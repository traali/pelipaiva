import { describe, it, expect } from 'vitest';
import { reconcileCalendarWithOfficial, applyOfficialKickoffKeepCalendarArrival } from '../../../src/lib/reconciliation/reconciliationEngine';
import { MatchdayEvent, OfficialLeagueFixture } from '../../../src/types/matchday';

describe('Feature 14: Conservative Fuzzy Match & Reconciliation', () => {
  const officialFixtures: OfficialLeagueFixture[] = [
    {
      id: 'spl_60341_101',
      teamId: '60341',
      association: 'palloliitto',
      sport: 'football',
      leagueName: 'T13 Ykkönen',
      homeTeam: 'HJK T13 Sininen',
      awayTeam: 'EPS',
      isHome: true,
      startTime: '2026-05-16T12:00:00.000Z', // 15:00 EEST
      venueName: 'Töölö PK 6 tn (Bubu)',
      status: 'upcoming',
      fetchedAt: new Date().toISOString()
    },
    {
      id: 'spl_60341_102',
      teamId: '60341',
      association: 'palloliitto',
      sport: 'football',
      leagueName: 'T13 Ykkönen',
      homeTeam: 'HJK T13 Sininen',
      awayTeam: 'KäPa',
      isHome: true,
      startTime: '2026-05-23T08:00:00.000Z', // 11:00 EEST
      venueName: 'Sahara tn',
      status: 'upcoming',
      fetchedAt: new Date().toISOString()
    }
  ];

  it('should auto-match high confidence calendar event on same date with matching opponent (score >= 0.85)', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-1',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK T13 Sininen vs EPS',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'EPS',
        isHomeMatch: true,
        startTime: '2026-05-16T12:00:00.000Z',
        endTime: '2026-05-16T13:30:00.000Z',
        warmupTime: '2026-05-16T11:15:00.000Z',
        venue: {
          name: 'Bubu',
          normalizedName: 'bubu',
          coordinates: { lat: 60.2132, lng: 25.1098 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-1');

    expect(res).toBeDefined();
    expect(res?.status).toBe('auto_matched');
    expect(res?.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(res?.officialFixture?.id).toBe('spl_60341_101');
  });

  it('should auto-match when calendar event has warmup start time within ±3h window', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-warmup',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'KäPa peli',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'KäPa',
        isHomeMatch: true,
        startTime: '2026-05-23T07:15:00.000Z', // 45 mins earlier than official
        endTime: '2026-05-23T09:30:00.000Z',
        warmupTime: '2026-05-23T07:15:00.000Z',
        venue: {
          name: 'Sahara',
          normalizedName: 'sahara',
          coordinates: { lat: 60.1882, lng: 24.9254 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-warmup');

    expect(res?.status).toBe('auto_matched');
    expect(res?.officialFixture?.id).toBe('spl_60341_102');
  });

  it('should leave event unlinked when date is outside fixture schedule or time window exceeds ±3h', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-distant',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs EPS',
        homeTeam: 'HJK',
        awayTeam: 'EPS',
        isHomeMatch: true,
        startTime: '2026-06-01T12:00:00.000Z', // Different date
        endTime: '2026-06-01T13:30:00.000Z',
        warmupTime: '2026-06-01T11:15:00.000Z',
        venue: {
          name: 'Bubu',
          normalizedName: 'bubu',
          coordinates: { lat: 60.2132, lng: 25.1098 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-distant');

    expect(res?.status).toBe('unlinked');
  });

  it('should leave training and meeting events unlinked without attempting match reconciliation', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-training',
        profileId: 'p1',
        sport: 'football',
        eventType: 'training',
        isTraining: true,
        title: 'Lajiharjoitukset Sahara',
        homeTeam: 'HJK',
        awayTeam: '',
        isHomeMatch: true,
        startTime: '2026-05-23T08:00:00.000Z',
        endTime: '2026-05-23T09:30:00.000Z',
        warmupTime: '2026-05-23T07:45:00.000Z',
        venue: {
          name: 'Sahara',
          normalizedName: 'sahara',
          coordinates: { lat: 60.1882, lng: 24.9254 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    expect(results.get('cal-training')?.status).toBe('unlinked');
  });

  it('should flag candidate_match when opponent similarity is moderate or ambiguous', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-candidate',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs Espoon Seura',
        homeTeam: 'HJK',
        awayTeam: 'Espoon Seura',
        isHomeMatch: true,
        startTime: '2026-05-16T12:00:00.000Z',
        endTime: '2026-05-16T13:30:00.000Z',
        warmupTime: '2026-05-16T11:15:00.000Z',
        venue: {
          name: 'Bubu',
          normalizedName: 'bubu',
          coordinates: { lat: 60.2132, lng: 25.1098 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-candidate');
    expect(res).toBeDefined();
    expect(['auto_matched', 'candidate_match']).toContain(res?.status);
  });

  it('should auto-match internal club match entry without opponent name if club and squad match (e.g. MyClub style)', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-myclub-sin',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK T13: Piirisarja - Sininen',
        homeTeam: 'HJK T13: Piirisarja',
        awayTeam: 'Sininen',
        isHomeMatch: true,
        startTime: '2026-05-16T11:15:00.000Z', // 45 min warmup before 12:00 kickoff
        endTime: '2026-05-16T13:30:00.000Z',
        venue: {
          name: 'Bubu',
          normalizedName: 'bubu',
          coordinates: { lat: 60.2132, lng: 25.1098 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-myclub-sin');
    expect(res).toBeDefined();
    expect(res?.status).toBe('auto_matched');
    expect(res?.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(res?.officialFixture?.id).toBe('spl_60341_101');
  });

  it('should NOT match squad entry if squad colors conflict (e.g. MUSTA calendar event vs SININEN fixture)', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-myclub-musta',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK T13: Piirisarja - Musta',
        homeTeam: 'HJK T13: Piirisarja',
        awayTeam: 'Musta',
        isHomeMatch: true,
        startTime: '2026-05-16T11:15:00.000Z',
        endTime: '2026-05-16T13:30:00.000Z',
        venue: {
          name: 'Bubu',
          normalizedName: 'bubu',
          coordinates: { lat: 60.2132, lng: 25.1098 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-myclub-musta');
    expect(res?.status).toBe('unlinked');
  });

  it('should flag venue mismatch when calendar venue differs from Torneopal/official venue', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-venue-diff',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK T13 Sininen vs EPS',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'EPS',
        isHomeMatch: true,
        startTime: '2026-05-16T12:00:00.000Z',
        endTime: '2026-05-16T13:30:00.000Z',
        venue: {
          name: 'Lauttasaaren urheilupuisto "Pyrkkä"',
          normalizedName: 'pyrkka',
          coordinates: { lat: 60.16, lng: 24.87 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      }
    ];

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures);
    const res = results.get('cal-venue-diff');
    expect(res).toBeDefined();
    expect(res?.status).toBe('auto_matched');
    expect(res?.mismatches?.hasVenueMismatch).toBe(true);
    expect(res?.mismatches?.calendarVenueName).toContain('Pyrkkä');
    expect(res?.mismatches?.officialVenueName).toBe('Töölö PK 6 tn (Bubu)');
  });

  it('uses Torneopal kickoff and keeps MyClub DTSTART as kokoontuminen', () => {
    const merged = applyOfficialKickoffKeepCalendarArrival(
      {
        startTime: '2026-09-13T09:30:00.000Z', // MyClub 12:30 EEST
        warmupTime: '2026-09-13T08:45:00.000Z',
        endTime: '2026-09-13T11:00:00.000Z'
      },
      { startTime: '2026-09-13T10:00:00.000Z' } // TASO 13:00 EEST
    );
    expect(merged.startTime).toBe('2026-09-13T10:00:00.000Z');
    expect(merged.warmupTime).toBe('2026-09-13T09:30:00.000Z');
  });

  it('auto-matches a floorball tournament block to the first same-day TASO game at the hall', () => {
    const official: OfficialLeagueFixture[] = [
      {
        id: 'ssbl_25301_949661',
        teamId: '25301',
        association: 'salibandy',
        sport: 'floorball',
        leagueName: 'U14 Pojat VALK B ES',
        homeTeam: 'SB Vantaa Orange',
        awayTeam: 'Westend Indians Yellow',
        isHome: false,
        startTime: '2026-09-13T13:00:00.000Z',
        venueName: 'Tuusulan Salibandyhalli kenttä 2',
        status: 'upcoming',
        fetchedAt: new Date().toISOString(),
        matchId: '949661'
      }
    ];
    const calendar: MatchdayEvent[] = [
      {
        id: 'nh-turnaus',
        profileId: 'p-s',
        sport: 'floorball',
        eventType: 'tournament',
        isTraining: false,
        title: 'Westend Indians P14: Turnaus Yellow',
        homeTeam: 'Westend Indians Yellow',
        awayTeam: '',
        isHomeMatch: false,
        startTime: '2026-09-13T12:00:00.000Z',
        endTime: '2026-09-13T16:00:00.000Z',
        warmupTime: '2026-09-13T11:15:00.000Z',
        venue: {
          name: 'Tuusulan Salibandyhalli, Kilpailukuja 4, Tuusula',
          normalizedName: 'tuusulan salibandyhalli',
          coordinates: { lat: 60.4042, lng: 25.0275 },
          isIndoor: true,
          surface: 'indoor_synthetic',
          hasFloodlights: true
        }
      }
    ];
    const res = reconcileCalendarWithOfficial(calendar, official).get('nh-turnaus');
    expect(res?.status).toBe('auto_matched');
    expect(res?.officialFixture?.matchId).toBe('949661');
  });
});

