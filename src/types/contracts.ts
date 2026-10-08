/**
 * Cross-Repo Contract Adapter for Pelipäivä
 * Canonical Contracts v1.0.0
 */

export const CONTRACT_VERSION = '1.0.0' as const;

export type SupportedSport = 'football' | 'volleyball' | 'floorball' | 'basketball' | 'weather' | 'other';

export interface MatchdayContextContract {
  eventId: string;
  sport: SupportedSport;
  startTime: string;
  warmupTime?: string;
  homeTeam: string;
  awayTeam: string;
  venueName: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  association?: 'palloliitto' | 'salibandy' | 'basket' | 'torneopal' | 'fmi' | 'other';
  externalId?: string;
}

export interface ParkingRiskContract {
  venueSlug: string;
  venueName?: string;
  riskRating: number;
  riskRating1to10?: number;
  safetyCategory: 'safe' | 'moderate' | 'trap';
  parkingZone?: string;
  zoneLabel?: string;
  walkDistanceMeters?: number;
  walkTimeMinutes?: number;
  deepLinkUrl: string;
  advisoryNote?: string;
  updatedAt?: string;
}

export interface SportStatsContract {
  sport: SupportedSport;
  matchOrTeamId: string;
  recentForm?: string[];
  standingsSummary?: {
    rank: number;
    totalTeams: number;
    points: number;
    playedMatches: number;
  };
  headToHead?: {
    wins: number;
    draws: number;
    losses: number;
    lastResult?: string;
  };
  keyMetrics?: Record<string, string | number>;
  deepLinkUrl: string;
}

export interface CrossRepoQueryContract {
  theme?: string;
  embed?: boolean;
  parentOrigin?: string;
  targetId?: string;
}

export interface WeatherForecastContract {
  venueId?: string;
  venueName?: string;
  coordinates: { latitude: number; longitude: number };
  kickoffTime: string;
  temperatureC: number;
  feelsLikeC: number;
  windSpeedMs: number;
  windGustMs: number;
  precipitationMmh: number;
  turfCondition: 'dry' | 'slick' | 'frozen' | 'snowy';
  turfConditionLabelFi: string;
  lightningRiskStatus: 'clear' | 'watch' | 'danger';
  suspendMatchRecommended: boolean;
  deepLinkUrl: string;
  isCacheFallback: boolean;
  updatedAt?: string;
}

/** Arto's Parkkis app (Cloudflare Pages project "parkkis", deploy-neighbors.yml). */
export const PARKKIS_BASE_URL = 'https://parkkis.pages.dev';

/**
 * Deep link to Parkkis at a venue. Parkkis reads the venue name from
 * `/venue/<name>` and centres its map on `?lat=&lon=`. Without real
 * coordinates there is nothing to point at, so this returns null.
 */
export function buildParkingDeepLink(
  parkkisBaseUrl: string,
  venueName: string,
  lat?: number,
  lon?: number
): string | null {
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!valid(lat) || !valid(lon) || (lat === 0 && lon === 0)) return null;
  const url = new URL(parkkisBaseUrl);
  const name = venueName.trim();
  url.pathname = name ? `/venue/${encodeURIComponent(name)}` : '/';
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  return url.toString();
}
