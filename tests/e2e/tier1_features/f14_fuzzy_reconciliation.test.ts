import { describe, it, expect } from 'vitest';
import { reconcileCalendarWithOfficial } from '../../../src/lib/reconciliation/reconciliationEngine';
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
});
