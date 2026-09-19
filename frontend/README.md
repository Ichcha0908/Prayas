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
