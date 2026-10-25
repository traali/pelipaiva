import { db, PelipaivaDB } from '../storage/db';
import { PlayerProfile, SportType } from '../../types/matchday';
import { generateStableProfileId, slugPlayerName } from '../clubs/attachTeam';
import { ingestSourceForProfile } from '../clubs/ingestOfficial';
import { swatchForHex } from '../sport/teamColors';
import { isValidFamilyCode, normalizeFamilyCode } from './familyCode';
import { detectSportFromText } from '../ai/eventCandidateRanker';

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
    },
    // Hard ceiling — a stalled Worker connection must never hang the join/sync (M-14).
    signal: AbortSignal.timeout(10_000)
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
      body: JSON.stringify(roster),
      // Hard ceiling — a stalled Worker connection must never hang sync (M-14).
      signal: AbortSignal.timeout(10_000)
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
 * Resolves a unique, deterministic stable profile ID.
 * Avoids colliding on empty URLs for same-named siblings by incorporating sport and team slug,
 * and regenerates incomplete legacy IDs ending in ':'.
 */
export function getStableProfileId(p: {
  id: string;
  playerName: string;
  calendarUrl?: string;
  associationUrl?: string;
  sport?: SportType;
  teamName?: string;
}): string {
  // If the profile already has a valid, fully qualified stable ID (not ending with empty key ':'), preserve it
  if (p.id && p.id.startsWith('p:') && p.id !== 'p:' && !p.id.endsWith(':')) {
    return p.id;
  }
  const url = (p.calendarUrl || p.associationUrl || '').trim();
  if (url) {
    return generateStableProfileId(p.playerName, url);
  }
  // Fallback for manual / non-URL profiles: differentiate by sport and teamName
  const sport = p.sport || 'football';
  const teamPart = p.teamName ? `:${slugPlayerName(p.teamName)}` : '';
  const fallbackSource = `manual:${sport}${teamPart}`;
  return generateStableProfileId(p.playerName, fallbackSource);
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
        // KV roster intentionally carries colorHex only (FINAL §4.1, kit =
        // family truth); 'sininen' is just the local display-label fallback.
        primaryColor: rp.colorHex ? swatchForHex(rp.colorHex).label : 'sininen',
        calendarUrl: rp.calendarUrl,
        associationUrl: rp.associationUrl,
        associationType:
          rp.associationType === 'palloliitto' ||
          rp.associationType === 'salibandy' ||
          rp.associationType === 'basket' ||
          rp.associationType === 'torneopal'
            ? rp.associationType
            : undefined,
        teamId: rp.teamId,
        colorHex: rp.colorHex || '#3b82f6'
      });
    }
  }

  // 2. Add or update with local profiles (if not tombstoned), preventing same-named sibling overwrites
  const localAssignedIds = new Set<string>();
  for (const lp of localProfiles) {
    const stableId = getStableProfileId(lp);
    if (tombstoneMap.has(stableId) || tombstoneMap.has(lp.id)) continue;

    let targetId = stableId;
    if (localAssignedIds.has(targetId)) {
      // Collision between distinct local profiles: disambiguate ID to protect data
      targetId = `${stableId}:${slugPlayerName(lp.id || Math.random().toString(36).slice(2, 6))}`;
    }
    localAssignedIds.add(targetId);

    profileMap.set(targetId, {
      ...lp,
      id: targetId
    });
  }

  // 3. Multi-sport profile harmonization: collect ALL official sports per player (Map<string, Set<SportType>>)
  const officialSportsByPlayer = new Map<string, Set<SportType>>();
  for (const p of profileMap.values()) {
    if (p.associationUrl || p.teamId) {
      if (p.sport) {
        const norm = p.playerName.trim().toLowerCase();
        let set = officialSportsByPlayer.get(norm);
        if (!set) {
          set = new Set<SportType>();
          officialSportsByPlayer.set(norm, set);
        }
        set.add(p.sport);
      }
    }
  }

  for (const p of profileMap.values()) {
    const norm = p.playerName.trim().toLowerCase();
    const playerOfficialSports = officialSportsByPlayer.get(norm);
    const profileText = `${p.teamName || ''} ${p.calendarUrl || ''} ${p.associationUrl || ''}`.trim();
    const detectedSport = detectSportFromText(profileText);

    if (!p.sport) {
      if (detectedSport) {
        p.sport = detectedSport;
      } else if (playerOfficialSports && playerOfficialSports.size === 1) {
        p.sport = Array.from(playerOfficialSports)[0] ?? p.sport;
      }
    } else if (p.sport === 'football' && !p.associationUrl) {
      const isActuallyFootball = /ppj|pallo-pojat|hjk|futis|jalkapallo|palloliitto|fcfj|käpa|gnistan|vjs/i.test(profileText);
      if (!isActuallyFootball) {
        if (detectedSport && detectedSport !== 'football') {
          p.sport = detectedSport;
        } else if (playerOfficialSports) {
          for (const offSport of playerOfficialSports) {
            if (offSport === 'football') continue;
            const matchesOffSport =
              (offSport === 'floorball' && /indians|salibandy|säbä|sähly|oilers|ervii|eräviikingit|hawks|tiikerit|classic|spv/i.test(profileText)) ||
              (offSport === 'basketball' && /basket|topola|koris|hnmky|namika|honka/i.test(profileText)) ||
              (offSport === 'volleyball' && /lentopallo|puma|lp viesti|valepa|lentis|puijo/i.test(profileText)) ||
              (offSport === 'icehockey' && /jokerit|hifk|kiekko|lätkä|tappara|jäähalli|kärpät|pelicans|lukko|ässät|saipa|jyp|hpk/i.test(profileText)) ||
              (offSport === 'futsal' && /futsal|kady|gft|mad max|ilves fs/i.test(profileText));

            if (matchesOffSport) {
              p.sport = offSport;
              break;
            }
          }
        }
      }
    }
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

          await ingestSourceForProfile({
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

// Single-flight in-memory mutex to prevent concurrent sync races for the same family code (M-16)
const inFlightSyncs = new Map<
  string,
  Promise<{ success: boolean; roster?: FamilyRosterV1; error?: string }>
>();

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
  const existingInFlight = inFlightSyncs.get(cleanCode);
  if (existingInFlight) {
    return existingInFlight;
  }

  const syncPromise = (async () => {
    try {
      return await executeSyncFamilyRosterCycle(cleanCode, databaseInstance, baseUrl);
    } finally {
      inFlightSyncs.delete(cleanCode);
    }
  })();

  inFlightSyncs.set(cleanCode, syncPromise);
  return syncPromise;
}

async function executeSyncFamilyRosterCycle(
  cleanCode: string,
  databaseInstance: PelipaivaDB,
  baseUrl: string
): Promise<{ success: boolean; roster?: FamilyRosterV1; error?: string }> {
  try {
    // 1. Load local profiles — demo rows must never leak into a real family
    // roster (M-08/N2). Demo ids are seeded by handleStartDemo.
    const isDemoProfileId = (id: string) =>
      id.startsWith('profile-ppj-') ||
      id.startsWith('profile-topola-') ||
      id.startsWith('profile-kw-') ||
      id === 'profile-hjk-demo';
    const localProfiles = (await databaseInstance.profiles.toArray()).filter(
      (p) => !isDemoProfileId(p.id)
    );
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
      const stableId = getStableProfileId(lp);
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
      } else if (stableId !== lp.id) {
        // Clean migration of legacy local profile IDs: delete old ID and repoint events
        await databaseInstance.profiles.delete(lp.id);
        const legacyEvents = await databaseInstance.events.where('profileId').equals(lp.id).toArray();
        for (const ev of legacyEvents) {
          await databaseInstance.events.update(ev.id, { profileId: stableId });
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
    if (err?.message === 'unknown_family') {
      console.warn(`[FAMILY_CLOUD] Family code ${cleanCode} is operating in local mode (not registered on edge).`);
    } else {
      console.warn('[FAMILY_CLOUD] Sync cycle warning:', err);
    }
    return { success: false, error: err?.message || 'Sync failed' };
  }
}
