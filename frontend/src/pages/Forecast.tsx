import { useState } from 'react';
import { CloudRain, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { useAppData } from '@/hooks/useAppData';
import {
  Badge,
  Card,
  CardHeader,
  CardSkeleton,
  ChartSkeleton,
  ErrorState,
  HonestyNote,
  ProvenanceChip,
  RiskBadge,
  Stat,
  WhyButton,
} from '@/components/ui';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { PageHeading } from '@/components/layout/PageHeading';
import { inr, pct, pctPlain, dayDate, RISK_CLASSES } from '@/lib/format';
import { cn } from '@/lib/cn';
import { WeatherIcon } from '@/lib/weather';
import type { ForecastDay as ForecastDayType, ForecastWindow } from '@/api/types';

export function Forecast() {
  const { forecast, risk } = useAppData();
  const [horizon, setHorizon] = useState<7 | 14>(7);

  if (forecast.initialLoading) {
    return (
      <div className="space-y-5">
        <PageHeading title="Income Forecast" subtitle="Loading your forecast…" />
        <CardSkeleton lines={4} />
        <Card>
          <ChartSkeleton />
        </Card>
      </div>
    );
  }

  if (forecast.error) {
    return (
      <div className="space-y-5">
        <PageHeading title="Income Forecast" subtitle="Expected income, range and the factors behind it." />
        <ErrorState message={forecast.error} onRetry={forecast.reload} />
      </div>
    );
  }

  const data = forecast.data;
  if (!data) return null;

  const w: ForecastWindow = horizon === 7 ? data.window_7d : data.window_14d;
  const days = data.days.slice(0, horizon);
  const modelDelta = w.expected_income - data.baseline_7d.expected_income;

  return (
    <div className="space-y-5">
      <PageHeading
        title="Income Forecast"
        subtitle="What the model expects you to earn, the range around it, and exactly which factors moved it."
        action={
          <div
            role="group"
            aria-label="Forecast horizon"
            className="flex items-center rounded-xl border border-canvas-line bg-canvas-card p-1"
          >
            {([7, 14] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                aria-pressed={horizon === h}
                className={cn(
                  'focus-ring rounded-lg px-3 py-1.5 text-xs font-600 transition-colors',
                  horizon === h ? 'bg-canvas-hover text-ink' : 'text-ink-muted hover:text-ink-soft',
                )}
              >
                {h} days
              </button>
            ))}
          </div>
        }
      />

      {/* --------------------------------------------------- summary card */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow">Next {horizon} days</span>
              <RiskBadge band={w.risk_band} probability={w.shortfall_probability} size="sm" showRange />
            </div>
            <h2 className="mt-3 font-display text-lg font-600 text-ink sm:text-xl">{w.headline}</h2>
          </div>
          <WhyButton
            title={`Why does the next ${horizon} days look like this?`}
            drivers={w.drivers}
            confidence={w.confidence}
            footnote="Each factor is measured from your own history. The amount shown is that factor's contribution to the window total."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 border-t border-canvas-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Expected income"
            value={inr(w.expected_income)}
            kind="forecast"
            sub={`80% range ${inr(w.lower_bound, { compact: true })} – ${inr(w.upper_bound, { compact: true })}`}
          />
          <Stat
            label="Your normal week"
            value={inr(w.normal_expected_income)}
            kind="historical"
            sub={`${pct(w.delta_vs_normal_pct)} vs normal`}
            trend={w.delta_vs_normal < 0 ? 'down' : 'up'}
          />
          <Stat
            label="Essential spend"
            value={inr(w.expected_essential_spend)}
            kind="forecast"
            sub={`Potential shortfall ${inr(w.potential_shortfall)}`}
          />
          <Stat label="Confidence" value={pctPlain(w.confidence)} kind="forecast" sub={`Shortfall probability ${pctPlain(w.shortfall_probability)}`} />
        </div>
      </Card>

      {/* ------------------------------------------------------- the chart */}
      <Card>
        <CardHeader
          eyebrow="Daily forecast"
          title="Expected income by day"
          description="Bars are the point forecast. The thin marker beside each bar spans the 80% range, and the dashed line is what that weekday normally earns for you."
        />
        <ForecastChart days={days} height={320} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ------------------------------------------ model vs baseline */}
        <Card>
          <CardHeader eyebrow="Model honesty" title="Against a naive baseline" />
          <div className="space-y-4">
            <Stat
              label="Trailing 7-day average"
              value={inr(data.baseline_7d.expected_income)}
              kind="historical"
              sub="What a flat moving-average would predict"
            />
            <Stat
              label="This model"
              value={inr(data.window_7d.expected_income)}
              kind="forecast"
              sub={`${inr(modelDelta, { sign: true })} after weather, festivals and day-of-week`}
              trend={modelDelta >= 0 ? 'up' : 'down'}
            />

            {data.model_performance ? (
              <div className="rounded-xl border border-canvas-line bg-canvas-raised p-3">
                <p className="label-eyebrow mb-2">Prototype benchmark on synthetic test data</p>
                <dl className="space-y-1.5 text-xs">
                  <Metric label="MAE" value={`₹${Math.round(data.model_performance.income_model.mae)}`} />
                  <Metric label="RMSE" value={`₹${Math.round(data.model_performance.income_model.rmse)}`} />
                  <Metric label="R²" value={data.model_performance.income_model.r2.toFixed(3)} />
                </dl>
              </div>
            ) : (
              <p className="rounded-xl border border-canvas-line bg-canvas-raised p-3 text-xs leading-relaxed text-ink-muted">
                No trained model has been evaluated for this session, so no accuracy figures are shown. Numbers here come
                from a statistical forecaster over synthetic history. Accuracy metrics will appear once the backend
                reports a real evaluation.
              </p>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ weather impact */}
        <WeatherImpactCard days={days} horizon={horizon} />

        {/* ------------------------------------------------ volatility */}
        <Card>
          <CardHeader eyebrow="Forecast uncertainty" title="How steady your income has been" />
          {risk.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat
                  label="Recent 14 days"
                  value={risk.data.volatility.current_index.toFixed(2)}
                  kind="historical"
                  sub="Variability index"
                />
                <Stat
                  label="Full history"
                  value={risk.data.volatility.baseline_index.toFixed(2)}
                  kind="historical"
                  sub="Variability index"
                />
              </div>
              <p className="rounded-xl border border-canvas-line bg-canvas-raised p-3 text-xs leading-relaxed text-ink-muted">
                {risk.data.volatility.interpretation}
              </p>
              <p className="flex items-center gap-2 text-[11px] text-ink-faint">
                <Gauge className="h-3.5 w-3.5" aria-hidden />
                A higher index means wider ranges on every forecast day.
              </p>
            </div>
          ) : (
            <ChartSkeleton height={160} />
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------ day table */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <CardHeader
            className="mb-0"
            eyebrow="Day by day"
            title="Full forecast detail"
            description="The same data as the chart, in a table — usable with a screen reader and sortable by eye."
          />
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[46rem] border-t border-canvas-line text-sm">
            <caption className="sr-only">
              Daily income forecast for the next {horizon} days, with range, weather and shortfall probability
            </caption>
            <thead>
              <tr className="border-b border-canvas-line text-left">
                <Th>Day</Th>
                <Th align="right">Expected</Th>
                <Th align="right">80% range</Th>
                <Th align="right">Your average</Th>
                <Th align="right">Essentials</Th>
                <Th>Weather</Th>
                <Th align="right">Day risk</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const delta = d.historical_average ? d.expected_income / d.historical_average - 1 : 0;
                const band =
                  d.day_shortfall_probability >= 0.8
                    ? 'critical'
                    : d.day_shortfall_probability >= 0.6
                      ? 'high'
                      : d.day_shortfall_probability >= 0.3
                        ? 'moderate'
                        : 'low';

                return (
                  <tr key={d.date} className="border-b border-canvas-line/60 last:border-0 hover:bg-canvas-hover/40">
                    <Td>
                      <span className="font-600 text-ink">{dayDate(d.date)}</span>
                      {d.festival ? (
                        <Badge tone="brand" className="ml-2">
                          {d.festival.name}
                        </Badge>
                      ) : null}
                    </Td>
                    <Td align="right">
                      {d.is_planned_rest_day ? (
                        <span className="text-ink-faint">Rest day</span>
                      ) : (
                        <span className="tnum font-600 text-ink">{inr(d.expected_income)}</span>
                      )}
                    </Td>
                    <Td align="right" className="tnum text-ink-muted">
                      {d.is_planned_rest_day ? '—' : `${inr(d.lower_bound)} – ${inr(d.upper_bound)}`}
                    </Td>
                    <Td align="right">
                      <span className="tnum text-ink-soft">{inr(d.historical_average)}</span>
                      {!d.is_planned_rest_day ? (
                        <span
                          className={cn(
                            'tnum ml-2 text-xs',
                            delta < -0.05 ? 'text-serious-ink' : delta > 0.05 ? 'text-good-ink' : 'text-ink-faint',
                          )}
                        >
                          {pct(delta)}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right" className="tnum text-ink-muted">
                      {inr(d.expected_essential_spend)}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2 text-xs text-ink-muted">
                        <WeatherIcon code={d.weather.code} className="h-4 w-4" />
                        <span className="truncate">{d.weather.label}</span>
                        {d.weather.rainfall_mm > 0 ? (
                          <span className="tnum text-ink-faint">{d.weather.rainfall_mm}mm</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className={cn('tnum text-xs font-600', RISK_CLASSES[band].text)}>
                        {pctPlain(d.day_shortfall_probability)}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-canvas-line p-5 sm:p-6">
          <HonestyNote text="Day risk is the modelled chance that a single day's income lands below that day's essential spend. It is a forecast, not a statement about what will happen." />
        </div>
      </Card>
    </div>
  );
}

function WeatherImpactCard({ days, horizon }: { days: ForecastDayType[]; horizon: number }) {
  const { forecast } = useAppData();
  const wet = days.filter((d) => d.weather.rainfall_mm >= 15);
  const totalImpact = days.reduce((a, d) => a + d.weather.income_impact, 0);
  const rainfall = days.reduce((a, d) => a + d.weather.rainfall_mm, 0);
  const rainDriver = forecast.data?.window_7d.drivers.find((d) => d.key === 'rain_days');

  return (
    <Card>
      <CardHeader eyebrow="Weather impact" title="Rain and your income" />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Rainfall" value={`${Math.round(rainfall)}mm`} kind="forecast" sub={`${wet.length} heavy-rain days`} />
          <Stat
            label="Income effect"
            value={inr(totalImpact, { sign: true })}
            kind="forecast"
            trend={totalImpact < 0 ? 'down' : 'up'}
            sub={`Across ${horizon} days`}
            valueClassName={totalImpact < 0 ? 'text-serious-ink' : 'text-good-ink'}
          />
        </div>

        {rainDriver ? (
          <div className="rounded-xl border border-canvas-line bg-canvas-raised p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <CloudRain className="h-3.5 w-3.5 text-serious-ink" aria-hidden />
              <span className="text-xs font-600 text-ink-soft">Measured in your own data</span>
              <ProvenanceChip kind="historical" />
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">{rainDriver.explanation}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-canvas-line bg-canvas-raised p-3 text-xs leading-relaxed text-ink-muted">
            No heavy-rain days fall inside this forecast window.
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-ink-faint">
          This is the relationship measured in your history, not a general claim about rain and delivery work.
        </p>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tnum font-600 text-ink">{value}</dd>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-5 py-3 text-2xs font-600 uppercase tracking-[0.08em] text-ink-muted',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={cn('px-5 py-3 align-middle', align === 'right' ? 'text-right' : 'text-left', className)}>
      {children}
    </td>
  );
}

export { TrendingDown, TrendingUp };
