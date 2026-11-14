import type { VenueInfo } from '../../types/matchday';
import { PARKKIS_BASE_URL, buildParkingDeepLink } from '../../types/contracts';
import { mappableCoordinates, venueLocationStatus } from '../geo/venueLocation';

type ParkkisVenue = Pick<VenueInfo, 'name' | 'coordinates' | 'isApproximateLocation'> &
  Partial<Pick<VenueInfo, 'locationQuality'>>;

/**
 * Parkkis link for a venue. Pelipäivä has no parking facts of its own; Parkkis
 * does. Exact pins and honestly-labelled approximate locations get a link; the
 * unknown fallback (no real coordinates) gets none: no guessed spot.
 */
export function parkkisVenueUrl(venue: ParkkisVenue | undefined): string | null {
  const c = mappableCoordinates(venue);
  if (!venue || !c) return null;
  return buildParkingDeepLink(PARKKIS_BASE_URL, venue.name || '', c.lat, c.lng);
}

/** True when the Parkkis link points at an estimated location, so the UI must say so. */
export function parkkisLinkIsApproximate(venue: ParkkisVenue | undefined): boolean {
  return venueLocationStatus(venue) === 'approximate';
}
