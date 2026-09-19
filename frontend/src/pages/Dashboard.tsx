import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Lightbulb, PiggyBank, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useAppData } from '@/hooks/useAppData';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardSkeleton,
  ErrorState,
  HonestyNote,
  ProgressBar,
  RiskBadge,
  Skeleton,
  Stat,
  WhyButton,
} from '@/components/ui';
import { WeatherStrip } from '@/components/charts/WeatherStrip';
import { inr, pct, pctPlain, relativeDays, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Dashboard() {
  const { user, forecast, risk, scenarios } = useAppData();

  return (
    <div className="space-y-5">
      <PageIntro name={user.data?.profile.name} scenarioCount={scenarios.length} />

      {/* ----------------------------------------------------- hero card */}
      {forecast.initialLoading ? (
        <CardSkeleton lines={4} />
      ) : forecast.error ? (
        <ErrorState message={forecast.error} onRetry={forecast.reload} />
      ) : forecast.data ? (
        <HeroCard />
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ------------------------------------------- financial weather */}
        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Financial weather"
            title="Your next seven days"
            description="Each day shows the forecast income, with the weather that shapes it."
            action={
              <Link to="/app/forecast">
                <Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
                  Details
                </Button>
              </Link>
            }
          />
          {forecast.initialLoading ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : forecast.data ? (
            <WeatherStrip days={forecast.data.days.slice(0, 7)} />
          ) : null}
        </Card>

        {/* ------------------------------------------- resilience buffer */}
        <BufferCard />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <OpportunityCard />
        <InsightCard />
      </div>

      {/* ----------------------------------------------------- shortcuts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink
          to="/app/cashflow"
          Icon={TrendingUp}
          title="Cashflow forecast"
          body={
            risk.data
              ? `Lowest point and buffer gap across the week`
              : 'Day-by-day balance against your buffer line'
          }
        />
        <QuickLink
          to="/app/stress-test"
          Icon={Sparkles}
          title="Stress test your week"
          body="Drop income, add rain, add an emergency expense"
        />
        <QuickLink to="/app/calendar" Icon={CalendarDays} title="Income calendar" body="Festival windows and saving opportunities" />
      </div>

      <HonestyNote
        text={
          forecast.data?.meta.disclaimer ??
          'Forecasts are estimates with an explicit range, not guarantees. Scenario figures show what would happen under the settings you choose.'
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- sub-views */

function PageIntro({ name, scenarioCount }: { name?: string; scenarioCount: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-700 tracking-tight text-ink sm:text-2xl">
          {name ? `Good to see you, ${name}` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Know your next good week. Prepare for your next bad week.</p>
      </div>
      {scenarioCount > 0 ? (
        <Badge tone="warn">
          <Sparkles className="h-3 w-3" aria-hidden />
          Showing scenario figures
        </Badge>
      ) : null}
    </div>
  );
}

function HeroCard() {
  const { forecast, risk } = useAppData();
  const data = forecast.data;
  if (!data) return null;

  const w = data.window_7d;
  const weaker = w.delta_vs_normal < 0;
  const improvement = data.baseline_7d.expected_income
    ? Math.abs(w.expected_income - data.baseline_7d.expected_income)
    : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="relative overflow-hidden bg-hero-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow">Next 7 days</span>
              <RiskBadge band={w.risk_band} probability={w.shortfall_probability} size="sm" />
            </div>

            <h2 className="mt-3 max-w-xl font-display text-xl font-700 leading-tight text-ink sm:text-2xl">
              {w.headline}
            </h2>

            {risk.data?.worst_day ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
                <span className="font-600 text-ink-soft">{risk.data.worst_day.day_label}</span> is your highest-risk day
                this week — {risk.data.worst_day.reason}
              </p>
            ) : null}
          </div>

          <WhyButton
            title={`Why does the next 7 days look like this?`}
            drivers={w.drivers}
            confidence={w.confidence}
            footnote="Factors are measured from your own history and the forecast window. Effects are shown as their contribution to the window total."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 border-t border-canvas-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Expected income"
            value={inr(w.expected_income)}
            kind="forecast"
            sub={`Range ${inr(w.lower_bound, { compact: true })} – ${inr(w.upper_bound, { compact: true })}`}
          />
          <Stat
            label="Your normal week"
            value={inr(w.normal_expected_income)}
            kind="historical"
            sub={`${pct(w.delta_vs_normal_pct)} vs normal`}
            trend={weaker ? 'down' : 'up'}
          />
          <Stat
            label="Potential shortfall"
            value={inr(w.potential_shortfall)}
            kind="forecast"
            sub={`Essentials ${inr(w.expected_essential_spend, { compact: true })} plus this week's share of fixed costs`}
            valueClassName={w.potential_shortfall > 0 ? 'text-serious-ink' : undefined}
          />
          <Stat
            label="Shortfall probability"
            value={pctPlain(w.shortfall_probability)}
            kind="forecast"
            sub={`Confidence ${pctPlain(w.confidence)}`}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-canvas-line pt-4 text-[11px] text-ink-faint">
          <span>
            Naive 7-day moving average would say {inr(data.baseline_7d.expected_income)} — the model differs by{' '}
            {inr(improvement)} after weather, festivals and day-of-week.
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

function BufferCard() {
  const { resilience } = useAppData();

  if (resilience.initialLoading) return <CardSkeleton lines={4} />;
  if (resilience.error) return <ErrorState message={resilience.error} onRetry={resilience.reload} />;
  const r = resilience.data;
  if (!r) return null;

  const short = r.gap < 0;

  return (
    <Card>
      <CardHeader
        eyebrow="Resilience buffer"
        title="How much to keep set aside"
        action={
          <Link to="/app/insights">
            <Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
              Breakdown
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label-eyebrow">Current buffer</p>
            <p className="tnum mt-1 font-display text-3xl font-700 leading-none text-ink">{inr(r.current_savings)}</p>
          </div>
          <div className="text-right">
            <p className="label-eyebrow">Estimated minimum</p>
            <p className="tnum mt-1 font-display text-xl font-600 leading-none text-ink-soft">{inr(r.buffer_target)}</p>
          </div>
        </div>

        <div>
          <ProgressBar
            value={r.current_savings}
            max={r.buffer_target}
            band={short ? r.risk_band : 'low'}
            label={`Buffer progress: ${inr(r.current_savings)} of ${inr(r.buffer_target)}`}
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={cn('tnum font-600', short ? 'text-serious-ink' : 'text-good-ink')}>
              {short ? `${inr(Math.abs(r.gap))} gap` : `${inr(r.gap)} above target`}
            </span>
            <span className="tnum text-ink-muted">
              {Math.floor(r.days_of_cover)} of {Math.floor(r.target_days_of_cover)} days covered
            </span>
          </div>
        </div>

        <p className="rounded-xl border border-canvas-line bg-canvas-raised p-3 text-xs leading-relaxed text-ink-muted">
          {r.narrative}
        </p>

        {short && r.weeks_to_target ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-400/25 bg-brand-900/20 p-3">
            <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-soft">
              Setting aside <span className="tnum font-600 text-ink">{inr(r.suggested_weekly_saving)}</span> a week
              would reach the target in about {r.weeks_to_target} week{r.weeks_to_target > 1 ? 's' : ''}. This is a
              scenario, not a commitment.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function OpportunityCard() {
  const { calendar } = useAppData();

  if (calendar.initialLoading) return <CardSkeleton className="lg:col-span-2" lines={3} />;
  if (calendar.error) return <ErrorState className="lg:col-span-2" message={calendar.error} onRetry={calendar.reload} />;

  const festival = calendar.data?.festivals.find((f) => f.observations > 0) ?? calendar.data?.festivals[0];
  const window = calendar.data?.saving_windows[0];

  if (!festival && !window) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader eyebrow="Next major opportunity" title="No stronger stretch in the next six weeks" />
        <p className="text-sm leading-relaxed text-ink-muted">
          Your forecast is close to your usual pattern throughout this range. In a flat period, a small fixed amount set
          aside on your strongest weekday does more than waiting for a spike.
        </p>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        eyebrow="Next major opportunity"
        title={festival ? `${festival.name} income window` : (window?.label ?? 'Stronger earning stretch')}
        description={festival ? `${shortDate(festival.start_date)} – ${shortDate(festival.end_date)} · ${relativeDays(festival.start_date)}` : undefined}
        action={
          <Link to="/app/calendar">
            <Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
              Calendar
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {festival ? (
          <div className="space-y-3">
            <Stat
              label="Historical change"
              value={festival.observations > 0 ? pct(festival.historical_uplift_pct) : '—'}
              kind="historical"
              trend={festival.historical_uplift_pct > 0 ? 'up' : 'down'}
              sub={
                festival.observations > 0
                  ? `${festival.observations} observations in your history`
                  : 'Not enough observations yet'
              }
            />
            <p className="text-xs leading-relaxed text-ink-muted">{festival.note}</p>
          </div>
        ) : null}

        {window ? (
          <div className="rounded-xl border border-good/25 bg-good-soft/40 p-4">
            <p className="label-eyebrow text-good-ink">Saving scenario</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Saving an additional{' '}
              <span className="tnum font-600 text-ink">{inr(window.suggested_saving)}</span> during this
              higher-income period would take your projected buffer from{' '}
              <span className="tnum text-ink">{inr(window.buffer_before)}</span> to{' '}
              <span className="tnum font-600 text-good-ink">{inr(window.buffer_after)}</span>.
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <TrendingUp className="h-3 w-3" aria-hidden />
              {inr(window.potential_extra)} above a normal stretch of the same length
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function InsightCard() {
  const { insights } = useAppData();

  if (insights.initialLoading) return <CardSkeleton lines={3} />;
  if (insights.error) return <ErrorState message={insights.error} onRetry={insights.reload} />;

  const top = insights.data?.insights[0];
  if (!top) return null;

  return (
    <Card>
      <CardHeader
        eyebrow="AI insight"
        title="What stands out"
        action={
          <Link to="/app/insights">
            <Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
              All
            </Button>
          </Link>
        }
      />

      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-400/25 bg-brand-900/25">
          <Lightbulb className="h-4.5 w-4.5 text-brand-300" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-600 leading-snug text-ink">{top.title}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{top.evidence}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'tnum inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-600',
                top.metric.direction === 'up' ? 'bg-good-soft text-good-ink' : 'bg-serious-soft text-serious-ink',
              )}
            >
              {top.metric.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              {top.metric.value}
            </span>
            <span className="text-[11px] text-ink-faint">{top.metric.label}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function QuickLink({
  to,
  Icon,
  title,
  body,
}: {
  to: string;
  Icon: typeof TrendingUp;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="focus-ring group block rounded-2xl">
      <Card interactive className="h-full">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-canvas-line bg-canvas-raised transition-colors group-hover:border-brand-400/40">
            <Icon className="h-4.5 w-4.5 text-brand-300" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-600 text-ink">
              {title}
              <ArrowRight
                className="h-3.5 w-3.5 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300"
                aria-hidden
              />
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{body}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
