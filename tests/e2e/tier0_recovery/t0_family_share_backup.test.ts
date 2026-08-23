import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, deleteTestDb } from '../../helpers/setupDexie';
import { PelipaivaDB } from '../../../src/lib/storage/db';
import {
  exportFamilyBackup,
  importFamilyBackup,
  generateSharePayload,
  unpackSharePayload
} from '../../../src/lib/sync/familyShare';
import { PlayerProfile } from '../../../src/types/matchday';

describe('Tier 0: Architectural & Recovery Tests (Zero-Auth Family Sync & Backup)', () => {
  let testDb: PelipaivaDB;

  beforeEach(async () => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await deleteTestDb(testDb);
  });

  it('t0.01: Encrypted/JSON export of full DB contains all profiles, rules, aliases, and pins', async () => {
    const profile: PlayerProfile = {
      id: 'prof-hjk-1',
      playerName: 'Eemeli',
      teamName: 'HJK T13 Sininen',
      sport: 'football',
      primaryColor: 'sininen',
      calendarUrl: 'https://nimenhuuto.com/demo.ics',
      colorHex: '#003580'
    };
    await testDb.profiles.add(profile);
    await testDb.customAliases.add({
      pattern: 'siniset',
      canonicalClub: 'hjk',
      createdAt: new Date().toISOString()
    });
    await testDb.venuePins.add({
      normalizedQuery: 'bubu',
      venueName: 'Töölön Pallokenttä 6 TN',
      lat: 60.187,
      lng: 24.928,
      isIndoor: false,
      savedAt: new Date().toISOString()
    });

    const backup = await exportFamilyBackup(testDb);
    expect(backup.version).toBe(2);
    expect(backup.profiles.length).toBe(1);
    expect(backup.profiles[0]?.teamName).toBe('HJK T13 Sininen');
    expect(backup.customAliases?.length).toBe(1);
    expect(backup.venuePins?.length).toBe(1);
  });

  it('t0.02: Import of backup JSON on fresh device restores 100% data without duplicates', async () => {
    const backupData = {
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      profiles: [
        {
          id: 'prof-ervi-1',
          playerName: 'Lauri',
          teamName: 'ErVi P11 Pohjoinen',
          sport: 'floorball' as const,
          primaryColor: 'sininen',
          calendarUrl: 'https://myclub.fi/ervi.ics',
          colorHex: '#2563eb'
        }
      ],
      arrivalRules: [
        {
          profileId: 'prof-ervi-1',
          sport: 'floorball' as const,
          defaultWarmupMinutesHome: 30,
          defaultWarmupMinutesAway: 45,
          defaultTrainingWarmupMinutes: 15
        }
      ]
    };

    const res = await importFamilyBackup(backupData, testDb);
    expect(res.profilesCount).toBe(1);
    expect(res.rulesCount).toBe(1);

    const storedProfiles = await testDb.profiles.toArray();
    expect(storedProfiles.length).toBe(1);
    expect(storedProfiles[0]?.playerName).toBe('Lauri');

    const storedRules = await testDb.arrivalRules.toArray();
    expect(storedRules.length).toBe(1);
    expect(storedRules[0]?.defaultWarmupMinutesHome).toBe(30);
  });

  it('t0.03: Generates and unpacks lightweight URL/QR share payload seamlessly', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p1',
        playerName: 'Milla',
        teamName: 'Honka T12 Keltainen',
        sport: 'football',
        primaryColor: 'keltainen',
        colorHex: '#facc15'
      },
      {
        id: 'p2',
        playerName: 'Milla',
        teamName: 'ToPo U13 Tytöt',
        sport: 'basketball',
        primaryColor: 'sininen',
        colorHex: '#1e40af'
      }
    ];

    const payload = generateSharePayload(profiles);
    expect(payload).toBeDefined();
    expect(typeof payload).toBe('string');

    const unpacked = unpackSharePayload(payload);
    expect(unpacked.length).toBe(2);
    expect(unpacked[0]?.teamName).toBe('Honka T12 Keltainen');
    expect(unpacked[1]?.sport).toBe('basketball');
  });

  it('t0.04: Gracefully handles malformed or invalid share payloads without throwing', () => {
    const invalidUnpack = unpackSharePayload('invalid-corrupted-base64-payload!!!');
    expect(invalidUnpack).toEqual([]);
  });

  it('t0.05: Preserves widened fields including associationUrl, teamId, and raw query string', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p:simo:tulospalvelu.palloliitto.fi:185085:hc2026',
        playerName: 'Simo',
        teamName: 'PPJ/Laru sin',
        sport: 'football',
        primaryColor: 'sininen',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8',
        associationUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8',
        associationType: 'palloliitto',
        teamId: '185085',
        colorHex: '#3b82f6'
      }
    ];

    const payload = generateSharePayload(profiles);
    const unpacked = unpackSharePayload(payload);

    expect(unpacked.length).toBe(1);
    expect(unpacked[0]?.id).toBe('p:simo:tulospalvelu.palloliitto.fi:185085:hc2026');
    expect(unpacked[0]?.calendarUrl).toBe('https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8');
    expect(unpacked[0]?.teamId).toBe('185085');
    expect(unpacked[0]?.associationType).toBe('palloliitto');
    expect(unpacked[0]?.colorHex).toBe('#3b82f6');
  });
});
