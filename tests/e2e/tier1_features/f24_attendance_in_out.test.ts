import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../../helpers/setupDexie';
import { PelipaivaDB } from '../../../src/lib/storage/db';
import { runMissionControlGraph } from '../../../src/lib/agents/planner';
import { conflictAgent } from '../../../src/lib/agents/conflictAgent';
import type { MatchdayEvent, PlayerProfile } from '../../../src/types/matchday';

describe('Feature 24: Player Attendance IN / OUT (Poisjäänti) Management', () => {
  let testDb: PelipaivaDB;

  const profileSimo: PlayerProfile = {
    id: 'profile-simo-nh',
    playerName: 'Simo',
    sport: 'floorball',
    teamName: 'Westend Indians P14',
    primaryColor: 'Teal',
    colorHex: '#0d9488',
    calendarUrl: 'https://westendindiansp14.nimenhuuto.com/calendar/ical'
  };

  const profileLilli: PlayerProfile = {
    id: 'profile-lilli-mc',
    playerName: 'Lilli',
    sport: 'basketball',
    teamName: 'Tapiolan Honka T14',
    primaryColor: 'Orange',
    colorHex: '#f97316',
    calendarUrl: 'https://id.myclub.fi/flow/calendar_subscriptions/honka'
  };

  const baseMondaySimoTraining: MatchdayEvent = {
    id: 'event-simo-monday-training',
    profileId: profileSimo.id,
    sport: 'floorball',
    eventType: 'training',
    isTraining: true,
    title: 'Westend Indians P14: Treenit 18:30-20:15',
    homeTeam: 'Westend Indians P14',
    awayTeam: '',
    isHomeMatch: true,
    startTime: '2026-08-31T15:30:00.000Z', // 18:30 EEST
    endTime: '2026-08-31T17:15:00.000Z',   // 20:15 EEST
    warmupTime: '2026-08-31T15:15:00.000Z', // 18:15 EEST
    venue: {
      id: 'venue-otaniemi',
      name: 'Otaniemen lukio',
      normalizedName: 'otaniemen lukio',
      address: 'Tietotie 6, Espoo',
      coordinates: { lat: 60.1870, lng: 24.8320 },
      isIndoor: true,
      surface: 'wood'
    }
  };

  const baseMondayLilliTraining: MatchdayEvent = {
    id: 'event-lilli-monday-training',
    profileId: profileLilli.id,
    sport: 'basketball',
    eventType: 'training',
    isTraining: true,
    title: 'Tapiolan Honka T14 Harjoitukset',
    homeTeam: 'Tapiolan Honka T14',
    awayTeam: '',
    isHomeMatch: true,
    startTime: '2026-08-31T15:30:00.000Z', // 18:30 EEST (exact overlap with Simo!)
    endTime: '2026-08-31T17:00:00.000Z',
    warmupTime: '2026-08-31T15:15:00.000Z',
    venue: {
      id: 'venue-honkahalli',
      name: 'Honkahalli',
      normalizedName: 'honkahalli',
      address: 'Urheilupuistontie 2, Espoo',
      coordinates: { lat: 60.1780, lng: 24.7820 },
      isIndoor: true,
      surface: 'wood'
    }
  };

  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.profiles.bulkAdd([profileSimo, profileLilli]);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('should exclude event from conflicts when marked as OUT', () => {
    // 1. Both events active -> Should detect overlap conflict between Simo & Lilli
    const initialConflicts = conflictAgent(
      [baseMondaySimoTraining, baseMondayLilliTraining],
      [profileSimo, profileLilli]
    );
    expect(initialConflicts.length).toBeGreaterThan(0);

    // 2. Mark Simo as OUT (attendanceStatus: 'out')
    const simoOutEvent: MatchdayEvent = {
      ...baseMondaySimoTraining,
      attendanceStatus: 'out'
    };

    const conflictsWithSimoOut = conflictAgent(
      [simoOutEvent, baseMondayLilliTraining],
      [profileSimo, profileLilli]
    );

    // Simo is skipping -> No conflict should be raised for the family!
    expect(conflictsWithSimoOut.length).toBe(0);
  });

  it('should exclude event from departure countdown and nextEvent when marked as OUT', () => {
    const fixedNow = new Date('2026-08-31T14:00:00.000Z');

    // 1. Simo active -> Simo is the next event
    const snapshotActive = runMissionControlGraph(
      [baseMondaySimoTraining],
      [profileSimo],
      fixedNow
    );
    expect(snapshotActive.nextEvent?.id).toBe(baseMondaySimoTraining.id);

    // 2. Simo marked OUT -> nextEvent should NOT be Simo's skipped training
    const simoOutEvent: MatchdayEvent = {
      ...baseMondaySimoTraining,
      attendanceStatus: 'out'
    };

    const snapshotOut = runMissionControlGraph(
      [simoOutEvent],
      [profileSimo],
      fixedNow
    );
    expect(snapshotOut.nextEvent).toBeUndefined();
  });

  it('persists attendanceStatus: out and in cleanly in IndexedDB', async () => {
    await testDb.events.add(baseMondaySimoTraining);

    // Mark OUT
    await testDb.events.update(baseMondaySimoTraining.id, { attendanceStatus: 'out' });
    let fetched = await testDb.events.get(baseMondaySimoTraining.id);
    expect(fetched?.attendanceStatus).toBe('out');

    // Mark back IN
    await testDb.events.update(baseMondaySimoTraining.id, { attendanceStatus: 'in' });
    fetched = await testDb.events.get(baseMondaySimoTraining.id);
    expect(fetched?.attendanceStatus).toBe('in');
  });
});
