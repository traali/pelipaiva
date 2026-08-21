import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, deleteTestDb } from '../../helpers/setupDexie';
import { PelipaivaDB } from '../../../src/lib/storage/db';
import { MatchdayEvent } from '../../../src/types/matchday';

describe('Tier 3: Resilience & Degraded Offline Mode', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await deleteTestDb(testDb);
  });

  it('d01.01: Retains and retrieves previously cached matchday events when offline', async () => {
    const cachedEvent: MatchdayEvent = {
      id: 'event-offline-1',
      profileId: 'prof-1',
      sport: 'football',
      homeTeam: 'HJK T13',
      awayTeam: 'EPS Punainen',
      startTime: '2026-08-20T15:00:00Z',
      endTime: '2026-08-20T16:30:00Z',
      isTraining: false,
      venue: {
        name: 'Puotilan tekonurmi (Bubu)',
        coordinates: { lat: 60.21, lng: 25.1 },
        isIndoor: false,
        surface: 'artificial_turf_3g'
      },
      reconciliationStatus: 'auto_matched'
    };

    await testDb.events.put(cachedEvent);

    // Simulate reading when network is completely down
    const retrieved = await testDb.events.get('event-offline-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.homeTeam).toBe('HJK T13');
    expect(retrieved?.venue.name).toBe('Puotilan tekonurmi (Bubu)');
    expect(retrieved?.reconciliationStatus).toBe('auto_matched');
  });
});
