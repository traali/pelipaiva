import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  formatTransitDistance,
  resolveTransitPlan
} from './transitEngine';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import { formatHomeTransitSummary } from '../storage/homeLocation';
import { conflictAgent } from '../agents/conflictAgent';
import { carpoolAgent } from '../agents/carpoolAgent';
import { HomeLocation, MatchdayEvent, PlayerProfile, WeatherCondition } from '../../types/matchday';

const mockHome: HomeLocation = {
  name: 'Lauttasaari Koti',
  address: 'Isokaari 1, 00200 Helsinki',
  coordinates: { lat: 60.1585, lng: 24.8770 },
  maxWalkingDistanceKm: 1.5,
  maxCyclingDistanceKm: 5.0,
  defaultTransitMode: 'auto'
};

const mockProfiles: PlayerProfile[] = [
  {
    id: 'p-simo',
    playerName: 'Simo',
    teamName: 'PPJ/Laru sin',
    sport: 'football',
    primaryColor: 'sininen',
    calendarUrl: '',
    colorHex: '#3b82f6'
  },
  {
    id: 'p-eemil',
    playerName: 'Eemil',
    teamName: 'HJK Töölö',
    sport: 'football',
    primaryColor: 'valkoinen',
    calendarUrl: '',
    colorHex: '#64748b'
  }
];

function makeEvent(partial: Partial<MatchdayEvent> & Pick<MatchdayEvent, 'id' | 'profileId' | 'startTime'>): MatchdayEvent {
  const start = new Date(partial.startTime);
  return {
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'Ottelu',
    homeTeam: 'PPJ',
    awayTeam: 'Vastustaja',
    isHomeMatch: true,
    endTime: new Date(start.getTime() + 90 * 60000).toISOString(),
    warmupTime: new Date(start.getTime() - 45 * 60000).toISOString(),
    venue: {
      name: 'Lauttasaaren TN',
      normalizedName: 'lauttasaari tn',
      coordinates: { lat: 60.1590, lng: 24.8780 }, // ~200m from home
      isIndoor: false,
      surface: 'artificial_turf_3g',
      hasFloodlights: true
    },
    ...partial
  };
}

describe('transitEngine', () => {
  it('calculates straight line distance with Haversine formula accurately', () => {
    // Helsinki to Lauttasaari (~4 km)
    const dist = calculateHaversineDistanceKm(
      { lat: 60.1699, lng: 24.9384 },
      { lat: 60.1585, lng: 24.8770 }
    );
    expect(dist).toBeGreaterThan(3.5);
    expect(dist).toBeLessThan(4.5);
  });

  it('formats transit distance in meters and kilometers properly in Finnish', () => {
    expect(formatTransitDistance(0.45)).toBe('450 m');
    expect(formatTransitDistance(0.9)).toBe('900 m');
    expect(formatTransitDistance(2.34)).toBe('2,3 km');
    expect(formatTransitDistance(12.0)).toBe('12,0 km');
  });

  it('resolves walking mode for nearby pitch (< 1.5 km)', () => {
    const venueCoords = { lat: 60.1590, lng: 24.8780 }; // ~200m
    const plan = resolveTransitPlan(mockHome, venueCoords);
    expect(plan.mode).toBe('walk');
    expect(plan.isSelfTransit).toBe(true);
    expect(plan.travelMinutes).toBeLessThanOrEqual(10);
    expect(plan.transitLabel).toContain('Kävely');
  });

  it('resolves bicycle mode for medium distance pitch (1.5 - 5.0 km)', () => {
    // Väinämöisen kenttä / Hietaniemi (~3 km from Lauttasaari)
    const vainamoinenCoords = { lat: 60.1745, lng: 24.9180 };
    const plan = resolveTransitPlan(mockHome, vainamoinenCoords);
    expect(plan.mode).toBe('bicycle');
    expect(plan.isSelfTransit).toBe(true);
    expect(plan.travelMinutes).toBeGreaterThan(5);
    expect(plan.travelMinutes).toBeLessThan(30);
    expect(plan.transitLabel).toContain('Pyöräily');
  });

  it('resolves car mode for distant pitch (> 5.0 km)', () => {
    // Myyrmäki stadion (~14 km)
    const myyrmakiCoords = { lat: 60.2610, lng: 24.8530 };
    const plan = resolveTransitPlan(mockHome, myyrmakiCoords);
    expect(plan.mode).toBe('car');
    expect(plan.isSelfTransit).toBe(false);
    expect(plan.transitLabel).toContain('Auto');
  });

  it('downgrades bicycle to car mode in heavy rain with a warning', () => {
    const vainamoinenCoords = { lat: 60.1745, lng: 24.9180 };
    const rainyWeather: WeatherCondition = {
      temperatureC: 12,
      feelsLikeC: 10,
      windSpeedMs: 7,
      windGustMs: 12,
      precipitationMmh: 4.5, // Heavy rain
      rainTimeline: [],
      turfCondition: 'slick'
    };
    const plan = resolveTransitPlan(mockHome, vainamoinenCoords, rainyWeather);
    expect(plan.mode).toBe('car');
    expect(plan.isSelfTransit).toBe(false);
    expect(plan.weatherWarning).toBeDefined();
    expect(plan.weatherWarning).toContain('Sadesää');
  });

  it('supports explicit manual transit mode override', () => {
    const vainamoinenCoords = { lat: 60.1745, lng: 24.9180 };
    const walkPlan = resolveTransitPlan(mockHome, vainamoinenCoords, undefined, 'walk');
    expect(walkPlan.mode).toBe('walk');
    expect(walkPlan.isSelfTransit).toBe(true);
  });

  it('family bicycle preference skips walk for a nearby pitch', () => {
    const nearby = { lat: 60.1590, lng: 24.8780 };
    const bikeHome = { ...mockHome, defaultTransitMode: 'bicycle' as const };
    const plan = resolveTransitPlan(bikeHome, nearby);
    expect(plan.mode).toBe('bicycle');
    expect(plan.transitLabel).toContain('Pyöräily');
  });

  it('family car preference never walks a local pitch', () => {
    const nearby = { lat: 60.1590, lng: 24.8780 };
    const carHome = { ...mockHome, defaultTransitMode: 'car' as const };
    const plan = resolveTransitPlan(carHome, nearby);
    expect(plan.mode).toBe('car');
    expect(plan.isSelfTransit).toBe(false);
  });
});

describe('departure countdown with HomeLocation', () => {
  it('calculates walking departure time dynamically without parking buffer', () => {
    const localEvent = makeEvent({
      id: 'e-laru',
      profileId: 'p-simo',
      startTime: '2026-08-22T14:00:00+03:00'
    });
    const { departureTime, transitPlan } = calculateDepartureCountdown(
      localEvent,
      undefined,
      mockHome
    );
    expect(transitPlan.mode).toBe('walk');
    expect(transitPlan.isSelfTransit).toBe(true);
    expect(departureTime).toBeDefined();
  });

  it('formats Finnish home transit summary for auto vs bike vs car', () => {
    expect(formatHomeTransitSummary(mockHome)).toMatch(/Kävely/i);
    expect(formatHomeTransitSummary({ ...mockHome, defaultTransitMode: 'bicycle' })).toMatch(/pyörä/i);
    expect(formatHomeTransitSummary({ ...mockHome, defaultTransitMode: 'car' })).toMatch(/auto/i);
  });
});

describe('conflictAgent with active transit', () => {
  it('resolves conflict when one child walks/bikes to local pitch', () => {
    const localEvent = makeEvent({
      id: 'e1',
      profileId: 'p-simo',
      startTime: '2026-08-22T14:00:00+03:00',
      venue: {
        name: 'Lauttasaari TN',
        normalizedName: 'lauttasaari',
        coordinates: { lat: 60.1590, lng: 24.8780 }, // walkable
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    });

    const distantEvent = makeEvent({
      id: 'e2',
      profileId: 'p-eemil',
      startTime: '2026-08-22T14:15:00+03:00',
      venue: {
        name: 'Myyrmäki Stadion',
        normalizedName: 'myyrmaki',
        coordinates: { lat: 60.2610, lng: 24.8530 }, // car needed
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    });

    const conflicts = conflictAgent([localEvent, distantEvent], mockProfiles, mockHome);
    expect(conflicts.length).toBeGreaterThan(0);
    const resolvedConflict = conflicts[0];
    expect(resolvedConflict?.severity).toBe('info');
    expect(resolvedConflict?.isResolvedByActiveTransit).toBe(true);
    expect(resolvedConflict?.message).toContain('Päällekkäisyys ratkaistu');
  });
});

describe('carpoolAgent with active transit', () => {
  it('assigns driverSlot as oma-kyyti for walkable/bikeable local events', () => {
    const localEvent = makeEvent({
      id: 'e1',
      profileId: 'p-simo',
      startTime: '2026-08-22T14:00:00+03:00',
      venue: {
        name: 'Lauttasaari TN',
        normalizedName: 'lauttasaari',
        coordinates: { lat: 60.1590, lng: 24.8780 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    });

    const distantEvent = makeEvent({
      id: 'e2',
      profileId: 'p-eemil',
      startTime: '2026-08-22T16:00:00+03:00',
      venue: {
        name: 'Myyrmäki Stadion',
        normalizedName: 'myyrmaki',
        coordinates: { lat: 60.2610, lng: 24.8530 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    });

    const legs = carpoolAgent([localEvent, distantEvent], mockProfiles, [], mockHome);
    expect(legs.length).toBe(2);
    expect(legs[0]?.driverSlot).toBe('oma-kyyti');
    expect(legs[0]?.action).toContain('Kävellen');
    expect(legs[1]?.driverSlot).toBe('kuski-1');
  });
});
