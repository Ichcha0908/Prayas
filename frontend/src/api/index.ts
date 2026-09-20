/**
 * The single entry point every component uses to reach data.
 *
 * Each function tries the live backend first (when configured) and falls back
 * to the in-browser mock engine. Components never know which one answered —
 * they only read `meta` if they want to label the source.
 */

import { DATA_SOURCE, http, isLiveBackendAvailable, type RequestOptions } from './client';
import type {
  CalendarResponse,
  CashflowResponse,
  ChatRequest,
  ChatResponse,
  ForecastResponse,
  InsightsResponse,
  ResilienceResponse,
  RiskResponse,
  ScenarioKey,
  StressTestRequest,
  StressTestResponse,
  UserResponse,
} from './types';
import {
  getCurrentCity,
  loadLiveForecastWeather,
  loadLiveHistoricalWeather,
  NEUTRAL_CONTEXT,
  setCurrentCity,
  type ForecastContext,
} from './mock/engine';
import * as mock from './mock/handlers';
import { SUPPORTED_CITIES, type SupportedCity } from '../lib/locations';

export * from './types';
export { ApiError, DEMO_DRIVER_ID, DATA_SOURCE } from './client';
export { SUPPORTED_CITIES, type SupportedCity };

/**
 * Location control. A real backend would take this as a parameter on the
 * driver's profile or a query param on each request; the mock engine keeps it
 * as session state (see engine.ts's CURRENT_CITY doc comment for why), so
 * these two functions are the seam between "the UI changed the location" and
 * "the engine now generates data for it".
 */
export const getCurrentLocation = (): SupportedCity => getCurrentCity();
export const setLocation = (cityId: string): void => setCurrentCity(cityId);

/**
 * Scenario overlays travel to the live backend as a repeated query parameter
 * (`?scenario=diwali&scenario=rain_shock`) so that GET endpoints stay cacheable
 * and the dashboard can render the signature demo against a real server.
 */
function scenarioQuery(scenarios: ScenarioKey[] = []): Record<string, string | undefined> {
  const active = scenarios.filter((s) => s !== 'baseline');
  return active.length ? { scenario: active.join(',') } : {};
}

function contextFromScenarios(scenarios: ScenarioKey[] = []): ForecastContext {
  return {
    ...NEUTRAL_CONTEXT,
    forceFestival: scenarios.includes('diwali') ? 'Diwali' : null,
    rainfallMultiplier: scenarios.includes('rain_shock') ? 3 : 1,
  };
}

/**
 * Runs the mock engine, after best-effort loading the live weather forecast
 * it prefers for near-term days. Loading is memoized (see
 * loadLiveForecastWeather), so this only actually fetches once per session
 * regardless of how many endpoints call it.
 */
async function runFallback<T>(fallback: () => T): Promise<T> {
  await Promise.all([loadLiveForecastWeather(), loadLiveHistoricalWeather()]);
  return fallback();
}

/** Runs the live call when possible, otherwise the local equivalent. */
async function resolve<T>(live: () => Promise<T>, fallback: () => T): Promise<T> {
  if (DATA_SOURCE === 'mock') return runFallback(fallback);
  const available = await isLiveBackendAvailable();
  if (!available) return runFallback(fallback);
  try {
    return await live();
  } catch (err) {
    // In 'live' mode a failure is a real failure and must surface to the UI.
    if (DATA_SOURCE === 'live') throw err;
    return runFallback(fallback);
  }
}

export interface ScenarioOptions extends RequestOptions {
  scenarios?: ScenarioKey[];
}

export const api = {
  getUser: (driverId: string, opts: RequestOptions = {}) =>
    resolve<UserResponse>(
      () => http.get(`/api/user/${driverId}`, opts),
      () => mock.getUser(driverId),
    ),

  getForecast: (driverId: string, opts: ScenarioOptions = {}) =>
    resolve<ForecastResponse>(
      () => http.get(`/api/forecast/${driverId}`, { ...opts, query: { ...opts.query, ...scenarioQuery(opts.scenarios) } }),
      () => mock.getForecast(driverId, contextFromScenarios(opts.scenarios)),
    ),

  getCashflow: (driverId: string, horizon: 7 | 14 = 7, opts: ScenarioOptions = {}) =>
    resolve<CashflowResponse>(
      () =>
        http.get(`/api/cashflow/${driverId}`, {
          ...opts,
          query: { ...opts.query, horizon, ...scenarioQuery(opts.scenarios) },
        }),
      () => mock.getCashflow(driverId, horizon, contextFromScenarios(opts.scenarios)),
    ),

  getRisk: (driverId: string, opts: ScenarioOptions = {}) =>
    resolve<RiskResponse>(
      () => http.get(`/api/risk/${driverId}`, { ...opts, query: { ...opts.query, ...scenarioQuery(opts.scenarios) } }),
      () => mock.getRisk(driverId, contextFromScenarios(opts.scenarios)),
    ),

  getResilience: (driverId: string, opts: ScenarioOptions = {}) =>
    resolve<ResilienceResponse>(
      () =>
        http.get(`/api/resilience/${driverId}`, { ...opts, query: { ...opts.query, ...scenarioQuery(opts.scenarios) } }),
      () => mock.getResilience(driverId, contextFromScenarios(opts.scenarios)),
    ),

  getCalendar: (driverId: string, opts: RequestOptions = {}) =>
    resolve<CalendarResponse>(
      () => http.get(`/api/calendar/${driverId}`, opts),
      () => mock.getCalendar(driverId),
    ),

  getInsights: (driverId: string, opts: RequestOptions = {}) =>
    resolve<InsightsResponse>(
      () => http.get(`/api/insights/${driverId}`, opts),
      () => mock.getInsights(driverId),
    ),

  postStressTest: (body: StressTestRequest, opts: RequestOptions = {}) =>
    resolve<StressTestResponse>(
      () => http.post('/api/stress-test', body, opts),
      () => mock.postStressTest(body),
    ),

  postChat: (body: ChatRequest, opts: RequestOptions = {}) =>
    resolve<ChatResponse>(
      () => http.post('/api/chat', body, opts),
      () => mock.postChat(body),
    ),
};
