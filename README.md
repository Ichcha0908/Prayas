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

No backend, no API keys, and nothing that resembles a real account — the one
thing it asks is which of four cities you're in (a location picker, not a
login), since that decides which city's real weather and fuel price drive the
forecast. The demo loads Arjun, a delivery partner, with 14 months of
synthetic earning history.

```bash
npm run build        # production build
npm run preview      # serve the build
npm run typecheck    # tsc, no emit
```

---

## The demo, in 90 seconds

Exact figures below vary by which city you pick and today's actual weather —
both are now real and live, not fixed fixtures — so treat the numbers as
illustrative of the shape of the demo, not a literal script.

1. **Landing page** → *Try the demo* → a 3-step entry: your name, your city
   (Delhi NCR, Mumbai, Chennai or Kolkata), then an optional step for loans
   and savings goals. Add a loan with a large EMI due soon and you'll see the
   default warning fire on the very next screen — or skip step 3 entirely,
   it leaves no trace anywhere in the app.
2. **Dashboard.** A 7-day income forecast against a "normal" week, with a
   shortfall-risk band. Hit **Why?** — the explanation is a ranked list of
   measured features, not "the AI detected a pattern".
3. **Signature demo.** In the header, click **Simulate Diwali** — risk falls,
   forecast income rises. Now click **Simulate Rain Shock** on top of it — risk
   rises again, but by less than the rain shock alone would cause. That gap
   *is* the product: the stronger Diwali week absorbs part of the rain-related
   shock.
4. **Cashflow.** Day-by-day balance against the buffer line, with the trough
   called out and the days carrying a fixed payment marked.
5. **Insights → "Loans, EMIs & goals."** If you added anything in step 1,
   this is where the detail lives: the exact minimum to hold for each EMI,
   the same default warning from the Dashboard banner, and each goal's
   pace — pro-rated by time elapsed, not just "is the money there."
6. **Stress Test.** Add a ₹5,000 emergency expense — risk band worsens, ending
   balance drops. Add **+2h Saturday** and watch it partially recover.
7. **Income Calendar.** Diwali shows a measured uplift (not hardcoded) from
   this driver's own history, typically in the 20-30% range.
8. **Ask Kamai** (sidebar). Every answer is computed from the data on screen.
9. **Header → your city name.** Click it to change location — every page
   refetches against the new city's real weather and fuel price.

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

**Weather is not synthetic.** `frontend/src/data/weather-delhi-ncr.json` is
real daily rainfall and temperature for South Delhi — Saket, pulled from
[Open-Meteo's ERA5 reanalysis archive](https://open-meteo.com/en/docs/historical-weather-api)
(free, no key, CC BY 4.0) by `scripts/fetch-weather.mjs`. The engine looks this
up by date for every historical day; a committed snapshot means the app needs
no setup, and `npm run fetch:weather` refreshes it. Only the forward-looking
forecast window still uses synthetic weather, since real future weather
doesn't exist yet. Every income effect described above (rain reducing hours,
the measured rain-day income gap in Insights) is therefore now computed
against actual Delhi monsoon rainfall on actual dates, not invented noise.

**Arjun's income level is deliberately calibrated, not guessed.** The
brief's own instruction is that this persona should read as "empowering,
intelligent... not poor," so the baseline needed to sit above the lower end of
what's actually reported for Indian delivery work, without becoming
unrealistic. Cross-checked against `evidence-sources.json`: PAIGAM/IFAT's
worker survey found 43% of app-based delivery workers earn under ₹10,000/month
and 27% earn ₹500-1,000/day; Fairwork India's 2024 interviews reported
₹500-600/day; PLFS puts the *national* self-employed average at ₹12,144/month
across every sector, most of it far lower-earning than urban gig delivery.
Arjun's computed average — currently ₹36,679/month, ₹1,356 median daily — sits
above all three, consistent with the brief, while Eternal's own CEO has stated
platform-wide average earnings of ₹102/hour in 2025 (up from ₹92 in 2024,
company-reported, not independently audited) as a broader sanity check on the
hourly scale involved.

**Neither is the forward-looking forecast, as of the most recent change.**
Historical weather became real first; the actual forecast pages
(`/app/forecast`, `/app/cashflow`) kept using synthetic weather for future
days even after that. `frontend/src/api/mock/engine.ts` now fetches
Open-Meteo's live forecast endpoint — same free provider, its forward-looking
API this time — once per browser session, and uses it for every day within
its 16-day reach. Because a forecast snapshot goes stale within days, this
can't be a committed file the way history is: it's fetched live, memoized so
navigating between pages doesn't refetch, and falls back to the synthetic
generator (logged, never thrown) if the network call fails. Verified by
deliberately blocking the request in a real browser — the app kept rendering
correctly throughout.

**Fuel price is also not synthetic.** `frontend/src/data/fuel-price-delhi.json`
is the real Delhi retail petrol price — ₹102.12/litre — from
[PPAC](https://ppac.gov.in) (Petroleum Planning & Analysis Cell, Ministry of
Petroleum & Natural Gas), verified against its own daily bulletin as flat for
at least 96 consecutive days. Each driver's daily fuel cost is derived from
this real price via a documented mileage assumption rather than a guessed
rupee figure, and the stress test's fuel-cost scenario states the real price
directly rather than an abstract percentage. Unlike weather, this one has no
automated refresh: PPAC publishes no API, only a same-day-dated PDF whose
filename can't be predicted in advance, so the data file documents how to
update it by hand instead of shipping a scraper that would silently break.

**Workforce context is also real, and scoped honestly.**
`frontend/src/data/plfs-urban-workforce-india.json` holds figures from MoSPI's
Periodic Labour Force Survey — extracted from a chart the PLFS dashboard has
no public API for, so it's a manually read, committed snapshot rather than a
live fetch. This is national macro data, not a per-driver input: it does not
feed the income model. Its one use is a citation — the landing page states
that self-employed workers are 54.2% of India's urban workforce (the largest
single segment), replacing what was previously an unsourced "7.7 million gig
workers" claim. The file is also explicit about what it doesn't trust: the
most recent four quarters of one series are flagged `unverified` because they
jump far more than any earlier quarter in the same table, which looks like a
PDF column-alignment artifact rather than a real swing that size.

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

### Evidence base

`frontend/src/data/evidence-sources.json` holds 30 cited claims — government
data, platform-reported figures and trade-press reporting — that several parts
of the model and the landing page are calibrated against. Each row carries the
claim, its exact value, source, year, a confidence rating, and which part of
the product it informs. When this file was imported, every source URL was
checked live: 26 of 30 returned 200 directly; the other 4 are on real, live
domains (Fairwork, Flourish Ventures, NewsBytes, ThePrint) that either
bot-block simple HTTP clients or have moved one specific PDF — not evidence of
a fabricated citation, but recorded honestly as unconfirmed rather than
silently treated as equal to the 26 that resolved cleanly.

What changed as a result:

- **Rain classification now follows IMD's own bands** (light <15mm, moderate
  15–64.5mm, heavy 64.5mm+), replacing three arbitrary thresholds that were
  never checked against anything. The synthetic generator's rain-amount
  ranges, the live-forecast WMO-code mapping, and the historical fetch
  script's mapping were all updated to match — three places that need to
  agree with each other, now agreeing with IMD instead of with each other by
  coincidence. The stress test's "Extreme" rainfall setting is calibrated so
  its ceiling lands near Delhi's own worst recorded single-day rainfall
  (98.7mm in Aug 2026, 153mm in Jul 2023 — IMD via press reporting), not an
  arbitrary number.
- **A rain-fee surcharge now partially offsets the rain income penalty.**
  Platforms add a per-order rain fee during heavier rain (₹15–35/order,
  Zomato/Swiggy policy via market reporting). Modelled as a small flat bonus
  on `heavy_rain`/`storm` days — deliberately kept well below the
  multiplicative loss at every tier, checked numerically after implementing
  it, because the evidence itself frames this as a *partial* offset and the
  entire "Simulate Rain Shock" demo depends on rain staying net negative.
- **Diwali's uplift dropped from an uncited 31% to 28%,** and **Raksha
  Bandhan's from 15% to 14%**, both now inside ranges the evidence explicitly
  recommends — one source's own note reads "platform-level volume; per-rider
  uplift is smaller... model ~20-30%, not +100%," which is exactly the kind of
  distinction this file preserves rather than collapses.
- **Raksha Bandhan's 2026 date (28 August) was cross-checked** against the
  Hindu lunisolar calendar and confirmed already correct.
- **The landing page's "7.7 million gig workers" line, and a "47% couldn't
  cover a month of expenses without borrowing" stat**, replaced softer
  unsourced framing with NITI Aayog's and Flourish Ventures' actual figures.

**Four evidence rows are preserved but not yet built into the model**: real-time
traffic congestion (TomTom Traffic Index), Delhi's AQI/GRAP winter
restrictions (Commission for Air Quality Management), heat's effect on
delivery-worker earning windows (WRI India, Business Standard), and a
zone-level "Income Weather Map" showing waterlogging risk. All four are
genuine, cited, and would extend the same context-multiplier pattern the
weather and festival models already use — they're sitting in the evidence
file as a ready-made spec for whoever builds them next, not silently dropped.

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

**Component D includes any loans entered at onboarding**, not just the
built-in rent and vehicle EMI. `/login`'s optional third step lets a driver
add up to three loans (label, EMI, due day, optional end date) and three
savings goals; loans flow into the exact same `obligationSpecs()` pipeline as
rent and EMI, so the buffer, the shortfall probability, the Cashflow chart and
the calendar all pick them up automatically — there's no separate code path
that could quietly disagree with the rest of the app. A dedicated
`GET /api/commitments/:id` then assesses each loan against a real cashflow
projection to answer the two questions a driver actually has: *"how much do I
need to keep aside for this EMI"* (the literal EMI amount) and *"am I about to
miss it"* (a plain-language early warning, fired the moment the projected
balance on that due date goes negative — before the date arrives, not after).
Savings goals get the same honesty treatment: progress is pro-rated by time
elapsed, not just compared to the target, and the amount to hold for a goal is
shown as an explicit addition on top of the resilience buffer above, never
folded into it — "can I survive a bad week" and "am I on track for this goal"
are different questions, and blending their numbers would answer neither one
clearly.

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
- Weather is real end to end — historical (Open-Meteo ERA5) and the next 16
  days of forecast (Open-Meteo's forecast API) — for whichever of the four
  supported cities is selected. Only the days beyond that 16-day reach, and
  the calendar's much longer 60-day view, use the synthetic generator.
- Location changes weather, fuel price and the displayed city/zone only.
  Rent, EMI, food and family expenses stay at their Delhi-calibrated values
  regardless of which city is selected — a real simplification, not an
  oversight: those would need their own per-city sourcing to vary honestly,
  and none was done here.
- The synthetic weather generator (used only as a fallback when a live fetch
  fails) applies Delhi-style monsoon seasonality regardless of selected city,
  so a fallback day in Chennai — which has a materially different rain
  season — won't look meteorologically right. The real-data path, which is
  what actually renders in normal use, does not have this problem.
- Festival dates are approximate, pan-India rather than city-specific, and
  cover 2025–2027 only.
- Loans and goals can only be set once, at onboarding. There is no way to
  edit or remove one afterwards short of clearing `localStorage` and going
  through `/login` again — a real scope cut, not an oversight, since building
  a proper "manage your commitments" screen is a separate piece of work from
  making the numbers those commitments produce actually correct.
- A goal's pacing is measured from when it was added, not from some earlier
  real-world date — so a goal you enter today always starts at "on track"
  regardless of how far off the target date is, since zero time has passed
  to fall behind in. That's the correct behaviour for the data available, not
  a bug, but it does mean the "behind pace" state only becomes visible in a
  session that outlives the goal's own timeline.
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
