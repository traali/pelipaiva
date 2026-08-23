import { describe, it, expect, vi } from 'vitest';
import {
  generateFamilyCode,
  isValidFamilyCode,
  normalizeFamilyCode,
  mergeRosters,
  FamilyRosterV1,
  fetchFamilyRoster,
  pushFamilyRoster
} from './familyCloud';
import { PlayerProfile } from '../../types/matchday';

describe('familyCloud Sync & Merge Engine', () => {
  it('generates valid Crockford-32 family code format (5-1)', () => {
    const code = generateFamilyCode();
    expect(isValidFamilyCode(code)).toBe(true);
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]$/);
  });

  it('normalizes unhyphenated 6-char family codes', () => {
    expect(normalizeFamilyCode('SAIMA4')).toBe('SAIMA-4');
    expect(normalizeFamilyCode('saima-4')).toBe('SAIMA-4');
    expect(normalizeFamilyCode('KOPPI8')).toBe('KOPPI-8');
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

    const fetched = await fetchFamilyRoster('SAIMA-4', 'https://mock.worker');
    expect(fetched?.v).toBe(1);

    const matchPush = await pushFamilyRoster('SAIMA-4', mockRoster, 1, 'https://mock.worker');
    expect(matchPush.success).toBe(true);

    const conflictPush = await pushFamilyRoster('SAIMA-4', mockRoster, 0, 'https://mock.worker');
    expect(conflictPush.success).toBe(false);
    if (!conflictPush.success && conflictPush.error === 'rev_conflict') {
      expect((conflictPush as any).currentRev).toBe(5);
    }
  });
});
