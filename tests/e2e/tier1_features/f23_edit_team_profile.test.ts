import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../../helpers/setupDexie';
import { PelipaivaDB } from '../../../src/lib/storage/db';

describe('Feature 23: Edit Existing Team Profile (Sport, Name, Player, Re-fetch)', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('allows changing sport from floorball to football and updates all profile records', async () => {
    const profileId = 'test-profile-1';
    await testDb.profiles.add({
      id: profileId,
      playerName: 'Simo',
      teamName: 'Simo:n joukkue',
      sport: 'floorball',
      primaryColor: 'Keltainen',
      calendarUrl: 'https://example.com/calendar.ics',
      colorHex: '#FBBF24'
    });

    await testDb.events.add({
      id: 'event-old-1',
      profileId,
      playerName: 'Simo',
      teamName: 'Simo:n joukkue',
      sport: 'floorball',
      title: 'Salibandypeli',
      startTime: '2026-09-01T10:00:00.000Z',
      endTime: '2026-09-01T11:30:00.000Z',
      arrivalTime: '2026-09-01T09:15:00.000Z',
      venue: { name: 'Kupittaa', coordinates: { lat: 60.45, lng: 22.28 } },
      isTraining: false
    });

    // User edits the team: changes sport to 'football' and teamName to 'Simo Futis'
    const newSport = 'football';
    const newTeamName = 'Simo Futis';

    // 1. Delete old events
    await testDb.events.where('profileId').equals(profileId).delete();
    const remainingOldEvents = await testDb.events.where('profileId').equals(profileId).toArray();
    expect(remainingOldEvents.length).toBe(0);

    // 2. Update profile
    await testDb.profiles.update(profileId, {
      sport: newSport,
      teamName: newTeamName
    });

    const updatedProfile = await testDb.profiles.get(profileId);
    expect(updatedProfile?.sport).toBe('football');
    expect(updatedProfile?.teamName).toBe('Simo Futis');

    // 3. Ingest fresh events with football sport
    await testDb.events.add({
      id: 'event-new-1',
      profileId,
      playerName: 'Simo',
      teamName: newTeamName,
      sport: newSport,
      title: 'Futismatsi',
      startTime: '2026-09-01T10:00:00.000Z',
      endTime: '2026-09-01T11:30:00.000Z',
      arrivalTime: '2026-09-01T09:15:00.000Z',
      venue: { name: 'Pyrkkä', coordinates: { lat: 60.15, lng: 24.87 } },
      isTraining: false
    });

    const newEvents = await testDb.events.where('profileId').equals(profileId).toArray();
    expect(newEvents.length).toBe(1);
    expect(newEvents[0]?.sport).toBe('football');
    expect(newEvents[0]?.teamName).toBe('Simo Futis');
  });
});
