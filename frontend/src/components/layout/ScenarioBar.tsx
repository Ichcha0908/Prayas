import { AnimatePresence, motion } from 'framer-motion';
import { CloudRain, RotateCcw, Sparkles } from 'lucide-react';
import { useAppData } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import type { ScenarioKey } from '@/api/types';

const SCENARIOS: { key: ScenarioKey; label: string; Icon: typeof Sparkles; active: string }[] = [
  {
    key: 'diwali',
    label: 'Simulate Diwali',
    Icon: Sparkles,
    active: 'border-good/50 bg-good-soft text-good-ink',
  },
  {
    key: 'rain_shock',
    label: 'Simulate Rain Shock',
    Icon: CloudRain,
    active: 'border-serious/50 bg-serious-soft text-serious-ink',
  },
];

/**
 * The signature demo control. Lives in the header so it is reachable from every
 * page — toggling one recomputes forecast, cashflow, risk and buffer at once.
 */
export function ScenarioBar() {
  const { scenarios, toggleScenario, clearScenarios } = useAppData();

  return (
    <div className="border-t border-canvas-line/60 bg-canvas-raised/40">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6">
        <span className="shrink-0 text-[11px] font-600 uppercase tracking-[0.1em] text-ink-faint">Simulate</span>

        {SCENARIOS.map(({ key, label, Icon, active }) => {
          const on = scenarios.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleScenario(key)}
              aria-pressed={on}
              className={cn(
                'focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-600 transition-all duration-200',
                on ? active : 'border-canvas-line bg-canvas-card text-ink-muted hover:border-brand-400/40 hover:text-ink-soft',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
              {on ? <span className="ml-0.5 text-[10px] opacity-80">ON</span> : null}
            </button>
          );
        })}

        <AnimatePresence>
          {scenarios.length ? (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              onClick={clearScenarios}
              className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-600 text-ink-muted transition-colors hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </motion.button>
          ) : null}
        </AnimatePresence>

        <span className="ml-auto hidden shrink-0 text-[11px] text-ink-faint md:block">
          {scenarios.length
            ? 'Scenario figures — not a prediction of what will happen.'
            : 'Overlay a scenario to see every figure recalculate.'}
        </span>
      </div>
    </div>
  );
}
