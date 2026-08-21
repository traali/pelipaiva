import Dexie, { DexieOptions, type Table } from 'dexie';
import {
  MatchdayEvent,
  PlayerProfile,
  OfficialLeagueFixture,
  OfficialTeamData,
  StandingRow,
  TeamSquadRoster,
  ArrivalRules,
  SportType,
  ReconciliationStatus,
  MismatchFlags,
  UserOverrideDecision,
  LeagueStandingsRecord,
  TeamRosterRecord
} from '../../types/matchday';

export interface CustomVenuePin {
  normalizedQuery: string;
  venueName: string;
  lat: number;
  lng: number;
  isIndoor: boolean;
  surface?: string;
  savedAt: string;
}

export interface CustomAliasRecord {
  pattern: string;
  canonicalClub: string;
  createdAt: string;
}

export interface SyncStateRecord {
  key: string;
  syncKey: string;
  lastSyncedAt: string;
  activeProfileId?: string;
}

export class PelipaivaDB extends Dexie {
  profiles!: Table<PlayerProfile, string>;
  events!: Table<MatchdayEvent, string>;
  officialFixtures!: Table<OfficialLeagueFixture, string>;
  leagueStandings!: Table<LeagueStandingsRecord | any, string>;
  teamRosters!: Table<TeamRosterRecord | any, string>;
  arrivalRules!: Table<ArrivalRules, string>;
  venuePins!: Table<CustomVenuePin, string>;
  customAliases!: Table<CustomAliasRecord, string>;
  syncState!: Table<SyncStateRecord, string>;

  constructor(databaseName = 'PelipaivaDB', options?: DexieOptions) {
    super(databaseName, options);
    
    // Schema Version 1 (Baseline profiles, events, venuePins, syncState)
    this.version(1).stores({
      profiles: 'id, teamName, sport',
      events: 'id, profileId, sport, startTime, [profileId+startTime]',
      venuePins: 'normalizedQuery, venueName',
      syncState: 'key, syncKey'
    });

    // Schema Version 2 (Multi-sport official fixtures, standings, rosters, arrival rules, customAliases, compound indexes)
    this.version(2).stores({
      profiles: 'id, teamName, sport, associationUrl, teamId, associationType',
      events: 'id, profileId, sport, startTime, officialFixtureId, reconciliationStatus, [profileId+startTime]',
      officialFixtures: 'id, teamId, association, sport, startTime, [teamId+startTime]',
      leagueStandings: 'id, teamId, leagueName, fetchedAt',
      teamRosters: 'id, teamId, teamName, fetchedAt',
      arrivalRules: 'profileId, defaultSport',
      venuePins: 'normalizedQuery, venueName',
      customAliases: 'pattern, canonicalClub, createdAt',
      syncState: 'key, syncKey'
    }).upgrade(async (tx) => {
      await tx.table('events').toCollection().modify((event: MatchdayEvent) => {
        if (!event.reconciliationStatus) {
          event.reconciliationStatus = 'unlinked';
        }
      });
    });
  }
}

export const db = new PelipaivaDB();

/**
 * Requests persistent storage from the browser if supported.
 */
export async function ensureStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[PELIPAIVA:STORAGE] Persistent storage granted: ${isPersisted}`);
      return isPersisted;
    } catch (e) {
      console.warn('[PELIPAIVA:STORAGE] Error requesting storage persistence', e);
      return false;
    }
  }
  return false;
}

/**
 * Checks whether persistent storage is currently active.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Obtains storage quota and usage estimates from the browser.
 */
export async function getStorageQuotaEstimate(): Promise<{
  quotaBytes?: number;
  usageBytes?: number;
  percentUsed?: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return {
        quotaBytes: est.quota,
        usageBytes: est.usage,
        percentUsed: est.quota ? Math.round(((est.usage || 0) / est.quota) * 100) : 0
      };
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Persists official team data (fixtures, standings, roster) into Dexie storage within an ACID transaction.
 */
export async function saveOfficialTeamData(
  teamData: OfficialTeamData,
  targetDb: PelipaivaDB = db
): Promise<void> {
  await targetDb.transaction('rw', [targetDb.officialFixtures, targetDb.leagueStandings, targetDb.teamRosters], async () => {
    if (teamData.fixtures && teamData.fixtures.length > 0) {
      await targetDb.officialFixtures.bulkPut(teamData.fixtures);
    }

    if (teamData.standings && teamData.standings.length > 0) {
      const records: LeagueStandingsRecord[] = [
        {
          id: `${teamData.teamId}_${teamData.leagueName || 'main'}`,
          teamId: teamData.teamId,
          leagueName: teamData.leagueName || 'Sarjataulukko',
          rows: teamData.standings,
          fetchedAt: new Date().toISOString()
        },
        {
          id: teamData.teamId,
          teamId: teamData.teamId,
          leagueName: teamData.leagueName || 'Sarjataulukko',
          rows: teamData.standings,
          fetchedAt: new Date().toISOString()
        }
      ];
      if (teamData.teamName) {
        records.push({
          id: teamData.teamName,
          teamId: teamData.teamId,
          leagueName: teamData.leagueName || 'Sarjataulukko',
          rows: teamData.standings,
          fetchedAt: new Date().toISOString()
        });
      }
      await targetDb.leagueStandings.bulkPut(records);
    }

    if (teamData.roster) {
      const rosterRecords: TeamRosterRecord[] = [
        {
          ...teamData.roster,
          id: teamData.teamId,
          teamId: teamData.teamId,
          fetchedAt: new Date().toISOString()
        }
      ];
      if (teamData.roster.teamName) {
        rosterRecords.push({
          ...teamData.roster,
          id: teamData.roster.teamName,
          teamId: teamData.teamId,
          fetchedAt: new Date().toISOString()
        });
      }
      await targetDb.teamRosters.bulkPut(rosterRecords);
    }
  });
}

/**
 * Retrieves official league fixtures for a specific team.
 */
export async function getOfficialFixtures(teamId: string, targetDb: PelipaivaDB = db): Promise<OfficialLeagueFixture[]> {
  return await targetDb.officialFixtures.where('teamId').equals(teamId).toArray();
}

/**
 * Retrieves official fixtures within a specific date range.
 */
export async function getOfficialFixturesByDateRange(
  teamId: string,
  startDate: string,
  endDate: string,
  targetDb: PelipaivaDB = db
): Promise<OfficialLeagueFixture[]> {
  const all = await getOfficialFixtures(teamId, targetDb);
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return all.filter((f) => {
    const t = new Date(f.startTime).getTime();
    return t >= start && t <= end;
  });
}

/**
 * Retrieves standings for a team by teamId or teamName. Returns array of StandingRow.
 */
export async function getOfficialStandings(teamIdOrName: string, targetDb: PelipaivaDB = db): Promise<StandingRow[]> {
  const direct = await targetDb.leagueStandings.get(teamIdOrName);
  if (direct && Array.isArray(direct.rows)) {
    return direct.rows;
  }
  if (direct && (direct as any).teamName && typeof (direct as any).rank === 'number') {
    return [direct as unknown as StandingRow];
  }
  const byTeamId = await targetDb.leagueStandings.where('teamId').equals(teamIdOrName).first();
  if (byTeamId && Array.isArray(byTeamId.rows)) {
    return byTeamId.rows;
  }
  // Check all records
  const allRecords = await targetDb.leagueStandings.toArray();
  for (const rec of allRecords) {
    if (rec.teamName === teamIdOrName && Array.isArray(rec.rows)) {
      return rec.rows;
    }
    if (rec.rows && Array.isArray(rec.rows)) {
      const match = rec.rows.find((r: StandingRow) => r.teamName === teamIdOrName);
      if (match) return rec.rows;
    }
  }
  return [];
}

/**
 * Retrieves full standings record by teamId and optional leagueName.
 */
export async function getOfficialStandingsRecord(
  teamId: string,
  leagueName?: string,
  targetDb: PelipaivaDB = db
): Promise<LeagueStandingsRecord | undefined> {
  if (leagueName) {
    const compositeId = `${teamId}_${leagueName}`;
    const direct = await targetDb.leagueStandings.get(compositeId);
    if (direct && direct.rows) return direct;
  }
  const direct = await targetDb.leagueStandings.get(teamId);
  if (direct && direct.rows) return direct;
  return await targetDb.leagueStandings.where('teamId').equals(teamId).first();
}

/**
 * Retrieves roster for a team by teamId or teamName.
 */
export async function getTeamRoster(teamIdOrName: string, targetDb: PelipaivaDB = db): Promise<TeamSquadRoster | undefined> {
  const direct = await targetDb.teamRosters.get(teamIdOrName);
  if (direct && direct.players) return direct;
  const byTeamId = await targetDb.teamRosters.where('teamId').equals(teamIdOrName).first();
  if (byTeamId && byTeamId.players) return byTeamId;
  const all = await targetDb.teamRosters.toArray();
  for (const rec of all) {
    if (rec.teamName === teamIdOrName || rec.teamId === teamIdOrName) {
      return rec;
    }
  }
  return undefined;
}

/**
 * Deletes official team data (fixtures, standings, roster) inside an ACID transaction.
 */
export async function deleteOfficialTeamData(teamId: string, targetDb: PelipaivaDB = db): Promise<void> {
  const [fixtureKeys, standingKeys, rosterKeys] = await Promise.all([
    targetDb.officialFixtures.where('teamId').equals(teamId).primaryKeys(),
    targetDb.leagueStandings.where('teamId').equals(teamId).primaryKeys(),
    targetDb.teamRosters.where('teamId').equals(teamId).primaryKeys()
  ]);

  const allStandingKeys = Array.from(new Set([...standingKeys, teamId]));
  const allRosterKeys = Array.from(new Set([...rosterKeys, teamId]));

  await Promise.all([
    fixtureKeys.length > 0 ? targetDb.officialFixtures.bulkDelete(fixtureKeys) : Promise.resolve(),
    allStandingKeys.length > 0 ? targetDb.leagueStandings.bulkDelete(allStandingKeys) : Promise.resolve(),
    allRosterKeys.length > 0 ? targetDb.teamRosters.bulkDelete(allRosterKeys) : Promise.resolve()
  ]);
}

/**
 * Creates default arrival rules for a profile.
 */
export function createDefaultArrivalRules(profileId: string, sport: SportType = 'football'): ArrivalRules {
  return {
    profileId,
    defaultSport: sport,
    warmupOffsetsMinutes: {
      homeMatch: 45,
      awayMatch: 60,
      training: 15,
      tournament: 30
    },
    departureBufferMinutes: 15,
    squadAliases: [],
    autoSurfaceDuty: true,
    preferredRoles: ['kahvio', 'toimitsija', 'kello_kirjuri']
  };
}

/**
 * Saves arrival rules configuration for a profile.
 */
export async function saveArrivalRules(rules: ArrivalRules, targetDb: PelipaivaDB = db): Promise<void> {
  const profileKey = rules.profileId || 'default';
  await targetDb.arrivalRules.put({ ...rules, profileId: profileKey, updatedAt: new Date().toISOString() });
}

/**
 * Retrieves arrival rules configuration for a profile.
 */
export async function getArrivalRules(profileId: string = 'default', targetDb: PelipaivaDB = db): Promise<ArrivalRules | undefined> {
  return await targetDb.arrivalRules.get(profileId);
}

/**
 * Retrieves or creates default arrival rules.
 */
export async function getOrCreateArrivalRules(
  profileId: string,
  sport: SportType = 'football',
  targetDb: PelipaivaDB = db
): Promise<ArrivalRules> {
  const existing = await getArrivalRules(profileId, targetDb);
  if (existing) return existing;
  const def = createDefaultArrivalRules(profileId, sport);
  await saveArrivalRules(def, targetDb);
  return def;
}

/**
 * Links a calendar event to an official league fixture in IndexedDB.
 */
export async function linkEventToOfficialFixture(
  eventId: string,
  officialFixtureId: string,
  status: ReconciliationStatus = 'auto_matched',
  mismatchFlags?: MismatchFlags,
  targetDb: PelipaivaDB = db
): Promise<void> {
  const event = await targetDb.events.get(eventId);
  if (!event) return;
  await targetDb.events.update(eventId, {
    officialFixtureId,
    reconciliationStatus: status,
    mismatchFlags
  });
}

/**
 * Unlinks a calendar event from its official league fixture.
 */
export async function unlinkEventFromOfficialFixture(eventId: string, targetDb: PelipaivaDB = db): Promise<void> {
  const event = await targetDb.events.get(eventId);
  if (!event) return;
  await targetDb.events.update(eventId, {
    officialFixtureId: undefined,
    reconciliationStatus: 'unlinked',
    mismatchFlags: undefined
  });
}

/**
 * Applies a user override decision to an event in IndexedDB.
 */
export async function applyEventUserOverride(
  eventId: string,
  override: UserOverrideDecision,
  targetDb: PelipaivaDB = db
): Promise<void> {
  await targetDb.events.update(eventId, {
    userOverride: override
  });
}

/**
 * Saves sync state token/key.
 */
export async function saveSyncState(key: string, syncKey: string, activeProfileId?: string, targetDb: PelipaivaDB = db): Promise<void> {
  await targetDb.syncState.put({
    key,
    syncKey,
    lastSyncedAt: new Date().toISOString(),
    activeProfileId
  });
}

/**
 * Retrieves sync state record.
 */
export async function getSyncState(key: string, targetDb: PelipaivaDB = db): Promise<SyncStateRecord | undefined> {
  return await targetDb.syncState.get(key);
}

/**
 * Clears all database tables.
 */
export async function clearAllDatabaseData(targetDb: PelipaivaDB = db): Promise<void> {
  await Promise.all([
    targetDb.profiles.clear(),
    targetDb.events.clear(),
    targetDb.officialFixtures.clear(),
    targetDb.leagueStandings.clear(),
    targetDb.teamRosters.clear(),
    targetDb.arrivalRules.clear(),
    targetDb.venuePins.clear(),
    targetDb.syncState.clear()
  ]);
}
