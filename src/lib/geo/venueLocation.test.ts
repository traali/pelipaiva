import { describe, it, expect } from 'vitest';
import {
  hasRealCoordinates,
  isBetterLocation,
  mappableCoordinates,
  shouldReResolveVenue,
  venueDirectionsUrl,
  venueLocationLabel,
  venueLocationStatus,
  venueMapUrl,
  venueSearchQuery
} from './venueLocation';
import { parkkisVenueUrl, parkkisLinkIsApproximate } from '../parking/parkkisLink';

// Real TASO venue of PPJ/Laru sin's 2026 league game (8.10.2026).
const taso = {
  name: 'Lauttasaari TN B',
  city: 'Helsinki',
  coordinates: { lat: 60.163573520062, lng: 24.867501722732 },
  locationSource: 'taso' as const
};
const approx = {
  name: 'AC Ruskeasuo kenttä 3',
  city: 'Helsinki',
  coordinates: { lat: 60.2054, lng: 24.9003 },
  isApproximateLocation: true,
  locationQuality: 'approximate' as const,
  locationSource: 'lipas' as const
};
const unknown = { name: 'Kalasataman koulu', city: 'Helsinki', coordinates: { lat: 0, lng: 0 }, isApproximateLocation: true };

describe('venue location status', () => {
  it('TASO coordinates are an exact pin', () => {
    expect(venueLocationStatus(taso)).toBe('exact');
    expect(mappableCoordinates(taso)).toEqual(taso.coordinates);
    expect(venueLocationLabel(taso)).toBe('Sijainti: Lauttasaari TN B (tulospalvelu)');
  });

  it('an unverified match is approximate and says so', () => {
    expect(venueLocationStatus(approx)).toBe('approximate');
    expect(venueLocationLabel(approx)).toBe('Sijainti arvioitu: AC Ruskeasuo kenttä 3 (LIPAS)');
    expect(mappableCoordinates(approx)).toEqual(approx.coordinates);
  });

  it('the 0,0 fallback is never mapped: search by name + city only', () => {
    expect(venueLocationStatus(unknown)).toBe('search');
    expect(mappableCoordinates(unknown)).toBeNull();
    expect(venueSearchQuery(unknown)).toBe('Kalasataman koulu, Helsinki');
    expect(venueLocationLabel(unknown)).toBe('Sijaintia ei tiedetä – haku kartalta: Kalasataman koulu, Helsinki');
    expect(venueMapUrl(unknown)).toBe('https://www.google.com/maps/search/?api=1&query=Kalasataman%20koulu%2C%20Helsinki');
  });

  it('an old approximate flag without quality is still "unknown"', () => {
    expect(venueLocationStatus({ ...taso, isApproximateLocation: true })).toBe('search');
  });

  it('placeholder names get nothing', () => {
    expect(venueLocationStatus({ name: 'Kenttä ilmoitetaan', coordinates: { lat: 0, lng: 0 } })).toBe('none');
    expect(venueMapUrl({ name: 'Kenttä ilmoitetaan', coordinates: { lat: 0, lng: 0 } })).toBeNull();
    expect(venueLocationStatus(undefined)).toBe('none');
  });

  it('coordinates outside Finland are not real', () => {
    expect(hasRealCoordinates({ lat: 48.85, lng: 2.35 })).toBe(false);
    expect(hasRealCoordinates({ lat: Number.NaN, lng: 24 })).toBe(false);
  });

  it('city is not repeated when the name already has it', () => {
    expect(venueSearchQuery({ ...unknown, name: 'Sipoon Areena', city: 'Sipoo' })).toBe('Sipoon Areena');
  });
});

describe('map links open the right place', () => {
  it('exact pins open by coordinates', () => {
    expect(venueMapUrl(taso)).toBe('https://www.google.com/maps/search/?api=1&query=60.163574,24.867502');
    expect(venueDirectionsUrl(taso, 'walking')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=60.163574,24.867502&travelmode=walking'
    );
  });

  it('approximate locations open a search by name, never a guessed pin', () => {
    expect(venueMapUrl(approx)).toBe('https://www.google.com/maps/search/?api=1&query=AC%20Ruskeasuo%20kentt%C3%A4%203%2C%20Helsinki');
    expect(venueDirectionsUrl(approx)).toContain('destination=AC%20Ruskeasuo');
  });
});

describe('Parkkis link', () => {
  it('exact and approximate venues get Parkkis; approximate is flagged', () => {
    expect(parkkisVenueUrl(taso)).toBe(
      'https://parkkis.pages.dev/venue/Lauttasaari%20TN%20B?lat=60.163573520062&lon=24.867501722732'
    );
    expect(parkkisLinkIsApproximate(taso)).toBe(false);
    expect(parkkisVenueUrl(approx)).toContain('lat=60.2054');
    expect(parkkisLinkIsApproximate(approx)).toBe(true);
  });

  it('unknown venues get no Parkkis pin', () => {
    expect(parkkisVenueUrl(unknown)).toBeNull();
  });
});

describe('stored venues are not downgraded', () => {
  it('exact pins are never re-resolved by name', () => {
    expect(shouldReResolveVenue(taso)).toBe(false);
    expect(shouldReResolveVenue(approx)).toBe(true);
    expect(shouldReResolveVenue(unknown)).toBe(true);
  });

  it('only a better location replaces a stored one', () => {
    expect(isBetterLocation(unknown, approx)).toBe(true);
    expect(isBetterLocation(approx, taso)).toBe(true);
    expect(isBetterLocation(taso, unknown)).toBe(false);
    expect(isBetterLocation(approx, unknown)).toBe(false);
  });
});

describe('built-in alias corrections', () => {
  it('re-reads alias pins and accepts a moved alias pin', async () => {
    const { isAliasCorrection, shouldReResolveVenue } = await import('./venueLocation');
    const old = { name: 'Lauttasaaren yhteiskoulu (LYK)', coordinates: { lat: 60.1601, lng: 24.8785 }, locationSource: 'alias' as const };
    const fixed = { ...old, coordinates: { lat: 60.15797, lng: 24.862663 } };
    expect(shouldReResolveVenue(old)).toBe(true);
    expect(isAliasCorrection(old, fixed)).toBe(true);
    expect(isAliasCorrection(fixed, fixed)).toBe(false);
    expect(isAliasCorrection({ ...old, locationSource: 'taso' as const }, fixed)).toBe(false);
  });
});
