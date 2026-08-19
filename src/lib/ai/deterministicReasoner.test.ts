import { describe, it, expect } from 'vitest';
import { determineFootwear, generateMatchdayBriefing } from './deterministicReasoner';
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
});
