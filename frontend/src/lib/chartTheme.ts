/**
 * Shared chart tokens.
 *
 * The series colours were validated as a categorical set against the dark card
 * surface (#111A2E): all three clear the lightness band, the chroma floor, a
 * 3:1 contrast ratio, and an all-pairs CVD separation of ΔE 9.4. Do not swap
 * one out without re-validating the set.
 *
 * Every chart that uses these also ships a legend and/or direct labels, so a
 * reader never has to rely on hue alone.
 */

export const VIZ = {
  surface: '#111A2E',
  grid: '#1E2C47',
  axis: '#5C6579',
  text: '#C3C7D1',
  textMuted: '#8A93A6',

  income: '#3987E5',
  spend: '#D95926',
  balance: '#199E70',
  /** Reserved status colour — the buffer threshold, never a data series. */
  buffer: '#FAB219',

  band: 'rgba(57, 135, 229, 0.16)',
  bandStroke: 'rgba(57, 135, 229, 0.32)',
  balanceBand: 'rgba(25, 158, 112, 0.14)',
} as const;

/** Recharts axis props shared across every chart so the family reads as one. */
export const axisProps = {
  stroke: VIZ.axis,
  tick: { fill: VIZ.textMuted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: VIZ.grid },
} as const;

export const gridProps = {
  stroke: VIZ.grid,
  strokeDasharray: '2 6',
  vertical: false,
} as const;

/** Compact rupee ticks — charts never carry full ₹1,23,456 on an axis. */
export function moneyTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${value < 0 ? '−' : ''}₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${value < 0 ? '−' : ''}₹${abs}`;
}

/**
 * Picks a readable tick step and rounds the domain out to it, aiming for about
 * five ticks. A balance chart is NOT forced to include zero — anchoring a
 * ₹5,000 balance to a zero baseline flattens the very movement the chart is
 * there to show.
 */
const STEPS = [100, 250, 500, 1000, 2000, 2500, 5000, 10000, 25000];

export function niceScale(
  min: number,
  max: number,
  targetTicks = 5,
): { min: number; max: number; ticks: number[] } {
  const span = Math.max(1, max - min);
  const step = STEPS.find((s) => span / s <= targetTicks) ?? STEPS[STEPS.length - 1];
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { min: lo, max: hi, ticks };
}
