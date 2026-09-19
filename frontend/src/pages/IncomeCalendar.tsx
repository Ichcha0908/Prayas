import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, PiggyBank, Sparkles, TrendingUp } from 'lucide-react';
import { useAppData } from '@/hooks/useAppData';
import {
  Badge,
  Card,
  CardHeader,
  CardSkeleton,
  EmptyState,
  ErrorState,
  HonestyNote,
  ProvenanceChip,
  Stat,
} from '@/components/ui';
import { PageHeading } from '@/components/layout/PageHeading';
import { inr, longDate, parseISO, pct, pctPlain, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { WeatherIcon } from '@/lib/weather';
import type { CalendarDay, CalendarMarker } from '@/api/types';

const MARKER_META: Record<CalendarMarker, { label: string; dot: string; ring: string; symbol: string }> = {
  high_income: { label: 'High earning opportunity', dot: 'bg-good', ring: 'ring-good/50', symbol: '▲' },
  normal: { label: 'Normal', dot: 'bg-ink-faint', ring: 'ring-canvas-line', symbol: '•' },
  volatility: { label: 'Big swing / wide range', dot: 'bg-warn', ring: 'ring-warn/50', symbol: '~' },
  shortfall_risk: { label: 'Shortfall risk', dot: 'bg-critical', ring: 'ring-critical/50', symbol: '▼' },
  festival: { label: 'Festival window', dot: 'bg-brand-400', ring: 'ring-brand-400/50', symbol: '★' },
};

/** Priority order decides which marker paints the cell. */
const MARKER_PRIORITY: CalendarMarker[] = ['festival', 'shortfall_risk', 'high_income', 'volatility', 'normal'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function IncomeCalendar() {
  const { calendar } = useAppData();
  const [selected, setSelected] = useState<string | null>(null);

  const months = useMemo(() => {
    const days = calendar.data?.days ?? [];
    const grouped = new Map<string, CalendarDay[]>();
    for (const d of days) {
      const key = d.date.slice(0, 7);
      const list = grouped.get(key) ?? [];
      list.push(d);
      grouped.set(key, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calendar.data]);

  if (calendar.initialLoading) {
    return (
      <div className="space-y-5">
        <PageHeading title="Income Calendar" subtitle="Loading your calendar…" />
        <CardSkeleton lines={6} />
      </div>
    );
  }

  if (calendar.error) {
    return (
      <div className="space-y-5">
        <PageHeading title="Income Calendar" subtitle="High and low earning days, festival windows and payment dates." />
        <ErrorState message={calendar.error} onRetry={calendar.reload} />
      </div>
    );
  }

  const data = calendar.data;
  if (!data) return null;

  const selectedDay = data.days.find((d) => d.date === selected) ?? null;

  return (
    <div className="space-y-5">
      <PageHeading
        title="Income Calendar"
        subtitle="Where your strong and weak days fall, which festival windows are coming, and when your fixed payments land."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_21rem]">
        {/* ------------------------------------------------ the calendar */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              eyebrow="Your months"
              title="Earning days at a glance"
              description="Past days show what you actually earned. Future days show the forecast against your own weekday average."
            />

            <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
              {MARKER_PRIORITY.map((m) => (
                <li key={m} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <span className={cn('h-2 w-2 rounded-full', MARKER_META[m].dot)} aria-hidden />
                  <span aria-hidden className="tnum text-ink-faint">
                    {MARKER_META[m].symbol}
                  </span>
                  {MARKER_META[m].label}
                </li>
              ))}
            </ul>

            <div className="space-y-6">
              {months.map(([key, days]) => (
                <MonthGrid
                  key={key}
                  monthKey={key}
                  days={days}
                  selected={selected}
                  onSelect={(d) => setSelected((cur) => (cur === d ? null : d))}
                />
              ))}
            </div>

            <HonestyNote
              className="mt-5"
              text="Markers combine the forecast against your weekday average, the forecast range, and whether the day covers its own costs. A festival marker means the window overlaps, not that income is guaranteed to rise."
            />
          </Card>

          {/* ------------------------------------------- saving windows */}
          <Card>
            <CardHeader
              eyebrow="Saving opportunity engine"
              title="Your strongest saving windows"
              description="Stretches where the forecast runs above a normal period of the same length."
            />

            {data.saving_windows.length ? (
              <ul className="space-y-3">
                {data.saving_windows.map((w, i) => (
                  <motion.li
                    key={w.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.35 }}
                    className="rounded-2xl border border-canvas-line bg-canvas-raised p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-600 text-ink">
                          <TrendingUp className="h-4 w-4 shrink-0 text-good-ink" aria-hidden />
                          {w.label}
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {shortDate(w.start_date)} – {shortDate(w.end_date)}
                        </p>
                      </div>
                      <Badge tone="good">
                        <PiggyBank className="h-3 w-3" aria-hidden />
                        {inr(w.potential_extra)} above normal
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-canvas-line pt-4 sm:grid-cols-3">
                      <Stat label="Expected income" value={inr(w.expected_income)} kind="forecast" />
                      <Stat label="Normal period" value={inr(w.normal_income)} kind="historical" />
                      <Stat
                        label="Buffer after saving"
                        value={inr(w.buffer_after)}
                        kind="scenario"
                        sub={`from ${inr(w.buffer_before)}`}
                        trend="up"
                      />
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-ink-muted">{w.rationale}</p>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<PiggyBank className="h-6 w-6" aria-hidden />}
                title="No stronger stretch in this range"
                description="Your forecast tracks close to your usual pattern. A small fixed amount set aside on your strongest weekday does more than waiting for a spike."
              />
            )}
          </Card>
        </div>

        {/* --------------------------------------------------- side panel */}
        <div className="space-y-5">
          <DayDetail day={selectedDay} />

          <Card>
            <CardHeader eyebrow="Festival intelligence" title="Upcoming windows" />
            {data.festivals.length ? (
              <ul className="space-y-3">
                {data.festivals.map((f) => (
                  <li key={f.id} className="rounded-xl border border-canvas-line bg-canvas-raised p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-600 text-ink">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden />
                          {f.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {shortDate(f.start_date)} – {shortDate(f.end_date)}
                        </p>
                      </div>
                      {f.observations > 0 ? (
                        <span
                          className={cn(
                            'tnum shrink-0 rounded-lg px-2 py-1 text-xs font-600',
                            f.historical_uplift_pct >= 0 ? 'bg-good-soft text-good-ink' : 'bg-serious-soft text-serious-ink',
                          )}
                        >
                          {pct(f.historical_uplift_pct)}
                        </span>
                      ) : null}
                    </div>

                    {f.observations > 0 ? (
                      <dl className="mt-3 space-y-1 border-t border-canvas-line pt-2.5 text-[11px]">
                        <Row label="Normal weekday" value={inr(f.historical_normal_daily)} />
                        <Row label={`Similar ${f.name} day`} value={inr(f.historical_festival_daily)} />
                        <Row
                          label="Predicted range"
                          value={`${inr(f.predicted_income_low)} – ${inr(f.predicted_income_high)}`}
                        />
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <dt className="text-ink-faint">Based on</dt>
                          <dd className="flex items-center gap-1.5 text-ink-faint">
                            {f.observations} observations
                            <ProvenanceChip kind="historical" />
                          </dd>
                        </div>
                      </dl>
                    ) : null}

                    <p className="mt-2.5 text-[11px] leading-relaxed text-ink-muted">{f.note}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden />}
                title="No festival windows ahead"
                description="Nothing in the next two months falls inside a festival window for your city."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- month grid */

function MonthGrid({
  monthKey,
  days,
  selected,
  onSelect,
}: {
  monthKey: string;
  days: CalendarDay[];
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const [year, month] = monthKey.split('-').map(Number);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Monday-first offset.
  const offset = (first.getDay() + 6) % 7;

  // The range rarely starts on the 1st, so trim whole leading/trailing weeks
  // that hold no data rather than rendering empty rows.
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const iso = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const visibleWeeks = weeks.filter((w) => w.some((d) => d !== null && byDate.has(iso(d))));

  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-600 text-ink">
        {MONTHS[month - 1]} {year}
      </h3>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={`${MONTHS[month - 1]} ${year}`}>
        {DOW.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] font-600 uppercase tracking-[0.06em] text-ink-faint">
            {d}
          </div>
        ))}

        {visibleWeeks.flat().map((dayNum, idx) => {
          if (dayNum === null) return <div key={`pad-${idx}`} aria-hidden />;
          const date = iso(dayNum);
          const day = byDate.get(date);

          if (!day) {
            return (
              <div
                key={date}
                className="flex aspect-square items-center justify-center rounded-lg border border-transparent text-xs text-ink-faint/40"
              >
                {dayNum}
              </div>
            );
          }

          const marker = MARKER_PRIORITY.find((m) => day.markers.includes(m)) ?? 'normal';
          const meta = MARKER_META[marker];
          const isSelected = selected === date;
          const value = day.is_past ? day.actual_income : day.expected_income;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${longDate(date)}: ${meta.label}, ${value !== null ? inr(value) : 'no income'}`}
              className={cn(
                'focus-ring flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition-all',
                day.is_past ? 'border-canvas-line/60 bg-canvas-raised/40' : 'border-canvas-line bg-canvas-raised',
                isSelected && 'ring-2 ring-brand-400 ring-offset-1 ring-offset-canvas-card',
                !isSelected && 'hover:border-brand-400/50',
              )}
            >
              <span className={cn('tnum font-600 leading-none', day.is_past ? 'text-ink-muted' : 'text-ink')}>
                {dayNum}
              </span>
              <span className="flex items-center gap-0.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
                {/* Symbol is a second, non-colour encoding of the marker. */}
                <span className="text-[8px] leading-none text-ink-faint" aria-hidden>
                  {meta.symbol}
                </span>
              </span>
              {day.obligations > 0 ? (
                <span className="text-[8px] leading-none text-serious-ink" aria-hidden>
                  ₹
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- day detail */

function DayDetail({ day }: { day: CalendarDay | null }) {
  if (!day) {
    return (
      <Card>
        <CardHeader eyebrow="Day detail" title="Select a date" />
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" aria-hidden />}
          title="Nothing selected"
          description="Tap any day in the calendar to see its forecast, weather, demand, expenses and projected balance."
        />
      </Card>
    );
  }

  const markers = day.markers.filter((m) => m !== 'normal');

  return (
    <Card>
      <CardHeader eyebrow={day.is_past ? 'What happened' : 'Day detail'} title={longDate(day.date)} />

      {markers.length ? (
        <ul className="mb-4 flex flex-wrap gap-1.5">
          {markers.map((m) => (
            <li key={m}>
              <Badge
                tone={
                  m === 'festival' ? 'brand' : m === 'shortfall_risk' ? 'critical' : m === 'high_income' ? 'good' : 'warn'
                }
              >
                {MARKER_META[m].label}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3.5">
        <Stat
          label={day.is_past ? 'Actual income' : 'Expected income'}
          value={day.is_past ? inr(day.actual_income ?? 0) : inr(day.expected_income)}
          kind={day.is_past ? 'historical' : 'forecast'}
          sub={`${pct(day.delta_pct)} vs your ${parseISO(day.date).toLocaleDateString('en-IN', { weekday: 'long' })} average`}
          trend={day.delta_pct >= 0 ? 'up' : 'down'}
        />

        <dl className="space-y-2 border-t border-canvas-line pt-3.5 text-xs">
          <Row label="Your weekday average" value={inr(day.historical_average)} />
          <Row
            label="Weather"
            value={
              <span className="flex items-center gap-1.5">
                <WeatherIcon code={day.weather.code} className="h-3.5 w-3.5" />
                {day.weather.label}
                {day.weather.rainfall_mm > 0 ? (
                  <span className="tnum text-ink-faint">{day.weather.rainfall_mm}mm</span>
                ) : null}
              </span>
            }
          />
          <Row label="Demand index" value={day.demand_index.toFixed(2)} />
          <Row label="Essential spend" value={inr(day.expected_expenses)} />
          {day.obligations > 0 ? <Row label="Fixed payment due" value={inr(day.obligations)} tone="serious" /> : null}
          {!day.is_past ? (
            <Row label="Projected balance" value={inr(day.projected_balance)} strong />
          ) : null}
        </dl>

        {day.festival ? (
          <p className="rounded-xl border border-brand-400/25 bg-brand-900/20 p-3 text-xs leading-relaxed text-brand-200">
            Falls inside the {day.festival} window.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  tone?: 'serious';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={cn(
          'tnum min-w-0 text-right',
          tone === 'serious' ? 'text-serious-ink' : strong ? 'font-600 text-ink' : 'text-ink-soft',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export { pctPlain };
