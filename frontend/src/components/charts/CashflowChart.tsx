import { useMemo } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CashflowDay } from '@/api/types';
import { axisProps, gridProps, moneyTick, niceScale, VIZ } from '@/lib/chartTheme';
import { dayDate, inr } from '@/lib/format';
import { cn } from '@/lib/cn';
import { WeatherIcon } from '@/lib/weather';

interface Row {
  date: string;
  label: string;
  income: number;
  outflow: number;
  balance: number;
  /** Stacked as [floor, span] so the band renders as a ribbon, not a fill. */
  bandFloor: number;
  bandSpan: number;
  lower: number;
  upper: number;
  obligations: number;
  obligationLabels: string[];
  essential: number;
  festival: string | null;
  weather: CashflowDay['weather_code'];
  belowBuffer: boolean;
}

function buildRows(days: CashflowDay[]): Row[] {
  return days.map((d) => ({
    date: d.date,
    label: d.day_label,
    income: d.income,
    outflow: -(d.essential_spend + d.obligations),
    balance: d.closing_balance,
    bandFloor: d.balance_lower,
    bandSpan: Math.max(0, d.balance_upper - d.balance_lower),
    lower: d.balance_lower,
    upper: d.balance_upper,
    obligations: d.obligations,
    obligationLabels: d.obligation_labels,
    essential: d.essential_spend,
    festival: d.festival,
    weather: d.weather_code,
    belowBuffer: d.below_buffer,
  }));
}

/** Shared tooltip — both panels describe the same day, so they read alike. */
function CashflowTooltip({
  active,
  payload,
  bufferTarget,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  bufferTarget: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const net = row.income + row.outflow;

  return (
    <div className="min-w-[13rem] rounded-xl border border-canvas-line bg-canvas-raised/97 p-3 shadow-lift backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-canvas-line pb-2">
        <span className="text-xs font-600 text-ink">{dayDate(row.date)}</span>
        <WeatherIcon code={row.weather} className="h-4 w-4" />
      </div>

      <dl className="space-y-1.5 text-xs">
        <TipRow color={VIZ.income} label="Income" value={inr(row.income)} />
        <TipRow color={VIZ.spend} label="Essentials" value={inr(-row.essential)} />
        {row.obligations > 0 ? (
          <TipRow
            color={VIZ.spend}
            label={row.obligationLabels.join(', ') || 'Fixed costs'}
            value={inr(-row.obligations)}
          />
        ) : null}
        <div className="flex items-center justify-between gap-4 border-t border-canvas-line pt-1.5">
          <dt className="text-ink-muted">Net</dt>
          <dd className={cn('tnum font-600', net >= 0 ? 'text-good-ink' : 'text-serious-ink')}>
            {inr(net, { sign: true })}
          </dd>
        </div>
        <TipRow color={VIZ.balance} label="Closing balance" value={inr(row.balance)} strong />
        <div className="flex items-center justify-between gap-4 text-[11px] text-ink-faint">
          <dt>Likely range</dt>
          <dd className="tnum">
            {inr(row.lower, { compact: true })} – {inr(row.upper, { compact: true })}
          </dd>
        </div>
      </dl>

      {row.festival ? (
        <p className="mt-2 rounded-md bg-brand-900/40 px-2 py-1 text-[11px] text-brand-200">{row.festival} window</p>
      ) : null}
      {row.balance < bufferTarget ? (
        <p className="mt-2 text-[11px] text-warn-ink">Below your resilience buffer of {inr(bufferTarget)}</p>
      ) : null}
    </div>
  );
}

function TipRow({ color, label, value, strong }: { color: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex min-w-0 items-center gap-1.5 text-ink-muted">
        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn('tnum shrink-0', strong ? 'font-600 text-ink' : 'text-ink-soft')}>{value}</dd>
    </div>
  );
}


/**
 * Cashflow is two measures on very different scales — a running balance in the
 * thousands and daily flows in the hundreds. Putting them on one axis flattens
 * the bars to nothing, and a second y-axis would be worse. So this renders two
 * stacked panels sharing one x-axis: each panel has a single measure and a
 * single scale, and the shared tooltip ties a day together across both.
 */
export function CashflowChart({
  days,
  bufferTarget,
  height = 340,
  showBand = true,
}: {
  days: CashflowDay[];
  bufferTarget: number;
  height?: number;
  showBand?: boolean;
}) {
  const rows = useMemo(() => buildRows(days), [days]);

  const scales = useMemo(() => {
    if (!rows.length) return null;

    const balanceValues = rows.flatMap((r) => [r.balance, r.lower, r.upper]).concat(bufferTarget);
    const bSpan = Math.max(...balanceValues) - Math.min(...balanceValues);
    const balance = niceScale(
      Math.max(0, Math.min(...balanceValues) - bSpan * 0.15),
      Math.max(...balanceValues) + bSpan * 0.2,
    );

    const flowValues = rows.flatMap((r) => [r.income, r.outflow]).concat(0);
    const flow = niceScale(Math.min(...flowValues) * 1.08, Math.max(...flowValues) * 1.08);

    return { balance, flow };
  }, [rows, bufferTarget]);

  if (!rows.length || !scales) return null;

  const balanceHeight = Math.round(height * 0.62);
  const flowHeight = Math.max(120, height - balanceHeight);

  return (
    <div>
      {/* ------------------------------------------- panel 1: balance */}
      <div>
        <p className="mb-1 text-[11px] font-600 text-ink-muted">Projected balance</p>
        <ResponsiveContainer width="100%" height={balanceHeight}>
          <ComposedChart data={rows} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} tick={false} height={1} />
            <YAxis
              {...axisProps}
              width={54}
              tickFormatter={moneyTick}
              domain={[scales.balance.min, scales.balance.max]}
              ticks={scales.balance.ticks}
            />
            <Tooltip
              content={<CashflowTooltip bufferTarget={bufferTarget} />}
              cursor={{ stroke: VIZ.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
            />

            {showBand ? (
              <>
                <Area dataKey="bandFloor" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area
                  dataKey="bandSpan"
                  stackId="band"
                  stroke="none"
                  fill={VIZ.balanceBand}
                  isAnimationActive={false}
                />
              </>
            ) : null}

            {/* Days carrying a fixed payment, marked before the data line. */}
            {rows
              .filter((r) => r.obligations > 0)
              .map((r) => (
                <ReferenceLine key={`ob-${r.date}`} x={r.label} stroke={VIZ.spend} strokeWidth={1} strokeOpacity={0.35} />
              ))}

            <ReferenceLine
              y={bufferTarget}
              stroke={VIZ.buffer}
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `Buffer ${inr(bufferTarget, { compact: true })}`,
                position: 'insideTopRight',
                fill: VIZ.buffer,
                fontSize: 11,
                fontWeight: 600,
              }}
            />

            <Line
              type="monotone"
              dataKey="balance"
              stroke={VIZ.balance}
              strokeWidth={2}
              dot={{ r: 4, fill: VIZ.balance, stroke: VIZ.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: VIZ.balance, stroke: VIZ.surface, strokeWidth: 2 }}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* --------------------------------------- panel 2: daily flows */}
      <div className="mt-2">
        <p className="mb-1 text-[11px] font-600 text-ink-muted">Daily money in and out</p>
        <ResponsiveContainer width="100%" height={flowHeight}>
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval={0} minTickGap={0} />
            <YAxis
              {...axisProps}
              width={54}
              tickFormatter={moneyTick}
              domain={[scales.flow.min, scales.flow.max]}
              ticks={scales.flow.ticks}
            />
            <Tooltip
              content={<CashflowTooltip bufferTarget={bufferTarget} />}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <ReferenceLine y={0} stroke={VIZ.grid} strokeWidth={1} />
            <Bar dataKey="income" fill={VIZ.income} radius={[4, 4, 0, 0]} maxBarSize={22} name="Income" />
            <Bar
              dataKey="outflow"
              fill={VIZ.spend}
              radius={[0, 0, 4, 4]}
              maxBarSize={22}
              name="Essentials & fixed costs"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend bufferTarget={bufferTarget} />
    </div>
  );
}

function ChartLegend({ bufferTarget }: { bufferTarget: number }) {
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-muted">
      <LegendItem color={VIZ.balance} label="Projected balance" shape="line" />
      <LegendItem color={VIZ.balance} label="Forecast range" shape="band" />
      <LegendItem color={VIZ.buffer} label={`Resilience buffer (${inr(bufferTarget, { compact: true })})`} shape="dash" />
      <LegendItem color={VIZ.income} label="Income" />
      <LegendItem color={VIZ.spend} label="Essentials & fixed costs" />
    </ul>
  );
}

function LegendItem({
  color,
  label,
  shape = 'square',
}: {
  color: string;
  label: string;
  shape?: 'square' | 'line' | 'dash' | 'band';
}) {
  return (
    <li className="flex items-center gap-1.5">
      {shape === 'square' ? (
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      ) : shape === 'band' ? (
        <span className="h-2.5 w-4 rounded-[3px]" style={{ background: color, opacity: 0.25 }} aria-hidden />
      ) : (
        <span
          className="h-0.5 w-4 rounded-full"
          style={{
            background:
              shape === 'dash' ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)` : color,
          }}
          aria-hidden
        />
      )}
      {label}
    </li>
  );
}
