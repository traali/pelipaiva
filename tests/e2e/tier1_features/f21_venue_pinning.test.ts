import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, deleteTestDb } from '../../helpers/setupDexie';
import { PelipaivaDB } from '../../../src/lib/storage/db';

describe('Feature f21: Venue Pinning & Custom Pitch Corrections', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await deleteTestDb(testDb);
  });

  it('f21.01: Saves user venue pin to Dexie with custom surface and coordinates', async () => {
    await testDb.venuePins.put({
      normalizedQuery: 'oman kylän kenttä',
      venueName: 'Oman Kylän Urheilukeskus TN 2',
      lat: 61.497,
      lng: 23.76,
      isIndoor: false,
      surface: 'artificial_turf_3g',
      savedAt: new Date().toISOString()
    });

    const pins = await testDb.venuePins.toArray();
    expect(pins.length).toBe(1);
    expect(pins[0]?.venueName).toBe('Oman Kylän Urheilukeskus TN 2');
    expect(pins[0]?.lat).toBe(61.497);
  });
});
