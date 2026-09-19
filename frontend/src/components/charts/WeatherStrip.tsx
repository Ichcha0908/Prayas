import { motion } from 'framer-motion';
import type { ForecastDay } from '@/api/types';
import { cn } from '@/lib/cn';
import { inr, pct } from '@/lib/format';
import { WeatherIcon } from '@/lib/weather';

/**
 * "Financial weather" — the seven-day strip on the dashboard.
 * Each day carries an icon, the day name and the rupee figure, so the strength
 * of a day is never communicated by colour or icon alone.
 */
export function WeatherStrip({
  days,
  onSelect,
  selectedDate,
}: {
  days: ForecastDay[];
  onSelect?: (day: ForecastDay) => void;
  selectedDate?: string;
}) {
  const working = days.filter((d) => !d.is_planned_rest_day);
  const best = Math.max(...working.map((d) => d.expected_income), 1);

  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {days.map((d, i) => {
        const delta = d.historical_average ? d.expected_income / d.historical_average - 1 : 0;
        const strength = d.is_planned_rest_day ? 0 : d.expected_income / best;
        const selected = selectedDate === d.date;

        const tone = d.is_planned_rest_day
          ? 'text-ink-faint'
          : delta <= -0.12
            ? 'text-serious-ink'
            : delta >= 0.1
              ? 'text-good-ink'
              : 'text-ink-soft';

        const Element = onSelect ? motion.button : motion.div;

        return (
          <li key={d.date}>
            <Element
              {...(onSelect
                ? { type: 'button' as const, onClick: () => onSelect(d), 'aria-pressed': selected }
                : {})}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'focus-ring flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors',
                selected ? 'border-brand-400/60 bg-brand-900/25' : 'border-canvas-line bg-canvas-raised',
                onSelect && 'hover:border-brand-400/40 hover:bg-canvas-hover',
              )}
            >
              <span className="text-2xs font-600 uppercase tracking-[0.08em] text-ink-muted">{d.day_label}</span>
              <WeatherIcon code={d.weather.code} title={d.weather.label} className="h-6 w-6" />
              <span className={cn('tnum text-xs font-600', tone)}>
                {d.is_planned_rest_day ? 'Rest' : inr(d.expected_income, { compact: true })}
              </span>

              {/* Magnitude bar — a second, non-colour encoding of day strength. */}
              <span className="h-1 w-full overflow-hidden rounded-full bg-canvas-hover" aria-hidden>
                <motion.span
                  className={cn(
                    'block h-full rounded-full',
                    d.is_planned_rest_day ? 'bg-ink-faint/30' : delta <= -0.12 ? 'bg-serious' : delta >= 0.1 ? 'bg-good' : 'bg-brand-400',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, strength * 100)}%` }}
                  transition={{ delay: 0.15 + i * 0.035, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>

              <span className="sr-only">
                {d.is_planned_rest_day
                  ? 'Planned non-working day'
                  : `${inr(d.expected_income)}, ${pct(delta)} against your ${d.day_label} average. ${d.weather.label}.`}
              </span>
            </Element>
          </li>
        );
      })}
    </ul>
  );
}
