import { db, PelipaivaDB } from '../storage/db';
import { PlayerProfile, SportType } from '../../types/matchday';
import { generateStableProfileId } from '../clubs/attachTeam';
import { parseAssociationUrl } from '../api/associationUrlParser';
import { ingestOfficialForProfile } from '../clubs/ingestOfficial';
import { isValidFamilyCode, normalizeFamilyCode } from './familyCode';

export { isValidFamilyCode, normalizeFamilyCode } from './familyCode';
export const WORKER_BASE_URL = 'https://pelipaiva-edge.sakkoja.workers.dev';

export interface FamilyRosterRow {
  id: string; // p:{slug(playerName)}:{teamSourceKey(calendarUrl)}
  playerName: string;
  teamName: string;
  sport: SportType;
  colorHex: string;
  calendarUrl: string; // RAW, keeps ?season=hc2026&category=B13-8
  associationUrl?: string;
  associationType?: string;
  teamId?: string;
}

export interface TombstoneRecord {
  id: string;
  deletedAt: string;
}

export interface FamilyRosterV1 {
  v: 1;
  rev: number;
  updatedAt: string;
  profiles: FamilyRosterRow[];
  tombstones: TombstoneRecord[];
}

/**
 * Fetches Family Roster from Cloudflare Worker KV.
 * 404 → null (create path). 400/429/network throw so the cycle does not PUT a new family.
 */
export async function fetchFamilyRoster(
  code: string,
  baseUrl: string = WORKER_BASE_URL
): Promise<FamilyRosterV1 | null> {
  const cleanCode = normalizeFamilyCode(code);
  const res = await fetch(`${baseUrl}/api/family/${encodeURIComponent(cleanCode)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (res.status === 404) return null;
  if (res.status === 403) {
    throw new Error('unknown_family');
  }
  if (res.status === 400) {
    throw new Error('invalid_code_format');
  }
  if (res.status === 429) {
    throw new Error('rate_limited');
  }
  if (!res.ok) {
    throw new Error(`Worker GET failed with status ${res.status}`);
  }

  const data = (await res.json()) as FamilyRosterV1;
  if (!data || data.v !== 1 || !Array.isArray(data.profiles)) {
    throw new Error('invalid_roster_schema');
  }
  return data;
}

export type PushRosterResult =
  | { success: true; rev: number; updatedAt: string }
  | { success: false; error: 'rev_conflict'; currentRev: number }
  | { success: false; error: string };

/**
 * Pushes Family Roster to Cloudflare Worker KV with optimistic concurrency If-Match.
 */
export async function pushFamilyRoster(
  code: string,
  roster: FamilyRosterV1,
  ifMatchRev?: number,
  baseUrl: string = WORKER_BASE_URL
): Promise<PushRosterResult> {
  const cleanCode = normalizeFamilyCode(code);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (ifMatchRev !== undefined) {
      headers['If-Match'] = `"${ifMatchRev}"`;
      headers['X-Pelipaiva-Rev'] = String(ifMatchRev);
    }

    const res = await fetch(`${baseUrl}/api/family/${encodeURIComponent(cleanCode)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(roster)
    });

    if (res.status === 409) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: 'rev_conflict',
        currentRev: (errJson as any).currentRev || 0
      };
    }

    if (res.status === 403) {
      return { success: false, error: 'unknown_family' };
    }

    if (!res.ok) {
      return { success: false, error: `Worker error status ${res.status}` };
    }

    const data = await res.json();
    return {
      success: true,
      rev: data.rev || (ifMatchRev !== undefined ? ifMatchRev + 1 : 1),
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  } catch (err: any) {
    console.warn('[FAMILY_CLOUD] Push failed:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

export function rosterFingerprint(
  profiles: Array<Pick<FamilyRosterRow, 'id' | 'playerName' | 'teamName' | 'sport' | 'colorHex' | 'calendarUrl' | 'associationUrl' | 'teamId'>>,
  tombstones: TombstoneRecord[]
): string {
  const p = profiles
    .map(
      (r) =>
        `${r.id}|${r.playerName}|${r.teamName}|${r.sport}|${r.colorHex}|${r.calendarUrl}|${r.associationUrl || ''}|${r.teamId || ''}`
    )
    .sort();
  const t = tombstones.map((x) => x.id).sort();
  return JSON.stringify({ p, t });
}

/**
 * Merges local profiles and remote roster, respecting tombstones and stable IDs.
 */
export function mergeRosters(
  localProfiles: PlayerProfile[],
  remoteRoster: FamilyRosterV1 | null,
  localTombstones: TombstoneRecord[] = []
): {
  mergedProfiles: PlayerProfile[];
  tombstones: TombstoneRecord[];
  hasChanges: boolean;
} {
  const tombstoneMap = new Map<string, string>();
  for (const t of localTombstones) {
    tombstoneMap.set(t.id, t.deletedAt);
  }
  if (remoteRoster?.tombstones) {
    for (const t of remoteRoster.tombstones) {
      tombstoneMap.set(t.id, t.deletedAt);
    }
  }

  const profileMap = new Map<string, PlayerProfile>();

  // 1. Add remote profiles first (if not tombstoned)
  if (remoteRoster?.profiles) {
    for (const rp of remoteRoster.profiles) {
      if (tombstoneMap.has(rp.id)) continue;
      profileMap.set(rp.id, {
        id: rp.id,
        playerName: rp.playerName,
        teamName: rp.teamName,
        sport: rp.sport,
        primaryColor: 'sininen',
        calendarUrl: rp.calendarUrl,
        associationUrl: rp.associationUrl,
        associationType: rp.associationType as any,
        teamId: rp.teamId,
        colorHex: rp.colorHex || '#3b82f6'
      });
    }
  }

  // 2. Add or update with local profiles (if not tombstoned)
  for (const lp of localProfiles) {
    const stableId = lp.id.startsWith('p:')
      ? lp.id
      : generateStableProfileId(lp.playerName, lp.calendarUrl || lp.associationUrl || '');
    if (tombstoneMap.has(stableId) || tombstoneMap.has(lp.id)) continue;

    profileMap.set(stableId, {
      ...lp,
      id: stableId
    });
  }

  const mergedProfiles = Array.from(profileMap.values());
  const tombstones = Array.from(tombstoneMap.entries()).map(([id, deletedAt]) => ({
    id,
    deletedAt
  }));

  const remoteFp = remoteRoster
    ? rosterFingerprint(remoteRoster.profiles, remoteRoster.tombstones)
    : '';
  const mergedFp = rosterFingerprint(
    mergedProfiles.map((p) => ({
      id: p.id,
      playerName: p.playerName,
      teamName: p.teamName,
      sport: p.sport,
      colorHex: p.colorHex || '#3b82f6',
      calendarUrl: p.calendarUrl || '',
      associationUrl: p.associationUrl,
      teamId: p.teamId
    })),
    tombstones
  );

  return {
    mergedProfiles,
    tombstones,
    hasChanges: remoteFp !== mergedFp
  };
}

/**
 * Hydrates official fixtures for roster profiles using a 2-parallel throttled queue.
 */
export async function hydrateRosterProfiles(
  profiles: PlayerProfile[],
  databaseInstance: PelipaivaDB = db
): Promise<void> {
  const needsHydration: PlayerProfile[] = [];
  for (const p of profiles) {
    if (!p.calendarUrl && !p.associationUrl) continue;
    const eventCount = await databaseInstance.events.where('profileId').equals(p.id).count();
    if (eventCount === 0 || !p.lastOfficialSyncAt) {
      needsHydration.push(p);
    }
  }
  if (needsHydration.length === 0) return;

  const chunkSize = 2;
  for (let i = 0; i < needsHydration.length; i += chunkSize) {
    const chunk = needsHydration.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async (profile) => {
        try {
          const url = profile.associationUrl || profile.calendarUrl;
          if (!url) return;
          if (!parseAssociationUrl(url)) return;

          await ingestOfficialForProfile({
            profileId: profile.id,
            playerName: profile.playerName,
            teamName: profile.teamName,
            sport: profile.sport,
            url,
            database: databaseInstance,
            includeWeather: true
          });
        } catch (err) {
          console.warn(`[FAMILY_CLOUD] Hydration failed for ${profile.playerName}:`, err);
        }
      })
    );

    if (i + chunkSize < needsHydration.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

/**
 * Executes a full synchronization cycle: GET -> merge -> hydrate -> PUT with 409 retry.
 */
export async function syncFamilyRosterCycle(
  familyCode: string,
  databaseInstance: PelipaivaDB = db,
  baseUrl: string = WORKER_BASE_URL
): Promise<{ success: boolean; roster?: FamilyRosterV1; error?: string }> {
  if (!isValidFamilyCode(familyCode)) {
    return { success: false, error: 'Invalid family code' };
  }

  const cleanCode = normalizeFamilyCode(familyCode);

  try {
    // 1. Load local profiles
    const localProfiles = await databaseInstance.profiles.toArray();
    const syncRecord = await databaseInstance.syncState.get('family');
    const localTombstonesStr = localStorage.getItem(`pelipaiva_tombstones_${cleanCode}`);
    const localTombstones: TombstoneRecord[] = localTombstonesStr ? JSON.parse(localTombstonesStr) : [];

    const remote = await fetchFamilyRoster(cleanCode, baseUrl);

    const { mergedProfiles, tombstones, hasChanges } = mergeRosters(
      localProfiles,
      remote,
      localTombstones
    );

    localStorage.setItem(`pelipaiva_tombstones_${cleanCode}`, JSON.stringify(tombstones));

    const tombstoneIds = new Set(tombstones.map((t) => t.id));
    for (const lp of localProfiles) {
      const stableId = lp.id.startsWith('p:')
        ? lp.id
        : generateStableProfileId(lp.playerName, lp.calendarUrl || lp.associationUrl || '');
      if (tombstoneIds.has(lp.id) || tombstoneIds.has(stableId)) {
        await databaseInstance.profiles.delete(lp.id);
        const events = await databaseInstance.events.where('profileId').equals(lp.id).toArray();
        for (const ev of events) {
          await databaseInstance.events.delete(ev.id);
        }
        if (stableId !== lp.id) {
          await databaseInstance.profiles.delete(stableId);
          const more = await databaseInstance.events.where('profileId').equals(stableId).toArray();
          for (const ev of more) {
            await databaseInstance.events.delete(ev.id);
          }
        }
      }
    }

    for (const mp of mergedProfiles) {
      await databaseInstance.profiles.put(mp);
    }

    await hydrateRosterProfiles(mergedProfiles, databaseInstance);

    const pendingUpload = Boolean(syncRecord?.pendingUpload);
    const shouldPut = hasChanges || pendingUpload || !remote;

    const rosterToPush: FamilyRosterV1 = {
      v: 1,
      rev: remote ? remote.rev + 1 : 1,
      updatedAt: new Date().toISOString(),
      profiles: mergedProfiles.map((p) => ({
        id: p.id,
        playerName: p.playerName,
        teamName: p.teamName,
        sport: p.sport,
        colorHex: p.colorHex || '#3b82f6',
        calendarUrl: p.calendarUrl || '',
        associationUrl: p.associationUrl,
        associationType: p.associationType,
        teamId: p.teamId
      })),
      tombstones
    };

    let pushRes: PushRosterResult = {
      success: true,
      rev: remote?.rev || 0,
      updatedAt: remote?.updatedAt || new Date().toISOString()
    };

    if (shouldPut) {
      pushRes = await pushFamilyRoster(cleanCode, rosterToPush, remote?.rev, baseUrl);

      if (!pushRes.success && pushRes.error === 'rev_conflict') {
        const freshRemote = await fetchFamilyRoster(cleanCode, baseUrl);
        const remerged = mergeRosters(mergedProfiles, freshRemote, tombstones);
        rosterToPush.profiles = remerged.mergedProfiles.map((p) => ({
          id: p.id,
          playerName: p.playerName,
          teamName: p.teamName,
          sport: p.sport,
          colorHex: p.colorHex || '#3b82f6',
          calendarUrl: p.calendarUrl || '',
          associationUrl: p.associationUrl,
          associationType: p.associationType,
          teamId: p.teamId
        }));
        rosterToPush.tombstones = remerged.tombstones;
        rosterToPush.rev = (freshRemote?.rev || 0) + 1;
        pushRes = await pushFamilyRoster(cleanCode, rosterToPush, freshRemote?.rev, baseUrl);
      }
    }

    await databaseInstance.syncState.put({
      key: 'family',
      syncKey: cleanCode,
      lastSyncedAt: new Date().toISOString(),
      pendingUpload: shouldPut ? !pushRes.success : pendingUpload
    });

    return {
      success: pushRes.success,
      roster: rosterToPush
    };
  } catch (err: any) {
    console.error('[FAMILY_CLOUD] Sync cycle error:', err);
    return { success: false, error: err?.message || 'Sync failed' };
  }
}
