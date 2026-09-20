import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { setLocation, SUPPORTED_CITIES, type SupportedCity } from '@/api';
import { clearStoredCityId, getStoredCityId, setStoredCityId } from '@/lib/locations';

/**
 * Which city's real weather and fuel price feed the app, plus the gate that
 * gets a user to choose one before /app is reachable. Selecting a city does
 * not change the driver's identity, income pattern or expenses — only the
 * location-derived inputs (weather, fuel price, the city/zone label shown in
 * the profile) — see engine.ts's buildDriverSpec for exactly what does and
 * doesn't change.
 */
interface LocationContextValue {
  /** null until the user has picked a city — the /login gate's condition. */
  selectedCity: SupportedCity | null;
  cities: SupportedCity[];
  selectCity: (cityId: string) => void;
  /** Clears the stored selection, sending the user back through /login. */
  resetLocation: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<SupportedCity | null>(() => {
    const storedId = getStoredCityId();
    if (!storedId) return null;
    const city = SUPPORTED_CITIES.find((c) => c.id === storedId);
    if (!city) return null;
    // Configure the engine synchronously on first render, before any data
    // hook fires its first fetch — otherwise the very first render would
    // briefly compute against the engine's default city.
    setLocation(city.id);
    return city;
  });

  const selectCity = useCallback((cityId: string) => {
    const city = SUPPORTED_CITIES.find((c) => c.id === cityId) ?? SUPPORTED_CITIES[0];
    setLocation(city.id);
    setStoredCityId(city.id);
    setSelectedCity(city);
  }, []);

  const resetLocation = useCallback(() => {
    clearStoredCityId();
    setSelectedCity(null);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({ selectedCity, cities: SUPPORTED_CITIES, selectCity, resetLocation }),
    [selectedCity, selectCity, resetLocation],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}
