import { describe, it, expect } from 'vitest';
import { determineFootwear, generateMatchdayBriefing, calculateDepartureCountdown } from './deterministicReasoner';
import { MatchdayEvent } from '../../types/matchday';

describe('Deterministic AI Reasoner & Nappisvahti', () => {
  it('recommends TF Turf shoes and flags safety risk on cold sand-infilled artificial turf', () => {
    const advice = determineFootwear('sand_artificial_turf', 2, 0, false);
    expect(advice.footwear).toBe('TF_TURF_SHOES');
    expect(advice.reason).toContain('kova kuin betoni');
  });

  it('recommends AG artificial grass studs for standard 3G turf', () => {
    const advice = determineFootwear('artificial_turf_3g', 15, 0, false);
    expect(advice.footwear).toBe('AG_ARTIFICIAL_GRASS');
  });

  it('recommends non-marking shoes for indoor sports halls', () => {
    const advice = determineFootwear('indoor_synthetic', 20, 0, true);
    expect(advice.footwear).toBe('INDOOR_NON_MARKING');
  });

  it('detects family schedule conflicts when multiple sibling matches overlap', () => {
    const event1: MatchdayEvent = {
      id: 'e1',
      profileId: 'p1',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'HJK T13 vs EPS',
      homeTeam: 'HJK',
      awayTeam: 'EPS',
      isHomeMatch: true,
      startTime: '2026-08-20T15:00:00.000Z',
      endTime: '2026-08-20T16:30:00.000Z',
      warmupTime: '2026-08-20T14:15:00.000Z',
      venue: {
        name: 'Puotila',
        normalizedName: 'puotila',
        coordinates: { lat: 60.21, lng: 25.10 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    };

    const event2: MatchdayEvent = {
      id: 'e2',
      profileId: 'p2',
      sport: 'floorball',
      eventType: 'match',
      isTraining: false,
      title: 'ErVi P11 vs Oilers',
      homeTeam: 'ErVi',
      awayTeam: 'Oilers',
      isHomeMatch: true,
      startTime: '2026-08-20T15:30:00.000Z', // Overlaps with event1!
      endTime: '2026-08-20T17:00:00.000Z',
      warmupTime: '2026-08-20T15:00:00.000Z',
      venue: {
        name: 'Mosahalli',
        normalizedName: 'mosahalli',
        coordinates: { lat: 60.26, lng: 25.02 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true
      }
    };

    const briefing = generateMatchdayBriefing(event1, [event1, event2]);
    expect(briefing.conflictWarning).toBeDefined();
    expect(briefing.conflictWarning).toContain('AIKATAULURUUHKI');
  });

  it('leaves home before a real kokoontuminen, not after it', () => {
    const event: MatchdayEvent = {
      id: 'honka',
      profileId: 'lilli',
      sport: 'basketball',
      eventType: 'match',
      isTraining: false,
      title: 'Honka vs TOPOLA',
      homeTeam: 'Honka',
      awayTeam: 'TOPOLA',
      isHomeMatch: true,
      startTime: '2026-09-26T08:00:00.000Z', // 11:00 EEST
      endTime: '2026-09-26T09:00:00.000Z',
      warmupTime: '2026-09-26T07:00:00.000Z', // 10:00 gathering, 60 min — not the 45 min default
      venue: {
        name: 'Honkahalli Tapiola',
        normalizedName: 'honkahalli tapiola',
        coordinates: { lat: 60.176, lng: 24.805 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true
      },
      parking: {
        easeScore: 'easy',
        easeScoreValue: 80,
        lotName: 'Honkahalli',
        coordinates: { lat: 60.176, lng: 24.805 },
        feeZone: 'Maksuton',
        parkingDiscRequired: false,
        walkingTimeMinutes: 3,
        walkingDistanceMeters: 150,
        warnings: [],
        mapsNavigationUrl: 'https://maps.google.com'
      },
      transit: {
        mode: 'car',
        distanceKm: 6.4,
        travelMinutes: 14,
        transitLabel: 'Auto 14 min',
        isSelfTransit: false,
        isUnknownLocation: false
      }
    };
    const { leaveHomeDate } = calculateDepartureCountdown(event);
    const leave = leaveHomeDate.getTime();
    const gather = new Date(event.warmupTime!).getTime();
    expect(leave).toBeLessThan(gather);
    // 14 min drive + 10 min buffer + 3 min walk = 27 min before 10:00 → 09:33
    expect((gather - leave) / 60000).toBe(27);
  });
});
