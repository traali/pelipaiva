import { describe, it, expect } from 'vitest';
import { computeMismatchDiagnostics } from '../../../src/lib/reconciliation/reconciliationEngine';
import { MatchdayEvent, OfficialLeagueFixture } from '../../../src/types/matchday';

describe('Feature 16: Visual Timestamp Mismatch Diagnostics', () => {
  const baseFixture: OfficialLeagueFixture = {
    id: 'spl_1',
    teamId: '60341',
    association: 'palloliitto',
    sport: 'football',
    leagueName: 'T13 Ykkönen',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
    isHome: true,
    startTime: '2026-05-16T12:30:00.000Z', // 15:30 EEST
    venueName: 'Puotilan Tekonurmi',
    status: 'upcoming',
    fetchedAt: new Date().toISOString()
  };

  const baseEvent: MatchdayEvent = {
    id: 'ev-1',
    profileId: 'p1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'HJK vs EPS',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
    isHomeMatch: true,
    startTime: '2026-05-16T12:00:00.000Z', // 15:00 EEST (30 min difference)
    endTime: '2026-05-16T13:30:00.000Z',
    warmupTime: '2026-05-16T11:15:00.000Z',
    venue: {
      name: 'Puotilan Tekonurmi',
      normalizedName: 'puotila',
      coordinates: { lat: 60.2132, lng: 25.1098 },
      isIndoor: false,
      surface: 'artificial_turf_3g',
      hasFloodlights: true
    }
  };

  it('should detect kickoff time mismatch and compute exact time difference in minutes', () => {
    const diag = computeMismatchDiagnostics(baseEvent, baseFixture);

    expect(diag.hasKickoffMismatch).toBe(true);
    expect(diag.timeDiffMinutes).toBe(30);
  });

  it('should format readable calendar and official start time strings', () => {
    const diag = computeMismatchDiagnostics(baseEvent, baseFixture);

    expect(diag.calendarStartTime).toBeDefined();
    expect(diag.officialStartTime).toBeDefined();
    expect(diag.calendarStartTime).not.toBe(diag.officialStartTime);
  });

  it('should report no kickoff mismatch when calendar and official start times match exactly', () => {
    const matchedEvent: MatchdayEvent = {
      ...baseEvent,
      startTime: baseFixture.startTime
    };

    const diag = computeMismatchDiagnostics(matchedEvent, baseFixture);
    expect(diag.hasKickoffMismatch).toBe(false);
    expect(diag.timeDiffMinutes).toBe(0);
  });

  it('should tolerate minor sub-5-minute clock skews without flagging false mismatch', () => {
    const skewedStart = new Date(new Date(baseFixture.startTime).getTime() + 2 * 60000).toISOString();
    const eventWithSkew: MatchdayEvent = {
      ...baseEvent,
      startTime: skewedStart
    };

    const diag = computeMismatchDiagnostics(eventWithSkew, baseFixture);
    expect(diag.hasKickoffMismatch).toBe(false);
    expect(diag.timeDiffMinutes).toBeLessThan(5);
  });

  it('should handle large time differences (e.g. match moved from morning to evening)', () => {
    const morningEvent: MatchdayEvent = {
      ...baseEvent,
      startTime: '2026-05-16T07:00:00.000Z' // 10:00 EEST vs 15:30 EEST = 330 min
    };

    const diag = computeMismatchDiagnostics(morningEvent, baseFixture);
    expect(diag.hasKickoffMismatch).toBe(true);
    expect(diag.timeDiffMinutes).toBe(330);
  });
});
