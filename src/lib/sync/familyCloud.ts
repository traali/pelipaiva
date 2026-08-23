import { db, PelipaivaDB } from '../storage/db';
import { PlayerProfile, MatchdayEvent, SportType } from '../../types/matchday';
import { generateStableProfileId } from '../clubs/attachTeam';
import { parseAssociationUrl } from '../api/associationUrlParser';
import { extractOfficialTeamData } from '../api/associationExtractor';
import { exampleTournamentFromUrl, mergeOfficialWithCupFallback, isCupName } from '../clubs/exampleTournaments';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { generateOrResolveMatchStats } from '../stats/statsEngine';

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

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generates a clean 6-character Crockford-32 code: e.g. "SAIMA-4" or "KOPPI-8".
 */
export function generateFamilyCode(): string {
  let chars = '';
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * CROCKFORD_ALPHABET.length);
    chars += CROCKFORD_ALPHABET[idx];
  }
  const checkIdx = Math.floor(Math.random() * CROCKFORD_ALPHABET.length);
  return `${chars}-${CROCKFORD_ALPHABET[checkIdx]}`;
}

export function isValidFamilyCode(code?: string): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase();
  return /^[0-9A-Z]{5}-[0-9A-Z]$/.test(clean) || /^[0-9A-Z]{6}$/.test(clean);
}

export function normalizeFamilyCode(code: string): string {
  const clean = code.trim().toUpperCase();
  if (clean.includes('-')) return clean;
  if (clean.length === 6) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  return clean;
}

/**
 * Fetches Family Roster from Cloudflare Worker KV.
 */
export async function fetchFamilyRoster(
  code: string,
  baseUrl: string = WORKER_BASE_URL
): Promise<FamilyRosterV1 | null> {
  const cleanCode = normalizeFamilyCode(code);
  try {
    const res = await fetch(`${baseUrl}/api/family/${encodeURIComponent(cleanCode)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Worker GET failed with status ${res.status}`);
    }

    const data = (await res.json()) as FamilyRosterV1;
    if (!data || data.v !== 1 || !Array.isArray(data.profiles)) {
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[FAMILY_CLOUD] Failed to fetch family roster:', err);
    return null;
  }
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
    if (tombstoneMap.has(stableId)) continue;

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

  return {
    mergedProfiles,
    tombstones,
    hasChanges: true
  };
}

/**
 * Hydrates official fixtures for roster profiles using a 2-parallel throttled queue.
 */
export async function hydrateRosterProfiles(
  profiles: PlayerProfile[],
  databaseInstance: PelipaivaDB = db
): Promise<void> {
  const needsHydration = profiles.filter((p) => Boolean(p.calendarUrl || p.associationUrl));
  if (needsHydration.length === 0) return;

  // Process in chunks of 2 with 150ms delay
  const chunkSize = 2;
  for (let i = 0; i < needsHydration.length; i += chunkSize) {
    const chunk = needsHydration.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async (profile) => {
        try {
          const url = profile.associationUrl || profile.calendarUrl;
          if (!url) return;
          const parsedAssoc = parseAssociationUrl(url);
          if (!parsedAssoc) return;

          let officialData = await extractOfficialTeamData(parsedAssoc, {
            customTeamName: profile.teamName,
            fallbackToSynthetic: false
          }).catch(() => null);

          // Example cup fallback integration
          const cup = exampleTournamentFromUrl(url);
          officialData = mergeOfficialWithCupFallback(cup, officialData);

          if (officialData && officialData.fixtures.length > 0) {
            for (const fix of officialData.fixtures) {
              await databaseInstance.officialFixtures.put(fix);
            }

            const eventsToInsert: MatchdayEvent[] = [];
            const cupish = Boolean(cup) || isCupName(officialData.leagueName);
            const fixtures = cupish
              ? officialData.fixtures.filter((f) => f.status !== 'cancelled')
              : officialData.fixtures;

            for (const fix of fixtures) {
              const venue = await resolveSportsVenue(fix.venueName, {
                lat: fix.venueLat,
                lng: fix.venueLng,
                city: fix.venueCity
              });
              const startTime = fix.startTime || new Date().toISOString();
              const endTime =
                fix.endTime || new Date(new Date(startTime).getTime() + 90 * 60000).toISOString();
              const warmupTime = new Date(new Date(startTime).getTime() - 45 * 60000).toISOString();

              const thisCup = cupish || isCupName(fix.leagueName);
              const event: MatchdayEvent = {
                id: `fixture-${profile.id}-${fix.id}`,
                profileId: profile.id,
                title: `${fix.homeTeam} vs ${fix.awayTeam}`,
                eventType: thisCup ? 'tournament' : 'match',
                isTraining: false,
                sport: officialData.sport || profile.sport,
                homeTeam: fix.homeTeam,
                awayTeam: fix.awayTeam,
                isHomeMatch: fix.isHome ?? true,
                startTime,
                endTime,
                warmupTime,
                tournamentName: thisCup ? fix.leagueName || officialData.leagueName : undefined,
                venue,
                officialFixtureId: fix.id,
                reconciliationStatus: 'auto_matched',
                confidenceScore: 1.0,
                stats: thisCup
                  ? undefined
                  : generateOrResolveMatchStats(fix.homeTeam, fix.awayTeam, officialData.sport)
              };
              eventsToInsert.push(event);
            }

            for (const ev of eventsToInsert) {
              await databaseInstance.events.put(ev);
            }
          }
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
    const localTombstonesStr = localStorage.getItem(`pelipaiva_tombstones_${cleanCode}`);
    const localTombstones: TombstoneRecord[] = localTombstonesStr ? JSON.parse(localTombstonesStr) : [];

    // 2. Fetch remote KV
    const remote = await fetchFamilyRoster(cleanCode, baseUrl);

    // 3. Merge
    const { mergedProfiles, tombstones } = mergeRosters(localProfiles, remote, localTombstones);

    // Persist tombstones locally
    localStorage.setItem(`pelipaiva_tombstones_${cleanCode}`, JSON.stringify(tombstones));

    // 4. Update Dexie profiles: add new / update existing / remove tombstoned
    const tombstoneIds = new Set(tombstones.map((t) => t.id));
    for (const lp of localProfiles) {
      if (tombstoneIds.has(lp.id)) {
        await databaseInstance.profiles.delete(lp.id);
        const events = await databaseInstance.events.where('profileId').equals(lp.id).toArray();
        for (const ev of events) {
          await databaseInstance.events.delete(ev.id);
        }
      }
    }

    for (const mp of mergedProfiles) {
      await databaseInstance.profiles.put(mp);
    }

    // 5. Hydrate fixtures for new teams
    await hydrateRosterProfiles(mergedProfiles, databaseInstance);

    // 6. Push updated roster to Cloudflare KV
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

    let pushRes = await pushFamilyRoster(cleanCode, rosterToPush, remote?.rev, baseUrl);

    // 409 Conflict Retry: GET -> re-merge -> bump rev -> PUT
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

    // Save syncState in Dexie
    await databaseInstance.syncState.put({
      key: 'family',
      syncKey: cleanCode,
      lastSyncedAt: new Date().toISOString(),
      pendingUpload: false
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
