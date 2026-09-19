import { Cloud, CloudDrizzle, CloudRain, CloudSun, Sun, Zap } from 'lucide-react';
import type { WeatherCode } from '@/api/types';
import { cn } from './cn';

interface WeatherMeta {
  label: string;
  /** Tone reflects the income effect, not the sky. Always paired with a label. */
  tone: string;
  Icon: typeof Sun;
}

export const WEATHER_META: Record<WeatherCode, WeatherMeta> = {
  clear: { label: 'Clear', tone: 'text-warn-ink', Icon: Sun },
  partly_cloudy: { label: 'Partly cloudy', tone: 'text-brand-200', Icon: CloudSun },
  cloudy: { label: 'Cloudy', tone: 'text-ink-soft', Icon: Cloud },
  rain: { label: 'Light rain', tone: 'text-brand-300', Icon: CloudDrizzle },
  heavy_rain: { label: 'Heavy rain', tone: 'text-serious-ink', Icon: CloudRain },
  storm: { label: 'Thunderstorm', tone: 'text-critical-ink', Icon: Zap },
};

export function WeatherIcon({
  code,
  className,
  title,
}: {
  code: WeatherCode;
  className?: string;
  title?: string;
}) {
  const meta = WEATHER_META[code] ?? WEATHER_META.clear;
  const { Icon } = meta;
  return (
    <Icon
      className={cn('h-5 w-5 shrink-0', meta.tone, className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}

export function weatherLabel(code: WeatherCode): string {
  return (WEATHER_META[code] ?? WEATHER_META.clear).label;
}
