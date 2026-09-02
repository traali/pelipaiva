/**
 * Cross-Repo Contract Adapter for Pelipäivä
 * Canonical Contracts v1.0.0
 */

export const CONTRACT_VERSION = '1.0.0' as const;

export type SupportedSport = 'football' | 'volleyball' | 'floorball' | 'basketball' | 'other';

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
  association?: 'palloliitto' | 'salibandy' | 'basket' | 'torneopal' | 'other';
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

/**
 * Calculates a local fallback ParkingRiskContract from coordinates.
 */
export function calculateParkingRiskContract(
  venueSlug: string,
  venueName: string,
  coords: { lat: number; lng: number }
): ParkingRiskContract {
  const isTrap = coords.lat > 60.17 && coords.lat < 60.19 && coords.lng > 24.93 && coords.lng < 24.96;
  const risk = isTrap ? 8 : 3;
  return {
    venueSlug,
    venueName,
    riskRating: risk,
    riskRating1to10: risk,
    safetyCategory: risk >= 7 ? 'trap' : risk >= 4 ? 'moderate' : 'safe',
    parkingZone: isTrap ? 'Maksullinen Vyöhyke 1' : 'Pysäköintikiekko 2h / Maksuton',
    zoneLabel: isTrap ? 'Zone 1 (Keskusta)' : 'Zone 2/3 (Ilmainen/Kiekko)',
    walkDistanceMeters: 180,
    walkTimeMinutes: 3,
    deepLinkUrl: `https://parkkis.pages.dev/venue/${encodeURIComponent(venueSlug)}?lat=${coords.lat}&lon=${coords.lng}&embed=true`,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to construct a deep-link to satellite sport apps
 */
export function buildSportStatsDeepLink(
  baseUrl: string,
  match: MatchdayContextContract,
  theme = 'night-captain'
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('targetId', match.externalId || match.eventId);
  url.searchParams.set('sport', match.sport);
  url.searchParams.set('theme', theme);
  return url.toString();
}

/**
 * Helper to construct a deep-link to Parkkis parking view
 */
export function buildParkingDeepLink(
  parkkisBaseUrl: string,
  venueSlug: string,
  lat?: number,
  lon?: number
): string {
  const url = new URL(parkkisBaseUrl);
  url.searchParams.set('venue', venueSlug);
  if (lat && lon) {
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
  }
  return url.toString();
}
