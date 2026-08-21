import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, deleteTestDb } from '../../helpers/setupDexie';
import { PelipaivaDB } from '../../../src/lib/storage/db';
import { reconcileCalendarWithOfficial } from '../../../src/lib/reconciliation/reconciliationEngine';
import { MatchdayEvent, OfficialLeagueFixture } from '../../../src/types/matchday';

describe('Feature f20: Local Alias Learning & Custom Aliases Store', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await deleteTestDb(testDb);
  });

  it('f20.01: Persists custom user alias mapping into Dexie customAliases store', async () => {
    await testDb.customAliases.put({
      pattern: 'siniset',
      canonicalClub: 'hjk',
      createdAt: new Date().toISOString()
    });

    const aliases = await testDb.customAliases.toArray();
    expect(aliases.length).toBe(1);
    expect(aliases[0]?.pattern).toBe('siniset');
    expect(aliases[0]?.canonicalClub).toBe('hjk');
  });

  it('f20.02: Reconciles match with 1.0 confidence when a custom learned alias matches', () => {
    const calendarEvents: MatchdayEvent[] = [
      {
        id: 'cal-event-1',
        profileId: 'prof-1',
        sport: 'football',
        homeTeam: 'Siniset',
        awayTeam: 'EPS',
        startTime: '2026-08-20T15:00:00Z',
        endTime: '2026-08-20T16:30:00Z',
        isTraining: false,
        venue: {
          name: 'Puotila TN',
          coordinates: { lat: 60.2, lng: 25.1 },
          isIndoor: false,
          surface: 'artificial_turf_3g'
        }
      }
    ];

    const officialFixtures: OfficialLeagueFixture[] = [
      {
        id: 'off-fix-1',
        association: 'palloliitto',
        sport: 'football',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'EPS Punainen',
        isHome: true,
        startTime: '2026-08-20T15:00:00Z',
        venue: 'Puotila TN',
        status: 'scheduled'
      }
    ];

    const customAliasesMap = new Map<string, string>();
    customAliasesMap.set('eps', 'eps');

    const results = reconcileCalendarWithOfficial(calendarEvents, officialFixtures, customAliasesMap);
    const result = results.get('cal-event-1');
    expect(result).toBeDefined();
    expect(result?.status).toBe('auto_matched');
    expect(result?.officialFixture?.id).toBe('off-fix-1');
  });
});
