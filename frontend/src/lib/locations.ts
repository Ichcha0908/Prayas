/**
 * Supported locations for KAMAI.AI.
 *
 * Deliberately a short, curated list rather than free-text city entry or a
 * geolocation API. Every field here is real, checked data — coordinates are
 * each city's IMD reference observatory (the same convention already used for
 * Delhi's Saket/Safdarjung coordinates), and fuel prices come from PPAC's
 * daily metro bulletin (see src/data/fuel-price-by-city.json). PPAC's
 * bulletin covers exactly these four cities and no others, which is the
 * actual reason the list stops at four rather than an arbitrary product
 * decision to limit choice.
 *
 * Selecting a city sets which real weather coordinates and real fuel price
 * feed the forecast — it does not generate a different persona. Arjun's
 * income pattern, expenses and history stay the same; only the
 * location-derived inputs change.
 */

export interface SupportedCity {
  id: string;
  /** Shown in the picker and the app header. */
  label: string;
  /** A short description of the metro zone, shown under the label. */
  zone: string;
  /** IMD reference observatory for this city — used for weather requests. */
  station: string;
  latitude: number;
  longitude: number;
}

export const SUPPORTED_CITIES: SupportedCity[] = [
  {
    id: 'delhi',
    label: 'Delhi NCR',
    zone: 'South Delhi — Saket cluster',
    station: 'Safdarjung Observatory',
    latitude: 28.5245,
    longitude: 77.2065,
  },
  {
    id: 'mumbai',
    label: 'Mumbai',
    zone: 'Western suburbs — Santacruz cluster',
    station: 'Santacruz Observatory',
    latitude: 19.0989,
    longitude: 72.8656,
  },
  {
    id: 'chennai',
    label: 'Chennai',
    zone: 'Central Chennai — Nungambakkam cluster',
    station: 'Nungambakkam Observatory',
    latitude: 13.0604,
    longitude: 80.2496,
  },
  {
    id: 'kolkata',
    label: 'Kolkata',
    zone: 'South Kolkata — Alipore cluster',
    station: 'Alipore Observatory',
    latitude: 22.5354,
    longitude: 88.3312,
  },
];

export const DEFAULT_CITY_ID = 'delhi';

export function getCityById(id: string): SupportedCity {
  return SUPPORTED_CITIES.find((c) => c.id === id) ?? SUPPORTED_CITIES[0];
}

const STORAGE_KEY = 'kamai.selectedCityId';

/** Reads the persisted city selection, or null if the user hasn't chosen yet. */
export function getStoredCityId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — treat as no selection yet.
    return null;
  }
}

export function setStoredCityId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* non-fatal — the session still works, it just won't persist a reload */
  }
}

export function clearStoredCityId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}
