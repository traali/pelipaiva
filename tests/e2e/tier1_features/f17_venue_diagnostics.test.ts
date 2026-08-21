import { describe, it, expect } from 'vitest';
import { computeMismatchDiagnostics } from '../../../src/lib/reconciliation/reconciliationEngine';
import { MatchdayEvent, OfficialLeagueFixture } from '../../../src/types/matchday';

describe('Feature 17: Visual Venue & Opponent Diagnostics', () => {
  const officialFixture: OfficialLeagueFixture = {
    id: 'spl_101',
    teamId: '60341',
    association: 'palloliitto',
    sport: 'football',
    leagueName: 'T13 Ykkönen',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
    isHome: true,
    startTime: '2026-05-16T12:00:00.000Z',
    venueName: 'Töölö PK 6 tn',
    status: 'upcoming',
    fetchedAt: new Date().toISOString()
  };

  const calendarEvent: MatchdayEvent = {
    id: 'ev-1',
    profileId: 'p1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'HJK vs EPS',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
    isHomeMatch: true,
    startTime: '2026-05-16T12:00:00.000Z',
    endTime: '2026-05-16T13:30:00.000Z',
    warmupTime: '2026-05-16T11:15:00.000Z',
    venue: {
      name: 'Väinämöisen kenttä (Väiski)',
      normalizedName: 'vaiski',
      coordinates: { lat: 60.1741, lng: 24.9192 },
      isIndoor: false,
      surface: 'sand_artificial_turf',
      hasFloodlights: true
    }
  };

  it('should detect venue divergence when calendar location differs from official league pitch', () => {
    const diag = computeMismatchDiagnostics(calendarEvent, officialFixture);

    expect(diag.hasVenueMismatch).toBe(true);
    expect(diag.calendarVenueName).toContain('Väinämöisen');
    expect(diag.officialVenueName).toContain('Töölö PK');
  });

  it('should report no venue mismatch when venues match closely', () => {
    const matchedVenueEvent: MatchdayEvent = {
      ...calendarEvent,
      venue: {
        ...calendarEvent.venue,
        name: 'Töölö PK 6 tn'
      }
    };

    const diag = computeMismatchDiagnostics(matchedVenueEvent, officialFixture);
    expect(diag.hasVenueMismatch).toBe(false);
  });

  it('should detect opponent mismatch if calendar lists unexpected opponent team', () => {
    const wrongOpponentEvent: MatchdayEvent = {
      ...calendarEvent,
      awayTeam: 'FC Honka Musta'
    };

    const diag = computeMismatchDiagnostics(wrongOpponentEvent, officialFixture);
    expect(diag.hasOpponentMismatch).toBe(true);
    expect(diag.calendarOpponent).toBe('FC Honka Musta');
    expect(diag.officialOpponent).toBe('EPS');
  });

  it('should not flag opponent mismatch when opponent names match via alias normalizer', () => {
    const aliasOpponentEvent: MatchdayEvent = {
      ...calendarEvent,
      awayTeam: 'Espoon Palloseura' // EPS alias
    };

    const diag = computeMismatchDiagnostics(aliasOpponentEvent, officialFixture);
    expect(diag.hasOpponentMismatch).toBe(false);
  });

  it('should support simultaneous kickoff, venue, and opponent diagnostic flags', () => {
    const fullyDivergentEvent: MatchdayEvent = {
      ...calendarEvent,
      startTime: '2026-05-16T10:00:00.000Z', // 2 hours earlier
      awayTeam: 'KäPa',
      venue: {
        ...calendarEvent.venue,
        name: 'Käpylän Urheilupuisto'
      }
    };

    const diag = computeMismatchDiagnostics(fullyDivergentEvent, officialFixture);
    expect(diag.hasKickoffMismatch).toBe(true);
    expect(diag.hasVenueMismatch).toBe(true);
    expect(diag.hasOpponentMismatch).toBe(true);
  });
});
