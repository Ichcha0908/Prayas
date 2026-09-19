/**
 * Mock implementations of every endpoint in the API contract.
 *
 * Each function here returns EXACTLY the shape declared in `../types.ts`, so
 * switching `VITE_DATA_SOURCE` to `live` swaps the data source with zero
 * component changes. Treat this file as the reference implementation the Python
 * backend should reproduce.
 */

import type {
  CalendarDay,
  CalendarMarker,
  CalendarResponse,
  CashflowDay,
  CashflowResponse,
  ChatRequest,
  ChatResponse,
  Driver,
  FestivalWindow,
  ForecastDay,
  ForecastResponse,
  ForecastWindow,
  Insight,
  InsightsResponse,
  ISODate,
  ResilienceResponse,
  ResponseMeta,
  RiskBand,
  RiskResponse,
  SavingWindow,
  StressTestRequest,
  StressTestResponse,
  UserResponse,
} from '../types';
import {
  addDays,
  analyseDayOfWeek,
  analyseFestivals,
  analyseRainEffect,
  buildDriverSpec,
  buildHistory,
  clamp,
  DAY_LABELS_FULL,
  dayLabel,
  daysBetween,
  festivalOn,
  forecastDays,
  fromISO,
  makeRng,
  hashSeed,
  mean,
  NEUTRAL_CONTEXT,
  normalCdf,
  obligationsInRange,
  percentile,
  REAL_PETROL_PRICE_PER_LITRE,
  summariseHistory,
  toISO,
  today,
  windowSigma,
  type DailyRecord,
  type DriverSpec,
  type ForecastContext,
  type ForecastPoint,
  type HistorySummary,
} from './engine';

/* ------------------------------------------------------------------- meta */

const MODEL_NAME = 'kamai_hybrid_v1';
const MODEL_VERSION = '1.0.0-demo';

function buildMeta(records: DailyRecord[], overrides: Partial<ResponseMeta> = {}): ResponseMeta {
  return {
    model: MODEL_NAME,
    model_version: MODEL_VERSION,
    // Honest: the in-browser engine is a statistical model, not a trained one.
    is_model_backed: false,
    generated_at: new Date().toISOString(),
    data_through: records[records.length - 1]?.date ?? toISO(today()),
    disclaimer:
      'Demo mode: figures come from a deterministic synthetic dataset and an in-browser statistical forecaster, not a trained model.',
    ...overrides,
  };
}

/* ------------------------------------------------------------ risk banding */

export function bandFor(probability: number): RiskBand {
  if (probability < 0.3) return 'low';
  if (probability < 0.6) return 'moderate';
  if (probability < 0.8) return 'high';
  return 'critical';
}

/* ----------------------------------------------------------- shared core */

/**
 * Everything the endpoints need, computed once and consistently.
 * The real backend should have the equivalent single source of truth so that
 * /forecast, /cashflow, /risk and /resilience can never disagree with each other.
 */
export interface Core {
  spec: DriverSpec;
  records: DailyRecord[];
  summary: HistorySummary;
  anchor: Date;
  points: ForecastPoint[];
  context: ForecastContext;
  obligations: { id: string; label: string; amount: number; date: ISODate; category: 'rent' | 'emi' | 'utilities' | 'family' | 'other'; isCritical: boolean }[];
  monthlyObligations: number;
  buffer: BufferResult;
}

const HORIZON = 28;

export function buildCore(driverId: string, context: ForecastContext = NEUTRAL_CONTEXT): Core {
  const spec = buildDriverSpec(driverId);
  const anchor = today();
  const records = buildHistory(spec, anchor);
  const summary = summariseHistory(records);
  const points = forecastDays(spec, records, HORIZON, context, anchor);
  const obligations = obligationsInRange(spec, anchor, HORIZON);
  const monthlyObligations =
    spec.finances.rent + spec.finances.emi + spec.finances.utilities + spec.finances.family;

  const core: Omit<Core, 'buffer'> = {
    spec,
    records,
    summary,
    anchor,
    points,
    context,
    obligations,
    monthlyObligations,
  };

  return { ...core, buffer: computeBuffer(core) };
}

function sumIncome(points: ForecastPoint[]): number {
  return Math.round(points.reduce((a, p) => a + p.expected, 0));
}

function sumEssentials(points: ForecastPoint[]): number {
  return Math.round(points.reduce((a, p) => a + p.essentialSpend, 0));
}

function obligationsWithin(core: Omit<Core, 'buffer'>, fromDay: number, toDay: number): number {
  const start = toISO(addDays(core.anchor, fromDay));
  const end = toISO(addDays(core.anchor, toDay));
  return core.obligations
    .filter((o) => o.date >= start && o.date <= end)
    .reduce((a, o) => a + o.amount, 0);
}

/* ---------------------------------------------------- resilience buffer */

export interface BufferResult {
  target: number;
  components: ResilienceResponse['components'];
  /** Days of essential spend the driver's current savings would cover. */
  daysOfCover: number;
  targetDaysOfCover: number;
}

/**
 * The minimum resilience buffer.
 * =========================================================================
 * Deliberately NOT "three months of expenses" — the whole point is that the
 * number tracks THIS driver's income volatility and THIS month's obligations.
 *
 *   A  expected_shortfall    max(0, essentials(14d) - expected income(14d))
 *   B  critical_expenses     one recovery week of essential spend
 *   C  uncertainty_margin    0.84 x sigma(14d)  — one-sided 80% forecast error
 *   D  fixed_obligations     rent/EMI/bills falling due in the next 21 days
 *   E  recovery_margin       0.6 x (median week - 10th-percentile week)
 *   F  safe_expected_income  p20 of forecast income, CAPPED AT (A + D)
 *
 *   target = max(A + B + C + D + E - F, floor)
 *
 * F is capped so that a strong forecast can cancel the obligations you are
 * about to pay, but can never drive the buffer to zero. The floor is five days
 * of essentials plus any critical obligation landing inside the next 14 days.
 * =========================================================================
 */
function computeBuffer(core: Omit<Core, 'buffer'>): BufferResult {
  const { spec, summary, points } = core;
  const next14 = points.slice(0, 14);

  const essentials14 = sumEssentials(next14);
  const income14 = sumIncome(next14);
  const sigma14 = windowSigma(next14);
  const dailyEssential = summary.avgDailyEssentialSpend || 650;

  const RECOVERY_DAYS = 7;

  const a = Math.max(0, essentials14 - income14);
  const b = Math.round(dailyEssential * RECOVERY_DAYS);
  const c = Math.round(0.8416 * sigma14);
  const d = obligationsWithin(core, 1, 21);
  const e = Math.round(Math.max(0, summary.medianWeeklyIncome - summary.p10WeeklyIncome) * 0.6);
  const p20Income = Math.max(0, income14 - 1.2816 * sigma14);
  const f = Math.round(Math.min(p20Income, a + d));

  const raw = a + b + c + d + e - f;

  const criticalSoon = core.obligations
    .filter((o) => o.isCritical && daysBetween(toISO(core.anchor), o.date) <= 14)
    .reduce((acc, o) => Math.max(acc, o.amount), 0);
  const floor = Math.round(dailyEssential * 5 + criticalSoon);

  const target = Math.round(Math.max(raw, floor) / 10) * 10;

  const components: ResilienceResponse['components'] = [
    {
      key: 'expected_shortfall',
      label: 'Expected shortfall',
      amount: a,
      sign: 1,
      explanation:
        a > 0
          ? `Your forecast income for the next 14 days is ₹${(essentials14 - income14).toLocaleString('en-IN')} short of your day-to-day essentials.`
          : 'Your forecast income covers your day-to-day essentials for the next 14 days, so nothing is added here.',
    },
    {
      key: 'critical_expenses',
      label: 'Essential expenses during recovery',
      amount: b,
      sign: 1,
      explanation: `One recovery week of essential spend at your running average of ₹${dailyEssential.toLocaleString('en-IN')} a day.`,
    },
    {
      key: 'uncertainty_margin',
      label: 'Forecast uncertainty margin',
      amount: c,
      sign: 1,
      explanation: `Covers 80% of the forecast error on a 14-day view. Your income spread is ±₹${sigma14.toLocaleString('en-IN')} over this window.`,
    },
    {
      key: 'fixed_obligations',
      label: 'Fixed obligations due',
      amount: d,
      sign: 1,
      explanation: `Rent, EMI and bills totalling ₹${d.toLocaleString('en-IN')} fall due within the next 21 days.`,
    },
    {
      key: 'recovery_margin',
      label: 'Bad-week recovery margin',
      amount: e,
      sign: 1,
      explanation: `Your weakest weeks run about ₹${Math.max(0, summary.medianWeeklyIncome - summary.p10WeeklyIncome).toLocaleString('en-IN')} below a typical week. This carries part of that gap.`,
    },
    {
      key: 'safe_expected_income',
      label: 'Income you can safely count on',
      amount: f,
      sign: -1,
      explanation: `The income you would still earn in a bad-but-not-worst 14 days. It offsets what you are about to pay out, but is capped so the target never falls to zero.`,
    },
  ];

  return {
    target,
    components,
    daysOfCover: Math.round((spec.finances.currentSavings / dailyEssential) * 10) / 10,
    targetDaysOfCover: Math.round((target / dailyEssential) * 10) / 10,
  };
}

/* --------------------------------------------------- shortfall probability */

/**
 * Probability that a window's income lands below what the window has to carry.
 * The obligation load is amortised across the month rather than shock-loaded
 * into whichever week rent happens to fall in — otherwise every rent week reads
 * as 100% risk and the signal is useless. The cashflow chart still shows the
 * real lumpy timing.
 */
function shortfallProbability(
  core: Omit<Core, 'buffer'>,
  points: ForecastPoint[],
  /** One-off outflow the window also has to carry, e.g. an emergency expense. */
  extraOutflow = 0,
): {
  probability: number;
  required: number;
  mu: number;
  sigma: number;
} {
  const days = points.length;
  const essentials = sumEssentials(points);
  const amortised = Math.round((core.monthlyObligations * days) / 30);
  // A one-off cost is amortised across the month like the fixed obligations,
  // so a single week is not asked to absorb the whole shock at once.
  const amortisedExtra = Math.round((extraOutflow * days) / 30);
  const required = essentials + amortised + amortisedExtra;
  const mu = sumIncome(points);
  const sigma = Math.max(1, windowSigma(points));
  return { probability: clamp(normalCdf((required - mu) / sigma), 0.01, 0.99), required, mu, sigma };
}

/* ----------------------------------------------------------- explanations */

/**
 * Feature-grounded drivers for the "Why?" explainers.
 * Every entry names the measured feature and its measured effect — never
 * "the model detected a pattern".
 */
function buildDrivers(core: Omit<Core, 'buffer'>, points: ForecastPoint[]): Driver[] {
  const { records, summary } = core;
  const dowStats = analyseDayOfWeek(records);
  const rain = analyseRainEffect(records);
  const drivers: Driver[] = [];

  // 1. Weather load across the horizon.
  const wetDays = points.filter((p) => p.weather.rainfallMm >= 15);
  if (wetDays.length) {
    const impact = Math.round(wetDays.reduce((a, p) => a + p.weatherImpact, 0));
    drivers.push({
      key: 'rain_days',
      label: `${wetDays.length} heavy-rain ${wetDays.length === 1 ? 'day' : 'days'} forecast`,
      impact_amount: impact,
      impact_pct: sumIncome(points) ? impact / sumIncome(points) : 0,
      direction: impact < 0 ? 'decrease' : 'increase',
      explanation: `On days with 15mm or more rainfall, your income has averaged ${formatPct(rain.deltaPct)} versus your dry days across ${rain.rainySamples} observations.`,
      evidence: 'historical',
    });
  }

  // 2. Day-of-week composition.
  const weekdayAvg = mean(dowStats.filter((d) => d.samples > 0).map((d) => d.meanIncome));
  const weakest = [...dowStats].filter((d) => d.samples > 2).sort((a, b) => a.meanIncome - b.meanIncome)[0];
  if (weakest && weekdayAvg) {
    const delta = weakest.meanIncome / weekdayAvg - 1;
    const count = points.filter((p) => p.dow === weakest.dow).length;
    drivers.push({
      key: `dow_${DAY_LABELS_FULL[weakest.dow].toLowerCase()}`,
      label: `${DAY_LABELS_FULL[weakest.dow]} is your weakest day`,
      impact_amount: Math.round((weakest.meanIncome - weekdayAvg) * count),
      impact_pct: delta,
      direction: delta < 0 ? 'decrease' : 'increase',
      explanation: `${DAY_LABELS_FULL[weakest.dow]} income has averaged ₹${weakest.meanIncome.toLocaleString('en-IN')}, ${formatPct(delta)} against your all-day average, over ${weakest.samples} ${DAY_LABELS_FULL[weakest.dow]}s.`,
      evidence: 'historical',
    });
  }

  // 3. Planned rest days.
  const restDays = points.filter((p) => p.isRestDay).length;
  if (restDays) {
    const lost = Math.round(summary.medianDailyIncome * restDays);
    drivers.push({
      key: 'rest_days',
      label: `${restDays} non-working ${restDays === 1 ? 'day' : 'days'} in this window`,
      impact_amount: -lost,
      impact_pct: -restDays / points.length,
      direction: 'decrease',
      explanation: `Each non-working day removes about ₹${summary.medianDailyIncome.toLocaleString('en-IN')}, your median earning day, from the window.`,
      evidence: 'forecast',
    });
  }

  // 4. Festival uplift.
  const festivalDays = points.filter((p) => p.festival);
  if (festivalDays.length) {
    const name = festivalDays[0].festival as string;
    const effect = analyseFestivals(records).find((f) => f.name === name);
    const impact = Math.round(festivalDays.reduce((a, p) => a + (p.expected - p.historicalAverage), 0));
    drivers.push({
      key: `festival_${name.toLowerCase().replace(/\s+/g, '_')}`,
      label: `${name} window overlaps this forecast`,
      impact_amount: impact,
      impact_pct: effect?.upliftPct ?? 0,
      direction: impact >= 0 ? 'increase' : 'decrease',
      explanation: effect
        ? `In your history, ${name} days earned ${formatPct(effect.upliftPct)} against the same weekdays outside the festival window, across ${effect.samples} observations.`
        : `${name} falls inside this window, but your history has too few observations to estimate an effect.`,
      evidence: 'historical',
    });
  }

  // 5. Recent volatility shift.
  if (summary.volatilityIndex > 0) {
    const change = summary.recentVolatilityIndex / summary.volatilityIndex - 1;
    if (Math.abs(change) > 0.05) {
      drivers.push({
        key: 'recent_volatility',
        label: change > 0 ? 'Your income has become more volatile' : 'Your income has become steadier',
        impact_amount: 0,
        impact_pct: change,
        direction: change > 0 ? 'decrease' : 'increase',
        explanation: `Your last 14 days swung ${formatPct(change)} against your longer-run pattern, which widens the range on every day in this forecast.`,
        evidence: 'historical',
      });
    }
  }

  // 6. Upcoming obligations.
  const soon = core.obligations.filter((o) => daysBetween(toISO(core.anchor), o.date) <= points.length);
  if (soon.length) {
    const total = soon.reduce((a, o) => a + o.amount, 0);
    const nearest = soon[0];
    drivers.push({
      key: 'upcoming_obligations',
      label: `₹${total.toLocaleString('en-IN')} of fixed costs due in this window`,
      impact_amount: -total,
      impact_pct: 0,
      direction: 'decrease',
      explanation: `${nearest.label} of ₹${nearest.amount.toLocaleString('en-IN')} is due in ${daysBetween(toISO(core.anchor), nearest.date)} days, which is what pulls your projected balance toward the buffer line.`,
      evidence: 'forecast',
    });
  }

  return drivers.sort((a, b) => Math.abs(b.impact_amount) - Math.abs(a.impact_amount)).slice(0, 5);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value * 100).toFixed(0)}%`;
}

/* ------------------------------------------------------------ GET /user */

export function getUser(driverId: string): UserResponse {
  const core = buildCore(driverId);
  const { spec, summary, records } = core;

  return {
    profile: {
      driver_id: spec.driverId,
      name: spec.name,
      role: 'Delivery Partner',
      city: spec.city,
      zone: spec.zone,
      experience_years: spec.experienceYears,
      typical_working_days: spec.typicalWorkingDays,
      avatar_initials: spec.name.slice(0, 2).toUpperCase(),
      joined_on: spec.joinedOn,
    },
    financials: {
      current_savings: spec.finances.currentSavings,
      avg_monthly_income: summary.avgMonthlyIncome,
      avg_daily_income: Math.round(summary.avgMonthlyIncome / 30),
      median_daily_income: summary.medianDailyIncome,
      income_std_dev: summary.stdDevDaily,
      volatility_index: summary.volatilityIndex,
      monthly_essential_expenses: Math.round(summary.avgDailyEssentialSpend * 30 + core.monthlyObligations),
      avg_daily_essential_spend: summary.avgDailyEssentialSpend,
      expense_breakdown: {
        rent: spec.finances.rent,
        emi: spec.finances.emi,
        food: Math.round(spec.finances.dailyFood * 30),
        fuel: Math.round(spec.finances.dailyFuel * spec.typicalWorkingDays * 4.33),
        utilities: spec.finances.utilities,
        family: spec.finances.family,
        other: 0,
      },
    },
    upcoming_obligations: core.obligations.slice(0, 6).map((o) => ({
      id: o.id,
      label: o.label,
      amount: o.amount,
      due_date: o.date,
      category: o.category,
      is_critical: o.isCritical,
    })),
    meta: buildMeta(records),
  };
}

/* -------------------------------------------------------- GET /forecast */

function buildWindow(
  core: Omit<Core, 'buffer'>,
  points: ForecastPoint[],
  horizon: 7 | 14,
): ForecastWindow {
  const { summary } = core;
  const expected = sumIncome(points);
  const sigma = windowSigma(points);
  const { probability, required } = shortfallProbability(core, points);

  // "Normal" = this driver's own typical window of the same length, which is
  // the day-of-week baseline with no weather or festival adjustment.
  const dowStats = analyseDayOfWeek(core.records);
  const normal = Math.round(
    points.reduce((acc, p) => acc + (p.isRestDay ? 0 : dowStats[p.dow].meanIncome || summary.avgDailyIncome), 0),
  );

  const delta = expected - normal;
  const drivers = buildDrivers(core, points);
  const essentials = sumEssentials(points);

  const band = bandFor(probability);
  const direction = delta < -normal * 0.04 ? 'weaker' : delta > normal * 0.04 ? 'stronger' : 'about normal';
  const headline =
    direction === 'about normal'
      ? `Your income looks about normal over the next ${horizon} days.`
      : `Your income looks ${direction} over the next ${horizon} days.`;

  return {
    horizon_days: horizon,
    expected_income: expected,
    lower_bound: Math.max(0, Math.round(expected - 1.2816 * sigma)),
    upper_bound: Math.round(expected + 1.2816 * sigma),
    normal_expected_income: normal,
    delta_vs_normal: delta,
    delta_vs_normal_pct: normal ? delta / normal : 0,
    expected_essential_spend: essentials,
    potential_shortfall: Math.max(0, required - expected),
    shortfall_probability: Math.round(probability * 100) / 100,
    risk_band: band,
    confidence: Math.round(mean(points.map((p) => p.confidence)) * 100) / 100,
    drivers,
    headline,
  };
}

function toForecastDay(point: ForecastPoint): ForecastDay {
  const dayProb = point.isRestDay
    ? 1
    : clamp(normalCdf((point.essentialSpend - point.expected) / Math.max(1, point.sigma)), 0.01, 0.99);
  return {
    date: point.date,
    day_label: dayLabel(point.date),
    day_of_week: point.dow,
    expected_income: point.expected,
    lower_bound: point.lower,
    upper_bound: point.upper,
    historical_average: point.historicalAverage,
    expected_essential_spend: point.essentialSpend,
    is_planned_rest_day: point.isRestDay,
    weather: {
      code: point.weather.code,
      label: point.weather.label,
      rainfall_mm: point.weather.rainfallMm,
      temp_c: point.weather.tempC,
      income_impact: point.weatherImpact,
    },
    festival: point.festival ? { name: point.festival, is_festival_window: point.isFestivalWindow } : null,
    demand_index: point.demandIndex,
    day_shortfall_probability: Math.round(dayProb * 100) / 100,
    confidence: point.confidence,
  };
}

export function getForecast(driverId: string, context: ForecastContext = NEUTRAL_CONTEXT): ForecastResponse {
  const core = buildCore(driverId, context);
  const next7 = core.points.slice(0, 7);
  const next14 = core.points.slice(0, 14);

  // Naive baseline: mean of the last 7 observed days, projected flat.
  const lastSeven = core.records.slice(-7).reduce((a, r) => a + r.income, 0);

  return {
    driver_id: driverId,
    generated_for: toISO(core.anchor),
    days: next14.map((p) => toForecastDay(p)),
    window_7d: buildWindow(core, next7, 7),
    window_14d: buildWindow(core, next14, 14),
    baseline_7d: { expected_income: lastSeven, method: 'trailing_7_day_moving_average' },
    // Honest: no trained model has been evaluated in demo mode, so no metrics.
    model_performance: null,
    meta: buildMeta(core.records),
  };
}

/* -------------------------------------------------------- GET /cashflow */

function buildCashflowDays(core: Core, horizon: number, startingBalance: number, extraExpense = 0): CashflowDay[] {
  const points = core.points.slice(0, horizon);
  let balance = startingBalance;
  let lowerBalance = startingBalance;
  let upperBalance = startingBalance;

  return points.map((p, idx) => {
    const dueToday = core.obligations.filter((o) => o.date === p.date);
    const obligations = dueToday.reduce((a, o) => a + o.amount, 0);
    // An emergency expense, when simulated, lands on day 2 of the horizon.
    const emergency = idx === 1 ? extraExpense : 0;
    const outflow = p.essentialSpend + obligations + emergency;
    const net = p.expected - outflow;

    balance += net;
    lowerBalance += p.lower - outflow;
    upperBalance += p.upper - outflow;

    const labels = dueToday.map((o) => o.label);
    if (emergency) labels.push('Unexpected expense');

    return {
      date: p.date,
      day_label: dayLabel(p.date),
      income: p.expected,
      income_lower: p.lower,
      income_upper: p.upper,
      essential_spend: p.essentialSpend,
      obligations: obligations + emergency,
      obligation_labels: labels,
      net: Math.round(net),
      closing_balance: Math.round(balance),
      balance_lower: Math.round(lowerBalance),
      balance_upper: Math.round(upperBalance),
      below_buffer: balance < core.buffer.target,
      weather_code: p.weather.code,
      festival: p.festival,
    };
  });
}

export function getCashflow(
  driverId: string,
  horizon = 7,
  context: ForecastContext = NEUTRAL_CONTEXT,
): CashflowResponse {
  const core = buildCore(driverId, context);
  const start = core.spec.finances.currentSavings;
  const days = buildCashflowDays(core, horizon, start);

  const ending = days.length ? days[days.length - 1].closing_balance : start;
  const lowestDay = days.reduce((min, d) => (d.closing_balance < min.closing_balance ? d : min), days[0]);
  // The trough is what breaks a week, so the gap is measured from the lowest
  // projected balance rather than the final day's closing balance.
  const lowest = lowestDay ? lowestDay.closing_balance : start;
  const gap = lowest - core.buffer.target;
  const { probability } = shortfallProbability(core, core.points.slice(0, horizon));

  return {
    driver_id: driverId,
    horizon_days: horizon,
    starting_balance: start,
    projected_ending_balance: ending,
    lowest_projected_balance: lowest,
    lowest_balance_date: lowestDay?.date ?? toISO(core.anchor),
    buffer_target: core.buffer.target,
    gap_to_buffer: gap,
    status_message:
      gap < 0
        ? `You are ₹${Math.abs(gap).toLocaleString('en-IN')} below your estimated resilience target.`
        : `You are ₹${gap.toLocaleString('en-IN')} above your estimated resilience target.`,
    risk_band: bandFor(probability),
    days,
    meta: buildMeta(core.records),
  };
}

/* ------------------------------------------------------------ GET /risk */

export function getRisk(driverId: string, context: ForecastContext = NEUTRAL_CONTEXT): RiskResponse {
  const core = buildCore(driverId, context);
  const { summary, records } = core;

  const windows = ([7, 14] as const).map((h) => {
    const pts = core.points.slice(0, h);
    const { probability, required, mu } = shortfallProbability(core, pts);
    return {
      horizon_days: h,
      shortfall_probability: Math.round(probability * 100) / 100,
      risk_band: bandFor(probability),
      expected_income: mu,
      required_income: required,
      projected_gap: Math.max(0, required - mu),
      confidence: Math.round(mean(pts.map((p) => p.confidence)) * 100) / 100,
    };
  });

  const working = core.points.slice(0, 7).filter((p) => !p.isRestDay);
  const worst = working.reduce((w, p) => (p.expected - p.essentialSpend < w.expected - w.essentialSpend ? p : w), working[0] ?? core.points[0]);
  const dowStats = analyseDayOfWeek(records);
  const weekAvg = mean(dowStats.filter((d) => d.samples > 0).map((d) => d.meanIncome));

  const worstReasons: string[] = [];
  if (worst) {
    const dowDelta = weekAvg ? dowStats[worst.dow].meanIncome / weekAvg - 1 : 0;
    if (dowDelta < -0.05) {
      worstReasons.push(`${DAY_LABELS_FULL[worst.dow]} income runs ${formatPct(dowDelta)} against your weekly average`);
    }
    if (worst.weather.rainfallMm >= 15) {
      worstReasons.push(`${worst.weather.rainfallMm}mm of rain is forecast`);
    }
    if (worst.expected < worst.essentialSpend) {
      worstReasons.push('forecast income does not cover that day’s essentials');
    }
  }

  const volChange = summary.volatilityIndex ? summary.recentVolatilityIndex / summary.volatilityIndex - 1 : 0;

  return {
    driver_id: driverId,
    overall_band: windows[0].risk_band,
    windows,
    worst_day: {
      date: worst?.date ?? toISO(core.anchor),
      day_label: worst ? dayLabel(worst.date) : '—',
      expected_income: worst?.expected ?? 0,
      reason: worstReasons.length
        ? `${worstReasons.join(', and ')}.`
        : 'This is the thinnest margin between forecast income and essential spend in the window.',
    },
    volatility: {
      current_index: summary.recentVolatilityIndex,
      baseline_index: summary.volatilityIndex,
      change_pct: Math.round(volChange * 1000) / 1000,
      interpretation:
        volChange > 0.05
          ? `Your last 14 days were ${formatPct(volChange)} more variable than your longer-run pattern, so the forecast range is wider than usual.`
          : volChange < -0.05
            ? `Your last 14 days were steadier than your longer-run pattern, which narrows the forecast range.`
            : 'Your recent variability is in line with your longer-run pattern.',
    },
    drivers: buildDrivers(core, core.points.slice(0, 7)),
    meta: buildMeta(records),
  };
}

/* ------------------------------------------------------ GET /resilience */

export function getResilience(driverId: string, context: ForecastContext = NEUTRAL_CONTEXT): ResilienceResponse {
  const core = buildCore(driverId, context);
  const { buffer, spec, summary } = core;
  const gap = spec.finances.currentSavings - buffer.target;
  const { probability } = shortfallProbability(core, core.points.slice(0, 14));

  const obligations14 = obligationsWithin(core, 1, 14);
  const volChange = summary.volatilityIndex ? summary.recentVolatilityIndex / summary.volatilityIndex - 1 : 0;

  const reasons: string[] = [];
  if (volChange > 0.05) reasons.push(`your income has been ${formatPct(volChange)} more variable than usual`);
  if (obligations14 > 0) reasons.push(`₹${obligations14.toLocaleString('en-IN')} of fixed costs fall due within the next 14 days`);
  const wetDays = core.points.slice(0, 14).filter((p) => p.weather.rainfallMm >= 15).length;
  if (wetDays > 1) reasons.push(`${wetDays} heavy-rain days sit inside the forecast window`);

  const weeklySurplus = Math.max(
    120,
    Math.round((summary.medianWeeklyIncome - summary.avgDailyEssentialSpend * 7 - core.monthlyObligations / 4.33) * 0.7),
  );

  return {
    driver_id: driverId,
    current_savings: spec.finances.currentSavings,
    buffer_target: buffer.target,
    gap,
    days_of_cover: buffer.daysOfCover,
    target_days_of_cover: buffer.targetDaysOfCover,
    components: buffer.components,
    narrative: reasons.length
      ? `Your estimated buffer is at ₹${buffer.target.toLocaleString('en-IN')} this fortnight because ${reasons.join(', and ')}.`
      : `Your estimated buffer is at ₹${buffer.target.toLocaleString('en-IN')}, in line with your usual income pattern and upcoming costs.`,
    suggested_weekly_saving: weeklySurplus,
    weeks_to_target: gap < 0 ? Math.ceil(Math.abs(gap) / weeklySurplus) : null,
    risk_band: bandFor(probability),
    meta: buildMeta(core.records),
  };
}

/* -------------------------------------------------------- GET /calendar */

export function getCalendar(driverId: string, daysBack = 30, daysForward = 60): CalendarResponse {
  const core = buildCore(driverId);
  const { spec, records, summary } = core;
  const dowStats = analyseDayOfWeek(records);
  const festivalEffects = analyseFestivals(records);
  const anchorISO = toISO(core.anchor);

  // Extend the forecast far enough to cover the requested forward range.
  const forwardPoints = forecastDays(spec, records, daysForward, NEUTRAL_CONTEXT, core.anchor);
  const forwardObligations = obligationsInRange(spec, core.anchor, daysForward);

  const days: CalendarDay[] = [];
  let runningBalance = spec.finances.currentSavings;

  // Past days — observed facts.
  const pastRecords = records.slice(-daysBack);
  for (const r of pastRecords) {
    const baseline = dowStats[r.dow].meanIncome || summary.avgDailyIncome;
    const delta = baseline ? r.income / baseline - 1 : 0;
    // Past days describe what happened. "Shortfall risk" is a forward-looking
    // concept, so a weak day that has already passed is marked as a swing
    // against its weekday average rather than as a risk.
    const markers: CalendarMarker[] = [];
    if (r.festival) markers.push('festival');
    if (delta > 0.12) markers.push('high_income');
    else if (delta < -0.15 || Math.abs(delta) > 0.3) markers.push('volatility');
    else markers.push('normal');

    days.push({
      date: r.date,
      markers,
      expected_income: baseline,
      historical_average: baseline,
      delta_pct: Math.round(delta * 1000) / 1000,
      weather: { code: r.weather.code, label: r.weather.label, rainfall_mm: r.weather.rainfallMm },
      demand_index: r.demandIndex,
      expected_expenses: r.essentialSpend,
      obligations: 0,
      projected_balance: 0,
      festival: r.festival,
      is_past: true,
      actual_income: r.income,
    });
  }

  // Future days — forecasts.
  for (const p of forwardPoints) {
    const due = forwardObligations.filter((o) => o.date === p.date).reduce((a, o) => a + o.amount, 0);
    runningBalance += p.expected - p.essentialSpend - due;

    const baseline = dowStats[p.dow].meanIncome || summary.avgDailyIncome;
    const delta = baseline ? p.expected / baseline - 1 : 0;
    const markers: CalendarMarker[] = [];
    if (p.festival) markers.push('festival');
    if (!p.isRestDay && delta > 0.1) markers.push('high_income');
    if (p.expected < p.essentialSpend + due) markers.push('shortfall_risk');
    if (p.sigma > (summary.stdDevDaily || 1) * 1.25) markers.push('volatility');
    if (!markers.length) markers.push('normal');

    days.push({
      date: p.date,
      markers,
      expected_income: p.expected,
      historical_average: baseline,
      delta_pct: Math.round(delta * 1000) / 1000,
      weather: { code: p.weather.code, label: p.weather.label, rainfall_mm: p.weather.rainfallMm },
      demand_index: p.demandIndex,
      expected_expenses: p.essentialSpend,
      obligations: due,
      projected_balance: Math.round(runningBalance),
      festival: p.festival,
      is_past: false,
      actual_income: null,
    });
  }

  // Festival windows that fall inside the forward range.
  const seen = new Set<string>();
  const festivals: FestivalWindow[] = [];
  for (const p of forwardPoints) {
    if (!p.festival || seen.has(p.festival)) continue;
    const hit = festivalOn(p.date);
    if (!hit) continue;
    seen.add(p.festival);

    const effect = festivalEffects.find((f) => f.name === p.festival);
    // Rest days would drag a festival window's range to zero, so the predicted
    // daily range describes the working days inside the window.
    const windowDays = forwardPoints.filter((q) => q.festival === p.festival && !q.isRestDay);
    const low = Math.round(mean(windowDays.map((q) => q.lower)));
    const high = Math.round(mean(windowDays.map((q) => q.upper)));
    const occurrence = hit.def.dates.find((d) => Math.abs(daysBetween(d, p.date)) <= 7) ?? p.date;

    festivals.push({
      id: hit.def.id,
      name: p.festival,
      start_date: toISO(addDays(fromISO(occurrence), -hit.def.windowBefore)),
      end_date: toISO(addDays(fromISO(occurrence), hit.def.windowAfter)),
      historical_uplift_pct: effect ? Math.round(effect.upliftPct * 1000) / 1000 : 0,
      historical_normal_daily: effect?.normalMean ?? 0,
      historical_festival_daily: effect?.festivalMean ?? 0,
      observations: effect?.samples ?? 0,
      predicted_income_low: low,
      predicted_income_high: high,
      confidence: effect?.confidence ?? 0.4,
      note: effect
        ? `In your historical data, income during ${p.festival} was typically ${formatPct(effect.upliftPct)} against the same weekdays outside the window, across ${effect.samples} observations.`
        : `${p.festival} falls in this range, but your history does not yet have enough observations to estimate an effect.`,
    });
  }

  return {
    driver_id: driverId,
    range_start: days[0]?.date ?? anchorISO,
    range_end: days[days.length - 1]?.date ?? anchorISO,
    days,
    festivals,
    saving_windows: buildSavingWindows(core, forwardPoints, dowStats),
    meta: buildMeta(records),
  };
}

/* ------------------------------------------------- saving opportunities */

function buildSavingWindows(
  core: Core,
  points: ForecastPoint[],
  dowStats: ReturnType<typeof analyseDayOfWeek>,
): SavingWindow[] {
  const windows: SavingWindow[] = [];
  const WINDOW = 5;

  // Slide a 5-day window; keep the non-overlapping windows with the best surplus.
  const candidates: { start: number; expected: number; normal: number; surplus: number }[] = [];
  for (let i = 0; i + WINDOW <= points.length; i += 1) {
    const slice = points.slice(i, i + WINDOW);
    const expected = sumIncome(slice);
    const normal = Math.round(
      slice.reduce((acc, p) => acc + (p.isRestDay ? 0 : dowStats[p.dow].meanIncome || core.summary.avgDailyIncome), 0),
    );
    candidates.push({ start: i, expected, normal, surplus: expected - normal });
  }

  const chosen: typeof candidates = [];
  for (const c of [...candidates].sort((a, b) => b.surplus - a.surplus)) {
    if (c.surplus < 250) continue;
    if (chosen.some((x) => Math.abs(x.start - c.start) < WINDOW)) continue;
    chosen.push(c);
    if (chosen.length === 3) break;
  }

  for (const c of chosen.sort((a, b) => a.start - b.start)) {
    const slice = points.slice(c.start, c.start + WINDOW);
    const festival = slice.find((p) => p.festival)?.festival ?? null;
    // Suggest banking roughly 60% of the surplus, rounded to a usable number.
    const suggested = Math.max(200, Math.round((c.surplus * 0.6) / 50) * 50);
    const before = core.spec.finances.currentSavings;

    windows.push({
      id: `sw-${slice[0].date}`,
      label: festival ? `${festival} earning window` : `Stronger stretch from ${dayLabel(slice[0].date)}`,
      start_date: slice[0].date,
      end_date: slice[slice.length - 1].date,
      expected_income: c.expected,
      normal_income: c.normal,
      potential_extra: c.surplus,
      suggested_saving: suggested,
      buffer_before: before,
      buffer_after: before + suggested,
      rationale: festival
        ? `Your forecast for this ${festival} window runs ₹${c.surplus.toLocaleString('en-IN')} above a typical ${WINDOW}-day stretch. Saving an additional ₹${suggested.toLocaleString('en-IN')} here would raise your projected buffer.`
        : `This ${WINDOW}-day stretch forecasts ₹${c.surplus.toLocaleString('en-IN')} above your usual, mostly from stronger weekend days. Saving an additional ₹${suggested.toLocaleString('en-IN')} here would raise your projected buffer.`,
    });
  }

  return windows;
}

/* ------------------------------------------------------ POST /stress-test */

function contextFrom(req: StressTestRequest): ForecastContext {
  const scenarios = req.scenarios ?? [];
  const extraHours: Record<number, number> = {};
  for (const e of req.extra_hours ?? []) extraHours[e.day_of_week] = e.hours;

  return {
    rainfallMultiplier: scenarios.includes('rain_shock')
      ? Math.max(req.rainfall_multiplier, 3)
      : req.rainfall_multiplier,
    incomeChangePct: clamp(req.income_change_pct, 0, 0.5),
    workingDays: clamp(Math.round(req.working_days), 1, 7),
    fuelCostIncreasePct: clamp(req.fuel_cost_increase_pct, 0, 0.3),
    forceFestival: scenarios.includes('diwali') ? 'Diwali' : null,
    extraHours,
  };
}

function toOutcome(core: Core, label: string, horizon: number, extraExpense: number): StressTestOutcomeInternal {
  const days = buildCashflowDays(core, horizon, core.spec.finances.currentSavings, extraExpense);
  const pts = core.points.slice(0, horizon);
  const { probability } = shortfallProbability(core, pts, extraExpense);
  const ending = days.length ? days[days.length - 1].closing_balance : core.spec.finances.currentSavings;
  const lowest = days.reduce((m, d) => Math.min(m, d.closing_balance), core.spec.finances.currentSavings);

  return {
    label,
    projected_income: sumIncome(pts),
    projected_expenses: days.reduce((a, d) => a + d.essential_spend + d.obligations, 0),
    projected_ending_balance: ending,
    lowest_balance: lowest,
    buffer_target: core.buffer.target,
    // Measured from the trough, matching /api/cashflow — the lowest point in
    // the week is what actually breaks a driver, not the closing day.
    gap_to_buffer: lowest - core.buffer.target,
    shortfall_probability: Math.round(probability * 100) / 100,
    risk_band: bandFor(probability),
    days,
  };
}

type StressTestOutcomeInternal = StressTestResponse['baseline'];

export function postStressTest(req: StressTestRequest): StressTestResponse {
  const horizon = 7;
  const baseCore = buildCore(req.driver_id, NEUTRAL_CONTEXT);
  const scenarioCore = buildCore(req.driver_id, contextFrom(req));

  const baseline = toOutcome(baseCore, 'Normal forecast', horizon, 0);
  const scenario = toOutcome(scenarioCore, scenarioLabel(req), horizon, Math.max(0, req.emergency_expense));

  const drivers: Driver[] = [];
  const scenarios = req.scenarios ?? [];

  if (req.income_change_pct > 0.005) {
    const impact = Math.round(-baseline.projected_income * req.income_change_pct);
    drivers.push({
      key: 'scenario_income_cut',
      label: `Income reduced by ${(req.income_change_pct * 100).toFixed(0)}%`,
      impact_amount: impact,
      impact_pct: -req.income_change_pct,
      direction: 'decrease',
      explanation: `Every forecast day is scaled down by ${(req.income_change_pct * 100).toFixed(0)}%, removing about ₹${Math.abs(impact).toLocaleString('en-IN')} across the week.`,
      evidence: 'scenario',
    });
  }

  if (req.working_days < 7) {
    const rest = 7 - req.working_days;
    drivers.push({
      key: 'scenario_working_days',
      label: `${req.working_days} working ${req.working_days === 1 ? 'day' : 'days'} in the week`,
      impact_amount: -Math.round(baseCore.summary.medianDailyIncome * rest),
      impact_pct: -rest / 7,
      direction: 'decrease',
      explanation: `Your ${rest} weakest earning weekday${rest === 1 ? '' : 's'} ${rest === 1 ? 'is' : 'are'} dropped first, each removing about ₹${baseCore.summary.medianDailyIncome.toLocaleString('en-IN')}.`,
      evidence: 'scenario',
    });
  }

  if (scenarios.includes('rain_shock') || req.rainfall_multiplier > 1.05) {
    const wet = scenarioCore.points.slice(0, horizon).filter((p) => p.weather.rainfallMm >= 15).length;
    const rain = analyseRainEffect(baseCore.records);
    drivers.push({
      key: 'scenario_rain',
      label: `${wet} heavy-rain ${wet === 1 ? 'day' : 'days'} in the simulated week`,
      impact_amount: Math.round(scenarioCore.points.slice(0, horizon).reduce((a, p) => a + p.weatherImpact, 0)),
      impact_pct: rain.deltaPct,
      direction: 'decrease',
      explanation: `Applied using your own measured rain effect: heavy-rain days in your history earned ${formatPct(rain.deltaPct)} against dry days across ${rain.rainySamples} observations.`,
      evidence: 'scenario',
    });
  }

  if (scenarios.includes('diwali')) {
    const effect = analyseFestivals(baseCore.records).find((f) => f.id === 'diwali');
    drivers.push({
      key: 'scenario_diwali',
      label: 'Diwali demand applied to the week',
      impact_amount: scenario.projected_income - baseline.projected_income,
      impact_pct: effect?.upliftPct ?? 0,
      direction: 'increase',
      explanation: effect
        ? `Uses the uplift measured from your own Diwali history: ${formatPct(effect.upliftPct)} against matched weekdays across ${effect.samples} observations.`
        : 'Applies a Diwali overlay, though your history has few Diwali observations so far.',
      evidence: 'scenario',
    });
  }

  if (req.emergency_expense > 0) {
    drivers.push({
      key: 'scenario_emergency',
      label: `₹${req.emergency_expense.toLocaleString('en-IN')} unexpected expense`,
      impact_amount: -req.emergency_expense,
      impact_pct: 0,
      direction: 'decrease',
      explanation: `A one-off cost lands early in the week, so it reduces every projected balance after that point.`,
      evidence: 'scenario',
    });
  }

  if (req.fuel_cost_increase_pct > 0.005) {
    const delta = scenario.projected_expenses - baseline.projected_expenses;
    const projectedPrice = REAL_PETROL_PRICE_PER_LITRE * (1 + req.fuel_cost_increase_pct);
    drivers.push({
      key: 'scenario_fuel',
      label: `Fuel cost up ${(req.fuel_cost_increase_pct * 100).toFixed(0)}%`,
      impact_amount: -Math.max(0, delta),
      impact_pct: -req.fuel_cost_increase_pct,
      direction: 'decrease',
      explanation: `Petrol in Delhi is ₹${REAL_PETROL_PRICE_PER_LITRE.toFixed(2)}/litre today (PPAC). A ${(req.fuel_cost_increase_pct * 100).toFixed(0)}% rise would put it near ₹${projectedPrice.toFixed(2)}/litre, raising outflow on every working day.`,
      evidence: 'scenario',
    });
  }

  if ((req.extra_hours ?? []).length) {
    const added = scenario.projected_income - baseline.projected_income;
    const e = (req.extra_hours ?? [])[0];
    drivers.push({
      key: 'scenario_extra_hours',
      label: `+${e.hours}h on ${DAY_LABELS_FULL[e.day_of_week]}`,
      impact_amount: Math.max(0, added),
      impact_pct: 0,
      direction: 'increase',
      explanation: `Extra hours are valued below your average hour, since the busiest slots are already worked.`,
      evidence: 'scenario',
    });
  }

  const endingDelta = scenario.projected_ending_balance - baseline.projected_ending_balance;

  return {
    driver_id: req.driver_id,
    baseline,
    scenario,
    deltas: {
      income: scenario.projected_income - baseline.projected_income,
      ending_balance: endingDelta,
      shortfall_probability: scenario.shortfall_probability - baseline.shortfall_probability,
      risk_band_changed: scenario.risk_band !== baseline.risk_band,
    },
    drivers,
    narrative: buildScenarioNarrative(req, baseline, scenario),
    meta: buildMeta(baseCore.records, {
      disclaimer:
        'Scenario output. These are simulated what-if figures under the settings you chose, not a prediction of what will happen.',
    }),
  };
}

function scenarioLabel(req: StressTestRequest): string {
  const scenarios = req.scenarios ?? [];
  if (scenarios.includes('diwali') && scenarios.includes('rain_shock')) return 'Diwali, then rain shock';
  if (scenarios.includes('diwali')) return 'Diwali week';
  if (scenarios.includes('rain_shock')) return 'Rain shock week';
  const parts: string[] = [];
  if (req.income_change_pct > 0.005) parts.push(`−${(req.income_change_pct * 100).toFixed(0)}% income`);
  if (req.emergency_expense > 0) parts.push(`₹${req.emergency_expense.toLocaleString('en-IN')} expense`);
  if (req.working_days !== 6) parts.push(`${req.working_days} working days`);
  return parts.length ? parts.join(' + ') : 'Your scenario';
}

function buildScenarioNarrative(
  req: StressTestRequest,
  baseline: StressTestOutcomeInternal,
  scenario: StressTestOutcomeInternal,
): string {
  const scenarios = req.scenarios ?? [];
  const endDelta = scenario.projected_ending_balance - baseline.projected_ending_balance;

  if (scenarios.includes('diwali') && scenarios.includes('rain_shock')) {
    return `Because your income was stronger during Diwali, you would enter this week with a larger balance. That balance now absorbs part of the predicted rain-related income shock, leaving you ₹${scenario.projected_ending_balance.toLocaleString('en-IN')} at the end of the week instead of running the shortfall on an empty buffer.`;
  }
  if (scenarios.includes('diwali')) {
    return `Under a Diwali week, projected income rises to ₹${scenario.projected_income.toLocaleString('en-IN')} against ₹${baseline.projected_income.toLocaleString('en-IN')} normally. This is the window where saving extra does the most work for your buffer.`;
  }
  if (scenarios.includes('rain_shock')) {
    return `Under a heavy-rain week, projected income falls to ₹${scenario.projected_income.toLocaleString('en-IN')} and shortfall risk moves to ${(scenario.shortfall_probability * 100).toFixed(0)}%. Your ending balance lands ₹${Math.abs(endDelta).toLocaleString('en-IN')} ${endDelta < 0 ? 'lower' : 'higher'} than normal.`;
  }
  if (endDelta === 0) {
    return 'This scenario matches your normal forecast. Move a slider to see how your week responds.';
  }
  return `Under this scenario your week ends at ₹${scenario.projected_ending_balance.toLocaleString('en-IN')}, ₹${Math.abs(endDelta).toLocaleString('en-IN')} ${endDelta < 0 ? 'below' : 'above'} your normal projection, and shortfall risk reads ${(scenario.shortfall_probability * 100).toFixed(0)}%.`;
}

/* -------------------------------------------------------- GET /insights */

export function getInsights(driverId: string): InsightsResponse {
  const core = buildCore(driverId);
  const { records, summary, buffer, spec } = core;
  const dowStats = analyseDayOfWeek(records);
  const rain = analyseRainEffect(records);
  const festivals = analyseFestivals(records);
  const insights: Insight[] = [];

  // 1. Strongest weekday.
  const ranked = [...dowStats].filter((d) => d.samples > 2).sort((a, b) => b.meanIncome - a.meanIncome);
  const weekAvg = mean(ranked.map((d) => d.meanIncome));
  if (ranked.length && weekAvg) {
    const best = ranked[0];
    const delta = best.meanIncome / weekAvg - 1;
    insights.push({
      id: 'strongest-day',
      rank: 1,
      category: 'pattern',
      title: `Your income is consistently stronger on ${DAY_LABELS_FULL[best.dow]}s.`,
      metric: { value: formatPct(delta), label: 'vs. your weekly average', direction: 'up' },
      evidence: `${best.samples} ${DAY_LABELS_FULL[best.dow]}s observed, averaging ₹${best.meanIncome.toLocaleString('en-IN')} against a weekly average of ₹${Math.round(weekAvg).toLocaleString('en-IN')}.`,
      explanation: `${DAY_LABELS_FULL[best.dow]} demand is the most reliable earning slot in your week. It is the cheapest place to add an hour when you need to rebuild your buffer.`,
      confidence: clamp(0.6 + best.samples * 0.012, 0.6, 0.93),
      sample_size: best.samples,
      kind: 'historical',
    });
  }

  // 2. Weakest weekday.
  if (ranked.length > 1 && weekAvg) {
    const worst = ranked[ranked.length - 1];
    const delta = worst.meanIncome / weekAvg - 1;
    insights.push({
      id: 'weakest-day',
      rank: 2,
      category: 'pattern',
      title: `${DAY_LABELS_FULL[worst.dow]}s are your thinnest earning day.`,
      metric: { value: formatPct(delta), label: 'vs. your weekly average', direction: 'down' },
      evidence: `${worst.samples} ${DAY_LABELS_FULL[worst.dow]}s observed, averaging ₹${worst.meanIncome.toLocaleString('en-IN')}.`,
      explanation: `A weak ${DAY_LABELS_FULL[worst.dow]} is normal for you rather than a warning sign. It matters most when it lands in the same week as a fixed payment.`,
      confidence: clamp(0.6 + worst.samples * 0.012, 0.6, 0.93),
      sample_size: worst.samples,
      kind: 'historical',
    });
  }

  // 3. Rain effect.
  if (rain.rainySamples >= 3) {
    insights.push({
      id: 'rain-effect',
      rank: 3,
      category: 'weather',
      title: `Your heavy-rain days earned ${formatPct(rain.deltaPct)} against your dry days.`,
      metric: { value: formatPct(rain.deltaPct), label: 'on days above 15mm rainfall', direction: rain.deltaPct < 0 ? 'down' : 'up' },
      evidence: `${rain.rainySamples} rain days averaging ₹${rain.rainyMean.toLocaleString('en-IN')}, against ₹${rain.dryMean.toLocaleString('en-IN')} on dry days.`,
      explanation: `This is the relationship measured in your own data — not a general claim about rain and delivery work. Hours worked fall on wet days, which explains most of the gap.`,
      confidence: clamp(0.5 + rain.rainySamples * 0.015, 0.5, 0.88),
      sample_size: rain.rainySamples,
      kind: 'historical',
    });
  }

  // 4. Best festival.
  if (festivals.length) {
    const top = festivals[0];
    insights.push({
      id: 'festival-uplift',
      rank: 4,
      category: 'festival',
      title: `${top.name} has historically been one of your strongest earning periods.`,
      metric: { value: formatPct(top.upliftPct), label: `vs. matched weekdays`, direction: top.upliftPct > 0 ? 'up' : 'down' },
      evidence: `${top.samples} ${top.name} days averaging ₹${top.festivalMean.toLocaleString('en-IN')}, against ₹${top.normalMean.toLocaleString('en-IN')} on the same weekdays outside the window.`,
      explanation: `Compared against the same weekdays so the weekend effect is not counted twice. Treat this as what happened before, not a guarantee of what happens next.`,
      confidence: top.confidence,
      sample_size: top.samples,
      kind: 'historical',
    });
  }

  // 5. Buffer coverage.
  insights.push({
    id: 'buffer-cover',
    rank: 5,
    category: 'buffer',
    title: `Your current buffer covers about ${Math.floor(buffer.daysOfCover)} days of essential expenses.`,
    metric: { value: `${Math.floor(buffer.daysOfCover)} days`, label: `target is ${Math.floor(buffer.targetDaysOfCover)} days`, direction: buffer.daysOfCover < buffer.targetDaysOfCover ? 'down' : 'up' },
    evidence: `₹${spec.finances.currentSavings.toLocaleString('en-IN')} in savings against essential spend of ₹${summary.avgDailyEssentialSpend.toLocaleString('en-IN')} a day.`,
    explanation: `The target is set by your own income volatility and the fixed costs due in the next three weeks, not by a generic months-of-expenses rule.`,
    confidence: 0.9,
    sample_size: summary.totalDays,
    kind: 'forecast',
  });

  // 6. Volatility shift.
  const volChange = summary.volatilityIndex ? summary.recentVolatilityIndex / summary.volatilityIndex - 1 : 0;
  if (Math.abs(volChange) > 0.04) {
    insights.push({
      id: 'volatility-shift',
      rank: 6,
      category: 'risk',
      title: volChange > 0
        ? `Your last 14 days were ${formatPct(volChange)} more variable than your normal pattern.`
        : `Your last 14 days were steadier than your normal pattern.`,
      metric: { value: formatPct(volChange), label: 'change in income variability', direction: volChange > 0 ? 'down' : 'up' },
      evidence: `Recent variation index ${summary.recentVolatilityIndex.toFixed(2)} against a longer-run ${summary.volatilityIndex.toFixed(2)} over ${summary.totalDays} days.`,
      explanation: `Higher variability widens the range on every forecast day, which is why your resilience target moves even when your average income has not changed.`,
      confidence: 0.76,
      sample_size: 14,
      kind: 'historical',
    });
  }

  // 7. Worst historical week — the severity the recovery margin is sized for.
  insights.push({
    id: 'worst-week',
    rank: 7,
    category: 'risk',
    title: `Your weakest week in this period came in at ₹${summary.worstWeekIncome.toLocaleString('en-IN')}.`,
    metric: {
      value: formatPct(summary.medianWeeklyIncome ? summary.worstWeekIncome / summary.medianWeeklyIncome - 1 : 0),
      label: 'vs. your median week',
      direction: 'down',
    },
    evidence: `Median week ₹${summary.medianWeeklyIncome.toLocaleString('en-IN')} across ${Math.floor(summary.totalDays / 7)} full weeks.`,
    explanation: `Your buffer's recovery margin is sized against this gap, so the target reflects how bad your bad weeks actually get rather than an assumed worst case.`,
    confidence: 0.85,
    sample_size: Math.floor(summary.totalDays / 7),
    kind: 'historical',
  });

  return { driver_id: driverId, insights, meta: buildMeta(records) };
}

/* ------------------------------------------------------------ POST /chat */

interface Intent {
  id: string;
  test: RegExp;
  answer: (core: Core, lastMessage: string) => { reply: string; citations: ChatResponse['citations']; route: string | null; followUps: string[] };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const INTENTS: Intent[] = [
  {
    id: 'earnings_next_week',
    test: /(how much).*(earn|make|income)|next week.*(earn|income)|earn.*next week/i,
    answer: (core) => {
      const w = buildWindow(core, core.points.slice(0, 7), 7);
      return {
        reply: `Over the next 7 days I expect **${inr(w.expected_income)}**, with a likely range of ${inr(w.lower_bound)} to ${inr(w.upper_bound)}.\n\nA typical week for you is ${inr(w.normal_expected_income)}, so this is ${w.delta_vs_normal < 0 ? `${inr(Math.abs(w.delta_vs_normal))} weaker` : `${inr(w.delta_vs_normal)} stronger`} than normal. Confidence on this window is ${(w.confidence * 100).toFixed(0)}%.`,
        citations: [
          { label: 'Expected 7-day income', value: inr(w.expected_income), kind: 'forecast' },
          { label: 'Your normal week', value: inr(w.normal_expected_income), kind: 'historical' },
        ],
        route: '/app/forecast',
        followUps: ['Why is next week weaker?', 'What is my worst projected day?'],
      };
    },
  },
  {
    id: 'worst_day',
    test: /(worst|weakest|riskiest|hardest).*(day)|which day.*(risk|bad|weak)/i,
    answer: (core) => {
      const risk = getRisk(core.spec.driverId);
      return {
        reply: `Your thinnest day this week is **${risk.worst_day.day_label}** (${risk.worst_day.date}), with expected income of ${inr(risk.worst_day.expected_income)}.\n\n${risk.worst_day.reason.charAt(0).toUpperCase()}${risk.worst_day.reason.slice(1)}`,
        citations: [{ label: `${risk.worst_day.day_label} forecast`, value: inr(risk.worst_day.expected_income), kind: 'forecast' }],
        route: '/app/cashflow',
        followUps: ['How much should I keep as a buffer?', 'What happens if my income drops 20%?'],
      };
    },
  },
  {
    id: 'why_risky',
    test: /why.*(risk|risky|weak|low|bad|drop|fall)|what.*(causing|driving)/i,
    answer: (core) => {
      const drivers = buildDrivers(core, core.points.slice(0, 7));
      const lines = drivers.slice(0, 4).map((d, i) => `${i + 1}. ${d.explanation}`).join('\n');
      return {
        reply: `Here is what is moving your forecast, largest effect first:\n\n${lines}`,
        citations: drivers.slice(0, 3).map((d) => ({
          label: d.label,
          value: d.impact_amount ? inr(d.impact_amount) : formatPct(d.impact_pct),
          kind: d.evidence,
        })),
        route: '/app/forecast',
        followUps: ['How much should I keep as a buffer?', 'When should I save more?'],
      };
    },
  },
  {
    id: 'expenses',
    test: /which expenses|what expenses|expenses.*(pressure|pushing|weigh)|pressure on my buffer|my (rent|emi|bills?)|spending|fixed costs?/i,
    answer: (core) => {
      const sorted = [...core.obligations].slice(0, 3);
      const lines = sorted
        .map((o) => `• ${o.label}: ${inr(o.amount)} due ${o.date} (in ${daysBetween(toISO(core.anchor), o.date)} days)`)
        .join('\n');
      const daily = core.summary.avgDailyEssentialSpend;
      return {
        reply: `Two things push on your buffer.\n\n**Fixed costs coming up:**\n${lines || '• Nothing due in the next four weeks.'}\n\n**Day-to-day essentials** run about ${inr(daily)} a day, roughly ${inr(daily * 30)} a month, mostly food and fuel. The fixed costs are what create the sharp dips in your cashflow chart; the daily spend is what sets how long your buffer lasts when income stops.`,
        citations: [
          { label: 'Daily essentials', value: inr(daily), kind: 'historical' },
          { label: 'Fixed monthly costs', value: inr(core.monthlyObligations), kind: 'historical' },
        ],
        route: '/app/cashflow',
        followUps: ['How much should I keep as a buffer?', 'What is my worst projected day?'],
      };
    },
  },
  {
    id: 'buffer',
    test: /how much.*(buffer|keep|set aside|save)|my buffer|resilience buffer|buffer target|emergency fund/i,
    answer: (core) => {
      const r = getResilience(core.spec.driverId);
      const parts = r.components
        .filter((c) => c.amount > 0)
        .map((c) => `• ${c.label}: ${c.sign === -1 ? '−' : ''}${inr(c.amount)}`)
        .join('\n');
      return {
        reply: `Your estimated resilience buffer right now is **${inr(r.buffer_target)}**. You currently hold ${inr(r.current_savings)}, so the gap is ${inr(Math.abs(r.gap))}.\n\n${parts}\n\n${r.narrative}`,
        citations: [
          { label: 'Buffer target', value: inr(r.buffer_target), kind: 'forecast' },
          { label: 'Current savings', value: inr(r.current_savings), kind: 'historical' },
          { label: 'Days of cover', value: `${Math.floor(r.days_of_cover)} days`, kind: 'forecast' },
        ],
        route: '/app/insights',
        followUps: ['When should I save more?', 'What happens if I have a ₹5,000 emergency?'],
      };
    },
  },
  {
    id: 'festival',
    test: /diwali|holi|eid|festival|christmas|raksha|dussehra|new year/i,
    answer: (core, lastMessage) => {
      const cal = getCalendar(core.spec.driverId);
      // Prefer the festival the question actually names, then the soonest one.
      const asked = cal.festivals.find((x) => new RegExp(x.name.split(' ')[0], 'i').test(lastMessage));
      const f = asked ?? cal.festivals[0];
      if (!f) {
        return {
          reply: `No festival window falls inside the next six weeks of your calendar. Your strongest upcoming stretches are weekend-driven instead.`,
          citations: [],
          route: '/app/calendar',
          followUps: ['When should I save more?', 'How much will I earn next week?'],
        };
      }
      return {
        reply: `**${f.name}** runs ${f.start_date} to ${f.end_date}.\n\n${f.note}\n\nFor that window I project ${inr(f.predicted_income_low)} to ${inr(f.predicted_income_high)} a day. This is where saving extra does the most work, because the money arrives before your next weak stretch rather than after it.`,
        citations: [
          { label: `${f.name} historical uplift`, value: formatPct(f.historical_uplift_pct), kind: 'historical' },
          { label: 'Observations behind it', value: `${f.observations} days`, kind: 'historical' },
        ],
        route: '/app/calendar',
        followUps: ['When should I save more?', 'How much should I keep as a buffer?'],
      };
    },
  },
  {
    id: 'save_more',
    test: /when.*(save|saving)|save more|saving window|best time to save/i,
    answer: (core) => {
      const cal = getCalendar(core.spec.driverId);
      const w = cal.saving_windows[0];
      if (!w) {
        return {
          reply: `I do not see a clearly stronger stretch in the next six weeks. In a flat period the practical move is a small fixed amount on your strongest weekday rather than waiting for a spike.`,
          citations: [],
          route: '/app/calendar',
          followUps: ['How much should I keep as a buffer?', 'Which expenses are putting pressure on my buffer?'],
        };
      }
      return {
        reply: `Your strongest saving window is **${w.start_date} to ${w.end_date}**.\n\nExpected income across it is ${inr(w.expected_income)} against a normal ${inr(w.normal_income)} — about ${inr(w.potential_extra)} extra.\n\nSaving an additional ${inr(w.suggested_saving)} during this higher-income period would take your projected buffer from ${inr(w.buffer_before)} to ${inr(w.buffer_after)}. That is a scenario, not a recommendation to commit to.`,
        citations: [
          { label: 'Window income', value: inr(w.expected_income), kind: 'forecast' },
          { label: 'Above normal by', value: inr(w.potential_extra), kind: 'forecast' },
        ],
        route: '/app/calendar',
        followUps: ['Will Diwali be a good week for me?', 'How much should I keep as a buffer?'],
      };
    },
  },
  {
    id: 'not_working',
    test: /(don'?t|do not|didn'?t|not).*(work|working)|skip.*(day|work)|take.*(day off|leave)/i,
    answer: (core) => {
      const res = postStressTest({
        driver_id: core.spec.driverId,
        income_change_pct: 0,
        working_days: 5,
        rainfall_multiplier: 1,
        emergency_expense: 0,
        fuel_cost_increase_pct: 0,
      });
      return {
        reply: `Dropping to 5 working days takes projected weekly income from ${inr(res.baseline.projected_income)} to ${inr(res.scenario.projected_income)}.\n\nYour week would end at ${inr(res.scenario.projected_ending_balance)} instead of ${inr(res.baseline.projected_ending_balance)}, and shortfall risk moves from ${(res.baseline.shortfall_probability * 100).toFixed(0)}% to ${(res.scenario.shortfall_probability * 100).toFixed(0)}%.\n\nThis is a scenario under settings I chose for you — open the stress test to change them.`,
        citations: [
          { label: 'Income change', value: inr(res.deltas.income), kind: 'scenario' },
          { label: 'Ending balance change', value: inr(res.deltas.ending_balance), kind: 'scenario' },
        ],
        route: '/app/stress-test',
        followUps: ['What happens if my income drops 20%?', 'How much should I keep as a buffer?'],
      };
    },
  },
  {
    id: 'income_drop',
    test: /(drop|fall|down|reduce|less|cut).*(\d{1,2})\s*%|20\s*%|income.*(drop|falls)/i,
    answer: (core) => {
      const res = postStressTest({
        driver_id: core.spec.driverId,
        income_change_pct: 0.2,
        working_days: 6,
        rainfall_multiplier: 1,
        emergency_expense: 0,
        fuel_cost_increase_pct: 0,
      });
      return {
        reply: `Under a 20% income reduction scenario, projected weekly income becomes ${inr(res.scenario.projected_income)} against ${inr(res.baseline.projected_income)} normally.\n\nYour ending balance lands at ${inr(res.scenario.projected_ending_balance)}, and shortfall risk reads ${(res.scenario.shortfall_probability * 100).toFixed(0)}% (${res.scenario.risk_band}).\n\nThat is a scenario, not a forecast of what will happen.`,
        citations: [
          { label: 'Scenario income', value: inr(res.scenario.projected_income), kind: 'scenario' },
          { label: 'Scenario ending balance', value: inr(res.scenario.projected_ending_balance), kind: 'scenario' },
        ],
        route: '/app/stress-test',
        followUps: ['What happens if I have a ₹5,000 emergency?', 'How much should I keep as a buffer?'],
      };
    },
  },
  {
    id: 'emergency',
    test: /emergency|unexpected|afford|sudden.*(expense|cost)|hospital|repair/i,
    answer: (core) => {
      const res = postStressTest({
        driver_id: core.spec.driverId,
        income_change_pct: 0,
        working_days: 6,
        rainfall_multiplier: 1,
        emergency_expense: 5000,
        fuel_cost_increase_pct: 0,
      });
      return {
        reply: `With a ₹5,000 unexpected expense this week, your projected ending balance goes from ${inr(res.baseline.projected_ending_balance)} to ${inr(res.scenario.projected_ending_balance)}, and your lowest point in the week drops to ${inr(res.scenario.lowest_balance)}.\n\nShortfall risk moves from ${(res.baseline.shortfall_probability * 100).toFixed(0)}% to ${(res.scenario.shortfall_probability * 100).toFixed(0)}%. Adding two hours on your strongest day recovers part of it — the stress test page lets you try that directly.`,
        citations: [
          { label: 'Ending balance after', value: inr(res.scenario.projected_ending_balance), kind: 'scenario' },
          { label: 'Lowest point', value: inr(res.scenario.lowest_balance), kind: 'scenario' },
        ],
        route: '/app/stress-test',
        followUps: ['When should I save more?', 'Which expenses are putting pressure on my buffer?'],
      };
    },
  },
];

export function postChat(req: ChatRequest): ChatResponse {
  const scenarios = req.scenarios ?? [];
  const context: ForecastContext = {
    ...NEUTRAL_CONTEXT,
    forceFestival: scenarios.includes('diwali') ? 'Diwali' : null,
    rainfallMultiplier: scenarios.includes('rain_shock') ? 3 : 1,
  };
  const core = buildCore(req.driver_id, context);
  const match = INTENTS.find((i) => i.test.test(req.message));

  if (!match) {
    const w = buildWindow(core, core.points.slice(0, 7), 7);
    const rng = makeRng(hashSeed(req.message));
    const suggestions = [
      'How much will I earn next week?',
      'How much should I keep as a buffer?',
      'When should I save more?',
      'What is my worst projected day?',
    ];
    return {
      reply: `I answer from your own forecast and history rather than general advice, so I can help with your income outlook, shortfall risk, buffer target, saving windows and what-if scenarios.\n\nRight now: expected income over the next 7 days is **${inr(w.expected_income)}** against a normal ${inr(w.normal_expected_income)}, with shortfall risk at ${(w.shortfall_probability * 100).toFixed(0)}%.\n\nTry one of the questions below.`,
      citations: [{ label: 'Expected 7-day income', value: inr(w.expected_income), kind: 'forecast' }],
      suggested_route: null,
      follow_ups: suggestions.sort(() => rng() - 0.5).slice(0, 3),
      meta: buildMeta(core.records),
    };
  }

  const result = match.answer(core, req.message);
  return {
    reply: result.reply,
    citations: result.citations,
    suggested_route: result.route,
    follow_ups: result.followUps,
    meta: buildMeta(core.records),
  };
}

/* ------------------------------------------------ misc exported helpers */

export { analyseRainEffect, analyseFestivals, analyseDayOfWeek, percentile };
