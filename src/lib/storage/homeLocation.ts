import { Coordinates, HomeLocation } from '../../types/matchday';
import { db } from './db';

export interface HomePreset {
  id: string;
  name: string;
  address: string;
  city: string;
  coordinates: Coordinates;
}

export const POPULAR_HOME_PRESETS: HomePreset[] = [
  { id: 'hki-laru', name: 'Lauttasaari', address: 'Isokaari 1, 00200 Helsinki', city: 'Helsinki', coordinates: { lat: 60.1585, lng: 24.8770 } },
  { id: 'hki-toolo', name: 'Töölö', address: 'Mannerheimintie 50, 00260 Helsinki', city: 'Helsinki', coordinates: { lat: 60.1830, lng: 24.9250 } },
  { id: 'hki-kallio', name: 'Kallio', address: 'Hämeentie 20, 00530 Helsinki', city: 'Helsinki', coordinates: { lat: 60.1865, lng: 24.9535 } },
  { id: 'hki-vuosaari', name: 'Vuosaari', address: 'Kallvikintie 1, 00980 Helsinki', city: 'Helsinki', coordinates: { lat: 60.2085, lng: 25.1430 } },
  { id: 'hki-oulunkyla', name: 'Oulunkylä', address: 'Kylänvanhimmantie 25, 00640 Helsinki', city: 'Helsinki', coordinates: { lat: 60.2280, lng: 24.9650 } },
  { id: 'espoo-tapiola', name: 'Tapiola', address: 'Tapiontori 3, 02100 Espoo', city: 'Espoo', coordinates: { lat: 60.1765, lng: 24.8050 } },
  { id: 'espoo-matinkyla', name: 'Matinkylä', address: 'Piispansilta 11, 02230 Espoo', city: 'Espoo', coordinates: { lat: 60.1600, lng: 24.7480 } },
  { id: 'espoo-leppavaara', name: 'Leppävaara', address: 'Konstaapelintie 4, 02600 Espoo', city: 'Espoo', coordinates: { lat: 60.2190, lng: 24.8130 } },
  { id: 'vantaa-tikkurila', name: 'Tikkurila', address: 'Kielotie 13, 01300 Vantaa', city: 'Vantaa', coordinates: { lat: 60.2940, lng: 25.0420 } },
  { id: 'vantaa-myyrmaki', name: 'Myyrmäki', address: 'Iskostie 4, 01600 Vantaa', city: 'Vantaa', coordinates: { lat: 60.2610, lng: 24.8530 } },
  { id: 'tre-keskusta', name: 'Tampere Keskusta', address: 'Keskustori 1, 33100 Tampere', city: 'Tampere', coordinates: { lat: 61.4980, lng: 23.7600 } },
  { id: 'tku-keskusta', name: 'Turku Keskusta', address: 'Kauppatori 1, 20100 Turku', city: 'Turku', coordinates: { lat: 60.4518, lng: 22.2666 } },
  { id: 'oulu-keskusta', name: 'Oulu Keskusta', address: 'Rotuaari, 90100 Oulu', city: 'Oulu', coordinates: { lat: 65.0121, lng: 25.4651 } },
  { id: 'jkl-keskusta', name: 'Jyväskylä Keskusta', address: 'Kauppakatu 20, 40100 Jyväskylä', city: 'Jyväskylä', coordinates: { lat: 62.2426, lng: 25.7473 } },
  { id: 'kuopio-keskusta', name: 'Kuopio Keskusta', address: 'Torikatu 18, 70100 Kuopio', city: 'Kuopio', coordinates: { lat: 62.8924, lng: 27.6770 } },
  { id: 'lahti-keskusta', name: 'Lahti Keskusta', address: 'Aleksanterinkatu 15, 15110 Lahti', city: 'Lahti', coordinates: { lat: 60.9827, lng: 25.6615 } }
];

export const DEFAULT_HOME_LOCATION: HomeLocation = {
  name: 'Lauttasaari',
  address: 'Isokaari 1, 00200 Helsinki',
  coordinates: { lat: 60.1585, lng: 24.8770 },
  maxWalkingDistanceKm: 1.5,
  maxCyclingDistanceKm: 5.0,
  defaultTransitMode: 'auto',
  updatedAt: new Date().toISOString()
};

const STORAGE_KEY = 'pelipaiva_home_location';

/**
 * Retrieves the configured family home location.
 * Falls back to Dexie syncState, localStorage, or Lauttasaari default.
 */
export async function getHomeLocation(): Promise<HomeLocation> {
  try {
    const sync = await db.syncState.get('home_location');
    if (sync && sync.syncKey) {
      const parsed = JSON.parse(sync.syncKey) as HomeLocation;
      if (parsed && parsed.coordinates && typeof parsed.coordinates.lat === 'number') {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  if (typeof localStorage !== 'undefined') {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local) as HomeLocation;
        if (parsed && parsed.coordinates && typeof parsed.coordinates.lat === 'number') {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
  }

  return DEFAULT_HOME_LOCATION;
}

/**
 * Saves and updates the family home location in Dexie and localStorage.
 */
export async function saveHomeLocation(home: HomeLocation): Promise<void> {
  const payload: HomeLocation = {
    ...home,
    maxWalkingDistanceKm: home.maxWalkingDistanceKm ?? 1.5,
    maxCyclingDistanceKm: home.maxCyclingDistanceKm ?? 5.0,
    updatedAt: new Date().toISOString()
  };

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  try {
    await db.syncState.put({
      key: 'home_location',
      syncKey: JSON.stringify(payload),
      lastSyncedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[HOME_LOCATION] Failed to save in Dexie syncState:', err);
  }
}

/**
 * Geocodes an address string using Helsinki ServiceMap or Nominatim.
 */
export async function geocodeAddress(query: string): Promise<Coordinates | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // 1. Check presets
  const presetHit = POPULAR_HOME_PRESETS.find(
    (p) =>
      p.name.toLowerCase() === trimmed.toLowerCase() ||
      p.address.toLowerCase().includes(trimmed.toLowerCase())
  );
  if (presetHit) {
    return presetHit.coordinates;
  }

  // 2. Try Helsinki Region ServiceMap API
  if (typeof fetch !== 'undefined') {
    try {
      const sUrl = `https://api.hel.fi/servicemap/v2/search/?q=${encodeURIComponent(trimmed)}&type=address`;
      const res = await fetch(sUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        const results = json.results || [];
        if (results.length > 0 && results[0].location?.coordinates) {
          const [lng, lat] = results[0].location.coordinates;
          if (typeof lat === 'number' && typeof lng === 'number') {
            return { lat, lng };
          }
        }
      }
    } catch {
      // fallback
    }

    // 3. Try OpenStreetMap Nominatim for all Finland
    try {
      const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        `${trimmed}, Finland`
      )}&format=json&limit=1`;
      const res = await fetch(nUrl, {
        headers: { 'User-Agent': 'PelipaivaMatchdayApp/1.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
      }
    } catch {
      // fallback
    }
  }

  return null;
}

/**
 * Gets user's current GPS location via browser Geolocation API.
 */
export async function getCurrentGpsLocation(): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}
