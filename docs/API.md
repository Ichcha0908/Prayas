# KAMAI.AI — API contract

This is the contract the frontend is already written against. Implement these
nine endpoints and the UI switches from its built-in demo engine to your backend
with **one environment variable** and no component changes.

The authoritative, machine-checkable version of every shape below is
[`frontend/src/api/types.ts`](../frontend/src/api/types.ts). If the two ever
disagree, the TypeScript file wins — it is what the UI compiles against.

---

## 1. Conventions

These are not stylistic preferences; the frontend depends on them.

| Rule | Detail |
|---|---|
| **Case** | `snake_case` everywhere, so Pydantic models serialise 1:1 with no shim. |
| **Money** | Integer rupees. No paise, no floats, no strings, no currency symbols. |
| **Dates** | `"YYYY-MM-DD"` strings, Asia/Kolkata local time. Never ISO datetimes. |
| **Probabilities** | Floats in `[0, 1]`. The UI multiplies by 100 for display. |
| **Percent change** | Floats where `0.24` means **+24%**. Never pre-formatted strings. |
| **Envelopes** | Every response is a top-level **object**, never a bare array. |
| **Errors** | `{"error": {"code": "...", "message": "...", "detail": ...}}`. FastAPI's default `{"detail": "..."}` is also understood. |
| **Meta** | Every forecast-bearing response carries `meta` (see below). |

### `meta` — required on every response

```json
{
  "model": "gradient_boosting_v1",
  "model_version": "1.2.0",
  "is_model_backed": true,
  "generated_at": "2026-09-20T09:14:00+05:30",
  "data_through": "2026-09-19",
  "disclaimer": "Prototype benchmark on synthetic test data."
}
```

`is_model_backed` must be `false` whenever a number came from a heuristic or
fallback rather than a trained model. The UI uses it to decide how confidently
to present the figure, and shows `disclaimer` in the honesty strip.

### Scenario overlays

The dashboard's "Simulate Diwali" / "Simulate Rain Shock" controls recompute
every page at once. On `GET` endpoints they arrive as a comma-separated query
parameter:

```
GET /api/forecast/DRV-0001?scenario=diwali,rain_shock
```

Valid keys: `diwali`, `rain_shock`. Absent means the normal forecast. Endpoints
that accept it: `/forecast`, `/cashflow`, `/risk`, `/resilience`.

---

## 2. Endpoints

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/api/health` | — | Anything `2xx`. Used only as a reachability probe. |
| GET | `/api/user/{driver_id}` | — | `UserResponse` |
| GET | `/api/forecast/{driver_id}` | `scenario` | `ForecastResponse` |
| GET | `/api/cashflow/{driver_id}` | `horizon` (7\|14), `scenario` | `CashflowResponse` |
| GET | `/api/risk/{driver_id}` | `scenario` | `RiskResponse` |
| GET | `/api/resilience/{driver_id}` | `scenario` | `ResilienceResponse` |
| GET | `/api/calendar/{driver_id}` | — | `CalendarResponse` |
| GET | `/api/insights/{driver_id}` | — | `InsightsResponse` |
| POST | `/api/stress-test` | — | `StressTestResponse` |
| POST | `/api/chat` | — | `ChatResponse` |

### `GET /api/user/{driver_id}`

```json
{
  "profile": {
    "driver_id": "DRV-0001", "name": "Arjun", "role": "Delivery Partner",
    "city": "Delhi NCR", "zone": "South Delhi — Saket cluster",
    "experience_years": 3, "typical_working_days": 6,
    "avatar_initials": "AR", "joined_on": "2023-04-11"
  },
  "financials": {
    "current_savings": 4800, "avg_monthly_income": 35756,
    "avg_daily_income": 1192, "median_daily_income": 1306,
    "income_std_dev": 404, "volatility_index": 0.309,
    "monthly_essential_expenses": 33880, "avg_daily_essential_spend": 611,
    "expense_breakdown": {
      "rent": 9000, "emi": 4500, "food": 10500,
      "fuel": 6755, "utilities": 850, "family": 1200, "other": 0
    }
  },
  "upcoming_obligations": [
    { "id": "rent-2026-10-05", "label": "Room rent", "amount": 9000,
      "due_date": "2026-10-05", "category": "rent", "is_critical": true }
  ],
  "meta": { }
}
```

`volatility_index` is `std_dev / mean` of daily income. It is the headline
number behind the whole product, so compute it from working days only.

### `GET /api/forecast/{driver_id}`

Returns 14 `days`, plus a 7-day and a 14-day aggregate window.

```json
{
  "driver_id": "DRV-0001",
  "generated_for": "2026-09-20",
  "days": [
    {
      "date": "2026-09-21", "day_label": "Mon", "day_of_week": 1,
      "expected_income": 1253, "lower_bound": 795, "upper_bound": 1711,
      "historical_average": 1329, "expected_essential_spend": 610,
      "is_planned_rest_day": false,
      "weather": { "code": "cloudy", "label": "Cloudy", "rainfall_mm": 0,
                   "temp_c": 31, "income_impact": -76 },
      "festival": null,
      "demand_index": 1.02,
      "day_shortfall_probability": 0.08,
      "confidence": 0.86
    }
  ],
  "window_7d": {
    "horizon_days": 7,
    "expected_income": 7368, "lower_bound": 5795, "upper_bound": 8941,
    "normal_expected_income": 8251,
    "delta_vs_normal": -883, "delta_vs_normal_pct": -0.107,
    "expected_essential_spend": 4232, "potential_shortfall": 492,
    "shortfall_probability": 0.66, "risk_band": "high", "confidence": 0.74,
    "drivers": [ /* see §3 */ ],
    "headline": "Your income looks weaker over the next 7 days."
  },
  "window_14d": { },
  "baseline_7d": { "expected_income": 7991, "method": "trailing_7_day_moving_average" },
  "model_performance": null,
  "meta": { }
}
```

- `weather.code` ∈ `clear | partly_cloudy | cloudy | rain | heavy_rain | storm`.
- `lower_bound` / `upper_bound` are an **80% predictive interval**.
- `normal_expected_income` is this driver's own day-of-week baseline with no
  weather or festival adjustment — it is the "vs normal" comparison base, so it
  must use the **same statistic** as `expected_income` (both mean, or both
  median). Mixing them makes every forecast read as "weaker than normal".
- `baseline_7d` is the naive moving average. The UI shows it beside the model
  so the model's contribution is visible.
- `model_performance` is `null` unless a real evaluation has been run.
  **Do not invent metrics.** When present:

```json
{
  "dataset": "synthetic_v1", "split": "chronological_holdout_last_60d",
  "income_model":   { "name": "lightgbm", "mae": 184.2, "rmse": 241.7, "r2": 0.61 },
  "baseline_model": { "name": "moving_average_7d", "mae": 263.0, "rmse": 329.4, "r2": 0.28 },
  "shortfall_model": { "name": "lightgbm_clf", "precision": 0.74, "recall": 0.68, "f1": 0.71, "auc": 0.81 },
  "evaluated_at": "2026-09-19T22:00:00+05:30",
  "notes": "Prototype benchmark on synthetic test data."
}
```

Time-series splits must be **chronological**, never random.

### `GET /api/cashflow/{driver_id}?horizon=7`

```json
{
  "driver_id": "DRV-0001", "horizon_days": 7,
  "starting_balance": 4800,
  "projected_ending_balance": 6736,
  "lowest_projected_balance": 5041,
  "lowest_balance_date": "2026-09-22",
  "buffer_target": 6680,
  "gap_to_buffer": -1639,
  "status_message": "You are ₹1,639 below your estimated resilience target.",
  "risk_band": "high",
  "days": [
    { "date": "2026-09-21", "day_label": "Mon",
      "income": 1253, "income_lower": 795, "income_upper": 1711,
      "essential_spend": 610, "obligations": 0, "obligation_labels": [],
      "net": 643, "closing_balance": 5443,
      "balance_lower": 4985, "balance_upper": 5901,
      "below_buffer": true, "weather_code": "cloudy", "festival": null }
  ],
  "meta": { }
}
```

`gap_to_buffer` is measured from **`lowest_projected_balance`**, not the closing
day — the trough is what actually breaks a week. Negative means below target.
`/api/stress-test` uses the same basis, so the two pages agree.

### `GET /api/risk/{driver_id}`

```json
{
  "driver_id": "DRV-0001", "overall_band": "high",
  "windows": [
    { "horizon_days": 7, "shortfall_probability": 0.66, "risk_band": "high",
      "expected_income": 7368, "required_income": 8410,
      "projected_gap": 1042, "confidence": 0.74 }
  ],
  "worst_day": { "date": "2026-09-27", "day_label": "Sun",
                 "expected_income": 1039, "reason": "52mm of rain is forecast." },
  "volatility": { "current_index": 0.31, "baseline_index": 0.31,
                  "change_pct": 0.0,
                  "interpretation": "Your recent variability is in line with your longer-run pattern." },
  "drivers": [ ],
  "meta": { }
}
```

**Risk bands** (product-display only — not a credit or regulatory rating):

| Band | Probability |
|---|---|
| `low` | 0–30% |
| `moderate` | 30–60% |
| `high` | 60–80% |
| `critical` | 80%+ |

**How the reference implementation defines shortfall probability.** A window is
short if its income cannot carry its own costs:

```
required = essential_spend(window) + monthly_obligations × days / 30
P(shortfall) = Φ( (required − μ) / σ )
```

Two deliberate choices, both worth keeping:

1. **Obligations are amortised across the month**, not shock-loaded into
   whichever week rent happens to fall in. Otherwise every rent week reads 100%
   and the signal is useless. The cashflow chart still shows the real lumpy
   timing.
2. **Current savings are excluded.** This measures "can this week pay for
   itself", which is the right signal for a weekly forecast. How well savings
   cover a gap is reported separately as the buffer gap.

A one-off emergency expense (stress test only) is amortised the same way.

### `GET /api/resilience/{driver_id}`

The transparent buffer calculation. The UI renders `components` as a waterfall,
so every term must be present with its sign and a plain-language `explanation`.

```json
{
  "driver_id": "DRV-0001",
  "current_savings": 4800, "buffer_target": 6680, "gap": -1880,
  "days_of_cover": 7.9, "target_days_of_cover": 10.9,
  "components": [
    { "key": "expected_shortfall", "label": "Expected shortfall",
      "amount": 0, "sign": 1, "explanation": "..." },
    { "key": "critical_expenses", "label": "Essential expenses during recovery",
      "amount": 4277, "sign": 1, "explanation": "..." },
    { "key": "uncertainty_margin", "label": "Forecast uncertainty margin",
      "amount": 1553, "sign": 1, "explanation": "..." },
    { "key": "fixed_obligations", "label": "Fixed obligations due",
      "amount": 10200, "sign": 1, "explanation": "..." },
    { "key": "recovery_margin", "label": "Bad-week recovery margin",
      "amount": 853, "sign": 1, "explanation": "..." },
    { "key": "safe_expected_income", "label": "Income you can safely count on",
      "amount": 10200, "sign": -1, "explanation": "..." }
  ],
  "narrative": "Your estimated buffer is at ₹6,680 this fortnight because …",
  "suggested_weekly_saving": 219, "weeks_to_target": 9,
  "risk_band": "high",
  "meta": { }
}
```

`amount` is always **positive**; `sign` carries the direction. The UI computes
nothing — `buffer_target` must equal `Σ(sign × amount)`, floored as below.

**The reference algorithm** (deliberately *not* "three months of expenses" — the
whole point is that it tracks this driver's volatility):

```
A  expected_shortfall    = max(0, essentials(14d) − expected_income(14d))
B  critical_expenses     = avg_daily_essential × 7          (one recovery week)
C  uncertainty_margin    = 0.8416 × σ(14d)                  (one-sided 80%)
D  fixed_obligations     = rent/EMI/bills due in the next 21 days
E  recovery_margin       = 0.6 × (median_week − p10_week)
F  safe_expected_income  = min( p20 of forecast income(14d), A + D )

buffer_target = max( A + B + C + D + E − F, floor )
floor         = avg_daily_essential × 5 + largest critical obligation due ≤ 14d
```

`F` is capped at `A + D` so a strong forecast can cancel the obligations you are
about to pay, but can never drive the target to zero. Round the result to ₹10.

### `GET /api/calendar/{driver_id}`

Returns ~30 past days and ~60 forecast days, plus festival and saving windows.

```json
{
  "driver_id": "DRV-0001",
  "range_start": "2026-08-21", "range_end": "2026-11-19",
  "days": [
    { "date": "2026-09-21", "markers": ["normal"],
      "expected_income": 1253, "historical_average": 1329, "delta_pct": -0.057,
      "weather": { "code": "cloudy", "label": "Cloudy", "rainfall_mm": 0 },
      "demand_index": 1.02, "expected_expenses": 610, "obligations": 0,
      "projected_balance": 5443, "festival": null,
      "is_past": false, "actual_income": null }
  ],
  "festivals": [
    { "id": "diwali", "name": "Diwali",
      "start_date": "2026-11-04", "end_date": "2026-11-10",
      "historical_uplift_pct": 0.24,
      "historical_normal_daily": 1381, "historical_festival_daily": 1708,
      "observations": 7,
      "predicted_income_low": 721, "predicted_income_high": 2591,
      "confidence": 0.78,
      "note": "In your historical data, income during Diwali was typically +24% against the same weekdays outside the window, across 7 observations." }
  ],
  "saving_windows": [
    { "id": "sw-2026-11-05", "label": "Diwali earning window",
      "start_date": "2026-11-05", "end_date": "2026-11-09",
      "expected_income": 8415, "normal_income": 7004,
      "potential_extra": 1411, "suggested_saving": 850,
      "buffer_before": 4800, "buffer_after": 5650,
      "rationale": "…" }
  ],
  "meta": { }
}
```

`markers` ∈ `high_income | normal | volatility | shortfall_risk | festival`
(a day may carry several). **`shortfall_risk` must never appear on a past day** —
it is a forward-looking concept; a weak day that already happened is `volatility`.

`historical_uplift_pct` must be **measured from this driver's own history**, and
compared against the *same weekdays* outside the window so a festival landing on
a Saturday is not credited with the weekend effect. Always send `observations`
so the UI can show the sample size behind the claim. If there are too few
observations, send `0` and say so in `note` rather than inventing a number.

### `POST /api/stress-test`

Request:

```json
{
  "driver_id": "DRV-0001",
  "income_change_pct": 0.2,
  "working_days": 6,
  "rainfall_multiplier": 1.0,
  "emergency_expense": 5000,
  "fuel_cost_increase_pct": 0.0,
  "scenarios": ["diwali"],
  "extra_hours": [{ "day_of_week": 6, "hours": 2 }]
}
```

`day_of_week` is 0 = Sunday. `income_change_pct` is a **reduction** (0.2 = −20%).
`rainfall_multiplier` scales modelled rainfall *and should impose a floor* —
multiplying a dry week by 3 must still produce a wet week, or the control does
nothing.

Response:

```json
{
  "driver_id": "DRV-0001",
  "baseline": {
    "label": "Normal forecast",
    "projected_income": 7368, "projected_expenses": 5432,
    "projected_ending_balance": 6736, "lowest_balance": 5041,
    "buffer_target": 6680, "gap_to_buffer": -1639,
    "shortfall_probability": 0.66, "risk_band": "high",
    "days": [ /* CashflowDay[] */ ]
  },
  "scenario": { },
  "deltas": { "income": -1474, "ending_balance": -1474,
              "shortfall_probability": 0.29, "risk_band_changed": true },
  "drivers": [ ],
  "narrative": "Under this scenario your week ends at …",
  "meta": { "disclaimer": "Scenario output. These are simulated what-if figures…" }
}
```

Both outcomes must carry a full `days` array of the **same length** — the
comparison chart plots them index-by-index.

### `POST /api/chat`

```json
{ "driver_id": "DRV-0001", "message": "How much should I keep as a buffer?",
  "history": [{ "role": "user", "content": "…" }],
  "scenarios": ["diwali"] }
```

```json
{
  "reply": "Your estimated resilience buffer right now is **₹6,680**.\n\nYou currently hold ₹4,800…",
  "citations": [
    { "label": "Buffer target", "value": "₹6,680", "kind": "forecast" },
    { "label": "Current savings", "value": "₹4,800", "kind": "historical" }
  ],
  "suggested_route": "/app/insights",
  "follow_ups": ["When should I save more?", "What happens if I have a ₹5,000 emergency?"]
}
```

`reply` is **markdown-lite**: the UI renders `**bold**` and line breaks only.
Anything else is shown literally. Answers must be grounded in this driver's
actual figures — a generic LLM answer disconnected from the dashboard is a bug.
`suggested_route` must be a real frontend route (`/app`, `/app/forecast`,
`/app/cashflow`, `/app/stress-test`, `/app/calendar`, `/app/insights`) or `null`.

---

## 3. `Driver` — the explanation object

Used by every "Why?" popover. Explanations must be **feature-grounded**: name
the measured feature and its measured effect. "The AI detected a pattern" is
explicitly not acceptable.

```json
{
  "key": "rain_days",
  "label": "1 heavy-rain day forecast",
  "impact_amount": -561,
  "impact_pct": -0.21,
  "direction": "decrease",
  "explanation": "On days with 15mm or more rainfall, your income has averaged −21% versus your dry days across 57 observations.",
  "evidence": "historical"
}
```

`evidence` ∈ `historical | forecast | scenario`. The UI renders it as a
provenance chip so a simulated number can never be mistaken for a measured one —
this is a core product requirement, not decoration.

---

## 4. Wiring it up

1. Serve the API on `http://localhost:8000`.
2. In `frontend/.env`:
   ```
   VITE_API_BASE_URL=
   VITE_DATA_SOURCE=live
   ```
   Empty base URL means same-origin `/api`, which the Vite dev server proxies to
   `BACKEND_ORIGIN` (default `http://localhost:8000`). Set
   `VITE_API_BASE_URL=http://localhost:8000` instead if you prefer to skip the
   proxy — then enable CORS for the frontend origin.
3. Restart `npm run dev`.

`VITE_DATA_SOURCE` accepts:

| Value | Behaviour |
|---|---|
| `mock` | Always the in-browser demo engine. No network calls. |
| `live` | Always the backend. Failures surface as error states in the UI. |
| `auto` | Probes `GET /api/health` once, then falls back to mock per-call if the backend is unreachable. Good for partial backends. |

Under `auto`, endpoints you have not implemented yet fall back to the demo
engine individually, so you can land the backend one route at a time.

### FastAPI skeleton

```python
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"],
)

def parse_scenarios(scenario: str | None) -> list[str]:
    return [s for s in (scenario or "").split(",") if s]

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/user/{driver_id}")
def get_user(driver_id: str) -> UserResponse: ...

@app.get("/api/forecast/{driver_id}")
def get_forecast(driver_id: str, scenario: str | None = None) -> ForecastResponse: ...

@app.get("/api/cashflow/{driver_id}")
def get_cashflow(driver_id: str, horizon: int = Query(7), scenario: str | None = None): ...

@app.get("/api/risk/{driver_id}")
def get_risk(driver_id: str, scenario: str | None = None): ...

@app.get("/api/resilience/{driver_id}")
def get_resilience(driver_id: str, scenario: str | None = None): ...

@app.get("/api/calendar/{driver_id}")
def get_calendar(driver_id: str): ...

@app.get("/api/insights/{driver_id}")
def get_insights(driver_id: str): ...

@app.post("/api/stress-test")
def stress_test(req: StressTestRequest) -> StressTestResponse: ...

@app.post("/api/chat")
def chat(req: ChatRequest) -> ChatResponse: ...
```

Because the wire format is `snake_case`, your Pydantic field names *are* the
JSON keys — no aliases, no `Config.alias_generator`.

### Checking your implementation against the reference

[`frontend/src/api/mock/handlers.ts`](../frontend/src/api/mock/handlers.ts) is a
complete, working implementation of all nine endpoints. When a response of yours
renders oddly, diff it against what that file returns for the same driver — it
is the behavioural spec, not just test data.
