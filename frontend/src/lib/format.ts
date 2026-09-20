import type { ISODate, RiskBand, ValueKind } from '@/api/types';

/** Indian-grouped rupees: ₹1,23,456. No paise anywhere in the product. */
export function inr(value: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  if (opts.compact && abs >= 100000) {
    return `${rounded < 0 ? '−' : opts.sign ? '+' : ''}₹${(abs / 100000).toFixed(1)}L`;
  }
  if (opts.compact && abs >= 1000) {
    return `${rounded < 0 ? '−' : opts.sign ? '+' : ''}₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  }
  const body = `₹${abs.toLocaleString('en-IN')}`;
  if (rounded < 0) return `−${body}`;
  return opts.sign ? `+${body}` : body;
}

/** Percentage with an explicit sign, e.g. "+24%" / "−18%". */
export function pct(value: number, digits = 0): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value * 100).toFixed(digits)}%`;
}

/** Plain percentage with no sign, e.g. "74%". */
export function pctPlain(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Today as YYYY-MM-DD in local time — never toISOString(), which is UTC and
 * can shift the calendar date near a timezone boundary. */
export function todayISO(): ISODate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "12 Oct" */
export function shortDate(iso: ISODate): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sat 12 Oct" */
export function dayDate(iso: ISODate): string {
  const d = parseISO(iso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Saturday, 12 October" */
export function longDate(iso: ISODate): string {
  const d = parseISO(iso);
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dayNameShort(iso: ISODate): string {
  return DAYS_SHORT[parseISO(iso).getDay()];
}

export function dayNameLong(iso: ISODate): string {
  return DAYS_LONG[parseISO(iso).getDay()];
}

/** "in 6 days" / "tomorrow" / "today" */
export function relativeDays(iso: ISODate, from = new Date()): string {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = Math.round((parseISO(iso).getTime() - base.getTime()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}

/* ------------------------------------------------------------- risk bands */

export const RISK_LABEL: Record<RiskBand, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

export const RISK_RANGE: Record<RiskBand, string> = {
  low: '0–30%',
  moderate: '30–60%',
  high: '60–80%',
  critical: '80%+',
};

/**
 * Colour is never the only carrier of risk — every consumer of this map also
 * renders the band's label and an icon.
 */
export const RISK_CLASSES: Record<RiskBand, { text: string; bg: string; border: string; dot: string; bar: string }> = {
  low: { text: 'text-good-ink', bg: 'bg-good-soft', border: 'border-good/40', dot: 'bg-good', bar: 'bg-good' },
  moderate: { text: 'text-warn-ink', bg: 'bg-warn-soft', border: 'border-warn/40', dot: 'bg-warn', bar: 'bg-warn' },
  high: { text: 'text-serious-ink', bg: 'bg-serious-soft', border: 'border-serious/40', dot: 'bg-serious', bar: 'bg-serious' },
  critical: { text: 'text-critical-ink', bg: 'bg-critical-soft', border: 'border-critical/40', dot: 'bg-critical', bar: 'bg-critical' },
};

/* -------------------------------------------------------- value provenance */

export const KIND_LABEL: Record<ValueKind, string> = {
  historical: 'Historical fact',
  forecast: 'Forecast',
  scenario: 'Scenario',
};

export const KIND_SHORT: Record<ValueKind, string> = {
  historical: 'Historical',
  forecast: 'Forecast',
  scenario: 'Scenario',
};

export const KIND_CLASSES: Record<ValueKind, string> = {
  historical: 'border-ink-faint/40 text-ink-soft',
  forecast: 'border-brand-400/40 text-brand-300',
  scenario: 'border-warn/40 text-warn-ink',
};
