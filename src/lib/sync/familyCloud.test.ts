import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isValidFamilyCode,
  normalizeFamilyCode,
  mergeRosters,
  FamilyRosterV1,
  fetchFamilyRoster,
  pushFamilyRoster
} from './familyCloud';
import { FAMILY_CODE_REGEX, existingRosterPutConflicts, parseFamilyAllowlist } from './familyCode';
import { PlayerProfile } from '../../types/matchday';

describe('familyCloud Sync & Merge Engine', () => {
  it('accepts Crockford-32 format without treating example strings as issued slots', () => {
    expect(FAMILY_CODE_REGEX.test('PERHE-2')).toBe(true);
    expect(isValidFamilyCode('PERHE-2')).toBe(true);
  });

  it('rejects Crockford-illegal letters I L O U (SAIMA-4 is invalid)', () => {
    expect(isValidFamilyCode('SAIMA-4')).toBe(false);
    expect(isValidFamilyCode('KOPPI-8')).toBe(false);
    expect(isValidFamilyCode('PERHE-2')).toBe(true);
    expect(isValidFamilyCode('SAKKA-4')).toBe(true);
  });

  it('normalizes unhyphenated 6-char family codes', () => {
    expect(normalizeFamilyCode('PERHE2')).toBe('PERHE-2');
    expect(normalizeFamilyCode('perhe-2')).toBe('PERHE-2');
    expect(normalizeFamilyCode('SAKKA4')).toBe('SAKKA-4');
  });

  it('worker source shares the client Crockford regex and requires If-Match on existing keys', () => {
    const workerSrc = readFileSync(resolve(__dirname, '../../../cloudflare-worker/worker.ts'), 'utf8');
    expect(workerSrc).toContain(FAMILY_CODE_REGEX.source);
    expect(workerSrc).toContain('if (!ifMatch || parseInt(ifMatch, 10) !== currentRev)');
    expect(workerSrc).toContain('rate_limited');
    expect(workerSrc).toContain('GET: 20');
    expect(workerSrc).toContain('PUT: 5');
    expect(workerSrc).toContain('FAMILY_CODES');
    expect(workerSrc).toContain('unknown_family');
    expect(workerSrc).not.toMatch(/FAMILY_CODES\s*=\s*['\"][0-9A-HJKMNP-TV-Z]{5}-/);
  });

  it('allowlist is fail-closed and does not live in the client', () => {
    expect(parseFamilyAllowlist(undefined).size).toBe(0);
    expect(parseFamilyAllowlist('').size).toBe(0);
    const issued = parseFamilyAllowlist('AAAAA-1, BBBBB-2\nCCCCC-3');
    expect(issued.has('AAAAA-1')).toBe(true);
    expect(issued.has('BBBBB-2')).toBe(true);
    expect(issued.has('CCCCC-3')).toBe(true);
    expect(issued.has('PERHE-2')).toBe(false);
    expect(issued.size).toBe(3);
  });

  it('existing KV PUT without If-Match conflicts', () => {
    expect(existingRosterPutConflicts(3, null)).toBe(true);
    expect(existingRosterPutConflicts(3, '"2"')).toBe(true);
    expect(existingRosterPutConflicts(3, '"3"')).toBe(false);
    expect(existingRosterPutConflicts(3, '3')).toBe(false);
  });

  it('merges remote roster with local profiles cleanly using stable IDs', () => {
    const localProfiles: PlayerProfile[] = [
      {
        id: 'p:aada:espooliikkuutournament.fi:203621',
        playerName: 'Aada',
        teamName: 'TOPOLA',
        sport: 'basketball',
        primaryColor: 'sininen',
        calendarUrl: 'https://espooliikkuutournament.fi/team/203621',
        colorHex: '#3b82f6'
      }
    ];

    const remoteRoster: FamilyRosterV1 = {
      v: 1,
      rev: 2,
      updatedAt: new Date().toISOString(),
      profiles: [
        {
          id: 'p:simo:tulospalvelu.palloliitto.fi:185085:hc2026',
          playerName: 'Simo',
          teamName: 'PPJ/Laru sin',
          sport: 'football',
          colorHex: '#3b82f6',
          calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
        }
      ],
      tombstones: []
    };

    const { mergedProfiles, tombstones } = mergeRosters(localProfiles, remoteRoster);
    expect(mergedProfiles.length).toBe(2);
    expect(mergedProfiles.find((p) => p.playerName === 'Aada')).toBeDefined();
    expect(mergedProfiles.find((p) => p.playerName === 'Simo')).toBeDefined();
    expect(tombstones.length).toBe(0);
  });

  it('applies tombstones to remove deleted teams from merged roster', () => {
    const localProfiles: PlayerProfile[] = [
      {
        id: 'p:aada:espooliikkuutournament.fi:203621',
        playerName: 'Aada',
        teamName: 'TOPOLA',
        sport: 'basketball',
        primaryColor: 'sininen',
        calendarUrl: 'https://espooliikkuutournament.fi/team/203621',
        colorHex: '#3b82f6'
      }
    ];

    const remoteRoster: FamilyRosterV1 = {
      v: 1,
      rev: 3,
      updatedAt: new Date().toISOString(),
      profiles: [
        {
          id: 'p:aada:espooliikkuutournament.fi:203621',
          playerName: 'Aada',
          teamName: 'TOPOLA',
          sport: 'basketball',
          colorHex: '#3b82f6',
          calendarUrl: 'https://espooliikkuutournament.fi/team/203621'
        }
      ],
      tombstones: [
        {
          id: 'p:aada:espooliikkuutournament.fi:203621',
          deletedAt: new Date().toISOString()
        }
      ]
    };

    const { mergedProfiles, tombstones } = mergeRosters(localProfiles, remoteRoster);
    expect(mergedProfiles.length).toBe(0);
    expect(tombstones.length).toBe(1);
  });

  it('distinguishes Helsinki Cup from P13 Kolmonen league in roster merge', () => {
    const localProfiles: PlayerProfile[] = [
      {
        id: 'p:simo:tulospalvelu.palloliitto.fi:185085',
        playerName: 'Simo',
        teamName: 'PPJ/Laru sin',
        sport: 'football',
        primaryColor: 'sininen',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
        colorHex: '#3b82f6'
      }
    ];

    const remoteRoster: FamilyRosterV1 = {
      v: 1,
      rev: 1,
      updatedAt: new Date().toISOString(),
      profiles: [
        {
          id: 'p:simo:tulospalvelu.palloliitto.fi:185085:hc2026',
          playerName: 'Simo',
          teamName: 'PPJ/Laru sin',
          sport: 'football',
          colorHex: '#3b82f6',
          calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
        }
      ],
      tombstones: []
    };

    const { mergedProfiles } = mergeRosters(localProfiles, remoteRoster);
    expect(mergedProfiles.length).toBe(2);
    expect(mergedProfiles.map((p) => p.id)).toContain('p:simo:tulospalvelu.palloliitto.fi:185085');
    expect(mergedProfiles.map((p) => p.id)).toContain('p:simo:tulospalvelu.palloliitto.fi:185085:hc2026');
  });

  it('reports hasChanges false when local already matches remote roster', () => {
    const localProfiles: PlayerProfile[] = [
      {
        id: 'p:aada:espooliikkuutournament.fi:203621',
        playerName: 'Aada',
        teamName: 'TOPOLA',
        sport: 'basketball',
        primaryColor: 'sininen',
        calendarUrl: 'https://espooliikkuutournament.fi/team/203621',
        colorHex: '#3b82f6'
      }
    ];
    const remoteRoster: FamilyRosterV1 = {
      v: 1,
      rev: 4,
      updatedAt: new Date().toISOString(),
      profiles: [
        {
          id: 'p:aada:espooliikkuutournament.fi:203621',
          playerName: 'Aada',
          teamName: 'TOPOLA',
          sport: 'basketball',
          colorHex: '#3b82f6',
          calendarUrl: 'https://espooliikkuutournament.fi/team/203621'
        }
      ],
      tombstones: []
    };
    const { hasChanges, mergedProfiles } = mergeRosters(localProfiles, remoteRoster);
    expect(mergedProfiles.length).toBe(1);
    expect(hasChanges).toBe(false);
  });

  it('GET 403 unknown_family throws instead of looking like an empty family', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'unknown_family' })
    });
    await expect(fetchFamilyRoster('PERHE-2', 'https://mock.worker')).rejects.toThrow(
      'unknown_family'
    );
  });

  it('GET 400 invalid_code_format throws instead of looking like an empty family', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'invalid_code_format' })
    });
    await expect(fetchFamilyRoster('SAIMA-4', 'https://mock.worker')).rejects.toThrow(
      'invalid_code_format'
    );
  });

  it('handles mock fetch GET and PUT with 409 conflict detection', async () => {
    const mockRoster: FamilyRosterV1 = {
      v: 1,
      rev: 1,
      updatedAt: new Date().toISOString(),
      profiles: [],
      tombstones: []
    };

    global.fetch = vi.fn().mockImplementation((_url: string, options?: any) => {
      if (options?.method === 'PUT') {
        if (options.headers?.['If-Match'] === '"1"') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, rev: 2, updatedAt: new Date().toISOString() })
          });
        }
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: 'rev_conflict', currentRev: 5 })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRoster)
      });
    });

    const fetched = await fetchFamilyRoster('PERHE-2', 'https://mock.worker');
    expect(fetched?.v).toBe(1);

    const matchPush = await pushFamilyRoster('PERHE-2', mockRoster, 1, 'https://mock.worker');
    expect(matchPush.success).toBe(true);

    const conflictPush = await pushFamilyRoster('PERHE-2', mockRoster, 0, 'https://mock.worker');
    expect(conflictPush.success).toBe(false);
    if (!conflictPush.success && conflictPush.error === 'rev_conflict') {
      expect((conflictPush as any).currentRev).toBe(5);
    }
  });
});
