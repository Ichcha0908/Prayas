#!/usr/bin/env node
/**
 * Fetches real historical daily weather for Delhi NCR from Open-Meteo's ERA5
 * reanalysis archive and writes it to src/data/weather-delhi-ncr.json.
 *
 * Why: the demo's synthetic data generator (src/api/mock/engine.ts) invents
 * weather with realistic seasonality, but it is still invented. This script
 * replaces the *historical* portion of that weather with actual observed
 * conditions, so statements like "your heavy-rain days earned 21% less" are
 * measured against real rainfall on real dates, not synthetic noise.
 *
 * Source: Open-Meteo Historical Weather API (ERA5 reanalysis), free, no API
 * key, CC BY 4.0. https://open-meteo.com/en/docs/historical-weather-api
 *
 * Coverage: the archive has a ~5-6 day reporting lag, so the most recent few
 * days before "today" are left ungenerated here — the engine's synthetic
 * generator fills that tail, and always fills the forward-looking forecast
 * window (real weather does not exist yet for future dates).
 *
 * Usage:
 *   node scripts/fetch-weather.mjs
 *   npm run fetch:weather
 *
 * Re-run periodically (e.g. monthly) to extend coverage as time passes. The
 * app works with no run at all — engine.ts falls back to synthetic weather
 * for any date this file doesn't cover.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'weather-delhi-ncr.json');

// South Delhi — Saket, matching the demo driver's zone in engine.ts.
const LATITUDE = 28.5245;
const LONGITUDE = 77.2065;

const ARCHIVE_LAG_DAYS = 6;
const HISTORY_DAYS = 450; // a little more than the engine's 430-day window

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, days) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Maps a WMO weather code + measured rainfall onto the app's WeatherCode enum.
 * Precipitation amount is checked first because it is what the income model
 * actually reacts to; the WMO code only resolves the dry-day sky condition
 * and catches thunderstorms that dropped little measurable rain.
 * Thresholds match src/api/mock/engine.ts's own synthetic generator, so real
 * and synthetic days are classified the same way.
 */
function mapWeatherCode(wmoCode, precipMm) {
  const isThunderstorm = [95, 96, 99].includes(wmoCode);
  if (isThunderstorm || precipMm >= 38) return 'storm';
  if (precipMm >= 20) return 'heavy_rain';
  if (precipMm >= 3) return 'rain';
  if (wmoCode === 0) return 'clear';
  if (wmoCode === 1 || wmoCode === 2) return 'partly_cloudy';
  return 'cloudy'; // overcast, fog, or any other code with no measurable rain
}

async function main() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const endDate = addDays(today, -ARCHIVE_LAG_DAYS);
  const startDate = addDays(today, -HISTORY_DAYS);

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(LATITUDE));
  url.searchParams.set('longitude', String(LONGITUDE));
  url.searchParams.set('start_date', isoDate(startDate));
  url.searchParams.set('end_date', isoDate(endDate));
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('timezone', 'Asia/Kolkata');

  console.log(`Fetching ${isoDate(startDate)} .. ${isoDate(endDate)} for (${LATITUDE}, ${LONGITUDE})…`);
  console.log(url.toString());

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();

  const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_sum } = body.daily;

  /** @type {Record<string, { code: string, rainfallMm: number, tempC: number }>} */
  const byDate = {};
  for (let i = 0; i < time.length; i += 1) {
    const precipMm = Math.round((precipitation_sum[i] ?? 0) * 10) / 10;
    const tMax = temperature_2m_max[i];
    const tMin = temperature_2m_min[i];
    byDate[time[i]] = {
      code: mapWeatherCode(weathercode[i], precipMm),
      rainfallMm: precipMm,
      tempC: Math.round((tMax + tMin) / 2),
    };
  }

  const rainyDays = Object.values(byDate).filter((d) => d.rainfallMm >= 3).length;
  console.log(`Got ${time.length} days. ${rainyDays} had measurable rain (≥3mm).`);

  const output = {
    source: 'Open-Meteo Historical Weather API (ERA5 reanalysis)',
    source_url: 'https://open-meteo.com/en/docs/historical-weather-api',
    license: 'CC BY 4.0',
    fetched_at: new Date().toISOString(),
    latitude: LATITUDE,
    longitude: LONGITUDE,
    start_date: isoDate(startDate),
    end_date: isoDate(endDate),
    days: byDate,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('fetch-weather failed:', err.message);
  console.error('The app still works without this file — engine.ts falls back to synthetic weather.');
  process.exitCode = 1;
});
