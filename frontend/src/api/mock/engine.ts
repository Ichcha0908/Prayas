/**
 * Deterministic synthetic data + forecasting engine.
 * =============================================================================
 * This is the client-side stand-in for the Python backend. It exists so the
 * product is fully demonstrable with no server running, and so the UI is built
 * against realistic, internally-consistent numbers rather than hand-written
 * fixtures.
 *
 * IMPORTANT DESIGN RULE — the thing that keeps the demo honest:
 * the generator injects effects (festival uplift, rain drag, day-of-week shape)
 * with noise, and the *analysis* layer below is only ever allowed to read the
 * generated `DailyRecord[]`. It never reads the injected constants back. So
 * every number the UI shows ("Diwali lifted your income 27%") is measured from
 * data, the way the real model will measure it — not echoed from a config.
 *
 * When the FastAPI backend is available this whole module is bypassed.
 * =============================================================================
 */

import type { ISODate, WeatherCode } from '../types';
import realWeatherFile from '../../data/weather-delhi-ncr.json';
import realFuelPriceFile from '../../data/fuel-price-delhi.json';

/* -------------------------------------------------------------- primitives */

/** mulberry32 — small, fast, deterministic PRNG. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller, so noise is Gaussian rather than uniform. */
function gauss(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1));
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp((sorted.length - 1) * p, 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Abramowitz-Stegun normal CDF — good to ~7 decimal places. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

/* ------------------------------------------------------------------- dates */

export function toISO(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayLabel(iso: ISODate): string {
  return DAY_LABELS[fromISO(iso).getDay()];
}

/** The engine's "today". Overridable so the demo can be pinned in tests. */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/* --------------------------------------------------------------- festivals */

export interface FestivalDef {
  id: string;
  name: string;
  /** Approximate observed dates. Demo data — not an authoritative calendar. */
  dates: ISODate[];
  /** Days before/after the date that still count as the earning window. */
  windowBefore: number;
  windowAfter: number;
  /** Latent uplift the GENERATOR injects. Analysis never reads this. */
  latentUplift: number;
}

export const FESTIVALS: FestivalDef[] = [
  { id: 'republic_day', name: 'Republic Day', dates: ['2025-01-26', '2026-01-26', '2027-01-26'], windowBefore: 1, windowAfter: 0, latentUplift: 0.06 },
  { id: 'new_year', name: 'New Year', dates: ['2025-01-01', '2026-01-01', '2027-01-01'], windowBefore: 2, windowAfter: 0, latentUplift: 0.24 },
  { id: 'holi', name: 'Holi', dates: ['2025-03-14', '2026-03-04', '2027-03-22'], windowBefore: 1, windowAfter: 1, latentUplift: 0.13 },
  { id: 'eid', name: 'Eid al-Fitr', dates: ['2025-03-31', '2026-03-20', '2027-03-10'], windowBefore: 2, windowAfter: 1, latentUplift: 0.17 },
  { id: 'independence_day', name: 'Independence Day', dates: ['2025-08-15', '2026-08-15', '2027-08-15'], windowBefore: 0, windowAfter: 0, latentUplift: 0.07 },
  { id: 'raksha_bandhan', name: 'Raksha Bandhan', dates: ['2025-08-09', '2026-08-28', '2027-08-17'], windowBefore: 2, windowAfter: 0, latentUplift: 0.15 },
  { id: 'ganesh_chaturthi', name: 'Ganesh Chaturthi', dates: ['2025-08-27', '2026-09-14', '2027-09-04'], windowBefore: 1, windowAfter: 2, latentUplift: 0.11 },
  { id: 'dussehra', name: 'Dussehra', dates: ['2025-10-02', '2026-10-20', '2027-10-09'], windowBefore: 2, windowAfter: 1, latentUplift: 0.16 },
  { id: 'diwali', name: 'Diwali', dates: ['2025-10-20', '2026-11-08', '2027-10-29'], windowBefore: 4, windowAfter: 2, latentUplift: 0.31 },
  { id: 'christmas', name: 'Christmas', dates: ['2025-12-25', '2026-12-25', '2027-12-25'], windowBefore: 3, windowAfter: 0, latentUplift: 0.19 },
];

export interface FestivalHit {
  def: FestivalDef;
  /** Day offset from the festival's own date, negative == before. */
  offset: number;
}

export function festivalOn(iso: ISODate): FestivalHit | null {
  for (const def of FESTIVALS) {
    for (const d of def.dates) {
      const offset = daysBetween(d, iso);
      if (offset >= -def.windowBefore && offset <= def.windowAfter) return { def, offset };
    }
  }
  return null;
}

/* ----------------------------------------------------------------- weather */

/** Delhi NCR-ish seasonality: monsoon Jul-Sep, dry winter, hot dry summer. */
function monsoonIntensity(month: number): number {
  // month is 0-indexed
  return [0.05, 0.05, 0.07, 0.05, 0.07, 0.22, 0.48, 0.52, 0.34, 0.1, 0.04, 0.04][month];
}

export interface WeatherObs {
  code: WeatherCode;
  label: string;
  rainfallMm: number;
  tempC: number;
}

export function weatherLabel(code: WeatherCode): string {
  switch (code) {
    case 'clear':
      return 'Clear';
    case 'partly_cloudy':
      return 'Partly cloudy';
    case 'cloudy':
      return 'Cloudy';
    case 'rain':
      return 'Light rain';
    case 'heavy_rain':
      return 'Heavy rain';
    case 'storm':
      return 'Thunderstorm';
  }
}

/**
 * Real historical weather for Delhi NCR (South Delhi — Saket), fetched from
 * Open-Meteo's ERA5 reanalysis archive by scripts/fetch-weather.mjs. Days not
 * covered by the file (the fetch script's lag window, and always the
 * forward-looking forecast horizon, since real future weather doesn't exist
 * yet) fall back to the synthetic generator below.
 *
 * This is what makes statements like "your heavy-rain days earned 21% less"
 * measured against real rainfall on real dates rather than synthetic noise —
 * re-run `npm run fetch:weather` periodically to extend coverage.
 */
interface RealWeatherFile {
  days: Record<string, { code: WeatherCode; rainfallMm: number; tempC: number }>;
}

const REAL_WEATHER: ReadonlyMap<ISODate, WeatherObs> = new Map(
  Object.entries((realWeatherFile as RealWeatherFile).days).map(([date, d]) => [
    date,
    { code: d.code, label: weatherLabel(d.code), rainfallMm: d.rainfallMm, tempC: d.tempC },
  ]),
);

function realWeatherOn(iso: ISODate): WeatherObs | undefined {
  return REAL_WEATHER.get(iso);
}

function generateWeather(date: Date, rng: () => number): WeatherObs {
  const month = date.getMonth();
  const wetness = monsoonIntensity(month);
  const roll = rng();

  let code: WeatherCode;
  let rainfallMm = 0;

  if (roll < wetness * 0.28) {
    code = 'storm';
    rainfallMm = 38 + rng() * 55;
  } else if (roll < wetness * 0.62) {
    code = 'heavy_rain';
    rainfallMm = 20 + rng() * 22;
  } else if (roll < wetness) {
    code = 'rain';
    rainfallMm = 3 + rng() * 14;
  } else if (roll < wetness + 0.16) {
    code = 'cloudy';
  } else if (roll < wetness + 0.4) {
    code = 'partly_cloudy';
  } else {
    code = 'clear';
  }

  // Seasonal temperature curve, peaking in May-June.
  const seasonal = 26 + 12 * Math.sin(((month - 3) / 12) * 2 * Math.PI);
  const tempC = Math.round(clamp(seasonal + gauss(rng) * 2.5 - (rainfallMm > 20 ? 4 : 0), 6, 47));

  return { code, label: weatherLabel(code), rainfallMm: Math.round(rainfallMm), tempC };
}

/** Latent multiplier the generator applies. Analysis measures this from data. */
function latentWeatherMultiplier(obs: WeatherObs, rng: () => number): number {
  const base =
    obs.code === 'storm' ? 0.7 : obs.code === 'heavy_rain' ? 0.81 : obs.code === 'rain' ? 0.93 : obs.code === 'cloudy' ? 1.0 : 1.01;
  return clamp(base + gauss(rng) * 0.05, 0.45, 1.2);
}

/* --------------------------------------------------------- driver profiles */

export interface DriverSpec {
  driverId: string;
  name: string;
  city: string;
  zone: string;
  experienceYears: number;
  typicalWorkingDays: number;
  /** Rupees per working day before context multipliers. */
  baseDailyIncome: number;
  /** Multiplicative noise sigma — the driver's intrinsic volatility. */
  volatility: number;
  /** Weekday the driver usually rests (0 = Sunday). */
  restDay: number;
  joinedOn: ISODate;
  finances: {
    rent: number;
    emi: number;
    dailyFood: number;
    dailyFuel: number;
    utilities: number;
    family: number;
    currentSavings: number;
  };
}

/**
 * Real Delhi retail petrol price, from PPAC (Ministry of Petroleum & Natural
 * Gas) — see src/data/fuel-price-delhi.json for the source, bulletin and
 * fetch date. Daily fuel cost is derived from this real price rather than
 * guessed as a flat rupee figure, using two documented assumptions:
 *
 *   - CITY_KM_PER_LITRE: real-world stop-and-go delivery mileage for a
 *     110-125cc two-wheeler, well below its highway-rated efficiency
 *     (typically 45-50 km/l rated vs. ~35-40 km/l in dense city traffic).
 *   - dailyDistanceKm: total distance covered in a working shift.
 *
 * Only Delhi pricing is available (PPAC's daily bulletin covers Delhi,
 * Mumbai, Chennai and Kolkata), so it is used as the baseline for every
 * synthetic driver regardless of city — a reasonable proxy given fuel
 * pricing does not vary enormously across major Indian metros.
 */
export const REAL_PETROL_PRICE_PER_LITRE: number = (realFuelPriceFile as { petrol_price_per_litre: number })
  .petrol_price_per_litre;

const CITY_KM_PER_LITRE = 38;

function estimateDailyFuelCost(dailyDistanceKm: number): number {
  return Math.round((dailyDistanceKm / CITY_KM_PER_LITRE) * REAL_PETROL_PRICE_PER_LITRE);
}

/** Day-of-week shape. Fridays weak, weekends strong — matches the persona. */
const DOW_SHAPE = [1.18, 1.03, 0.97, 0.93, 0.95, 0.82, 1.22]; // Sun..Sat

/**
 * The demo driver. The wider 5,000-driver population lives in the Python data
 * generator; the frontend only ever needs the signed-in driver, which it builds
 * deterministically from the id.
 */
export function buildDriverSpec(driverId: string): DriverSpec {
  const rng = makeRng(hashSeed(driverId));
  const isDemo = driverId === 'DRV-0001';

  if (isDemo) {
    return {
      driverId,
      name: 'Arjun',
      city: 'Delhi NCR',
      zone: 'South Delhi — Saket cluster',
      experienceYears: 3,
      typicalWorkingDays: 6,
      baseDailyIncome: 1300,
      volatility: 0.22,
      restDay: 2, // Tuesday
      joinedOn: '2023-04-11',
      finances: {
        rent: 9000,
        emi: 4500,
        dailyFood: 350,
        // ~100km/day shift at real Delhi petrol pricing — see estimateDailyFuelCost above.
        dailyFuel: estimateDailyFuelCost(100),
        utilities: 850,
        family: 1200,
        currentSavings: 4800,
      },
    };
  }

  const cities = ['Delhi NCR', 'Mumbai', 'Bengaluru', 'Pune', 'Hyderabad'];
  return {
    driverId,
    name: `Driver ${driverId.slice(-4)}`,
    city: cities[Math.floor(rng() * cities.length)],
    zone: `Zone ${Math.ceil(rng() * 9)}`,
    experienceYears: 1 + Math.floor(rng() * 6),
    typicalWorkingDays: 5 + Math.floor(rng() * 2),
    baseDailyIncome: Math.round(900 + rng() * 620),
    volatility: 0.18 + rng() * 0.18,
    restDay: Math.floor(rng() * 7),
    joinedOn: '2023-06-01',
    finances: {
      rent: Math.round(6000 + rng() * 6000),
      emi: Math.round(2500 + rng() * 4000),
      dailyFood: Math.round(300 + rng() * 160),
      // Distance varies per driver; the price per litre does not.
      dailyFuel: estimateDailyFuelCost(70 + rng() * 60),
      utilities: Math.round(600 + rng() * 700),
      family: Math.round(800 + rng() * 2200),
      currentSavings: Math.round(2000 + rng() * 9000),
    },
  };
}

/* ------------------------------------------------------------ daily record */

export interface DailyRecord {
  date: ISODate;
  dow: number;
  worked: boolean;
  income: number;
  hoursWorked: number;
  deliveries: number;
  avgDeliveryValue: number;
  incentives: number;
  fuelCost: number;
  weather: WeatherObs;
  isHoliday: boolean;
  festival: string | null;
  demandIndex: number;
  essentialSpend: number;
}

const HISTORY_DAYS = 430; // ~14 months, so every festival is observed at least once

/**
 * Generates the driver's observed history, ending yesterday.
 * Deterministic for a given driverId + anchor date.
 */
export function buildHistory(spec: DriverSpec, anchor: Date = today()): DailyRecord[] {
  const rng = makeRng(hashSeed(`${spec.driverId}:history`));
  const records: DailyRecord[] = [];

  for (let i = HISTORY_DAYS; i >= 1; i -= 1) {
    const date = addDays(anchor, -i);
    const iso = toISO(date);
    const dow = date.getDay();
    const weather = realWeatherOn(iso) ?? generateWeather(date, rng);
    const hit = festivalOn(iso);

    // Rest day: usually the driver's regular rest day, occasionally shifted.
    const shifted = rng() < 0.18;
    const restToday = shifted ? Math.floor(rng() * 7) === dow : dow === spec.restDay;
    // Festivals pull people into work even on their rest day.
    const worked = hit && rng() < 0.75 ? true : !restToday;

    const dowMult = DOW_SHAPE[dow];
    const weatherMult = latentWeatherMultiplier(weather, rng);
    const festivalMult = hit ? 1 + hit.def.latentUplift * (1 + gauss(rng) * 0.28) : 1;
    // Slow drift in platform demand across the period.
    const trend = 1 + Math.sin((i / HISTORY_DAYS) * Math.PI * 1.4) * 0.05;
    const noise = Math.exp(gauss(rng) * spec.volatility);

    const demandIndex = clamp(
      0.72 * dowMult * weatherMult * festivalMult * (1 + gauss(rng) * 0.07),
      0.3,
      2.1,
    );

    let income = 0;
    let hoursWorked = 0;
    let deliveries = 0;
    let incentives = 0;
    let fuelCost = 0;
    let avgDeliveryValue = 0;

    if (worked) {
      // Hours respond to weather and festival demand, not just to intent.
      hoursWorked = clamp(8.2 * clamp(weatherMult + 0.08, 0.6, 1.1) * (hit ? 1.12 : 1) + gauss(rng) * 0.9, 3.5, 13);
      const gross = spec.baseDailyIncome * dowMult * weatherMult * festivalMult * trend * noise;
      // Incentive tiers kick in on high-demand days.
      incentives = demandIndex > 1.05 && rng() < 0.55 ? Math.round(60 + rng() * 240) : 0;
      income = Math.max(140, Math.round(gross + incentives));
      avgDeliveryValue = 38 + rng() * 26;
      deliveries = Math.max(4, Math.round(income / avgDeliveryValue));
      fuelCost = Math.round(hoursWorked * (26 + rng() * 9));
    }

    const isWeekend = dow === 0 || dow === 6;
    const essentialSpend = Math.round(
      (spec.finances.dailyFood + (worked ? spec.finances.dailyFuel : spec.finances.dailyFuel * 0.2)) *
        (isWeekend ? 1.14 : 1) *
        (1 + gauss(rng) * 0.08),
    );

    records.push({
      date: iso,
      dow,
      worked,
      income,
      hoursWorked: Math.round(hoursWorked * 10) / 10,
      deliveries,
      avgDeliveryValue: Math.round(avgDeliveryValue * 10) / 10,
      incentives,
      fuelCost,
      weather,
      isHoliday: Boolean(hit) && (hit?.offset ?? 0) === 0,
      festival: hit ? hit.def.name : null,
      demandIndex: Math.round(demandIndex * 100) / 100,
      essentialSpend,
    });
  }

  return records;
}

/* ---------------------------------------------------------------- analysis */
/* Everything below reads ONLY DailyRecord[] — never the latent constants.    */

export interface DowStat {
  dow: number;
  meanIncome: number;
  medianIncome: number;
  stdDev: number;
  workedRatio: number;
  samples: number;
}

export function analyseDayOfWeek(records: DailyRecord[]): DowStat[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const all = records.filter((r) => r.dow === dow);
    const worked = all.filter((r) => r.worked).map((r) => r.income);
    return {
      dow,
      meanIncome: Math.round(mean(worked)),
      medianIncome: Math.round(median(worked)),
      stdDev: Math.round(stdDev(worked)),
      workedRatio: all.length ? all.filter((r) => r.worked).length / all.length : 0,
      samples: worked.length,
    };
  });
}

export interface WeatherEffect {
  code: WeatherCode;
  meanIncome: number;
  /** Relative to clear/partly-cloudy days, where -0.18 means 18% lower. */
  deltaPct: number;
  samples: number;
}

export function analyseWeather(records: DailyRecord[]): WeatherEffect[] {
  const worked = records.filter((r) => r.worked);
  const baseline = mean(
    worked.filter((r) => r.weather.code === 'clear' || r.weather.code === 'partly_cloudy').map((r) => r.income),
  );
  const codes: WeatherCode[] = ['clear', 'partly_cloudy', 'cloudy', 'rain', 'heavy_rain', 'storm'];
  return codes.map((code) => {
    const subset = worked.filter((r) => r.weather.code === code).map((r) => r.income);
    const m = mean(subset);
    return {
      code,
      meanIncome: Math.round(m),
      deltaPct: baseline && subset.length ? m / baseline - 1 : 0,
      samples: subset.length,
    };
  });
}

/** Aggregate "is it raining meaningfully" effect — used by the Weather page. */
export function analyseRainEffect(records: DailyRecord[]): {
  deltaPct: number;
  rainyMean: number;
  dryMean: number;
  rainySamples: number;
} {
  const worked = records.filter((r) => r.worked);
  const rainy = worked.filter((r) => r.weather.rainfallMm >= 15).map((r) => r.income);
  const dry = worked.filter((r) => r.weather.rainfallMm < 2).map((r) => r.income);
  const rainyMean = mean(rainy);
  const dryMean = mean(dry);
  return {
    deltaPct: dryMean && rainy.length ? rainyMean / dryMean - 1 : 0,
    rainyMean: Math.round(rainyMean),
    dryMean: Math.round(dryMean),
    rainySamples: rainy.length,
  };
}

export interface FestivalEffect {
  id: string;
  name: string;
  upliftPct: number;
  festivalMean: number;
  normalMean: number;
  samples: number;
  confidence: number;
}

/**
 * Measures each festival's uplift from history, comparing festival days against
 * non-festival days *of the same weekday mix* so a festival landing on a
 * Saturday is not credited with the weekend effect.
 */
export function analyseFestivals(records: DailyRecord[]): FestivalEffect[] {
  const worked = records.filter((r) => r.worked);
  const dowStats = analyseDayOfWeek(records);
  const results: FestivalEffect[] = [];

  for (const def of FESTIVALS) {
    const hits = worked.filter((r) => r.festival === def.name);
    if (hits.length < 2) continue;

    // Weekday-matched expectation: what these same weekdays normally earn.
    const expected = mean(hits.map((r) => dowStats[r.dow].meanIncome || 0));
    const actual = mean(hits.map((r) => r.income));
    if (!expected) continue;

    // Confidence grows with sample size and shrinks with dispersion.
    const dispersion = hits.length > 1 ? stdDev(hits.map((r) => r.income)) / (actual || 1) : 0.4;
    const confidence = clamp(0.44 + Math.min(hits.length, 10) * 0.05 - dispersion * 0.55, 0.35, 0.92);

    results.push({
      id: def.id,
      name: def.name,
      upliftPct: actual / expected - 1,
      festivalMean: Math.round(actual),
      normalMean: Math.round(expected),
      samples: hits.length,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  return results.sort((a, b) => b.upliftPct - a.upliftPct);
}

export interface HistorySummary {
  avgDailyIncome: number;
  medianDailyIncome: number;
  stdDevDaily: number;
  volatilityIndex: number;
  /** Volatility over the most recent 14 days, for the "more volatile" claim. */
  recentVolatilityIndex: number;
  avgMonthlyIncome: number;
  rolling7: number;
  rolling14: number;
  rolling30: number;
  /** Typical vs. bad week, used by the recovery margin in the buffer maths. */
  medianWeeklyIncome: number;
  worstWeekIncome: number;
  p10WeeklyIncome: number;
  avgDailyEssentialSpend: number;
  workedDaysRatio: number;
  totalDays: number;
}

export function summariseHistory(records: DailyRecord[]): HistorySummary {
  const worked = records.filter((r) => r.worked).map((r) => r.income);
  const allIncome = records.map((r) => r.income);

  const weekly: number[] = [];
  for (let i = records.length - 7; i >= 0; i -= 7) {
    weekly.push(records.slice(i, i + 7).reduce((a, r) => a + r.income, 0));
  }

  const last = (n: number) => records.slice(-n).reduce((a, r) => a + r.income, 0);
  const recent14 = records.slice(-14).filter((r) => r.worked).map((r) => r.income);

  const avgDaily = mean(worked);
  const sd = stdDev(worked);

  return {
    avgDailyIncome: Math.round(avgDaily),
    medianDailyIncome: Math.round(median(worked)),
    stdDevDaily: Math.round(sd),
    volatilityIndex: avgDaily ? Math.round((sd / avgDaily) * 1000) / 1000 : 0,
    recentVolatilityIndex:
      mean(recent14) > 0 ? Math.round((stdDev(recent14) / mean(recent14)) * 1000) / 1000 : 0,
    avgMonthlyIncome: Math.round(mean(allIncome) * 30),
    rolling7: last(7),
    rolling14: last(14),
    rolling30: last(30),
    medianWeeklyIncome: Math.round(median(weekly)),
    worstWeekIncome: Math.round(Math.min(...weekly)),
    p10WeeklyIncome: Math.round(percentile(weekly, 0.1)),
    avgDailyEssentialSpend: Math.round(mean(records.map((r) => r.essentialSpend))),
    workedDaysRatio: records.filter((r) => r.worked).length / records.length,
    totalDays: records.length,
  };
}

/* ---------------------------------------------------------------- forecast */

export interface ForecastContext {
  /** Multiplier applied to all modelled rainfall (stress test). */
  rainfallMultiplier: number;
  /** Fractional income reduction, where 0.2 means -20%. */
  incomeChangePct: number;
  /** How many days of the 7 the driver intends to work. */
  workingDays: number;
  /** Fractional fuel cost increase. */
  fuelCostIncreasePct: number;
  /** Forces a festival overlay onto the horizon (signature demo). */
  forceFestival: string | null;
  /** Extra hours committed, keyed by day of week. */
  extraHours: Record<number, number>;
}

export const NEUTRAL_CONTEXT: ForecastContext = {
  rainfallMultiplier: 1,
  incomeChangePct: 0,
  workingDays: 6,
  fuelCostIncreasePct: 0,
  forceFestival: null,
  extraHours: {},
};

export interface ForecastPoint {
  date: ISODate;
  dow: number;
  expected: number;
  sigma: number;
  lower: number;
  upper: number;
  historicalAverage: number;
  essentialSpend: number;
  isRestDay: boolean;
  weather: WeatherObs;
  weatherImpact: number;
  festival: string | null;
  isFestivalWindow: boolean;
  demandIndex: number;
  confidence: number;
}

/**
 * The forecast model.
 *
 * Structurally this is the same three-layer design as the Python model:
 *   L1 baseline   — day-of-week median plus a recent-trend correction
 *   L2 context    — measured weather / festival multipliers, work intent
 *   L3 uncertainty— residual sigma widened with horizon distance
 *
 * The multipliers are *measured from the driver's own history* by the analysis
 * functions above, so swapping this for a gradient-boosted model server-side
 * changes the numbers but not the shape of what the UI renders.
 */
export function forecastDays(
  spec: DriverSpec,
  records: DailyRecord[],
  horizon: number,
  context: ForecastContext = NEUTRAL_CONTEXT,
  anchor: Date = today(),
): ForecastPoint[] {
  const dowStats = analyseDayOfWeek(records);
  const weatherEffects = analyseWeather(records);
  const festivalEffects = analyseFestivals(records);
  const summary = summariseHistory(records);
  const rng = makeRng(hashSeed(`${spec.driverId}:forecast:${toISO(anchor)}`));

  // Recent-trend correction: last 30 worked days vs. the full-period mean.
  const recent = records.slice(-30).filter((r) => r.worked).map((r) => r.income);
  const trendAdj = summary.avgDailyIncome ? clamp(mean(recent) / summary.avgDailyIncome, 0.82, 1.18) : 1;

  const weatherLookup = new Map(weatherEffects.map((e) => [e.code, e]));
  const festivalLookup = new Map(festivalEffects.map((e) => [e.name, e]));

  // Which weekdays the driver plans to work, weakest days dropped first.
  const restCount = Math.max(0, 7 - context.workingDays);
  const restDays: number[] = [];
  if (restCount > 0) restDays.push(spec.restDay);
  for (const d of [...dowStats].sort((a, b) => a.meanIncome - b.meanIncome)) {
    if (restDays.length >= restCount) break;
    if (!restDays.includes(d.dow)) restDays.push(d.dow);
  }
  const weakestDays = restDays.slice(0, restCount);

  const points: ForecastPoint[] = [];

  for (let i = 1; i <= horizon; i += 1) {
    const date = addDays(anchor, i);
    const iso = toISO(date);
    const dow = date.getDay();

    // Weather forecast — same generator, seeded forward from the anchor.
    const raw = generateWeather(date, rng);
    // A rainfall multiplier scales what is already forecast AND imposes a floor,
    // otherwise an extreme-rain scenario over a dry week would change nothing.
    const mult = context.rainfallMultiplier;
    const imposedFloor = mult > 1.2 ? (mult - 1) * 16 : 0;
    const scaledRain = Math.round(Math.max(raw.rainfallMm * mult, imposedFloor));
    const code: WeatherCode =
      mult > 1.05
        ? scaledRain >= 38
          ? 'storm'
          : scaledRain >= 20
            ? 'heavy_rain'
            : scaledRain >= 3
              ? 'rain'
              : raw.code
        : raw.code;
    const weather: WeatherObs = { code, label: weatherLabel(code), rainfallMm: scaledRain, tempC: raw.tempC };

    const hit = festivalOn(iso);
    const festivalName = context.forceFestival ?? (hit ? hit.def.name : null);
    const festivalEffect = festivalName ? festivalLookup.get(festivalName) : undefined;

    const base = dowStats[dow].meanIncome || summary.avgDailyIncome;
    const weatherMult = 1 + (weatherLookup.get(code)?.deltaPct ?? 0);
    const festivalMult = 1 + (festivalEffect?.upliftPct ?? 0);
    const extra = context.extraHours[dow] ?? 0;
    // Marginal hour earns less than the average hour.
    const extraHoursMult = 1 + (extra / 8.2) * 0.78;

    const isRestDay = weakestDays.includes(dow);

    const expectedRaw =
      base * weatherMult * festivalMult * trendAdj * extraHoursMult * (1 - context.incomeChangePct);
    const expected = isRestDay ? 0 : Math.round(Math.max(0, expectedRaw));

    // Uncertainty: residual sigma, widened the further out we look. Growth is
    // sqrt-shaped and capped — linear growth would make a six-week-out forecast
    // so wide that every lower bound collapses to zero.
    const horizonInflation = clamp(1 + 0.1 * Math.sqrt(i - 1), 1, 1.7);
    const sigma = isRestDay
      ? 0
      : Math.round((dowStats[dow].stdDev || summary.stdDevDaily) * horizonInflation * (festivalEffect ? 1.2 : 1));

    const isWeekend = dow === 0 || dow === 6;
    const fuel = spec.finances.dailyFuel * (1 + context.fuelCostIncreasePct);
    const essentialSpend = Math.round(
      (spec.finances.dailyFood + (isRestDay ? fuel * 0.2 : fuel)) * (isWeekend ? 1.14 : 1),
    );

    const clearBase = base * trendAdj;
    const weatherImpact = isRestDay ? 0 : Math.round(clearBase * (weatherMult - 1));

    points.push({
      date: iso,
      dow,
      expected,
      sigma,
      // 80% interval — 1.2816 sigma each side.
      lower: Math.max(0, Math.round(expected - 1.2816 * sigma)),
      upper: Math.round(expected + 1.2816 * sigma),
      historicalAverage: dowStats[dow].meanIncome || summary.avgDailyIncome,
      essentialSpend,
      isRestDay,
      weather,
      weatherImpact,
      festival: festivalName,
      isFestivalWindow: Boolean(festivalName),
      demandIndex: Math.round(clamp(weatherMult * festivalMult * (base / (summary.medianDailyIncome || 1)), 0.3, 2.2) * 100) / 100,
      confidence:
        Math.round(
          clamp(0.9 - (i - 1) * 0.018 - summary.volatilityIndex * 0.34 - (festivalEffect ? 0.03 : 0), 0.45, 0.94) * 100,
        ) / 100,
    });
  }

  return points;
}

/** Aggregate sigma over a window, allowing for correlated day-to-day errors. */
export function windowSigma(points: ForecastPoint[]): number {
  const independent = Math.sqrt(points.reduce((acc, p) => acc + p.sigma ** 2, 0));
  return Math.round(independent * 1.14);
}

/* ------------------------------------------------------------- obligations */

export interface ObligationSpec {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  category: 'rent' | 'emi' | 'utilities' | 'family' | 'other';
  isCritical: boolean;
}

export function obligationSpecs(spec: DriverSpec): ObligationSpec[] {
  return [
    { id: 'rent', label: 'Room rent', amount: spec.finances.rent, dayOfMonth: 5, category: 'rent', isCritical: true },
    { id: 'emi', label: 'Two-wheeler EMI', amount: spec.finances.emi, dayOfMonth: 12, category: 'emi', isCritical: true },
    { id: 'utilities', label: 'Phone & electricity', amount: spec.finances.utilities, dayOfMonth: 18, category: 'utilities', isCritical: false },
    { id: 'family', label: 'Family transfer', amount: spec.finances.family, dayOfMonth: 26, category: 'family', isCritical: false },
  ];
}

/** Expands the recurring obligations into concrete dated instances. */
export function obligationsInRange(spec: DriverSpec, start: Date, days: number): { id: string; label: string; amount: number; date: ISODate; category: ObligationSpec['category']; isCritical: boolean }[] {
  const out: { id: string; label: string; amount: number; date: ISODate; category: ObligationSpec['category']; isCritical: boolean }[] = [];
  for (const o of obligationSpecs(spec)) {
    for (let i = 1; i <= days; i += 1) {
      const d = addDays(start, i);
      if (d.getDate() === o.dayOfMonth) {
        out.push({ id: `${o.id}-${toISO(d)}`, label: o.label, amount: o.amount, date: toISO(d), category: o.category, isCritical: o.isCritical });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
