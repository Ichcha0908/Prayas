import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, Info, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Driver, RiskBand, ValueKind } from '@/api/types';
import { cn } from '@/lib/cn';
import { KIND_CLASSES, KIND_LABEL, KIND_SHORT, RISK_CLASSES, RISK_LABEL, RISK_RANGE, inr, pct, pctPlain } from '@/lib/format';

/* -------------------------------------------------------------------- Card */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section' | 'article';
  padded?: boolean;
  interactive?: boolean;
}

export function Card({ className, padded = true, interactive = false, as: Tag = 'div', ...rest }: CardProps) {
  return <Tag className={cn('card', padded && 'p-5 sm:p-6', interactive && 'card-hover', className)} {...rest} />;
}

export function CardHeader({
  title,
  eyebrow,
  description,
  action,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label-eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="font-display text-base font-600 leading-tight text-ink sm:text-lg">{title}</h2>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95 border border-brand-400/50',
  secondary: 'bg-canvas-card text-ink border border-canvas-line hover:border-brand-400/50 hover:bg-canvas-hover',
  ghost: 'bg-transparent text-ink-soft hover:bg-canvas-hover hover:text-ink border border-transparent',
  danger: 'bg-critical-soft text-critical-ink border border-critical/40 hover:bg-critical/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', icon, iconRight, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'focus-ring inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

/* ------------------------------------------------------------------- Badge */

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'brand' | 'good' | 'warn' | 'serious' | 'critical';
}) {
  const tones = {
    neutral: 'border-canvas-line bg-canvas-hover text-ink-soft',
    brand: 'border-brand-400/40 bg-brand-900/30 text-brand-200',
    good: 'border-good/40 bg-good-soft text-good-ink',
    warn: 'border-warn/40 bg-warn-soft text-warn-ink',
    serious: 'border-serious/40 bg-serious-soft text-serious-ink',
    critical: 'border-critical/40 bg-critical-soft text-critical-ink',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- RiskBadge */

const RISK_ICON: Record<RiskBand, typeof CheckCircle2> = {
  low: CheckCircle2,
  moderate: Info,
  high: AlertTriangle,
  critical: ShieldAlert,
};

/**
 * Risk is always icon + label + band range. Colour is reinforcement only, so
 * the state survives greyscale, colour-blindness and forced-colours mode.
 */
export function RiskBadge({
  band,
  probability,
  size = 'md',
  showRange = false,
  className,
}: {
  band: RiskBand;
  probability?: number;
  size?: 'sm' | 'md';
  showRange?: boolean;
  className?: string;
}) {
  const Icon = RISK_ICON[band];
  const c = RISK_CLASSES[band];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-semibold',
        c.bg,
        c.border,
        c.text,
        size === 'sm' ? 'px-2.5 py-1 text-2xs' : 'px-3 py-1.5 text-xs',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      <span>
        {RISK_LABEL[band]} risk
        {probability !== undefined ? ` · ${pctPlain(probability)}` : ''}
      </span>
      {showRange ? <span className="font-normal opacity-70">({RISK_RANGE[band]})</span> : null}
    </span>
  );
}

/* --------------------------------------------------------- ProvenanceChip */

/**
 * Makes the historical / forecast / scenario distinction visible at the point
 * of use, so a simulated number can never be mistaken for a measured one.
 */
export function ProvenanceChip({ kind, className }: { kind: ValueKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
        KIND_CLASSES[kind],
        className,
      )}
      title={KIND_LABEL[kind]}
    >
      {KIND_SHORT[kind]}
    </span>
  );
}

/* -------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  sub,
  trend,
  kind,
  className,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  kind?: ValueKind;
  className?: string;
  valueClassName?: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="label-eyebrow">{label}</p>
        {kind ? <ProvenanceChip kind={kind} /> : null}
      </div>
      <p className={cn('tnum mt-1.5 font-display text-2xl font-600 leading-none text-ink', valueClassName)}>{value}</p>
      {sub ? (
        <p
          className={cn(
            'mt-1.5 flex items-center gap-1 text-xs',
            trend === 'up' ? 'text-good-ink' : trend === 'down' ? 'text-serious-ink' : 'text-ink-muted',
          )}
        >
          {TrendIcon ? <TrendIcon className="h-3.5 w-3.5" aria-hidden /> : null}
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={className} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-4 h-3 w-24" />
      <Skeleton className="mb-3 h-8 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('mb-2 h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </Card>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="flex w-full items-end gap-2" style={{ height }} aria-busy="true">
      {[0.5, 0.75, 0.42, 0.9, 0.62, 0.8, 0.55, 0.7, 0.45, 0.85].map((h, i) => (
        <div key={i} className="skeleton flex-1 rounded-t-md" style={{ height: `${h * 100}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- ErrorState */

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col items-start gap-3', className)} role="alert">
      <div className="flex items-center gap-2 text-serious-ink">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        <h3 className="font-display text-sm font-600">We could not load this</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-canvas-line px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-ink-faint">{icon}</div> : null}
      <p className="font-display text-sm font-600 text-ink-soft">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}

/* -------------------------------------------------------------- WhyButton */

/**
 * The explanation affordance attached to every prediction.
 * Explanations are always feature-grounded — each row names the measured
 * feature, its effect in rupees or percent, and the evidence class.
 */
export function WhyButton({
  title,
  drivers,
  confidence,
  footnote,
  className,
}: {
  title: string;
  drivers: Driver[];
  confidence?: number;
  footnote?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-canvas-line bg-canvas-hover px-2.5 py-1 text-2xs font-semibold text-ink-soft transition-colors hover:border-brand-400/50 hover:text-ink"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        Why?
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-canvas-line bg-canvas-raised p-4 shadow-lift"
          >
            <p className="font-display text-sm font-600 text-ink">{title}</p>

            {drivers.length ? (
              <ol className="mt-3 space-y-3">
                {drivers.map((d, i) => (
                  <li key={d.key} className="flex gap-2.5">
                    <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-canvas-hover text-[10px] font-bold text-ink-muted">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold text-ink">{d.label}</span>
                        {d.impact_amount !== 0 ? (
                          <span
                            className={cn(
                              'tnum text-xs font-semibold',
                              d.impact_amount < 0 ? 'text-serious-ink' : 'text-good-ink',
                            )}
                          >
                            {inr(d.impact_amount, { sign: true })}
                          </span>
                        ) : d.impact_pct !== 0 ? (
                          <span
                            className={cn(
                              'tnum text-xs font-semibold',
                              d.impact_pct < 0 ? 'text-serious-ink' : 'text-good-ink',
                            )}
                          >
                            {pct(d.impact_pct)}
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
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                No single factor stands out for this window — the forecast is close to your usual pattern.
              </p>
            )}

            {confidence !== undefined ? (
              <div className="mt-4 flex items-center justify-between border-t border-canvas-line pt-3">
                <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  Model confidence
                </span>
                <span className="tnum text-xs font-semibold text-ink">{pctPlain(confidence)}</span>
              </div>
            ) : null}

            {footnote ? <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">{footnote}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ Slider */

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  hint?: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const id = useId();
  const fillPct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
        <span className="tnum font-display text-sm font-600 text-ink">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-input"
        style={{ backgroundSize: `${fillPct}% 100%` }}
        aria-valuetext={format(value)}
      />
      {leftLabel || rightLabel || hint ? (
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-faint">
          <span>{leftLabel}</span>
          {hint ? <span className="text-center">{hint}</span> : null}
          <span>{rightLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Progress */

export function ProgressBar({
  value,
  max,
  band,
  className,
  label,
}: {
  value: number;
  max: number;
  band?: RiskBand;
  className?: string;
  label?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-canvas-hover', className)}
      role="progressbar"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        className={cn('h-full rounded-full', band ? RISK_CLASSES[band].bar : 'bg-brand-gradient')}
        initial={{ width: 0 }}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- SectionLink */

export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

/* -------------------------------------------------------------- DataSource */

/** The honesty strip — every page that shows model output carries one. */
export function HonestyNote({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-[11px] leading-relaxed text-ink-faint', className)}>
      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
