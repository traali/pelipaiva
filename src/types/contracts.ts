/**
 * Cross-Repo Contract Adapter for Pelipäivä
 * Implements / re-exports the canonical contracts defined in contracts/index.ts.
 */

export type {
  SupportedSport,
  MatchdayContextContract,
  ParkingRiskContract,
  SportStatsContract,
  CrossRepoQueryContract
} from '../../../contracts/index';

import type {
  MatchdayContextContract,
  ParkingRiskContract,
  SportStatsContract
} from '../../../contracts/index';

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
