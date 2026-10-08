import { describe, it, expect } from 'vitest';
import type { HomeLocation, MatchdayEvent } from '../../types/matchday';
import { effectiveTransitPlan, hasRealTravelTime, resolveTransitPlan } from './transitEngine';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import { buildParkingDeepLink, PARKKIS_BASE_URL } from '../../types/contracts';
import { parkkisVenueUrl } from '../parking/parkkisLink';
import { buildSportKitPlan } from '../agents/kitAgent';
import { isParkingQuestion, queryFamilySchedule } from '../ai/localAiEngine';

const venue = {
  name: 'Pirkkolan tekonurmi',
  normalizedName: 'pirkkola tn',
  coordinates: { lat: 60.2338, lng: 24.9214 },
  isIndoor: false,
  surface: 'artificial_turf_3g' as const,
  hasFloodlights: true
};

const home: HomeLocation = {
  name: 'Koti',
  address: 'Testikatu 1',
  coordinates: { lat: 60.17, lng: 24.94 },
  maxWalkingDistanceKm: 1.5,
  maxCyclingDistanceKm: 5
};

function event(partial: Partial<MatchdayEvent> = {}): MatchdayEvent {
  return {
    id: 'e1',
    profileId: 'p1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'A vs B',
    homeTeam: 'A',
    awayTeam: 'B',
    isHomeMatch: true,
    startTime: '2026-10-10T12:00:00+03:00',
    endTime: '2026-10-10T13:30:00+03:00',
    warmupTime: '2026-10-10T11:15:00+03:00',
    venue,
    ...partial
  } as MatchdayEvent;
}

describe('no home, no invented trip', () => {
  it('resolveTransitPlan without a home has no travel time and no "~20 min" guess', () => {
    const plan = resolveTransitPlan(undefined, venue.coordinates);
    expect(plan.needsHome).toBe(true);
    expect(plan.travelMinutes).toBe(0);
    expect(plan.transitLabel).not.toMatch(/Auto|min/);
    expect(hasRealTravelTime(plan)).toBe(false);
  });

  it('a plan stored from an old default home is ignored when no home is set', () => {
    const stale = event({
      transit: { mode: 'walk', distanceKm: 0.2, travelMinutes: 3, transitLabel: '🚶 Kävely 3 min (200 m)', isSelfTransit: true }
    });
    const plan = effectiveTransitPlan(stale, undefined);
    expect(plan.needsHome).toBe(true);
    expect(plan.transitLabel).not.toContain('Kävely');
  });

  it('with a home, the trip is computed from it, not from a stored plan', () => {
    const stale = event({
      transit: { mode: 'walk', distanceKm: 0.2, travelMinutes: 3, transitLabel: '🚶 Kävely 3 min (200 m)', isSelfTransit: true }
    });
    const plan = effectiveTransitPlan(stale, { ...home, defaultTransitMode: 'car' });
    expect(plan.mode).toBe('car');
    expect(plan.transitLabel).toMatch(/^🚗 Auto \d+ min/);
  });

  it('no home: no leave time; with a home: leave time as before', () => {
    const noHome = calculateDepartureCountdown(event());
    expect(noHome.hasDepartureTime).toBe(false);
    expect(noHome.departureTime).toBe('');

    const withHome = calculateDepartureCountdown(event(), undefined, home);
    expect(withHome.hasDepartureTime).toBe(true);
    expect(withHome.departureTime).toMatch(/^\d{2}[.:]\d{2}$/);
    expect(withHome.transitPlan.travelMinutes).toBeGreaterThan(0);
  });

  it('approximate venue pin: no leave time even with a home', () => {
    const approx = event({ venue: { ...venue, isApproximateLocation: true } });
    const res = calculateDepartureCountdown(approx, undefined, home);
    expect(res.hasDepartureTime).toBe(false);
    expect(res.transitPlan.isUnknownLocation).toBe(true);
  });
});

describe('parking comes from Parkkis', () => {
  it('links to the real Parkkis route at the venue', () => {
    expect(PARKKIS_BASE_URL).toBe('https://parkkis.pages.dev');
    expect(buildParkingDeepLink(PARKKIS_BASE_URL, 'Pirkkolan tekonurmi', 60.2338, 24.9214)).toBe(
      'https://parkkis.pages.dev/venue/Pirkkolan%20tekonurmi?lat=60.2338&lon=24.9214'
    );
  });

  it('no venue pin, no link', () => {
    expect(buildParkingDeepLink(PARKKIS_BASE_URL, 'X')).toBeNull();
    expect(buildParkingDeepLink(PARKKIS_BASE_URL, 'X', 0, 0)).toBeNull();
    expect(parkkisVenueUrl({ ...venue, isApproximateLocation: true })).toBeNull();
    expect(parkkisVenueUrl(undefined)).toBeNull();
  });

  it('the copilot answers parking questions with Parkkis, not invented facts', () => {
    expect(isParkingQuestion('missä voi parkkeerata?')).toBe(true);
    expect(isParkingQuestion('tarvitaanko pysäköintikiekko')).toBe(true);
    expect(isParkingQuestion('jääkiekko huomenna')).toBe(false);
    const future = event({ startTime: '2099-01-01T12:00:00+02:00', endTime: '2099-01-01T13:00:00+02:00' });
    const res = queryFamilySchedule('missä parkkipaikka?', [future], []);
    expect(res.answer).toContain('Parkkis');
    expect(res.answer).toContain('https://parkkis.pages.dev/venue/');
    expect(res.answer).not.toMatch(/€|kiekko|vyöhyke|EasyPark/i);
  });
});

describe('kit advice without weather', () => {
  it('unknown weather: "Sää ei tiedossa", no temperature-based items', () => {
    const plan = buildSportKitPlan(event());
    const labels = plan.playerItems.map((i) => i.label).concat(plan.spectatorItems.map((i) => i.label));
    expect(labels).toContain('Sää ei tiedossa');
    expect(labels.join(' ')).not.toMatch(/aluskerrasto|Termos|kuiva paita/);
  });

  it('a real cold forecast still gives cold-weather items', () => {
    const cold = event({
      weather: { temperatureC: 1, precipitationMmh: 0, windSpeedMs: 2, windGustMs: 4, turfCondition: 'dry' } as MatchdayEvent['weather']
    });
    const labels = buildSportKitPlan(cold).playerItems.map((i) => i.label);
    expect(labels.join(' ')).toMatch(/aluskerrasto/);
    expect(labels).not.toContain('Sää ei tiedossa');
  });
});
