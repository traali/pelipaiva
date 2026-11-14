import type { VenueInfo } from '../../types/matchday';

/**
 * How sure Pelipäivä is about where a game is:
 * - exact: real coordinates from TASO, LIPAS, a built-in alias or the user's own pin
 * - approximate: real coordinates of an unverified match (shown as "Sijainti arvioitu")
 * - search: no coordinates; only a map search by venue name (+ city) is offered
 * - none: no venue name at all (e.g. "Kenttä ilmoitetaan")
 */
export type VenueLocationStatus = 'exact' | 'approximate' | 'search' | 'none';

type VenueLike = Pick<VenueInfo, 'name' | 'coordinates' | 'isApproximateLocation'> &
  Partial<Pick<VenueInfo, 'city' | 'address' | 'locationQuality' | 'locationSource'>>;

const FINLAND = { minLat: 59.3, maxLat: 70.2, minLng: 19.0, maxLng: 31.7 };

export function hasRealCoordinates(c: { lat?: number; lng?: number } | undefined | null): c is { lat: number; lng: number } {
  if (!c) return false;
  const { lat, lng } = c;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= FINLAND.minLat && lat <= FINLAND.maxLat && lng >= FINLAND.minLng && lng <= FINLAND.maxLng;
}

/** Placeholder names that are not a place, so not worth a map search either. */
const NOT_A_PLACE = /^(kenttä ilmoitetaan.*|ilmoitetaan myöhemmin|tuntematon kenttä|tba|tbd|-|)$/i;

export function isSearchableVenueName(name: string | undefined): boolean {
  const n = (name || '').trim();
  return n.length >= 3 && !NOT_A_PLACE.test(n);
}

export function venueLocationStatus(venue: VenueLike | undefined | null): VenueLocationStatus {
  if (!venue) return 'none';
  if (hasRealCoordinates(venue.coordinates)) {
    if (!venue.isApproximateLocation) return 'exact';
    if (venue.locationQuality === 'approximate') return 'approximate';
  }
  return isSearchableVenueName(venue.name) ? 'search' : 'none';
}

/** Coordinates a map may show: exact or approximate, never the unknown fallback. */
export function mappableCoordinates(venue: VenueLike | undefined | null): { lat: number; lng: number } | null {
  const s = venueLocationStatus(venue);
  return (s === 'exact' || s === 'approximate') && venue ? { lat: venue.coordinates.lat, lng: venue.coordinates.lng } : null;
}

/** "Otahalli Otaniemi, Espoo" — the city is added when the name does not already contain it. */
export function venueSearchQuery(venue: VenueLike): string {
  const name = (venue.name || '').trim();
  const city = (venue.city || '').trim();
  if (city && !name.toLowerCase().includes(city.toLowerCase())) return `${name}, ${city}`;
  return name;
}

const round = (n: number) => Number(n.toFixed(6));

/** Opens the place in the phone's map app (Google Maps universal link opens the app when installed). */
export function venueMapUrl(venue: VenueLike | undefined | null): string | null {
  if (!venue) return null;
  const c = mappableCoordinates(venue);
  if (c && venueLocationStatus(venue) === 'exact') {
    return `https://www.google.com/maps/search/?api=1&query=${round(c.lat)},${round(c.lng)}`;
  }
  // Approximate or unknown: search by name so the map app finds the real place
  // instead of us pinning a guess.
  if (!isSearchableVenueName(venue.name)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueSearchQuery(venue))}`;
}

/** Turn-by-turn directions; exact pins by coordinates, everything else by name. */
export function venueDirectionsUrl(
  venue: VenueLike | undefined | null,
  travelMode?: 'walking' | 'bicycling' | 'driving' | 'transit'
): string | null {
  if (!venue) return null;
  const mode = travelMode ? `&travelmode=${travelMode}` : '';
  const c = mappableCoordinates(venue);
  if (c && venueLocationStatus(venue) === 'exact') {
    return `https://www.google.com/maps/dir/?api=1&destination=${round(c.lat)},${round(c.lng)}${mode}`;
  }
  if (!isSearchableVenueName(venue.name)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueSearchQuery(venue))}${mode}`;
}

const SOURCE_FI: Record<NonNullable<VenueInfo['locationSource']>, string> = {
  taso: 'tulospalvelu',
  alias: 'Pelipäivän kenttälista',
  lipas: 'LIPAS',
  servicemap: 'Helsingin palvelukartta',
  osm: 'OpenStreetMap',
  user: 'oma merkintä'
};

/** Honest one-line Finnish label for the location under the map. */
export function venueLocationLabel(venue: VenueLike | undefined | null): string {
  const s = venueLocationStatus(venue);
  const name = venue?.name?.trim() || 'kenttä';
  const src = venue?.locationSource ? ` (${SOURCE_FI[venue.locationSource]})` : '';
  if (s === 'exact') return `Sijainti: ${name}${src}`;
  if (s === 'approximate') return `Sijainti arvioitu: ${name}${src}`;
  if (s === 'search') return `Sijaintia ei tiedetä – haku kartalta: ${venue ? venueSearchQuery(venue) : name}`;
  return 'Kenttä ilmoitetaan myöhemmin';
}

/**
 * A stored venue is re-resolved by name only when it is not already an exact
 * pin: re-resolving by name alone would throw away TASO's own coordinates.
 */
export function shouldReResolveVenue(venue: VenueLike | undefined | null): boolean {
  if (!venue?.name) return false;
  // Built-in aliases are ours and offline: re-reading them picks up corrected pins.
  if (venue.locationSource === 'alias') return true;
  return venueLocationStatus(venue) !== 'exact';
}

/** A corrected built-in alias pin for the same venue (same quality, moved coordinates). */
export function isAliasCorrection(prev: VenueLike | undefined | null, next: VenueLike | undefined | null): boolean {
  if (prev?.locationSource !== 'alias' || next?.locationSource !== 'alias') return false;
  if (venueLocationStatus(next) !== 'exact') return false;
  const a = prev?.coordinates;
  const b = next?.coordinates;
  return Boolean(a && b && (Math.abs(a.lat - b.lat) > 1e-5 || Math.abs(a.lng - b.lng) > 1e-5));
}

/** True when `next` locates the venue better than `prev` (search < approximate < exact). */
export function isBetterLocation(prev: VenueLike | undefined | null, next: VenueLike | undefined | null): boolean {
  const rank = (v: VenueLike | undefined | null) => ({ none: 0, search: 1, approximate: 2, exact: 3 })[venueLocationStatus(v)];
  return rank(next) > rank(prev);
}
