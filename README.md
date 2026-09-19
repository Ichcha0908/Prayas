# KAMAI.AI

**AI-powered income forecasting and financial resilience for delivery drivers.**

> Know your next good week. Prepare for your next bad week.

A delivery driver's average month can be perfectly fine while any given week is
not. Income arrives daily and varies; rent, EMI and bills arrive monthly and
don't. The problem is rarely *"I don't earn enough"* — it's *"I don't know what
I'll earn next week, so I don't know whether I can safely spend money today."*

KAMAI.AI forecasts the next 7–14 days of income, flags shortfall risk before it
arrives, sizes a resilience buffer against the driver's own volatility, and
shows which upcoming periods are the best ones to save into.

**This is a resilience tool, not a lending funnel.** No loans, no BNPL, no
credit scoring, no financial products. See [Ethics](#ethics-and-limitations).

---

## Current status

This repository currently contains the **frontend**, complete and running.

It ships with a deterministic in-browser demo engine that generates 14 months of
synthetic history and computes every forecast, buffer, risk figure and insight
from it — so the whole product is demonstrable with no server. That engine is a
faithful reference implementation of the API contract, which means dropping in a
real Python backend is a one-line configuration change.

| Piece | State |
|---|---|
| React + TypeScript frontend, 7 pages | Complete |
| API contract (`types.ts`) + HTTP client | Complete |
| In-browser demo engine (all 9 endpoints) | Complete |
| Python/FastAPI backend | **Not in this repo yet** — [contract ready](docs/API.md) |

---

## Quick start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

No backend, no accounts, no API keys. The demo loads Arjun, a delivery partner
in Delhi NCR, with 14 months of synthetic earning history.

```bash
npm run build        # production build
npm run preview      # serve the build
npm run typecheck    # tsc, no emit
```

---

## The demo, in 90 seconds

1. **Landing page** → *Try the demo*.
2. **Dashboard.** Expected 7-day income ₹7,368 against a normal ₹8,251, with
   shortfall risk at 66% (High). Hit **Why?** — the explanation is a ranked list
   of measured features, not "the AI detected a pattern".
3. **Signature demo.** In the header, click **Simulate Diwali**. Every page
   recomputes: risk falls 66% → 20%, forecast income rises to ₹9,111. Now click
   **Simulate Rain Shock** on top of it — risk lands at **41%**, versus **84%**
   for the rain shock alone. That difference *is* the product: the stronger
   Diwali week absorbs part of the rain-related shock.
4. **Cashflow.** Day-by-day balance against the buffer line, with the trough
   called out and the days carrying a fixed payment marked.
5. **Stress Test.** *₹5,000 emergency* → risk High 66% → Critical 91%, ending
   balance ₹6,736 → ₹1,736. Then **+2h Saturday** recovers it to 87% / ₹2,037.
6. **Income Calendar.** Diwali shows **+24%**, measured from 7 observations in
   this driver's own history — the number is never hardcoded.
7. **Ask Kamai** (sidebar). Every answer is computed from the data on screen.

---

## Architecture

```
/frontend
  src/
    api/
      types.ts          Single source of truth for the wire format
      client.ts         fetch wrapper: base URL, timeouts, ApiError
      index.ts          live/mock resolution — the swap point
      mock/
        engine.ts       Synthetic data generation + forecasting model
        handlers.ts     Reference implementation of all 9 endpoints
    components/
      ui/               Card, Stat, RiskBadge, WhyButton, Slider, …
      layout/           AppShell, ScenarioBar, PageHeading
      charts/           Cashflow, Forecast, WeatherStrip, ScenarioCompare
    features/copilot/   The "Ask Kamai" assistant
    hooks/              useAsync, useAppData (app-wide state + scenarios)
    lib/                format, chartTheme, weather, cn
    pages/              Landing, Dashboard, Forecast, Cashflow,
                        StressTest, IncomeCalendar, Insights
/docs
  API.md                The backend contract — start here
```

**Stack:** React 18, TypeScript (strict), Vite, Tailwind CSS, Recharts,
Framer Motion, Lucide, React Router.

### How the data layer swaps

Components never call `fetch`. They call `api.getForecast(...)`, which resolves
to either the live backend or the in-browser engine:

```
component → hooks/useAppData → api/index.ts ─┬─ live  → api/client.ts → FastAPI
                                             └─ mock  → api/mock/handlers.ts
```

Controlled by one environment variable:

| `VITE_DATA_SOURCE` | Behaviour |
|---|---|
| `mock` | Always the demo engine. No network calls. **Default in `.env`.** |
| `live` | Always the backend. Failures surface as UI error states. |
| `auto` | Probes `/api/health`; falls back to mock **per endpoint**, so you can land the backend one route at a time. |

---

## Methodology

### Synthetic data

`api/mock/engine.ts` generates 430 days of daily records from a seeded PRNG
(mulberry32), so the same driver id always produces the same history. Each day
carries income, hours, deliveries, incentives, fuel cost, weather, rainfall,
temperature, holiday/festival flags, demand index and essential spend.

Effects are injected with noise and realistic correlations: monsoon seasonality
drives rainfall, rain reduces hours worked and therefore income, festivals lift
demand, weekends differ from weekdays, incentives trigger on high-demand days,
and the driver rests roughly one day a week (but is pulled into work by
festivals).

**The rule that keeps the demo honest:** the analysis layer reads *only* the
generated records — it never reads the injected constants back. So when the UI
says "Diwali lifted your income 24%", that number was measured from 7 observed
Diwali days, exactly the way a real model would measure it. The injected
constant is 31%; the measured one is 24%, and they differ because of noise,
sample size and weekday matching. That gap is the point.

### Forecast model

A three-layer hybrid, structured to mirror what the Python model will do:

- **L1 baseline** — day-of-week mean, corrected by a recent 30-day trend.
- **L2 context** — weather and festival multipliers *measured from this driver's
  own history*, plus work intent (rest days, extra hours).
- **L3 uncertainty** — residual σ per weekday, widened with horizon distance on
  a `√` curve and capped at 1.7×. (Linear growth was a bug: at six weeks out it
  made every lower bound collapse to zero.)

A naive trailing-7-day moving average runs alongside and is shown in the UI, so
the model's contribution is visible rather than asserted.

### Resilience buffer

Deliberately **not** "three months of expenses" — the whole point is that the
number tracks *this* driver's volatility and *this* month's obligations:

```
A  expected shortfall    = max(0, essentials(14d) − expected income(14d))
B  critical expenses     = daily essentials × 7   (one recovery week)
C  uncertainty margin    = 0.8416 × σ(14d)        (one-sided 80%)
D  fixed obligations     = rent/EMI/bills due in the next 21 days
E  recovery margin       = 0.6 × (median week − 10th-percentile week)
F  safe expected income  = min( p20 of forecast income(14d), A + D )

target = max(A + B + C + D + E − F, 5 days of essentials + largest critical bill)
```

`F` is capped so a strong forecast can cancel what you're about to pay out, but
can never drive the target to zero. Every term is shown in the UI with its sign
and a plain-language explanation — the calculation is not a black box.

### Shortfall risk

```
required = essentials(window) + monthly obligations × days / 30
P(shortfall) = Φ( (required − μ) / σ )
```

Bands are **product-display only**, not a credit or regulatory rating:
Low 0–30%, Moderate 30–60%, High 60–80%, Critical 80%+.

Two deliberate modelling choices:

1. **Obligations are amortised across the month** rather than shock-loaded into
   whichever week rent lands in — otherwise every rent week reads 100% and the
   signal is worthless. The cashflow chart still shows the real lumpy timing.
2. **Savings are excluded.** This measures "can this week pay for itself". How
   well savings cover the gap is reported separately as the buffer gap, which is
   measured from the week's *lowest* projected balance, since the trough is what
   actually breaks a driver.

---

## Design

The interface aims at premium, calm and data-dense without clutter: a deep navy
canvas, warm off-white ink, restrained blue gradients, and status colour used
sparingly.

**Charts.** The three series colours (income `#3987E5`, spend `#D95926`, balance
`#199E70`) were validated as a set against the dark card surface: all clear the
lightness band, the chroma floor, 3:1 contrast, and an all-pairs colour-vision
separation of ΔE 9.4. Don't swap one without re-validating the set.

Two specifics worth knowing, both the result of fixing a bad first attempt:

- **Cashflow is two stacked panels, not one chart.** A running balance in the
  thousands and daily flows in the hundreds on a shared axis flattens the bars
  to nothing — and a second y-axis would be worse. Each panel carries one
  measure and one scale.
- **The forecast range is a whisker, not a shaded band.** These are discrete
  days; a band that wide visually swamps the bars it's meant to qualify.

**Accessibility.** Risk is always icon + label + band range, never colour alone.
Calendar markers carry a symbol alongside the dot. Every chart has a legend and
a matching data table. Semantic HTML, labelled controls, visible focus rings, a
skip link, and `prefers-reduced-motion` honoured throughout. Verified with no
horizontal overflow at 1440 / 768 / 390px.

---

## Ethics and limitations

**What this product refuses to do**

- No lending, payday credit, BNPL or any financial product. Ever.
- No credit scoring. The app never judges whether someone deserves credit.
- No real credentials — no bank passwords, card numbers, UPI PINs or Aadhaar.
  The demo runs entirely on synthetic data.

**Language.** The product talks about income volatility, financial pressure,
shortfall risk, resilience and buffers. It does not call anyone poor, risky or
financially irresponsible. Arjun's problem is variance, not character.

**Honesty about model output.** Every figure is labelled by provenance —
`Historical` (measured), `Forecast` (predicted), `Scenario` (simulated). A
what-if is never presented as a prediction, and a prediction is never presented
as a fact. Every major prediction exposes its contributing factors.

**No invented accuracy.** `model_performance` is `null` in demo mode and the UI
says so plainly, rather than displaying fabricated MAE/R². Real metrics appear
only when a backend reports a real evaluation, labelled *"Prototype benchmark on
synthetic test data"*.

**Known limitations**

- All data is synthetic. Nothing here has been validated against real earnings.
- Weather is generated, not fetched from a forecast provider.
- Festival dates are approximate and cover 2025–2027 only.
- Relationships (rain, festivals, weekdays) are measured from one synthetic
  driver's history and must not be read as general claims about delivery work.
- The in-browser engine is a statistical forecaster, not a trained model. It
  reports `is_model_backed: false` honestly.
- The copilot is intent-matched over real computed figures, not an LLM.

---

## Adding the backend

The contract is fully specified in **[docs/API.md](docs/API.md)** — nine
endpoints, exact payloads, conventions and a FastAPI skeleton.

Two things make this straightforward:

1. The wire format is `snake_case`, so your Pydantic field names *are* the JSON
   keys. No aliases, no serialisation shim on either side.
2. `frontend/src/api/mock/handlers.ts` is a complete working implementation of
   every endpoint. When a response renders oddly, diff it against what that file
   returns for the same driver — it's the behavioural spec, not just fixtures.

Then set `VITE_DATA_SOURCE=live` in `frontend/.env` and restart. Nothing else
changes.
