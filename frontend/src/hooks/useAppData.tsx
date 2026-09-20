import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, DEMO_DRIVER_ID, type ScenarioKey } from '@/api';
import type {
  CalendarResponse,
  CashflowResponse,
  ForecastResponse,
  InsightsResponse,
  ResilienceResponse,
  RiskResponse,
  UserResponse,
} from '@/api/types';
import { useAsync, type AsyncState } from './useAsync';
import { useLocation } from './useLocation';

/**
 * App-wide data + the scenario overlay.
 *
 * Scenario overlays ("Simulate Diwali", "Simulate Rain Shock") are global on
 * purpose: the signature demo is that toggling one recomputes the forecast,
 * cashflow, risk AND buffer everywhere at once, not just on one chart.
 */
interface AppDataValue {
  driverId: string;
  scenarios: ScenarioKey[];
  toggleScenario: (key: ScenarioKey) => void;
  clearScenarios: () => void;
  isScenarioActive: (key: ScenarioKey) => boolean;

  user: AsyncState<UserResponse>;
  forecast: AsyncState<ForecastResponse>;
  cashflow: AsyncState<CashflowResponse>;
  risk: AsyncState<RiskResponse>;
  resilience: AsyncState<ResilienceResponse>;
  calendar: AsyncState<CalendarResponse>;
  insights: AsyncState<InsightsResponse>;

  cashflowHorizon: 7 | 14;
  setCashflowHorizon: (h: 7 | 14) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const driverId = DEMO_DRIVER_ID;
  const { selectedCity } = useLocation();
  // AppDataProvider only ever renders inside <RequireLocation>, which
  // already redirects to /login when no city is chosen — this id is
  // included in every fetch's dependency list purely so switching cities
  // (via the sidebar's "Change" control) triggers a full refetch of every
  // endpoint against the newly selected city's weather and fuel price.
  const cityId = selectedCity?.id ?? 'unset';
  const [scenarios, setScenarios] = useState<ScenarioKey[]>([]);
  const [cashflowHorizon, setCashflowHorizon] = useState<7 | 14>(7);

  const scenarioKey = scenarios.join(',');

  const toggleScenario = useCallback((key: ScenarioKey) => {
    setScenarios((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const clearScenarios = useCallback(() => setScenarios([]), []);

  const user = useAsync((signal) => api.getUser(driverId, { signal }), [driverId, cityId]);
  const forecast = useAsync(
    (signal) => api.getForecast(driverId, { signal, scenarios }),
    [driverId, cityId, scenarioKey],
  );
  const cashflow = useAsync(
    (signal) => api.getCashflow(driverId, cashflowHorizon, { signal, scenarios }),
    [driverId, cityId, scenarioKey, cashflowHorizon],
  );
  const risk = useAsync((signal) => api.getRisk(driverId, { signal, scenarios }), [driverId, cityId, scenarioKey]);
  const resilience = useAsync(
    (signal) => api.getResilience(driverId, { signal, scenarios }),
    [driverId, cityId, scenarioKey],
  );
  const calendar = useAsync((signal) => api.getCalendar(driverId, { signal }), [driverId, cityId]);
  const insights = useAsync((signal) => api.getInsights(driverId, { signal }), [driverId, cityId]);

  const value = useMemo<AppDataValue>(
    () => ({
      driverId,
      scenarios,
      toggleScenario,
      clearScenarios,
      isScenarioActive: (key) => scenarios.includes(key),
      user,
      forecast,
      cashflow,
      risk,
      resilience,
      calendar,
      insights,
      cashflowHorizon,
      setCashflowHorizon,
    }),
    [
      driverId,
      scenarios,
      toggleScenario,
      clearScenarios,
      user,
      forecast,
      cashflow,
      risk,
      resilience,
      calendar,
      insights,
      cashflowHorizon,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
