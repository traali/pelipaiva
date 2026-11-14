import { describe, it, expect } from 'vitest';
import { stitchCalendarEventsWithFixtures } from './reconciliationEngine';
import { MatchdayEvent } from '../../types/matchday';

const tasoVenue = {
  name: 'Sipoon Areena kenttä 1',
  normalizedName: 'sipoon areena kenttä 1',
  city: 'Sipoo',
  coordinates: { lat: 60.298065774928, lng: 25.338970137627 },
  isIndoor: true,
  surface: 'indoor_synthetic' as const,
  hasFloodlights: true,
  locationSource: 'taso' as const,
};

function ev(partial: Partial<MatchdayEvent>): MatchdayEvent {
  return {
    id: 'x',
    profileId: 'nimenhuuto',
    sport: 'floorball',
    eventType: 'match',
    isTraining: false,
    title: 'Westend Indians Yellow vs SB Vantaa Orange',
    homeTeam: 'Westend Indians Yellow',
    awayTeam: 'SB Vantaa Orange',
    isHomeMatch: true,
    startTime: '2026-11-22T13:45:00.000Z',
    endTime: '2026-11-22T14:45:00.000Z',
    venue: tasoVenue,
    ...partial,
  } as MatchdayEvent;
}

const fixture = ev({ id: 'fixture-p:simo:949701', profileId: 'westend', officialFixtureId: '949701', venue: tasoVenue });

describe('saved calendar ↔ TASO link keeps the official pin', () => {
  it('replaces a free-text Nimenhuuto venue without coordinates with the TASO venue', () => {
    const cal = ev({
      id: '20410402@Nimenhuuto.com',
      officialFixtureId: '949701',
      venue: {
        name: 'Sipoon Areena Oy, Uusi Porvoontie 1210,  01150 Söderkulla',
        normalizedName: 'sipoon areena oy uusi porvoontie 1210 01150 söderkulla',
        coordinates: { lat: 0, lng: 0 },
        isApproximateLocation: true,
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true,
      },
    });
    const out = stitchCalendarEventsWithFixtures([cal, fixture]);
    expect(out).toHaveLength(1);
    expect(out[0]!.venue.coordinates).toEqual(tasoVenue.coordinates);
    expect(out[0]!.venue.locationSource).toBe('taso');
    expect(out[0]!.mismatchFlags?.venueMismatch).toBe(true);
    expect(out[0]!.mismatchFlags?.calendarVenueName).toContain('Sipoon Areena Oy');
  });

  it('replaces a wrong calendar hall (Otahalli) with the TASO hall and flags it', () => {
    const cal = ev({
      id: '20410758@Nimenhuuto.com',
      officialFixtureId: '949701',
      venue: {
        name: 'Otahalli Otaniemi',
        normalizedName: 'otahalli',
        coordinates: { lat: 60.185, lng: 24.832 },
        isIndoor: true,
        surface: 'indoor_parquet',
        hasFloodlights: true,
        locationSource: 'alias',
      },
    });
    const out = stitchCalendarEventsWithFixtures([cal, fixture]);
    expect(out[0]!.venue.name).toBe('Sipoon Areena kenttä 1');
    expect(out[0]!.mismatchFlags?.officialVenueName).toBe('Sipoon Areena kenttä 1');
  });

  it('keeps an exact calendar pin when the official venue has no coordinates', () => {
    const cal = ev({ id: 'cal-1', officialFixtureId: '949701', venue: tasoVenue });
    const noPin = ev({
      id: 'fixture-p:simo:949701',
      profileId: 'westend',
      officialFixtureId: '949701',
      venue: { ...tasoVenue, name: 'Sipoon Areena', normalizedName: 'sipoon areena', coordinates: { lat: 0, lng: 0 }, isApproximateLocation: true },
    });
    const out = stitchCalendarEventsWithFixtures([cal, noPin]);
    expect(out[0]!.venue.coordinates).toEqual(tasoVenue.coordinates);
  });

  it('flags a different coordinate-less official hall while keeping the exact calendar pin', () => {
    const cal = ev({
      id: 'cal-2',
      officialFixtureId: '949701',
      venue: { ...tasoVenue, name: 'Otahalli Otaniemi', normalizedName: 'otahalli', coordinates: { lat: 60.184418, lng: 24.835045 }, locationSource: 'alias' },
    });
    const noPin = ev({
      id: 'fixture-p:simo:949701',
      profileId: 'westend',
      officialFixtureId: '949701',
      venue: { ...tasoVenue, coordinates: { lat: 0, lng: 0 }, isApproximateLocation: true },
    });
    const out = stitchCalendarEventsWithFixtures([cal, noPin]);
    expect(out[0]!.venue.name).toBe('Otahalli Otaniemi');
    expect(out[0]!.mismatchFlags?.venueMismatch).toBe(true);
    expect(out[0]!.mismatchFlags?.officialVenueName).toBe('Sipoon Areena kenttä 1');
  });

  it('a saved "Säilytä oma" (keep_calendar) choice keeps the calendar venue', () => {
    const own = { name: 'Otahalli Otaniemi', normalizedName: 'otahalli', coordinates: { lat: 60.184418, lng: 24.835045 }, isIndoor: true, surface: 'indoor_parquet' as const, hasFloodlights: true };
    const cal = ev({
      id: 'cal-3',
      officialFixtureId: '949701',
      venue: own,
      userOverride: { action: 'keep_calendar', appliedAt: '2026-11-14T10:00:00.000Z' },
    });
    const out = stitchCalendarEventsWithFixtures([cal, fixture]);
    expect(out[0]!.venue.name).toBe('Otahalli Otaniemi');
    expect(out[0]!.venue.coordinates).toEqual(own.coordinates);
    expect(out[0]!.mismatchFlags?.venueMismatch).toBeFalsy();
  });
});

describe('linked fixture lookup', () => {
  it('949701 never takes the venue of fixture …1949701', () => {
    const other = ev({ id: 'fixture-p:simo:1949701', profileId: 'westend', officialFixtureId: '1949701', startTime: '2026-11-08T13:45:00.000Z', endTime: '2026-11-08T14:45:00.000Z', venue: { ...tasoVenue, name: 'Väärä halli', normalizedName: 'väärä halli', coordinates: { lat: 61, lng: 25 } } });
    const cal = ev({ id: 'cal-4', officialFixtureId: '949701', venue: { ...tasoVenue, name: 'Sipoon Areena Oy', normalizedName: 'sipoon areena oy', coordinates: { lat: 0, lng: 0 }, isApproximateLocation: true } });
    const out = stitchCalendarEventsWithFixtures([other, cal, fixture]);
    const card = out.find((e) => e.id === 'cal-4')!;
    expect(card.venue.name).toBe('Sipoon Areena kenttä 1');
  });
});

describe('dismissed banner', () => {
  it('"Piilota" (custom, no venue) still takes the TASO pin, without the banner', () => {
    const cal = ev({
      id: 'cal-5',
      officialFixtureId: '949701',
      venue: { ...tasoVenue, name: 'Sipoon Areena Oy', normalizedName: 'sipoon areena oy', coordinates: { lat: 0, lng: 0 }, isApproximateLocation: true },
      userOverride: { action: 'custom', appliedAt: '2026-11-14T10:00:00.000Z', notes: 'Piilotettu aikatauluristiriita' },
    });
    const out = stitchCalendarEventsWithFixtures([cal, fixture]);
    expect(out[0]!.venue.coordinates).toEqual(tasoVenue.coordinates);
    expect(out[0]!.mismatchFlags?.venueMismatch).toBeFalsy();
  });
});

describe('family pin', () => {
  it('a user-pinned calendar venue is kept and the differing TASO hall is flagged', () => {
    const pin = { name: 'Oma kenttä', normalizedName: 'oma kenttä', coordinates: { lat: 60.2, lng: 24.9 }, isIndoor: true, surface: 'indoor_parquet' as const, hasFloodlights: true, isUserPinned: true, locationSource: 'user' as const };
    const cal = ev({ id: 'cal-6', officialFixtureId: '949701', venue: pin });
    const out = stitchCalendarEventsWithFixtures([cal, fixture]);
    expect(out[0]!.venue.coordinates).toEqual(pin.coordinates);
    expect(out[0]!.mismatchFlags?.venueMismatch).toBe(true);
  });
});

describe('adopt official', () => {
  it('"Päivitä liiton tietoon" replaces a family pin with the TASO venue', () => {
    const pin = { name: 'Oma kenttä', normalizedName: 'oma kenttä', coordinates: { lat: 60.2, lng: 24.9 }, isIndoor: true, surface: 'indoor_parquet' as const, hasFloodlights: true, isUserPinned: true, locationSource: 'user' as const };
    const cal = ev({ id: 'cal-7', officialFixtureId: '949701', venue: pin, userOverride: { action: 'adopt_official', appliedAt: '2026-11-14T10:00:00.000Z' } });
    const out = stitchCalendarEventsWithFixtures([cal, fixture]);
    expect(out[0]!.venue.coordinates).toEqual(tasoVenue.coordinates);
    expect(out[0]!.mismatchFlags?.venueMismatch).toBeFalsy();
  });
});
