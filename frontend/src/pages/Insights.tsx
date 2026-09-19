import { motion } from 'framer-motion';
import {
  CalendarHeart,
  CloudRain,
  Lightbulb,
  PiggyBank,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAppData } from '@/hooks/useAppData';
import {
  Card,
  CardHeader,
  CardSkeleton,
  ErrorState,
  HonestyNote,
  ProgressBar,
  ProvenanceChip,
  RiskBadge,
  Stat,
} from '@/components/ui';
import { PageHeading } from '@/components/layout/PageHeading';
import { inr, pctPlain } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Insight } from '@/api/types';

const CATEGORY_META: Record<Insight['category'], { Icon: typeof Lightbulb; label: string }> = {
  pattern: { Icon: TrendingUp, label: 'Earning pattern' },
  weather: { Icon: CloudRain, label: 'Weather' },
  festival: { Icon: CalendarHeart, label: 'Festival' },
  buffer: { Icon: PiggyBank, label: 'Buffer' },
  risk: { Icon: ShieldAlert, label: 'Risk' },
  opportunity: { Icon: Wallet, label: 'Opportunity' },
};

export function Insights() {
  const { insights, user } = useAppData();

  return (
    <div className="space-y-5">
      <PageHeading
        title="Insights"
        subtitle="What your own earning history shows — each with its evidence, sample size and confidence, so you can judge it yourself."
      />

      {/* --------------------------------------------- buffer breakdown */}
      <BufferBreakdown />

      {/* ------------------------------------------------- the insights */}
      {insights.initialLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      ) : insights.error ? (
        <ErrorState message={insights.error} onRetry={insights.reload} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {insights.data?.insights.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))}
        </div>
      )}

      {/* ----------------------------------------------- expense profile */}
      {user.data ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              eyebrow="Expense profile"
              title="Where your money goes"
              description="Monthly view. Fixed costs are what create the sharp dips in your cashflow; daily spend sets how long a buffer lasts."
            />
            <ExpenseBars />
          </Card>

          <Card>
            <CardHeader eyebrow="Income profile" title="How your earning behaves" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Stat
                label="Average monthly income"
                value={inr(user.data.financials.avg_monthly_income)}
                kind="historical"
                sub={`${inr(user.data.financials.avg_daily_income)} a day on average`}
              />
              <Stat
                label="Median earning day"
                value={inr(user.data.financials.median_daily_income)}
                kind="historical"
                sub={`Swing of ±${inr(user.data.financials.income_std_dev)}`}
              />
              <Stat
                label="Volatility index"
                value={user.data.financials.volatility_index.toFixed(2)}
                kind="historical"
                sub="Std. deviation ÷ mean daily income"
              />
              <Stat
                label="Daily essential spend"
                value={inr(user.data.financials.avg_daily_essential_spend)}
                kind="historical"
                sub="Food and fuel, running average"
              />
            </div>
            <HonestyNote
              className="mt-5"
              text="Volatility is the point of this product: the same average income is a very different experience at 0.15 and at 0.35."
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const { Icon, label } = CATEGORY_META[insight.category];
  const up = insight.metric.direction === 'up';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card interactive className="h-full">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-canvas-line bg-canvas-raised">
            <Icon className="h-4.5 w-4.5 text-brand-300" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow">
                Insight {String(insight.rank).padStart(2, '0')} · {label}
              </span>
              <ProvenanceChip kind={insight.kind} />
            </div>

            <h3 className="mt-2 text-sm font-600 leading-snug text-ink">{insight.title}</h3>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'tnum inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-600',
                  insight.metric.direction === 'neutral'
                    ? 'bg-canvas-hover text-ink-soft'
                    : up
                      ? 'bg-good-soft text-good-ink'
                      : 'bg-serious-soft text-serious-ink',
                )}
              >
                {insight.metric.direction !== 'neutral' ? (
                  up ? (
                    <TrendingUp className="h-3 w-3" aria-hidden />
                  ) : (
                    <TrendingDown className="h-3 w-3" aria-hidden />
                  )
                ) : null}
                {insight.metric.value}
              </span>
              <span className="text-[11px] text-ink-faint">{insight.metric.label}</span>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-canvas-line pt-4 text-xs">
              <div>
                <dt className="mb-1 font-600 uppercase tracking-[0.06em] text-ink-faint">Evidence</dt>
                <dd className="leading-relaxed text-ink-soft">{insight.evidence}</dd>
              </div>
              <div>
                <dt className="mb-1 font-600 uppercase tracking-[0.06em] text-ink-faint">What it means</dt>
                <dd className="leading-relaxed text-ink-muted">{insight.explanation}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center gap-3 border-t border-canvas-line pt-3">
              <span className="shrink-0 text-[10px] font-600 uppercase tracking-[0.08em] text-ink-faint">
                Confidence
              </span>
              <ProgressBar value={insight.confidence} max={1} className="h-1.5 flex-1" label="Confidence" />
              <span className="tnum shrink-0 text-xs font-600 text-ink">{pctPlain(insight.confidence)}</span>
              <span className="tnum shrink-0 text-[10px] text-ink-faint">n={insight.sample_size}</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function BufferBreakdown() {
  const { resilience } = useAppData();

  if (resilience.initialLoading) return <CardSkeleton lines={5} />;
  if (resilience.error) return <ErrorState message={resilience.error} onRetry={resilience.reload} />;

  const r = resilience.data;
  if (!r) return null;

  const additive = r.components.filter((c) => c.sign === 1 && c.amount > 0);
  const subtractive = r.components.filter((c) => c.sign === -1 && c.amount > 0);
  const maxAmount = Math.max(...r.components.map((c) => c.amount), 1);

  return (
    <Card>
      <CardHeader
        eyebrow="Minimum resilience buffer"
        title="How your target is calculated"
        description="This is not three months of expenses. It moves with your income volatility, your forecast uncertainty and the bills actually due."
        action={<RiskBadge band={r.risk_band} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-canvas-line bg-canvas-raised p-4">
            <p className="label-eyebrow">Your estimated resilience buffer</p>
            <p className="tnum mt-2 font-display text-3xl font-700 leading-none text-ink">{inr(r.buffer_target)}</p>
            <div className="mt-4">
              <ProgressBar
                value={r.current_savings}
                max={r.buffer_target}
                band={r.gap < 0 ? r.risk_band : 'low'}
                label={`${inr(r.current_savings)} of ${inr(r.buffer_target)}`}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="tnum text-ink-muted">Holding {inr(r.current_savings)}</span>
                <span className={cn('tnum font-600', r.gap < 0 ? 'text-serious-ink' : 'text-good-ink')}>
                  {r.gap < 0 ? `${inr(Math.abs(r.gap))} gap` : `${inr(r.gap)} above`}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Days of cover"
              value={`${Math.floor(r.days_of_cover)}`}
              kind="forecast"
              sub={`Target ${Math.floor(r.target_days_of_cover)} days`}
            />
            <Stat
              label="Suggested saving"
              value={inr(r.suggested_weekly_saving)}
              kind="scenario"
              sub={r.weeks_to_target ? `Reaches target in ~${r.weeks_to_target} weeks` : 'Target already met'}
            />
          </div>

          <p className="rounded-xl border border-canvas-line bg-canvas-raised p-3 text-xs leading-relaxed text-ink-muted">
            {r.narrative}
          </p>
        </div>

        {/* ---------------------------------------- component waterfall */}
        <div>
          <p className="label-eyebrow mb-3">The calculation, line by line</p>
          <ul className="space-y-3">
            {[...additive, ...subtractive].map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-600 text-ink-soft">{c.label}</span>
                  <span className={cn('tnum shrink-0 text-sm font-600', c.sign === -1 ? 'text-good-ink' : 'text-ink')}>
                    {c.sign === -1 ? '−' : '+'}
                    {inr(c.amount)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-canvas-hover">
                  <motion.div
                    className={cn('h-full rounded-full', c.sign === -1 ? 'bg-good' : 'bg-brand-gradient')}
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.amount / maxAmount) * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{c.explanation}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-canvas-line pt-4">
            <span className="font-display text-sm font-600 text-ink">Total buffer target</span>
            <span className="tnum font-display text-xl font-700 text-ink">{inr(r.buffer_target)}</span>
          </div>

          <HonestyNote
            className="mt-3"
            text="A floor applies: the target never falls below five days of essentials plus any critical payment due within a fortnight."
          />
        </div>
      </div>
    </Card>
  );
}

function ExpenseBars() {
  const { user } = useAppData();
  const b = user.data?.financials.expense_breakdown;
  if (!b) return null;

  const rows = [
    { label: 'Rent', value: b.rent },
    { label: 'EMI', value: b.emi },
    { label: 'Food', value: b.food },
    { label: 'Fuel', value: b.fuel },
    { label: 'Family', value: b.family },
    { label: 'Utilities', value: b.utilities },
    { label: 'Other', value: b.other },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b2) => b2.value - a.value);

  const total = rows.reduce((a, r) => a + r.value, 0);

  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-600 text-ink-soft">{r.label}</span>
              <span className="tnum text-xs text-ink-muted">
                {inr(r.value)} · {((r.value / total) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-canvas-hover">
              <motion.div
                className="h-full rounded-full bg-brand-gradient"
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / rows[0].value) * 100}%` }}
                transition={{ delay: i * 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-canvas-line pt-3">
        <span className="text-sm font-600 text-ink">Monthly total</span>
        <span className="tnum font-display text-base font-700 text-ink">{inr(total)}</span>
      </div>
    </div>
  );
}
