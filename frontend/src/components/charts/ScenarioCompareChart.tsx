import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StressTestOutcome } from '@/api/types';
import { axisProps, gridProps, moneyTick, niceScale, VIZ } from '@/lib/chartTheme';
import { dayDate, inr } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Row {
  date: string;
  label: string;
  baseline: number;
  scenario: number;
}

function CompareTooltip({
  active,
  payload,
  bufferTarget,
  scenarioLabel,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  bufferTarget: number;
  scenarioLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const delta = r.scenario - r.baseline;

  return (
    <div className="min-w-[13rem] rounded-xl border border-canvas-line bg-canvas-raised/97 p-3 shadow-lift backdrop-blur">
      <p className="mb-2 border-b border-canvas-line pb-2 text-xs font-600 text-ink">{dayDate(r.date)}</p>
      <dl className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <span
              className="h-0.5 w-4"
              style={{ background: `repeating-linear-gradient(90deg, ${VIZ.axis} 0 4px, transparent 4px 8px)` }}
              aria-hidden
            />
            Normal forecast
          </dt>
          <dd className="tnum text-ink-soft">{inr(r.baseline)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex min-w-0 items-center gap-1.5 text-ink-muted">
            <span className="h-0.5 w-4 rounded-full" style={{ background: VIZ.balance }} aria-hidden />
            <span className="truncate">{scenarioLabel}</span>
          </dt>
          <dd className="tnum font-600 text-ink">{inr(r.scenario)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-canvas-line pt-1.5">
          <dt className="text-ink-muted">Difference</dt>
          <dd className={cn('tnum font-600', delta < 0 ? 'text-serious-ink' : 'text-good-ink')}>
            {inr(delta, { sign: true })}
          </dd>
        </div>
      </dl>
      {r.scenario < bufferTarget ? (
        <p className="mt-2 text-[11px] text-warn-ink">Below your buffer of {inr(bufferTarget)}</p>
      ) : null}
    </div>
  );
}

/**
 * Baseline vs. scenario projected balance.
 * Two lines on ONE axis — never a dual-axis comparison.
 */
export function ScenarioCompareChart({
  baseline,
  scenario,
  height = 300,
}: {
  baseline: StressTestOutcome;
  scenario: StressTestOutcome;
  height?: number;
}) {
  const rows = useMemo<Row[]>(
    () =>
      baseline.days.map((d, i) => ({
        date: d.date,
        label: d.day_label,
        baseline: d.closing_balance,
        scenario: scenario.days[i]?.closing_balance ?? d.closing_balance,
      })),
    [baseline.days, scenario.days],
  );

  if (!rows.length) return null;

  const values = rows.flatMap((r) => [r.baseline, r.scenario]).concat(scenario.buffer_target);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  // Keep zero in view when a scenario pushes the balance negative.
  const scale = niceScale(Math.min(lo - span * 0.15, 0), hi + span * 0.2);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={4} />
          <YAxis
            {...axisProps}
            width={54}
            tickFormatter={moneyTick}
            domain={[scale.min, scale.max]}
            ticks={scale.ticks}
          />
          <Tooltip
            content={<CompareTooltip bufferTarget={scenario.buffer_target} scenarioLabel={scenario.label} />}
            cursor={{ stroke: VIZ.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          <ReferenceLine y={0} stroke={VIZ.grid} />
          <ReferenceLine
            y={scenario.buffer_target}
            stroke={VIZ.buffer}
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: `Buffer ${inr(scenario.buffer_target, { compact: true })}`,
              position: 'insideTopRight',
              fill: VIZ.buffer,
              fontSize: 11,
              fontWeight: 600,
            }}
          />

          <Line
            type="monotone"
            dataKey="baseline"
            stroke={VIZ.axis}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Normal forecast"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="scenario"
            stroke={VIZ.balance}
            strokeWidth={2}
            dot={{ r: 4, fill: VIZ.balance, stroke: VIZ.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: VIZ.balance, stroke: VIZ.surface, strokeWidth: 2 }}
            name={scenario.label}
            animationDuration={420}
          />
        </LineChart>
      </ResponsiveContainer>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-muted">
        <li className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4"
            style={{ background: `repeating-linear-gradient(90deg, ${VIZ.axis} 0 4px, transparent 4px 8px)` }}
            aria-hidden
          />
          Normal forecast
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: VIZ.balance }} aria-hidden />
          {scenario.label}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4"
            style={{ background: `repeating-linear-gradient(90deg, ${VIZ.buffer} 0 4px, transparent 4px 8px)` }}
            aria-hidden
          />
          Resilience buffer
        </li>
      </ul>
    </div>
  );
}
