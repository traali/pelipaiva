import type { VenueInfo } from '../../types/matchday';
import { PARKKIS_BASE_URL, buildParkingDeepLink } from '../../types/contracts';

/**
 * Parkkis link for a venue. Pelipäivä has no parking facts of its own; Parkkis
 * does. Null when the venue pin is missing or approximate: no guessed spot.
 */
export function parkkisVenueUrl(
  venue: Pick<VenueInfo, 'name' | 'coordinates' | 'isApproximateLocation'> | undefined
): string | null {
  if (!venue || venue.isApproximateLocation) return null;
  return buildParkingDeepLink(PARKKIS_BASE_URL, venue.name || '', venue.coordinates?.lat, venue.coordinates?.lng);
}
