import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Plus, RotateCcw, Sparkles, Wallet, Zap } from 'lucide-react';
import { api } from '@/api';
import type { ScenarioKey, StressTestRequest, StressTestResponse } from '@/api/types';
import { useAppData } from '@/hooks/useAppData';
import {
  Button,
  Card,
  CardHeader,
  ChartSkeleton,
  ErrorState,
  HonestyNote,
  ProvenanceChip,
  RiskBadge,
  Slider,
  Stat,
} from '@/components/ui';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { PageHeading } from '@/components/layout/PageHeading';
import { inr, pct, pctPlain, RISK_LABEL } from '@/lib/format';
import { cn } from '@/lib/cn';

const DEFAULTS = {
  income_change_pct: 0,
  working_days: 6,
  rainfall_multiplier: 1,
  emergency_expense: 0,
  fuel_cost_increase_pct: 0,
};

type Controls = typeof DEFAULTS;

const PRESETS: { id: string; label: string; Icon: typeof Zap; patch: Partial<Controls>; scenarios?: ScenarioKey[] }[] = [
  { id: 'diwali', label: 'Diwali week', Icon: Sparkles, patch: { ...DEFAULTS }, scenarios: ['diwali'] },
  { id: 'rain', label: 'Rain shock', Icon: CloudRain, patch: { ...DEFAULTS }, scenarios: ['rain_shock'] },
  { id: 'emergency', label: '₹5,000 emergency', Icon: Wallet, patch: { emergency_expense: 5000 } },
  { id: 'slump', label: '20% income drop', Icon: Zap, patch: { income_change_pct: 0.2 } },
];

export function StressTest() {
  const { driverId } = useAppData();
  const [controls, setControls] = useState<Controls>(DEFAULTS);
  const [scenarios, setScenarios] = useState<ScenarioKey[]>([]);
  const [extraHours, setExtraHours] = useState<{ day_of_week: number; hours: number }[]>([]);
  const [result, setResult] = useState<StressTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  const request = useMemo<StressTestRequest>(
    () => ({ driver_id: driverId, ...controls, scenarios, extra_hours: extraHours }),
    [driverId, controls, scenarios, extraHours],
  );

  // Debounced so dragging a slider doesn't fire a request per pixel.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setPending(true);
      api
        .postStressTest(request)
        .then((res) => {
          if (cancelled) return;
          setResult(res);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Could not run this scenario.');
        })
        .finally(() => {
          if (!cancelled) setPending(false);
        });
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request]);

  const set = useCallback(<K extends keyof Controls>(key: K, value: Controls[K]) => {
    setControls((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setControls(DEFAULTS);
    setScenarios([]);
    setExtraHours([]);
  }, []);

  const dirty =
    scenarios.length > 0 ||
    extraHours.length > 0 ||
    (Object.keys(DEFAULTS) as (keyof Controls)[]).some((k) => controls[k] !== DEFAULTS[k]);

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setControls({ ...DEFAULTS, ...preset.patch });
    setScenarios(preset.scenarios ?? []);
    setExtraHours([]);
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="Stress Test Your Week"
        subtitle="Move a control and every figure recalculates: income, balance, shortfall risk and your buffer gap. These are scenarios, not predictions."
        action={
          dirty ? (
            <Button size="sm" variant="ghost" onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}>
              Reset
            </Button>
          ) : null
        }
      />

      {/* ------------------------------------------------------- presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active =
            (p.scenarios?.length ? p.scenarios.every((s) => scenarios.includes(s)) : scenarios.length === 0) &&
            Object.entries(p.patch).every(([k, v]) => controls[k as keyof Controls] === v);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={active}
              className={cn(
                'focus-ring inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-600 transition-colors',
                active
                  ? 'border-brand-400/60 bg-brand-900/30 text-brand-200'
                  : 'border-canvas-line bg-canvas-card text-ink-muted hover:border-brand-400/40 hover:text-ink-soft',
              )}
            >
              <p.Icon className="h-3.5 w-3.5" aria-hidden />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
        {/* ------------------------------------------------- the controls */}
        <Card className="lg:sticky lg:top-32 lg:self-start">
          <CardHeader eyebrow="Scenario controls" title="Adjust your week" />

          <div className="space-y-6">
            <Slider
              label="Income decrease"
              value={controls.income_change_pct}
              min={0}
              max={0.5}
              step={0.05}
              onChange={(v) => set('income_change_pct', v)}
              format={(v) => (v === 0 ? 'No change' : `−${(v * 100).toFixed(0)}%`)}
              leftLabel="0%"
              rightLabel="−50%"
            />

            <Slider
              label="Working days"
              value={controls.working_days}
              min={1}
              max={7}
              step={1}
              onChange={(v) => set('working_days', v)}
              format={(v) => `${v} ${v === 1 ? 'day' : 'days'}`}
              leftLabel="1"
              rightLabel="7"
              hint="weakest days drop first"
            />

            <Slider
              label="Rainfall"
              value={controls.rainfall_multiplier}
              min={1}
              max={3}
              step={0.5}
              onChange={(v) => set('rainfall_multiplier', v)}
              format={(v) => (v === 1 ? 'Normal' : v >= 3 ? 'Extreme' : v >= 2 ? 'Heavy' : 'Elevated')}
              leftLabel="Normal"
              rightLabel="Extreme"
            />

            <Slider
              label="Emergency expense"
              value={controls.emergency_expense}
              min={0}
              max={20000}
              step={500}
              onChange={(v) => set('emergency_expense', v)}
              format={(v) => (v === 0 ? 'None' : inr(v))}
              leftLabel="₹0"
              rightLabel="₹20,000"
            />

            <Slider
              label="Fuel cost increase"
              value={controls.fuel_cost_increase_pct}
              min={0}
              max={0.3}
              step={0.05}
              onChange={(v) => set('fuel_cost_increase_pct', v)}
              format={(v) => (v === 0 ? 'No change' : `+${(v * 100).toFixed(0)}%`)}
              leftLabel="0%"
              rightLabel="+30%"
            />
          </div>

          {/* --------------------------------------------- recovery lever */}
          <div className="mt-6 border-t border-canvas-line pt-5">
            <p className="label-eyebrow mb-2.5">Recover the gap</p>
            <div className="flex flex-wrap gap-2">
              {[
                { day: 6, label: '+2h Saturday', hours: 2 },
                { day: 0, label: '+2h Sunday', hours: 2 },
              ].map((o) => {
                const on = extraHours.some((e) => e.day_of_week === o.day);
                return (
                  <button
                    key={o.day}
                    type="button"
                    onClick={() =>
                      setExtraHours((prev) =>
                        on ? prev.filter((e) => e.day_of_week !== o.day) : [...prev, { day_of_week: o.day, hours: o.hours }],
                      )
                    }
                    aria-pressed={on}
                    className={cn(
                      'focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-600 transition-colors',
                      on
                        ? 'border-good/50 bg-good-soft text-good-ink'
                        : 'border-canvas-line bg-canvas-raised text-ink-muted hover:text-ink-soft',
                    )}
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
              Extra hours are valued below your average hour, since your busiest slots are already worked.
            </p>
          </div>
        </Card>

        {/* -------------------------------------------------- the results */}
        <div className="space-y-5">
          {error ? (
            <ErrorState message={error} onRetry={() => setControls({ ...controls })} />
          ) : !result ? (
            <Card>
              <ChartSkeleton height={300} />
            </Card>
          ) : (
            <>
              <ComparisonCard result={result} pending={pending} />

              <Card>
                <CardHeader
                  eyebrow="Projected balance"
                  title="Normal forecast against your scenario"
                  description="Both lines share one axis, so the vertical gap between them is the real difference in rupees."
                />
                <ScenarioCompareChart baseline={result.baseline} scenario={result.scenario} height={320} />
              </Card>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader eyebrow="What changed" title="Factors in this scenario" />
                  {result.drivers.length ? (
                    <ol className="space-y-3">
                      {result.drivers.map((d, i) => (
                        <li key={d.key} className="flex gap-3">
                          <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-canvas-hover text-[10px] font-700 text-ink-muted">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-xs font-600 text-ink">{d.label}</span>
                              {d.impact_amount !== 0 ? (
                                <span
                                  className={cn(
                                    'tnum text-xs font-600',
                                    d.impact_amount < 0 ? 'text-serious-ink' : 'text-good-ink',
                                  )}
                                >
                                  {inr(d.impact_amount, { sign: true })}
                                </span>
                              ) : null}
                              <ProvenanceChip kind={d.evidence} />
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{d.explanation}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      Nothing is changed yet — move a control or pick a preset above.
                    </p>
                  )}
                </Card>

                <Card>
                  <CardHeader eyebrow="Reading the result" title="What this means" />
                  <p className="text-sm leading-relaxed text-ink-soft">{result.narrative}</p>

                  <div className="mt-5 space-y-3 border-t border-canvas-line pt-5">
                    <DeltaRow
                      label="Income"
                      value={inr(result.deltas.income, { sign: true })}
                      positive={result.deltas.income >= 0}
                    />
                    <DeltaRow
                      label="Ending balance"
                      value={inr(result.deltas.ending_balance, { sign: true })}
                      positive={result.deltas.ending_balance >= 0}
                    />
                    <DeltaRow
                      label="Shortfall probability"
                      value={pct(result.deltas.shortfall_probability)}
                      positive={result.deltas.shortfall_probability <= 0}
                    />
                    {result.deltas.risk_band_changed ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2">
                        <span className="text-xs font-600 text-warn-ink">Risk band moved</span>
                        <span className="text-xs font-600 text-warn-ink">
                          {RISK_LABEL[result.baseline.risk_band]} → {RISK_LABEL[result.scenario.risk_band]}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <HonestyNote
                    className="mt-5"
                    text={result.meta.disclaimer ?? 'Scenario output — simulated figures under the settings you chose.'}
                  />
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({ result, pending }: { result: StressTestResponse; pending: boolean }) {
  const { baseline, scenario } = result;

  return (
    <Card className={cn('transition-opacity', pending && 'opacity-70')}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Outcome
          title={baseline.label}
          tone="baseline"
          income={baseline.projected_income}
          ending={baseline.projected_ending_balance}
          lowest={baseline.lowest_balance}
          probability={baseline.shortfall_probability}
          band={baseline.risk_band}
          gap={baseline.gap_to_buffer}
        />
        <Outcome
          title={scenario.label}
          tone="scenario"
          income={scenario.projected_income}
          ending={scenario.projected_ending_balance}
          lowest={scenario.lowest_balance}
          probability={scenario.shortfall_probability}
          band={scenario.risk_band}
          gap={scenario.gap_to_buffer}
          compareTo={{ income: baseline.projected_income, ending: baseline.projected_ending_balance }}
        />
      </div>
    </Card>
  );
}

function Outcome({
  title,
  tone,
  income,
  ending,
  lowest,
  probability,
  band,
  gap,
  compareTo,
}: {
  title: string;
  tone: 'baseline' | 'scenario';
  income: number;
  ending: number;
  lowest: number;
  probability: number;
  band: Parameters<typeof RiskBadge>[0]['band'];
  gap: number;
  compareTo?: { income: number; ending: number };
}) {
  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border p-4',
        tone === 'scenario' ? 'border-brand-400/35 bg-brand-900/15' : 'border-canvas-line bg-canvas-raised',
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-xs font-600', tone === 'scenario' ? 'text-brand-200' : 'text-ink-muted')}>{title}</p>
        <RiskBadge band={band} probability={probability} size="sm" />
      </div>

      <div className="space-y-4">
        <Stat
          label="Projected income"
          value={inr(income)}
          kind={tone === 'scenario' ? 'scenario' : 'forecast'}
          sub={compareTo ? `${inr(income - compareTo.income, { sign: true })} vs normal` : undefined}
          trend={compareTo ? (income >= compareTo.income ? 'up' : 'down') : undefined}
        />
        <Stat
          label="Ending balance"
          value={inr(ending)}
          kind={tone === 'scenario' ? 'scenario' : 'forecast'}
          sub={compareTo ? `${inr(ending - compareTo.ending, { sign: true })} vs normal` : undefined}
          trend={compareTo ? (ending >= compareTo.ending ? 'up' : 'down') : undefined}
          valueClassName={ending < 0 ? 'text-critical-ink' : undefined}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-canvas-line pt-3 text-xs">
          <div>
            <p className="text-ink-muted">Lowest point</p>
            <p className={cn('tnum mt-1 font-600', lowest < 0 ? 'text-critical-ink' : 'text-ink')}>{inr(lowest)}</p>
          </div>
          <div>
            <p className="text-ink-muted">Buffer gap</p>
            <p className={cn('tnum mt-1 font-600', gap < 0 ? 'text-serious-ink' : 'text-good-ink')}>
              {inr(gap, { sign: true })}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-ink-faint">Shortfall probability {pctPlain(probability)}</p>
      </div>
    </motion.div>
  );
}

function DeltaRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={cn('tnum text-sm font-600', positive ? 'text-good-ink' : 'text-serious-ink')}>{value}</span>
    </div>
  );
}
