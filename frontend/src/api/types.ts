/**
 * KAMAI.AI — API contract
 * =============================================================================
 * This file is the single source of truth for the wire format between the React
 * frontend and the Python/FastAPI backend.
 *
 * CONVENTIONS (keep these when you write the backend):
 *   - All field names are snake_case so Pydantic models serialise 1:1 with no
 *     camelCase shim on either side.
 *   - All money values are INTEGER RUPEES (no paise, no floats, no strings).
 *   - All dates are ISO "YYYY-MM-DD" strings in Asia/Kolkata local time.
 *   - All probabilities / confidences are floats in [0, 1].
 *   - All percentage-change fields are floats where 0.24 means +24%.
 *   - Every endpoint returns a top-level object (never a bare array), so the
 *     response can be extended with metadata without a breaking change.
 *   - Every forecast-bearing response carries `meta` so the UI can label output
 *     honestly as model output vs. heuristic, and show the data vintage.
 *
 * See docs/API.md for the matching endpoint table and example payloads.
 * =============================================================================
 */

/* ------------------------------------------------------------------ shared */

export type ISODate = string;

/** Product-display risk bands (not a regulatory or credit classification). */
export type RiskBand = 'low' | 'moderate' | 'high' | 'critical';

/** Drives the "financial weather" icons across the app. */
export type WeatherCode = 'clear' | 'partly_cloudy' | 'cloudy' | 'rain' | 'heavy_rain' | 'storm';

/** How a number was produced. The UI renders these differently on purpose. */
export type ValueKind = 'historical' | 'forecast' | 'scenario';

export interface ResponseMeta {
  /** e.g. "gradient_boosting_v1", "moving_average_baseline", "heuristic_v1" */
  model: string;
  model_version: string;
  /** True when the number came from a trained model rather than a fallback. */
  is_model_backed: boolean;
  generated_at: string;
  /** Last date of observed (non-forecast) data the response was built from. */
  data_through: ISODate;
  /** Free-text caveat surfaced in the honesty strip. */
  disclaimer?: string;
}

export interface ApiEnvelopeError {
  error: { code: string; message: string; detail?: unknown };
}

/** A single named contributor to a prediction, used by the "Why?" explainers. */
export interface Driver {
  /** Stable machine key, e.g. "heavy_rain_days", "dow_friday_weakness". */
  key: string;
  label: string;
  /** Signed effect on the predicted quantity, in rupees where applicable. */
  impact_amount: number;
  /** Signed relative effect, where 0.18 means +18%. */
  impact_pct: number;
  direction: 'increase' | 'decrease';
  /** Plain-language, feature-grounded sentence. Never "a pattern was detected". */
  explanation: string;
  /** Where the evidence came from — shown as a provenance chip. */
  evidence: ValueKind;
}

/* ------------------------------------------------------- GET /api/user/:id */

export interface DriverProfile {
  driver_id: string;
  name: string;
  role: string;
  city: string;
  zone: string;
  experience_years: number;
  typical_working_days: number;
  avatar_initials: string;
  joined_on: ISODate;
}

export interface ExpenseBreakdown {
  rent: number;
  emi: number;
  food: number;
  fuel: number;
  utilities: number;
  family: number;
  other: number;
}

export interface Obligation {
  id: string;
  label: string;
  amount: number;
  due_date: ISODate;
  category: 'rent' | 'emi' | 'utilities' | 'family' | 'other';
  /** True when missing it has knock-on cost (late fee, service cut). */
  is_critical: boolean;
}

export interface UserResponse {
  profile: DriverProfile;
  financials: {
    current_savings: number;
    avg_monthly_income: number;
    avg_daily_income: number;
    median_daily_income: number;
    income_std_dev: number;
    /** std_dev / mean — the headline volatility number. */
    volatility_index: number;
    monthly_essential_expenses: number;
    avg_daily_essential_spend: number;
    expense_breakdown: ExpenseBreakdown;
  };
  upcoming_obligations: Obligation[];
  meta: ResponseMeta;
}

/* --------------------------------------------------- GET /api/forecast/:id */

export interface ForecastDay {
  date: ISODate;
  day_label: string;
  day_of_week: number;
  /** Point forecast for the day, in rupees. */
  expected_income: number;
  /** 80% predictive interval. */
  lower_bound: number;
  upper_bound: number;
  /** This driver's historical average for the same weekday and context. */
  historical_average: number;
  expected_essential_spend: number;
  is_planned_rest_day: boolean;
  weather: {
    code: WeatherCode;
    label: string;
    rainfall_mm: number;
    temp_c: number;
    /** Modelled effect of this day's weather on income, in rupees. */
    income_impact: number;
  };
  festival: { name: string; is_festival_window: boolean } | null;
  demand_index: number;
  /** Chance in [0,1] that this single day lands below its essential spend. */
  day_shortfall_probability: number;
  confidence: number;
}

export interface ForecastWindow {
  horizon_days: 7 | 14;
  expected_income: number;
  lower_bound: number;
  upper_bound: number;
  /** What a typical window looks like for this driver — the comparison base. */
  normal_expected_income: number;
  delta_vs_normal: number;
  delta_vs_normal_pct: number;
  expected_essential_spend: number;
  potential_shortfall: number;
  shortfall_probability: number;
  risk_band: RiskBand;
  confidence: number;
  drivers: Driver[];
  /** Single-sentence headline for the dashboard hero card. */
  headline: string;
}

export interface ForecastResponse {
  driver_id: string;
  generated_for: ISODate;
  days: ForecastDay[];
  window_7d: ForecastWindow;
  window_14d: ForecastWindow;
  /** Naive moving-average forecast, shown beside the model to prove uplift. */
  baseline_7d: { expected_income: number; method: string };
  model_performance: ModelPerformance | null;
  meta: ResponseMeta;
}

/** Real evaluation output only. Backend returns null if no eval has been run. */
export interface ModelPerformance {
  dataset: string;
  split: string;
  income_model: { name: string; mae: number; rmse: number; r2: number };
  baseline_model: { name: string; mae: number; rmse: number; r2: number };
  /** null when the classifier has not been evaluated. */
  shortfall_model: {
    name: string;
    precision: number;
    recall: number;
    f1: number;
    auc: number | null;
  } | null;
  evaluated_at: string;
  notes: string;
}

/* --------------------------------------------------- GET /api/cashflow/:id */

export interface CashflowDay {
  date: ISODate;
  day_label: string;
  income: number;
  income_lower: number;
  income_upper: number;
  essential_spend: number;
  /** Rent/EMI/bills landing on this date, separate from daily essentials. */
  obligations: number;
  obligation_labels: string[];
  net: number;
  closing_balance: number;
  balance_lower: number;
  balance_upper: number;
  /** True when closing_balance dips under the resilience buffer target. */
  below_buffer: boolean;
  weather_code: WeatherCode;
  festival: string | null;
}

export interface CashflowResponse {
  driver_id: string;
  horizon_days: number;
  starting_balance: number;
  projected_ending_balance: number;
  lowest_projected_balance: number;
  lowest_balance_date: ISODate;
  buffer_target: number;
  /** Negative means below target. */
  gap_to_buffer: number;
  status_message: string;
  risk_band: RiskBand;
  days: CashflowDay[];
  meta: ResponseMeta;
}

/* ------------------------------------------------------- GET /api/risk/:id */

export interface RiskWindow {
  horizon_days: 7 | 14;
  shortfall_probability: number;
  risk_band: RiskBand;
  expected_income: number;
  required_income: number;
  projected_gap: number;
  confidence: number;
}

export interface RiskResponse {
  driver_id: string;
  overall_band: RiskBand;
  windows: RiskWindow[];
  /** The single day most likely to break the week. */
  worst_day: { date: ISODate; day_label: string; expected_income: number; reason: string };
  volatility: {
    current_index: number;
    baseline_index: number;
    change_pct: number;
    interpretation: string;
  };
  drivers: Driver[];
  meta: ResponseMeta;
}

/* ------------------------------------------------- GET /api/resilience/:id */

export type BufferComponentKey =
  | 'expected_shortfall'
  | 'critical_expenses'
  | 'uncertainty_margin'
  | 'fixed_obligations'
  | 'recovery_margin'
  | 'safe_expected_income';

/** The transparent buffer maths, component by component, for the UI breakdown. */
export interface BufferComponent {
  key: BufferComponentKey;
  label: string;
  amount: number;
  /** Negative components (e.g. safe expected income) subtract from the target. */
  sign: 1 | -1;
  explanation: string;
}

export interface ResilienceResponse {
  driver_id: string;
  current_savings: number;
  buffer_target: number;
  gap: number;
  /** How many days of essential spend the current savings cover. */
  days_of_cover: number;
  target_days_of_cover: number;
  components: BufferComponent[];
  /** Why the target moved versus the previous calculation. */
  narrative: string;
  /** Simple recovery plan the UI renders as suggested saving steps. */
  suggested_weekly_saving: number;
  weeks_to_target: number | null;
  risk_band: RiskBand;
  meta: ResponseMeta;
}

/* --------------------------------------------------- GET /api/calendar/:id */

export type CalendarMarker =
  | 'high_income'
  | 'normal'
  | 'volatility'
  | 'shortfall_risk'
  | 'festival';

export interface CalendarDay {
  date: ISODate;
  markers: CalendarMarker[];
  expected_income: number;
  historical_average: number;
  delta_pct: number;
  weather: { code: WeatherCode; label: string; rainfall_mm: number };
  demand_index: number;
  expected_expenses: number;
  obligations: number;
  projected_balance: number;
  festival: string | null;
  is_past: boolean;
  /** Only present for past days — what actually happened. */
  actual_income: number | null;
}

export interface FestivalWindow {
  id: string;
  name: string;
  start_date: ISODate;
  end_date: ISODate;
  /** Learned from this driver's own history, where 0.24 means +24%. */
  historical_uplift_pct: number;
  historical_normal_daily: number;
  historical_festival_daily: number;
  /** Sample size behind the uplift — shown so the claim is auditable. */
  observations: number;
  predicted_income_low: number;
  predicted_income_high: number;
  confidence: number;
  note: string;
}

export interface SavingWindow {
  id: string;
  label: string;
  start_date: ISODate;
  end_date: ISODate;
  expected_income: number;
  normal_income: number;
  potential_extra: number;
  suggested_saving: number;
  buffer_before: number;
  buffer_after: number;
  rationale: string;
}

export interface CalendarResponse {
  driver_id: string;
  range_start: ISODate;
  range_end: ISODate;
  days: CalendarDay[];
  festivals: FestivalWindow[];
  saving_windows: SavingWindow[];
  meta: ResponseMeta;
}

/* -------------------------------------------------- POST /api/stress-test */

export type ScenarioKey = 'baseline' | 'diwali' | 'rain_shock';

export interface StressTestRequest {
  driver_id: string;
  /** 0.0 to 0.5 — fraction by which income is reduced. */
  income_change_pct: number;
  /** 1 to 7 working days in the simulated week. */
  working_days: number;
  /** Multiplier on modelled rainfall: 1 is normal, 3 is extreme. */
  rainfall_multiplier: number;
  /** One-off unexpected expense in rupees. */
  emergency_expense: number;
  /** 0.0 to 0.3 increase in fuel cost. */
  fuel_cost_increase_pct: number;
  /** Optional named overlays — drives the signature demo. */
  scenarios?: ScenarioKey[];
  /** Extra hours the driver commits to; powers the buffer-recovery demo. */
  extra_hours?: { day_of_week: number; hours: number }[];
}

export interface StressTestOutcome {
  label: string;
  projected_income: number;
  projected_expenses: number;
  projected_ending_balance: number;
  lowest_balance: number;
  buffer_target: number;
  gap_to_buffer: number;
  shortfall_probability: number;
  risk_band: RiskBand;
  days: CashflowDay[];
}

export interface StressTestResponse {
  driver_id: string;
  baseline: StressTestOutcome;
  scenario: StressTestOutcome;
  deltas: {
    income: number;
    ending_balance: number;
    shortfall_probability: number;
    risk_band_changed: boolean;
  };
  /** Feature-grounded explanation of what the scenario did. */
  drivers: Driver[];
  narrative: string;
  meta: ResponseMeta;
}

/* --------------------------------------------------- GET /api/insights/:id */

export interface Insight {
  id: string;
  rank: number;
  category: 'pattern' | 'weather' | 'festival' | 'buffer' | 'risk' | 'opportunity';
  title: string;
  /** The single number the insight turns on. */
  metric: { value: string; label: string; direction: 'up' | 'down' | 'neutral' };
  evidence: string;
  explanation: string;
  confidence: number;
  /** How many observations support it — makes the claim auditable. */
  sample_size: number;
  kind: ValueKind;
}

export interface InsightsResponse {
  driver_id: string;
  insights: Insight[];
  meta: ResponseMeta;
}

/* --------------------------------------------------------- POST /api/chat */

export interface ChatRequest {
  driver_id: string;
  message: string;
  /** Prior turns, oldest first. Keep it short; the backend may truncate. */
  history?: { role: 'user' | 'assistant'; content: string }[];
  /** Active scenario overlays, so the copilot answers about what is on screen. */
  scenarios?: ScenarioKey[];
}

export interface ChatResponse {
  /** Markdown-lite: the UI renders bold spans and line breaks only. */
  reply: string;
  /** Numbers the answer leaned on — rendered as chips under the reply. */
  citations: { label: string; value: string; kind: ValueKind }[];
  /** Deep-link the UI turns into a button, e.g. "/cashflow". */
  suggested_route: string | null;
  follow_ups: string[];
  meta: ResponseMeta;
}
