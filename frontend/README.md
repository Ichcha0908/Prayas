# KAMAI.AI — frontend

React + TypeScript + Vite. See the [root README](../README.md) for the product
overview and [docs/API.md](../docs/API.md) for the backend contract.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Works with no backend: `.env` ships with `VITE_DATA_SOURCE=mock`, which runs the
deterministic in-browser demo engine.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc -b --noEmit` |

## Configuration

Copy `.env.example` to `.env` and adjust:

```ini
VITE_API_BASE_URL=          # empty = same-origin /api (Vite proxies it)
VITE_DATA_SOURCE=mock       # mock | live | auto
VITE_DEMO_DRIVER_ID=DRV-0001
```

The dev proxy forwards `/api/*` to `BACKEND_ORIGIN`, default
`http://localhost:8000`:

```bash
BACKEND_ORIGIN=http://localhost:9000 npm run dev
```

## Where things live

| Path | Purpose |
|---|---|
| `src/api/types.ts` | **The contract.** Every wire shape, one file. |
| `src/api/client.ts` | fetch wrapper: base URL, timeouts, `ApiError` |
| `src/api/index.ts` | Live/mock resolution — the swap point |
| `src/api/mock/engine.ts` | Synthetic data + the forecasting model |
| `src/data/weather-delhi-ncr.json` | Real historical weather (see below) |
| `scripts/fetch-weather.mjs` | Refreshes the real weather file |
| `src/data/fuel-price-by-city.json` | Real petrol/diesel price for all 4 supported cities |
| `src/data/plfs-urban-workforce-india.json` | Real national workforce data (see below) |
| `src/lib/locations.ts` | The 4 supported cities: coordinates, zone labels, localStorage |
| `src/hooks/useLocation.tsx` | Location context — selection, persistence, change |
| `src/hooks/useCommitments.tsx` | Name + loans/goals context — the optional step 3 |
| `src/pages/Login.tsx` | The 3-step entry gate: name, city, loans/goals |
| `src/data/evidence-sources.json` | 30 cited claims backing the model calibration and landing-page copy (see root README's Evidence base section) |
| `src/api/mock/handlers.ts` | Reference implementation of all 9 endpoints |
| `src/hooks/useAppData.tsx` | App-wide data + the scenario overlay |
| `src/components/charts/` | Recharts components |
| `src/lib/chartTheme.ts` | Validated series colours, axis props, `niceScale` |
| `src/lib/format.ts` | `inr()`, `pct()`, dates, risk-band classes |

## Conventions

- **Money is integer rupees** end to end. `inr()` does all formatting; no
  component builds a currency string by hand.
- **Percent-change values are floats** (`0.24` = +24%). `pct()` renders them.
- **Provenance is mandatory.** Any displayed figure that is a forecast or a
  scenario carries a `ProvenanceChip`. Never present a simulation as a fact.
- **Risk is never colour-alone.** `RiskBadge` always renders icon + label.
- **Charts use one axis per measure.** No dual-axis charts; split into panels.
  Every chart ships a legend and a corresponding data table.
- Grids that only set `lg:grid-cols-*` must also set `grid-cols-1`, or the
  single mobile column is `auto`-sized and overflows the viewport.

## Real weather data

Historical weather is not synthetic. `src/data/weather-delhi-ncr.json` is real
daily rainfall and temperature for South Delhi — Saket, fetched from
[Open-Meteo's ERA5 reanalysis archive](https://open-meteo.com/en/docs/historical-weather-api)
(free, no API key, CC BY 4.0). `engine.ts` looks up this file by date for every
day in the driver's history; only the forward-looking forecast window (where
real future weather doesn't exist yet) uses the synthetic generator.

A snapshot is committed to the repo, so the app works with zero setup. To
extend coverage as time passes:

```bash
npm run fetch:weather
```

This is what makes a claim like *"your heavy-rain days earned 19% less"* a
statement about actual Delhi monsoon rainfall on actual dates, not synthetic
noise — check `/app/calendar`, select a day in September, and the rainfall
figure shown is what actually fell that day.

**The forward-looking forecast is live, not just history.** The `/app/forecast`
and `/app/cashflow` pages used to fall straight to synthetic weather for every
future day, even after history became real. They no longer do:
`loadLiveForecastWeather()` in `engine.ts` fetches Open-Meteo's forecast
endpoint (same free, no-key, CORS-enabled provider, its forward-looking API
instead of the ERA5 archive) once per browser session and feeds the next 16
days of real predicted weather into every forecast day it covers. A forecast
snapshot goes stale within days, so unlike history this is **not** a committed
file — it's fetched live, memoized so six pages sharing the same navigation
trigger exactly one request, and falls back to the synthetic generator with a
logged warning (never a thrown error) if the fetch fails. Days beyond 16 out,
and the calendar's much longer 60-day view, correctly stay synthetic — no
provider forecasts weather that far out with real skill.

## Onboarding: name, location, loans & goals

Before reaching `/app`, every visitor goes through a 3-step `/login`: a
display name, a city, and an entirely optional third step for loans and
savings goals. This is deliberately **not** a real login (this product's own
ethics section rules out fake credentials) — steps 1 and 2 are the minimum the
demo needs to personalise anything, and step 3 exists because a resilience
buffer that ignores a driver's actual EMIs and goals is answering a smaller
question than the one they actually have. All three persist to `localStorage`
(`kamai.selectedCityId`, `kamai.commitments`), and `/app/*` redirects back to
`/login` if the name or city is missing.

### Step 2: location

Delhi NCR, Mumbai, Chennai or Kolkata.

The four cities are exactly the ones PPAC's daily fuel bulletin covers — see
below — so every price shown is real and checked, never a same-country
approximation for a city with no source behind it. Coordinates are each
city's IMD reference observatory (Safdarjung, Santacruz, Nungambakkam,
Alipore — `src/lib/locations.ts`), matching the convention already used for
Delhi. Selecting a city does not generate a different persona: Arjun's income
pattern, expenses and history stay the same everywhere — only the
location-derived inputs (weather, fuel price, the city/zone label) change.
Switching city later, via the header's location button, triggers a full
refetch of every page against the new city and clears the previous city's
cached live-weather data so nothing stale bleeds through.

Historical weather for Delhi still uses the committed snapshot (no network
round trip); the other three cities have no such file — committing one per
city would mean maintaining several going stale at different rates — so their
history is fetched live from the same ERA5 archive endpoint, once per
session, exactly like the live forecast already was.

### Step 3: loans, EMIs & goals (optional)

Up to three loans and three goals, added inline during onboarding with a
"Skip for now" always sitting next to "Finish." A loan is a label, an EMI
amount, a due day of month and an optional end date; a goal is a label, a
target amount, a target date and how much is already saved. Both flow
straight into computation, not just storage:

- **Loans become obligations.** `obligationSpecs()` in `engine.ts` appends
  each active loan (filtered by `end_date`) alongside the built-in rent and
  vehicle EMI, so they automatically reach the resilience buffer's
  `fixed_obligations` component, the shortfall-probability calculation, the
  Cashflow chart's obligation markers, and the calendar's "fixed payment due"
  flags — one pipeline, not a parallel one to keep in sync.
- **`GET /api/commitments/:id` assesses each loan against a real cashflow
  projection**, not a separate estimate. `at_risk_of_default` is `true`
  exactly when the projected closing balance on that loan's next due date is
  negative — the same thing the Cashflow page's own chart would show as a dip
  below zero. When true, the Dashboard shows a warning banner *before* the
  date arrives, and Insights shows the exact shortfall.
- **Each goal's pace is pro-rated by elapsed time**, not just "is the money
  there": `expected_progress_amount = target × (days since created ÷ days to
  target)`. A goal added five minutes ago always shows `on_track: true` —
  correctly, since zero time has passed. `minimum_extra_to_maintain` is
  framed as "hold this much, on top of your resilience buffer" rather than
  folded into the buffer itself, since "can I survive a bad week" and "am I
  on track for this goal" are different questions that shouldn't share one
  number.

Skipping this step leaves no trace in the UI — the Dashboard banner and the
Insights "Loans, EMIs & goals" card both render nothing when there's nothing
to show, rather than an empty state nobody asked to see.

### Real fuel price data

`src/data/fuel-price-by-city.json` holds the real retail petrol and diesel
price for all four supported cities, from [PPAC](https://ppac.gov.in)
(Petroleum Planning & Analysis Cell, Ministry of Petroleum & Natural Gas) —
₹102.12/litre in Delhi as of this writing, confirmed flat for at least 96
consecutive days in PPAC's own daily bulletin, alongside Mumbai (₹111.21),
Chennai (₹107.77) and Kolkata (₹113.51). `engine.ts` derives each driver's
daily fuel cost from whichever price matches the selected city, times a
documented city-mileage assumption (`estimateDailyFuelCost`), rather than a
guessed rupee figure. The stress test's fuel-cost scenario cites the real
price for the selected city directly: *"Petrol in Mumbai is ₹111.21/litre
today (PPAC). A 15% rise would put it near ₹127.89/litre."*

Unlike weather, there is **no automated refresh script** for this one — PPAC
publishes no API or downloadable table, only a same-day-dated PDF whose
filename isn't predictable in advance, and it's also the reason the location
picker stops at four cities: that bulletin covers exactly these four and no
others. The JSON file documents exactly how to refresh it by hand, and says
so rather than shipping a scraper that would silently break the next time
PPAC renames a file.

## Real workforce data (PLFS)

`src/data/plfs-urban-workforce-india.json` holds real figures from MoSPI's
Periodic Labour Force Survey (PLFS): urban Worker Population Ratio by year,
urban Labour Force Participation Rate by quarter, and the urban employment
status split (self-employed / regular wage-salaried / casual labour). It was
extracted from a chart the user exported from the PLFS dashboard — that
dashboard has no public API, so this is a manually read, committed snapshot,
same as the fuel price file.

This is **national macro data, not a per-driver input** — it does not feed the
income model, which stays keyed to each driver's own observed history. The one
place it's used is a citation: `PLFS_URBAN_SELF_EMPLOYED_SHARE` (54.2%) grounds
the landing page's framing of the persona, replacing a previously unsourced
"7.7 million gig workers" claim with a real, cited figure.

Not everything in the file is equally solid, and it says so: the annual WPR
and the employment-status split are high confidence (clean, well-separated
values). The four most recent LFPR quarters are flagged `unverified` — they
jump far more than any earlier quarter-to-quarter change in the same series,
which looks more like a column-misalignment artifact from a wide, flattened
PDF table than a real one-quarter swing that size. The file documents the
discrepancy rather than presenting an uncertain number as settled fact.
