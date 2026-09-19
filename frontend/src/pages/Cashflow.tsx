import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock } from 'lucide-react';
import { useAppData } from '@/hooks/useAppData';
import {
  Badge,
  Card,
  CardHeader,
  CardSkeleton,
  ChartSkeleton,
  ErrorState,
  HonestyNote,
  RiskBadge,
  Stat,
} from '@/components/ui';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { PageHeading } from '@/components/layout/PageHeading';
import { Td, Th } from './Forecast';
import { dayDate, inr, relativeDays, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { WeatherIcon } from '@/lib/weather';

export function Cashflow() {
  const { cashflow, cashflowHorizon, setCashflowHorizon, user, resilience } = useAppData();

  if (cashflow.initialLoading) {
    return (
      <div className="space-y-5">
        <PageHeading title="Cashflow Forecast" subtitle="Loading your projected balance…" />
        <CardSkeleton lines={3} />
        <Card>
          <ChartSkeleton height={320} />
        </Card>
      </div>
    );
  }

  if (cashflow.error) {
    return (
      <div className="space-y-5">
        <PageHeading title="Cashflow Forecast" subtitle="Day-by-day money in, money out, and where your balance lands." />
        <ErrorState message={cashflow.error} onRetry={cashflow.reload} />
      </div>
    );
  }

  const data = cashflow.data;
  if (!data) return null;

  const below = data.gap_to_buffer < 0;
  const totalIn = data.days.reduce((a, d) => a + d.income, 0);
  const totalOut = data.days.reduce((a, d) => a + d.essential_spend + d.obligations, 0);
  const obligations = user.data?.upcoming_obligations ?? [];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Cashflow Forecast"
        subtitle="Money in, money out and the running balance — with the buffer line you are trying to stay above."
        action={
          <div
            role="group"
            aria-label="Cashflow horizon"
            className="flex items-center rounded-xl border border-canvas-line bg-canvas-card p-1"
          >
            {([7, 14] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setCashflowHorizon(h)}
                aria-pressed={cashflowHorizon === h}
                className={cn(
                  'focus-ring rounded-lg px-3 py-1.5 text-xs font-600 transition-colors',
                  cashflowHorizon === h ? 'bg-canvas-hover text-ink' : 'text-ink-muted hover:text-ink-soft',
                )}
              >
                {h} days
              </button>
            ))}
          </div>
        }
      />

      {/* -------------------------------------------------------- status */}
      <Card className={cn(below ? 'border-serious/30' : 'border-good/30')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                below ? 'border-serious/40 bg-serious-soft' : 'border-good/40 bg-good-soft',
              )}
            >
              {below ? (
                <AlertTriangle className="h-5 w-5 text-serious-ink" aria-hidden />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-good-ink" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="label-eyebrow">Status</p>
              <p className="mt-1.5 font-display text-lg font-600 leading-snug text-ink sm:text-xl">
                {data.status_message}
              </p>
            </div>
          </div>
          <RiskBadge band={data.risk_band} showRange />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 border-t border-canvas-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Starting balance" value={inr(data.starting_balance)} kind="historical" sub="Your savings today" />
          <Stat
            label="Projected ending balance"
            value={inr(data.projected_ending_balance)}
            kind="forecast"
            sub={`${inr(data.projected_ending_balance - data.starting_balance, { sign: true })} across ${data.horizon_days} days`}
            trend={data.projected_ending_balance >= data.starting_balance ? 'up' : 'down'}
          />
          <Stat
            label="Lowest projected balance"
            value={inr(data.lowest_projected_balance)}
            kind="forecast"
            sub={`On ${shortDate(data.lowest_balance_date)}`}
            valueClassName={data.lowest_projected_balance < data.buffer_target ? 'text-serious-ink' : undefined}
          />
          <Stat
            label="Minimum buffer"
            value={inr(data.buffer_target)}
            kind="forecast"
            sub={below ? `${inr(Math.abs(data.gap_to_buffer))} below target` : `${inr(data.gap_to_buffer)} above target`}
            trend={below ? 'down' : 'up'}
          />
        </div>
      </Card>

      {/* --------------------------------------------------------- chart */}
      <Card>
        <CardHeader
          eyebrow="Projected balance"
          title={`Next ${data.horizon_days} days`}
          description="Bars show income against outflow. The line is your running balance, with its forecast range shaded. Vertical marks are days carrying a fixed payment."
        />
        <CashflowChart days={data.days} bufferTarget={data.buffer_target} height={360} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* ------------------------------------------------ daily table */}
        <Card padded={false} className="min-w-0 overflow-hidden">
          <div className="p-5 sm:p-6">
            <CardHeader
              className="mb-0"
              eyebrow="Day by day"
              title="Income, spend and net"
              description={`Across these ${data.horizon_days} days: ${inr(totalIn)} in, ${inr(totalOut)} out.`}
            />
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[40rem] border-t border-canvas-line text-sm">
              <caption className="sr-only">Daily cashflow projection with income, essential spend, fixed costs and closing balance</caption>
              <thead>
                <tr className="border-b border-canvas-line">
                  <Th>Day</Th>
                  <Th align="right">Income</Th>
                  <Th align="right">Essentials</Th>
                  <Th align="right">Fixed costs</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr
                    key={d.date}
                    className={cn(
                      'border-b border-canvas-line/60 last:border-0 hover:bg-canvas-hover/40',
                      d.below_buffer && 'bg-serious-soft/20',
                    )}
                  >
                    <Td>
                      <span className="flex items-center gap-2">
                        <WeatherIcon code={d.weather_code} className="h-4 w-4" />
                        <span className="font-600 text-ink">{d.day_label}</span>
                        <span className="text-xs text-ink-faint">{shortDate(d.date)}</span>
                        {d.festival ? <Badge tone="brand">{d.festival}</Badge> : null}
                      </span>
                    </Td>
                    <Td align="right" className="tnum text-ink">
                      {d.income > 0 ? inr(d.income) : <span className="text-ink-faint">Rest</span>}
                    </Td>
                    <Td align="right" className="tnum text-ink-muted">
                      {inr(-d.essential_spend)}
                    </Td>
                    <Td align="right">
                      {d.obligations > 0 ? (
                        <span className="tnum text-serious-ink" title={d.obligation_labels.join(', ')}>
                          {inr(-d.obligations)}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        className={cn('tnum font-600', d.net >= 0 ? 'text-good-ink' : 'text-serious-ink')}
                      >
                        {inr(d.net, { sign: true })}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="tnum font-600 text-ink">{inr(d.closing_balance)}</span>
                      {d.below_buffer ? (
                        <span className="ml-1.5 inline-flex" title="Below your resilience buffer">
                          <ArrowDownRight className="h-3.5 w-3.5 text-warn-ink" aria-label="Below buffer" />
                        </span>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-canvas-line bg-canvas-raised/50">
                  <Td>
                    <span className="text-xs font-600 uppercase tracking-[0.08em] text-ink-muted">Total</span>
                  </Td>
                  <Td align="right" className="tnum font-600 text-ink">
                    {inr(totalIn)}
                  </Td>
                  <Td align="right" className="tnum text-ink-muted">
                    <span className="text-ink-faint">—</span>
                  </Td>
                  <Td align="right" className="tnum text-ink-muted">
                    {inr(-totalOut)}
                  </Td>
                  <Td align="right">
                    <span className={cn('tnum font-600', totalIn - totalOut >= 0 ? 'text-good-ink' : 'text-serious-ink')}>
                      {inr(totalIn - totalOut, { sign: true })}
                    </span>
                  </Td>
                  <Td align="right" className="tnum font-600 text-ink">
                    {inr(data.projected_ending_balance)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-canvas-line p-5 sm:p-6">
            <HonestyNote text="Rows highlighted in amber are days your projected balance sits below the resilience buffer. The balance line carries a forecast range that widens further out." />
          </div>
        </Card>

        {/* ------------------------------------------------- obligations */}
        <div className="space-y-5">
          <Card>
            <CardHeader eyebrow="Upcoming fixed costs" title="What is due, and when" />
            {obligations.length ? (
              <ul className="space-y-2.5">
                {obligations.slice(0, 5).map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-canvas-line bg-canvas-raised p-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-600 text-ink">
                        {o.label}
                        {o.is_critical ? <Badge tone="warn">Critical</Badge> : null}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <CalendarClock className="h-3 w-3" aria-hidden />
                        {dayDate(o.due_date)} · {relativeDays(o.due_date)}
                      </p>
                    </div>
                    <span className="tnum shrink-0 font-display text-sm font-600 text-ink">{inr(o.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nothing due in the next four weeks.</p>
            )}
          </Card>

          {resilience.data ? (
            <Card>
              <CardHeader eyebrow="Buffer context" title="Why the line sits where it does" />
              <p className="text-xs leading-relaxed text-ink-muted">{resilience.data.narrative}</p>
              <div className="mt-4 space-y-2 border-t border-canvas-line pt-4">
                {resilience.data.components
                  .filter((c) => c.amount !== 0)
                  .map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-ink-muted">{c.label}</span>
                      <span
                        className={cn('tnum shrink-0 font-600', c.sign === -1 ? 'text-good-ink' : 'text-ink')}
                      >
                        {c.sign === -1 ? '−' : '+'}
                        {inr(c.amount)}
                      </span>
                    </div>
                  ))}
                <div className="flex items-center justify-between gap-3 border-t border-canvas-line pt-2 text-sm">
                  <span className="font-600 text-ink">Buffer target</span>
                  <span className="tnum font-display font-700 text-ink">{inr(resilience.data.buffer_target)}</span>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
