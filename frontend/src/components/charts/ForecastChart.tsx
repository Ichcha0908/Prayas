import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastDay } from '@/api/types';
import { axisProps, gridProps, moneyTick, niceScale, VIZ } from '@/lib/chartTheme';
import { dayDate, inr, pct } from '@/lib/format';
import { WeatherIcon } from '@/lib/weather';
import { cn } from '@/lib/cn';

interface Row {
  date: string;
  label: string;
  expected: number;
  historical: number;
  /** Floating-bar pair that draws the 80% range as a thin whisker. */
  rangeBase: number;
  rangeSpan: number;
  lower: number;
  upper: number;
  essential: number;
  rest: boolean;
  weather: ForecastDay['weather'];
  festival: string | null;
  confidence: number;
}

function ForecastTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const delta = r.historical ? r.expected / r.historical - 1 : 0;

  return (
    <div className="min-w-[13rem] rounded-xl border border-canvas-line bg-canvas-raised/97 p-3 shadow-lift backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-canvas-line pb-2">
        <span className="text-xs font-600 text-ink">{dayDate(r.date)}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <WeatherIcon code={r.weather.code} className="h-4 w-4" />
          {r.weather.rainfall_mm > 0 ? `${r.weather.rainfall_mm}mm` : r.weather.label}
        </span>
      </div>

      {r.rest ? (
        <p className="text-xs text-ink-muted">Planned non-working day — no income modelled.</p>
      ) : (
        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Expected income</dt>
            <dd className="tnum font-600 text-ink">{inr(r.expected)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px] text-ink-faint">
            <dt>80% range</dt>
            <dd className="tnum">
              {inr(r.lower)} – {inr(r.upper)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Your {r.label} average</dt>
            <dd className="tnum text-ink-soft">{inr(r.historical)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-canvas-line pt-1.5">
            <dt className="text-ink-muted">vs. that average</dt>
            <dd className={cn('tnum font-600', delta < 0 ? 'text-serious-ink' : 'text-good-ink')}>{pct(delta)}</dd>
          </div>
          {r.weather.income_impact !== 0 ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-muted">Weather effect</dt>
              <dd className={cn('tnum', r.weather.income_impact < 0 ? 'text-serious-ink' : 'text-good-ink')}>
                {inr(r.weather.income_impact, { sign: true })}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Essential spend</dt>
            <dd className="tnum text-ink-soft">{inr(-r.essential)}</dd>
          </div>
        </dl>
      )}

      {r.festival ? (
        <p className="mt-2 rounded-md bg-brand-900/40 px-2 py-1 text-[11px] text-brand-200">{r.festival} window</p>
      ) : null}
    </div>
  );
}

/**
 * Daily income forecast.
 *
 * The forecast range is drawn as a thin floating whisker beside each day rather
 * than as a shaded ribbon: these are discrete, categorical days, and a filled
 * band this wide visually swamps the bars it is meant to qualify. (Recharts'
 * own ErrorBar collapses the bar geometry inside a ComposedChart, so the
 * whisker is built from a transparent base bar plus a stacked span.)
 */
export function ForecastChart({ days, height = 300 }: { days: ForecastDay[]; height?: number }) {
  const rows = useMemo<Row[]>(
    () =>
      days.map((d) => ({
        date: d.date,
        label: d.day_label,
        expected: d.expected_income,
        historical: d.historical_average,
        rangeBase: d.lower_bound,
        rangeSpan: Math.max(0, d.upper_bound - d.lower_bound),
        lower: d.lower_bound,
        upper: d.upper_bound,
        essential: d.expected_essential_spend,
        rest: d.is_planned_rest_day,
        weather: d.weather,
        festival: d.festival?.name ?? null,
        confidence: d.confidence,
      })),
    [days],
  );

  const scale = useMemo(() => {
    if (!rows.length) return null;
    const values = rows.flatMap((r) => [r.upper, r.historical, r.expected]).concat(0);
    return niceScale(0, Math.max(...values) * 1.06);
  }, [rows]);

  if (!rows.length || !scale) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} barGap={3}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval={0} minTickGap={0} />
          <YAxis
            {...axisProps}
            width={54}
            tickFormatter={moneyTick}
            domain={[scale.min, scale.max]}
            ticks={scale.ticks}
          />
          <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

          <Bar
            dataKey="expected"
            fill={VIZ.income}
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
            name="Expected income"
            animationDuration={500}
          />

          {/* Transparent pedestal lifts the span bar to the lower bound. */}
          <Bar dataKey="rangeBase" stackId="range" fill="transparent" maxBarSize={4} isAnimationActive={false} />
          <Bar
            dataKey="rangeSpan"
            stackId="range"
            fill={VIZ.bandStroke}
            radius={2}
            maxBarSize={4}
            isAnimationActive={false}
            name="80% forecast range"
          />

          <Line
            type="monotone"
            dataKey="historical"
            stroke={VIZ.buffer}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Your day-of-week average"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: VIZ.income }} aria-hidden />
          Expected income
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded-full" style={{ background: VIZ.bandStroke }} aria-hidden />
          80% forecast range
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4"
            style={{ background: `repeating-linear-gradient(90deg, ${VIZ.buffer} 0 4px, transparent 4px 8px)` }}
            aria-hidden
          />
          Your day-of-week average
        </li>
      </ul>
    </div>
  );
}
