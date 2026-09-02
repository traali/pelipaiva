import { db, PelipaivaDB } from '../storage/db';
import { PlayerProfile, SportType } from '../../types/matchday';
import { generateStableProfileId } from '../clubs/attachTeam';
import { ingestSourceForProfile } from '../clubs/ingestOfficial';
import { swatchForHex } from '../sport/teamColors';
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

  // Harmonize child sport across profiles if the child has an official association sport (e.g. basketball, floorball, volleyball)
  const officialSportByPlayer = new Map<string, SportType>();
  for (const p of profileMap.values()) {
    if (p.associationUrl || p.teamId) {
      if (p.sport && p.sport !== 'football') {
        officialSportByPlayer.set(p.playerName.trim().toLowerCase(), p.sport);
      }
    }
  }
  for (const p of profileMap.values()) {
    const offSport = officialSportByPlayer.get(p.playerName.trim().toLowerCase());
    if (offSport && p.sport === 'football' && !p.associationUrl) {
      p.sport = offSport;
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
    if (err?.message === 'unknown_family') {
      console.warn(`[FAMILY_CLOUD] Family code ${cleanCode} is operating in local mode (not registered on edge).`);
    } else {
      console.warn('[FAMILY_CLOUD] Sync cycle warning:', err);
    }
    return { success: false, error: err?.message || 'Sync failed' };
  }
}

// ---------------------------------------------------------------------------
// Manual Events Sync — cross-device freeform event sharing
// KV key: fam_events:{familyCode}  TTL: 30 days rolling
// ---------------------------------------------------------------------------

import type { FamilyManualEvent, FamilyEventsV1, AttendanceOverrideRecord } from '../../types/matchday';

/** GET /api/family/:code/events — returns null on 404 (first device, no events yet) */
export async function fetchFamilyEvents(
  code: string,
  baseUrl: string = WORKER_BASE_URL
): Promise<FamilyEventsV1 | null> {
  const cleanCode = normalizeFamilyCode(code);
  try {
    const res = await fetch(`${baseUrl}/api/family/${encodeURIComponent(cleanCode)}/events`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000)
    });
    if (res.status === 404) return null;
    if (res.status === 403) throw new Error('unknown_family');
    if (!res.ok) throw new Error(`Worker events GET failed: ${res.status}`);
    const data = (await res.json()) as FamilyEventsV1;
    if (!data || data.v !== 1 || !Array.isArray(data.events)) throw new Error('invalid_events_schema');
    return data;
  } catch (err: any) {
    console.warn('[FAMILY_CLOUD] fetchFamilyEvents failed:', err);
    return null;
  }
}

export type PushEventsResult =
  | { success: true; rev: number; updatedAt: string }
  | { success: false; error: 'rev_conflict'; currentRev: number }
  | { success: false; error: string };

/** PUT /api/family/:code/events — uploads merged event list with If-Match concurrency */
export async function pushFamilyEvents(
  code: string,
  payload: FamilyEventsV1,
  ifMatchRev?: number,
  baseUrl: string = WORKER_BASE_URL
): Promise<PushEventsResult> {
  const cleanCode = normalizeFamilyCode(code);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ifMatchRev !== undefined) headers['If-Match'] = `"${ifMatchRev}"`;

    const res = await fetch(`${baseUrl}/api/family/${encodeURIComponent(cleanCode)}/events`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });

    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: 'rev_conflict', currentRev: (err as any).currentRev || 0 };
    }
    if (res.status === 403) return { success: false, error: 'unknown_family' };
    if (!res.ok) return { success: false, error: `Worker error ${res.status}` };

    const data = await res.json();
    return { success: true, rev: data.rev, updatedAt: data.updatedAt };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Merge local and remote manual event lists.
 * Strategy: last-write-wins per event ID; tombstone (deletedAt) always beats live.
 * Prunes tombstones older than 30 days to keep payload compact.
 */
export function mergeFamilyEvents(
  local: FamilyManualEvent[],
  remote: FamilyManualEvent[]
): FamilyManualEvent[] {
  const map = new Map<string, FamilyManualEvent>();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const ev of [...remote, ...local]) {
    const existing = map.get(ev.id);
    // Tombstone always wins; among live events, later updatedAt wins
    if (!existing) {
      map.set(ev.id, ev);
    } else if (ev.deletedAt && !existing.deletedAt) {
      map.set(ev.id, ev);
    } else if (!ev.deletedAt && existing.deletedAt) {
      // keep tombstone
    } else if (ev.updatedAt > existing.updatedAt) {
      map.set(ev.id, ev);
    }
  }

  // Prune tombstones older than 30 days — they've served their purpose
  return [...map.values()].filter(
    (ev) => !ev.deletedAt || ev.deletedAt > thirtyDaysAgo
  );
}

/**
 * Merge local and remote attendance override lists.
 * Strategy: last-write-wins per eventId based on updatedAt.
 */
export function mergeAttendanceOverrides(
  local: AttendanceOverrideRecord[],
  remote: AttendanceOverrideRecord[]
): AttendanceOverrideRecord[] {
  const map = new Map<string, AttendanceOverrideRecord>();
  for (const ov of [...remote, ...local]) {
    const existing = map.get(ov.eventId);
    if (!existing || ov.updatedAt > existing.updatedAt) {
      map.set(ov.eventId, ov);
    }
  }
  return [...map.values()];
}

/**
 * Full sync cycle for family calendar data: fetch remote events & attendance overrides,
 * merge with local Dexie, apply overrides to local events, and push any local updates.
 */
export async function syncManualEvents(
  code: string,
  databaseInstance: import('../storage/db').PelipaivaDB,
  baseUrl: string = WORKER_BASE_URL
): Promise<{ events: FamilyManualEvent[]; overrides: AttendanceOverrideRecord[]; success: boolean }> {
  const cleanCode = normalizeFamilyCode(code);

  try {
    // 1. Load local events
    const localAll = await databaseInstance.manualEvents.toArray();

    // 2. Fetch remote
    const remote = await fetchFamilyEvents(cleanCode, baseUrl);
    const remoteEvents = remote?.events ?? [];
    const remoteOverrides = remote?.attendanceOverrides ?? [];

    // 3. Merge manual events & attendance overrides
    const mergedEvents = mergeFamilyEvents(localAll, remoteEvents);

    // 4. Write merged manual events back to Dexie
    if (mergedEvents.length > 0) {
      await databaseInstance.manualEvents.bulkPut(mergedEvents);
    }

    // 5. Apply remote attendance overrides to local Dexie events table
    for (const ov of remoteOverrides) {
      try {
        const ev = await databaseInstance.events.get(ov.eventId);
        if (ev && ev.attendanceStatus !== ov.status) {
          await databaseInstance.events.update(ov.eventId, { attendanceStatus: ov.status });
        }
      } catch {
        // Continue if event doesn't exist locally yet
      }
    }

    // 6. Check if local has newer events or overrides to push
    const localHasChanges = localAll.some((ev) => {
      const remoteEv = remoteEvents.find((r) => r.id === ev.id);
      return !remoteEv || ev.updatedAt > remoteEv.updatedAt;
    });

    if (localHasChanges) {
      const payload: FamilyEventsV1 = {
        v: 1,
        rev: (remote?.rev ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        events: mergedEvents,
        attendanceOverrides: remoteOverrides
      };
      const pushRes = await pushFamilyEvents(cleanCode, payload, remote?.rev, baseUrl);

      if (!pushRes.success && pushRes.error === 'rev_conflict') {
        const fresh = await fetchFamilyEvents(cleanCode, baseUrl);
        const freshMerged = mergeFamilyEvents(mergedEvents, fresh?.events ?? []);
        const freshOverrides = mergeAttendanceOverrides(remoteOverrides, fresh?.attendanceOverrides ?? []);
        await databaseInstance.manualEvents.bulkPut(freshMerged);
        const retryPayload: FamilyEventsV1 = {
          v: 1,
          rev: (fresh?.rev ?? 0) + 1,
          updatedAt: new Date().toISOString(),
          events: freshMerged,
          attendanceOverrides: freshOverrides
        };
        await pushFamilyEvents(cleanCode, retryPayload, fresh?.rev, baseUrl);
        return {
          events: freshMerged.filter((e) => !e.deletedAt),
          overrides: freshOverrides,
          success: true
        };
      }
    }

    return {
      events: mergedEvents.filter((e) => !e.deletedAt),
      overrides: remoteOverrides,
      success: true
    };
  } catch (err: any) {
    console.warn('[FAMILY_CLOUD] syncManualEvents failed:', err);
    const localLive = await databaseInstance.manualEvents
      .filter((e) => !e.deletedAt)
      .toArray();
    return { events: localLive, overrides: [], success: false };
  }
}

/**
 * Record an attendance override (IN / OUT) locally and push to Cloudflare KV in background.
 */
export async function recordAttendanceOverride(
  code: string,
  eventId: string,
  status: 'in' | 'out' | 'maybe',
  databaseInstance: import('../storage/db').PelipaivaDB,
  baseUrl: string = WORKER_BASE_URL
): Promise<void> {
  // 1. Update local database immediately
  try {
    await databaseInstance.events.update(eventId, { attendanceStatus: status });
  } catch (e) {
    console.warn('[FAMILY_CLOUD] Failed to update local event attendance:', e);
  }

  // If no family code, local update is sufficient
  if (!code || code === 'local') return;

  // 2. Non-blocking background sync to Cloudflare KV
  (async () => {
    try {
      const cleanCode = normalizeFamilyCode(code);
      const remote = await fetchFamilyEvents(cleanCode, baseUrl);
      const remoteOverrides = remote?.attendanceOverrides ?? [];
      const remoteEvents = remote?.events ?? [];

      const newOverride: AttendanceOverrideRecord = {
        eventId,
        status,
        updatedAt: new Date().toISOString()
      };

      const mergedOverrides = mergeAttendanceOverrides([newOverride], remoteOverrides);
      const payload: FamilyEventsV1 = {
        v: 1,
        rev: (remote?.rev ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        events: remoteEvents,
        attendanceOverrides: mergedOverrides
      };

      await pushFamilyEvents(cleanCode, payload, remote?.rev, baseUrl);
    } catch (err) {
      console.warn('[FAMILY_CLOUD] Background attendance push failed:', err);
    }
  })();
}

/**
 * Record an added/imported manual family event locally and push to Cloudflare KV.
 */
export async function recordManualFamilyEvent(
  code: string,
  event: FamilyManualEvent,
  databaseInstance: import('../storage/db').PelipaivaDB,
  baseUrl: string = WORKER_BASE_URL
): Promise<void> {
  // 1. Save to local database
  try {
    await databaseInstance.manualEvents.put(event);
  } catch (e) {
    console.warn('[FAMILY_CLOUD] Failed to save manual event locally:', e);
  }

  if (!code || code === 'local') return;

  // 2. Non-blocking background sync to Cloudflare KV
  (async () => {
    try {
      const cleanCode = normalizeFamilyCode(code);
      const remote = await fetchFamilyEvents(cleanCode, baseUrl);
      const remoteOverrides = remote?.attendanceOverrides ?? [];
      const remoteEvents = remote?.events ?? [];

      const mergedEvents = mergeFamilyEvents([event], remoteEvents);
      const payload: FamilyEventsV1 = {
        v: 1,
        rev: (remote?.rev ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        events: mergedEvents,
        attendanceOverrides: remoteOverrides
      };

      await pushFamilyEvents(cleanCode, payload, remote?.rev, baseUrl);
    } catch (err) {
      console.warn('[FAMILY_CLOUD] Background event push failed:', err);
    }
  })();
}
