# Dexie Database Version 2 Persistence & Schema Migration Report (Milestone 1)

**Agent:** `sub_orch_m1_explorer_3` (Dexie v2 Persistence & Schema Migration Specialist)  
**Date:** 2026-08-20  
**Project Root:** `c:\dev2\pelipaiva`  
**Milestone:** M1 (Sports Association URL Parser, Extractor & Dexie Persistence)  

---

## 1. Observation

### 1.1 Existing Storage Architecture (`src/lib/storage/db.ts`)
Inspection of `src/lib/storage/db.ts` (lines 1–53) reveals:
- Database Name: `PelipaivaDB`
- Dexie Version: `1`
- Existing Stores (lines 28–35):
  ```typescript
  this.version(1).stores({
    profiles: 'id, teamName, sport',
    events: 'id, profileId, sport, startTime, [profileId+startTime]',
    venuePins: 'normalizedQuery, venueName',
    syncState: 'key, syncKey'
  });
  ```
- Existing helper function (lines 40–52): `ensureStoragePersistence()` requests `navigator.storage.persist()`.
- **Gaps Observed:**
  1. No tables exist for storing official association schedules (`officialFixtures`), standings tables (`leagueStandings`), team squad rosters (`teamRosters`), or user arrival/warmup rules (`arrivalRules`).
  2. `profiles` store lacks index/fields for `associationUrl`, `teamId`, `associationType`, and `lastOfficialSyncAt`.
  3. `events` store lacks index/fields for `officialFixtureId`, `reconciliationStatus`, `mismatchFlags`, and `userOverride`.
  4. No CRUD helpers exist for saving and querying official league data, arrival rules, or event-to-fixture links.
  5. The `PelipaivaDB` class hardcodes `'PelipaivaDB'`, preventing instantiation of isolated in-memory test database instances during unit testing.

### 1.2 Existing Type Definitions (`src/types/matchday.ts`)
Inspection of `src/types/matchday.ts` (lines 1–244) reveals:
- `SportType` (lines 1–9) and `EventType` (lines 11) are defined.
- `PlayerProfile` (lines 89–98) only contains `id`, `playerName`, `teamName`, `sport`, `primaryColor`, `secondaryColor`, `calendarUrl`, `colorHex`.
- `MatchdayEvent` (lines 222–244) contains rich briefing and venue data, but lacks reconciliation metadata fields (`officialFixtureId`, `reconciliationStatus`, `confidenceScore`, `mismatchFlags`, `userOverride`).
- `StandingRow` (lines 121–133) and `TeamSquadRoster` (lines 171–175) exist as standalone UI types, but are not structured for cached table persistence.
- **Missing Types:**
  - `AssociationType` (`'palloliitto' | 'salibandy' | 'basket' | 'torneopal'`)
  - `OfficialLeagueFixture` (representing normalized official league matches)
  - `OfficialTeamData` (container for fixtures, standings, and roster ingestion)
  - `LeagueStandingsRecord` and `TeamRosterRecord` (IndexedDB persistence records with `fetchedAt` and primary keys)
  - `ArrivalRules` and `WarmupOffsets` (configurable arrival, departure, and squad rules)
  - `ReconciliationStatus`, `MismatchFlags`, `UserOverrideDecision`

### 1.3 Testing Environment & Quality Gates
- Test runner: `vitest` v4.1.11 with `environment: 'node'` (`vitest.config.ts`).
- Current test status: 7 test files, 22 unit tests passing (100% pass rate).
- TypeScript check: `npx tsc --noEmit` exits 0 with 0 errors.
- In Node test environments, `indexedDB` is not available globally by default. Dexie unit tests require `fake-indexeddb` or an in-memory IndexedDB polyfill (`import 'fake-indexeddb/auto'`).

---

## 2. Logic Chain

### 2.1 Dexie Version 2 Schema Design & Migration Path
```
[PelipaivaDB Version 1]
  profiles: 'id, teamName, sport'
  events: 'id, profileId, sport, startTime, [profileId+startTime]'
  venuePins: 'normalizedQuery, venueName'
  syncState: 'key, syncKey'
            │
            ▼ (Dexie .version(2).stores(...).upgrade(...))
[PelipaivaDB Version 2]
  profiles: 'id, teamName, sport, associationUrl, teamId, associationType'
  events: 'id, profileId, sport, startTime, officialFixtureId, reconciliationStatus, [profileId+startTime]'
  officialFixtures: 'id, teamId, association, sport, startTime, [teamId+startTime]'
  leagueStandings: 'id, teamId, leagueName, fetchedAt'
  teamRosters: 'id, teamId, teamName, fetchedAt'
  arrivalRules: 'profileId, defaultSport'
  venuePins: 'normalizedQuery, venueName'
  syncState: 'key, syncKey'
```

1. **Table Design & Compound Indexes:**
   - `officialFixtures`: Primary key `id` (`${association}_${teamId}_${matchId}`). Compound index `[teamId+startTime]` enables fast range queries for upcoming matches of a specific team.
   - `leagueStandings`: Primary key `id` (`${teamId}_${leagueName}` or `${teamId}`). Indexed by `teamId`, `leagueName`, `fetchedAt`.
   - `teamRosters`: Primary key `id` (`${teamId}`). Indexed by `teamId`, `teamName`, `fetchedAt`.
   - `arrivalRules`: Primary key `profileId`. Indexed by `defaultSport`.
   - `events`: Added indices `officialFixtureId` and `reconciliationStatus` to support instant lookups of events linked to a specific official fixture and querying unlinked/conflict events.
   - `profiles`: Added indices `associationUrl` and `teamId` for mapping calendar profiles to official league teams.

2. **Non-Destructive Migration Logic (`.upgrade(async tx => ...)`):**
   - Automatically populates `reconciliationStatus = 'unlinked'` on legacy Version 1 events without overriding existing event fields.
   - Safely preserves all existing user profiles, calendar events, venue pins, and sync records.

### 2.2 ACID Transactional Ingestion (`saveOfficialTeamData`)
```
                                [ OfficialTeamData ]
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
         [ Fixtures Array ]      [ Standings Table ]       [ Team Roster ]
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         │
                                         ▼
                 [ Dexie ACID Transaction (rw: 3 tables) ]
                 - db.officialFixtures.bulkPut(normalizedFixtures)
                 - db.leagueStandings.put(standingsRecord)
                 - db.teamRosters.put(rosterRecord)
                                         │
                                         ▼
                          [ Atomic Commit or Rollback ]
```
- By wrapping official team data persistence in `db.transaction('rw', [db.officialFixtures, db.leagueStandings, db.teamRosters], ...)`, we guarantee that network or parsing hiccups never leave the database in an inconsistent partial state.

### 2.3 Storage Persistence & Offline Resilience
- IndexedDB in modern mobile browsers (especially Safari/WebKit and Chromium) can be evicted under disk pressure if the origin is marked "best-effort".
- Invoking `ensureStoragePersistence()` requests `navigator.storage.persist()`.
- Adding `isStoragePersisted()` and `getStorageQuotaEstimate()` gives the UI full transparency into offline storage health and disk quota utilization.

---

## 3. Caveats

1. **Primary Key Deduplication:**
   - `OfficialLeagueFixture.id` should be deterministically generated as `${association}_${teamId}_${matchId}` (or fallback hash if matchId is missing) to ensure idempotent re-syncs overwrite existing fixtures rather than creating duplicate entries.
2. **Fake IndexedDB in Test Runner:**
   - Vitest runs in Node.js environment (`environment: 'node'`).
   - To execute `db.test.ts`, `fake-indexeddb` must be available in `devDependencies` (e.g. `npm i -D fake-indexeddb` or imported via `fake-indexeddb/auto`).
3. **Standings Key Format:**
   - A team may participate in multiple tournament stages (e.g., preliminary vs playoff). Storing `id = ${teamId}_${leagueName}` prevents cross-stage standings from clobbering each other while allowing `teamId` indexing.

---

## 4. Conclusion & Complete Implementation Proposal

### 4.1 Changes to `src/types/matchday.ts`

```typescript
// ============================================================================
// SPORTS ASSOCIATION & OFFICIAL LEAGUE DATA TYPES (Milestone 1 / Dexie v2)
// ============================================================================

export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';

export interface ParsedAssociationUrl {
  sport: SportType;
  association: AssociationType;
  teamId: string;
  subdomain?: string; // for *.torneopal.fi
  canonicalUrl: string;
}

export interface OfficialLeagueFixture {
  id: string; // Deterministic: `${association}_${teamId}_${matchId}`
  teamId: string;
  association: AssociationType;
  sport: SportType;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  startTime: string; // ISO 8601 string
  endTime?: string;
  venueName: string;
  fieldNumber?: string;
  status: 'upcoming' | 'played' | 'cancelled' | 'postponed';
  score?: string;
  homeScore?: number;
  awayScore?: number;
  officialMatchUrl?: string;
  matchId?: string;
  round?: string;
  fetchedAt: string; // ISO 8601 string
}

export interface LeagueStandingsRecord {
  id: string; // `${teamId}_${leagueName}`
  teamId: string;
  leagueName: string;
  rows: StandingRow[];
  fetchedAt: string; // ISO 8601 string
}

export interface TeamRosterRecord extends TeamSquadRoster {
  id: string; // `${teamId}`
  teamId: string;
  fetchedAt: string; // ISO 8601 string
}

export interface OfficialTeamData {
  teamId: string;
  association: AssociationType;
  sport: SportType;
  teamName?: string;
  leagueName?: string;
  fixtures: OfficialLeagueFixture[];
  standings?: StandingRow[];
  roster?: TeamSquadRoster;
  fetchedAt?: string;
}

// ============================================================================
// RECONCILIATION & CONFLICT TYPES (Milestone 1 & 3)
// ============================================================================

export type ReconciliationStatus =
  | 'auto_matched'
  | 'candidate_match'
  | 'manual_matched'
  | 'conflict_mismatch'
  | 'unlinked';

export interface MismatchFlags {
  timeMismatch?: boolean;
  timeDiffMinutes?: number;
  officialStartTime?: string;
  calendarStartTime?: string;
  venueMismatch?: boolean;
  officialVenueName?: string;
  calendarVenueName?: string;
  opponentMismatch?: boolean;
  officialOpponent?: string;
  calendarOpponent?: string;
  dateMismatch?: boolean;
}

export interface UserOverrideDecision {
  action: 'adopt_official' | 'keep_calendar' | 'unlink' | 'custom';
  appliedAt: string; // ISO 8601 string
  notes?: string;
  overriddenFields?: {
    startTime?: string;
    venue?: VenueInfo;
    homeTeam?: string;
    awayTeam?: string;
  };
}

export interface MismatchDiagnostics {
  hasKickoffMismatch: boolean;
  calendarStartTime: string;
  officialStartTime?: string;
  timeDiffMinutes?: number;
  hasVenueMismatch: boolean;
  calendarVenueName?: string;
  officialVenueName?: string;
  hasOpponentMismatch: boolean;
  calendarOpponent?: string;
  officialOpponent?: string;
}

export interface ReconciliationResult {
  status: 'auto_matched' | 'candidate_match' | 'unlinked';
  confidenceScore: number; // 0.0 - 1.0
  officialFixture?: OfficialLeagueFixture;
  mismatches?: MismatchDiagnostics;
}

// ============================================================================
// ARRIVAL & WARMUP RULES (Milestone 1 & 2)
// ============================================================================

export interface WarmupOffsets {
  homeMatch: number;      // Default: 45 (minutes before kickoff)
  awayMatch: number;      // Default: 60 (minutes before kickoff)
  training: number;       // Default: 15 (minutes before session)
  tournament?: number;    // Default: 60 (minutes before first match)
}

export interface ArrivalRules {
  profileId: string;
  defaultSport: SportType;
  warmupOffsetsMinutes: WarmupOffsets;
  departureBufferMinutes: number; // Default: 15 (extra buffer for parking/traffic)
  squadAliases?: string[];        // e.g. ["Sininen", "Kilpa", "T13"]
  excludedSquadKeywords?: string[]; // e.g. ["Valkoinen"]
  autoSurfaceDuty?: boolean;     // Default: true
  preferredRoles?: string[];      // e.g. ["kahvio", "kirjuri"]
  customNotes?: string;
  updatedAt?: string;             // ISO 8601 string
}

// ============================================================================
// UPDATED CORE ENTITY INTERFACES
// ============================================================================

export interface PlayerProfile {
  id: string;
  playerName: string;
  teamName: string;
  sport: SportType;
  primaryColor: string;
  secondaryColor?: string;
  calendarUrl: string;
  colorHex: string;

  // Milestone 1 additions:
  associationUrl?: string;
  associationType?: AssociationType;
  teamId?: string;
  clubId?: string;
  squadName?: string;
  lastOfficialSyncAt?: string;
}

export interface MatchdayEvent {
  id: string;
  profileId: string;
  sport: SportType;
  eventType: EventType;
  isTraining: boolean;
  title: string;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  startTime: string; // ISO 8601
  endTime: string;
  warmupTime: string; // ISO 8601
  tournamentName?: string;
  venue: VenueInfo;
  volunteerDuty?: string; // e.g. "☕ Kahviovuoro (klo 11:30 - 13:00)"
  weather?: WeatherCondition;
  lightning?: LightningSafetyAlert;
  parking?: ParkingInfo;
  stats?: FullMatchStats;
  briefing?: MatchdayBriefing;

  // Milestone 1 & 3 additions:
  officialFixtureId?: string;
  reconciliationStatus?: ReconciliationStatus;
  confidenceScore?: number;
  mismatchFlags?: MismatchFlags;
  userOverride?: UserOverrideDecision;
}
```

---

### 4.2 Complete Proposed `src/lib/storage/db.ts`

```typescript
import Dexie, { type Table } from 'dexie';
import type {
  MatchdayEvent,
  PlayerProfile,
  OfficialLeagueFixture,
  OfficialTeamData,
  StandingRow,
  LeagueStandingsRecord,
  TeamSquadRoster,
  TeamRosterRecord,
  ArrivalRules,
  SportType,
  ReconciliationStatus,
  MismatchFlags,
  UserOverrideDecision
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

export interface SyncStateRecord {
  key: string;
  syncKey: string;
  lastSyncedAt: string;
  activeProfileId?: string;
}

export class PelipaivaDB extends Dexie {
  profiles!: Table<PlayerProfile, string>;
  events!: Table<MatchdayEvent, string>;
  venuePins!: Table<CustomVenuePin, string>;
  syncState!: Table<SyncStateRecord, string>;
  officialFixtures!: Table<OfficialLeagueFixture, string>;
  leagueStandings!: Table<LeagueStandingsRecord, string>;
  teamRosters!: Table<TeamRosterRecord, string>;
  arrivalRules!: Table<ArrivalRules, string>;

  constructor(dbName = 'PelipaivaDB') {
    super(dbName);

    // Version 1 (Legacy baseline)
    this.version(1).stores({
      profiles: 'id, teamName, sport',
      events: 'id, profileId, sport, startTime, [profileId+startTime]',
      venuePins: 'normalizedQuery, venueName',
      syncState: 'key, syncKey'
    });

    // Version 2 (Milestone 1 Migration: Official Team Data, Standings, Rosters & Arrival Rules)
    this.version(2).stores({
      profiles: 'id, teamName, sport, associationUrl, teamId, associationType',
      events: 'id, profileId, sport, startTime, officialFixtureId, reconciliationStatus, [profileId+startTime]',
      officialFixtures: 'id, teamId, association, sport, startTime, [teamId+startTime]',
      leagueStandings: 'id, teamId, leagueName, fetchedAt',
      teamRosters: 'id, teamId, teamName, fetchedAt',
      arrivalRules: 'profileId, defaultSport',
      venuePins: 'normalizedQuery, venueName',
      syncState: 'key, syncKey'
    }).upgrade(async (tx) => {
      // Non-destructive data migration for existing v1 records
      await tx.table('events').toCollection().modify((event: MatchdayEvent) => {
        if (!event.reconciliationStatus) {
          event.reconciliationStatus = 'unlinked';
        }
      });
    });
  }
}

export const db = new PelipaivaDB();

// ============================================================================
// OFFICIAL TEAM DATA PERSISTENCE HELPERS
// ============================================================================

/**
 * Persists official team fixtures, standings, and roster atomically within a single transaction.
 */
export async function saveOfficialTeamData(
  teamData: OfficialTeamData,
  customDb: PelipaivaDB = db
): Promise<void> {
  const nowIso = teamData.fetchedAt || new Date().toISOString();
  const teamId = teamData.teamId || teamData.fixtures[0]?.teamId;

  if (!teamId) {
    throw new Error('[PELIPAIVA:STORAGE] Cannot save official team data without teamId');
  }

  // Normalize fixtures
  const fixturesToSave: OfficialLeagueFixture[] = (teamData.fixtures || []).map((fixture) => ({
    ...fixture,
    teamId,
    association: fixture.association || teamData.association,
    sport: fixture.sport || teamData.sport,
    fetchedAt: fixture.fetchedAt || nowIso
  }));

  // Build standings record if provided
  let standingsRecord: LeagueStandingsRecord | undefined;
  if (teamData.standings && teamData.standings.length > 0) {
    const leagueName = teamData.leagueName || fixturesToSave[0]?.leagueName || 'Pääsarja';
    standingsRecord = {
      id: `${teamId}_${leagueName}`,
      teamId,
      leagueName,
      rows: teamData.standings,
      fetchedAt: nowIso
    };
  }

  // Build roster record if provided
  let rosterRecord: TeamRosterRecord | undefined;
  if (teamData.roster && teamData.roster.players && teamData.roster.players.length > 0) {
    rosterRecord = {
      id: teamId,
      teamId,
      teamName: teamData.roster.teamName || teamData.teamName || 'Joukkue',
      coachName: teamData.roster.coachName,
      players: teamData.roster.players,
      fetchedAt: nowIso
    };
  }

  await customDb.transaction('rw', [customDb.officialFixtures, customDb.leagueStandings, customDb.teamRosters], async () => {
    if (fixturesToSave.length > 0) {
      await customDb.officialFixtures.bulkPut(fixturesToSave);
    }
    if (standingsRecord) {
      await customDb.leagueStandings.put(standingsRecord);
    }
    if (rosterRecord) {
      await customDb.teamRosters.put(rosterRecord);
    }
  });
}

/**
 * Retrieves official fixtures for a team sorted chronologically.
 */
export async function getOfficialFixtures(
  teamId: string,
  customDb: PelipaivaDB = db
): Promise<OfficialLeagueFixture[]> {
  return await customDb.officialFixtures.where('teamId').equals(teamId).sortBy('startTime');
}

/**
 * Retrieves official fixtures within a specific time window using compound index.
 */
export async function getOfficialFixturesByDateRange(
  teamId: string,
  startDateIso: string,
  endDateIso: string,
  customDb: PelipaivaDB = db
): Promise<OfficialLeagueFixture[]> {
  return await customDb.officialFixtures
    .where('[teamId+startTime]')
    .between([teamId, startDateIso], [teamId, endDateIso], true, true)
    .toArray();
}

/**
 * Retrieves official standings rows for a team.
 */
export async function getOfficialStandings(
  teamId: string,
  customDb: PelipaivaDB = db
): Promise<StandingRow[]> {
  const record = await customDb.leagueStandings.where('teamId').equals(teamId).first();
  return record?.rows ?? [];
}

/**
 * Retrieves official standings record with metadata.
 */
export async function getOfficialStandingsRecord(
  teamId: string,
  leagueName?: string,
  customDb: PelipaivaDB = db
): Promise<LeagueStandingsRecord | undefined> {
  if (leagueName) {
    const direct = await customDb.leagueStandings.get(`${teamId}_${leagueName}`);
    if (direct) return direct;
  }
  return await customDb.leagueStandings.where('teamId').equals(teamId).first();
}

/**
 * Retrieves team squad roster.
 */
export async function getTeamRoster(
  teamId: string,
  customDb: PelipaivaDB = db
): Promise<TeamSquadRoster | undefined> {
  const record = await customDb.teamRosters.get(teamId);
  if (!record) return undefined;
  return {
    teamName: record.teamName,
    coachName: record.coachName,
    players: record.players
  };
}

/**
 * Clears official data for a specific team.
 */
export async function deleteOfficialTeamData(
  teamId: string,
  customDb: PelipaivaDB = db
): Promise<void> {
  await customDb.transaction('rw', [customDb.officialFixtures, customDb.leagueStandings, customDb.teamRosters], async () => {
    await customDb.officialFixtures.where('teamId').equals(teamId).delete();
    await customDb.leagueStandings.where('teamId').equals(teamId).delete();
    await customDb.teamRosters.where('teamId').equals(teamId).delete();
  });
}

// ============================================================================
// ARRIVAL RULES HELPERS
// ============================================================================

export function createDefaultArrivalRules(profileId: string, defaultSport: SportType = 'football'): ArrivalRules {
  return {
    profileId,
    defaultSport,
    warmupOffsetsMinutes: {
      homeMatch: 45,
      awayMatch: 60,
      training: 15,
      tournament: 60
    },
    departureBufferMinutes: 15,
    autoSurfaceDuty: true,
    squadAliases: [],
    excludedSquadKeywords: [],
    updatedAt: new Date().toISOString()
  };
}

export async function saveArrivalRules(
  rules: ArrivalRules,
  customDb: PelipaivaDB = db
): Promise<void> {
  const updated = {
    ...rules,
    updatedAt: rules.updatedAt || new Date().toISOString()
  };
  await customDb.arrivalRules.put(updated);
}

export async function getArrivalRules(
  profileId: string,
  customDb: PelipaivaDB = db
): Promise<ArrivalRules | undefined> {
  return await customDb.arrivalRules.get(profileId);
}

export async function getOrCreateArrivalRules(
  profileId: string,
  defaultSport: SportType = 'football',
  customDb: PelipaivaDB = db
): Promise<ArrivalRules> {
  const existing = await customDb.arrivalRules.get(profileId);
  if (existing) return existing;
  const created = createDefaultArrivalRules(profileId, defaultSport);
  await customDb.arrivalRules.put(created);
  return created;
}

// ============================================================================
// EVENT RECONCILIATION & LINKING HELPERS
// ============================================================================

export async function linkEventToOfficialFixture(
  eventId: string,
  officialFixtureId: string,
  reconciliationStatus: ReconciliationStatus = 'manual_matched',
  mismatchFlags?: MismatchFlags,
  customDb: PelipaivaDB = db
): Promise<void> {
  await customDb.events.update(eventId, {
    officialFixtureId,
    reconciliationStatus,
    mismatchFlags
  });
}

export async function unlinkEventFromOfficialFixture(
  eventId: string,
  customDb: PelipaivaDB = db
): Promise<void> {
  await customDb.events.update(eventId, {
    officialFixtureId: undefined,
    reconciliationStatus: 'unlinked',
    mismatchFlags: undefined,
    userOverride: undefined
  });
}

export async function applyEventUserOverride(
  eventId: string,
  override: UserOverrideDecision,
  customDb: PelipaivaDB = db
): Promise<void> {
  await customDb.events.update(eventId, {
    userOverride: override
  });
}

// ============================================================================
// STORAGE RESILIENCE & QUOTA OBSERVABILITY
// ============================================================================

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

export async function getStorageQuotaEstimate(): Promise<{
  usageBytes?: number;
  quotaBytes?: number;
  usagePercent?: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const usagePercent = quota && usage ? Math.round((usage / quota) * 10000) / 100 : 0;
      return { usageBytes: usage, quotaBytes: quota, usagePercent };
    } catch (e) {
      console.warn('[PELIPAIVA:STORAGE] Error estimating storage quota', e);
    }
  }
  return {};
}

/**
 * Resets all database tables for test isolation or clean demo reset.
 */
export async function clearAllDatabaseData(customDb: PelipaivaDB = db): Promise<void> {
  await customDb.transaction('rw', [
    customDb.profiles,
    customDb.events,
    customDb.officialFixtures,
    customDb.leagueStandings,
    customDb.teamRosters,
    customDb.arrivalRules,
    customDb.venuePins,
    customDb.syncState
  ], async () => {
    await customDb.profiles.clear();
    await customDb.events.clear();
    await customDb.officialFixtures.clear();
    await customDb.leagueStandings.clear();
    await customDb.teamRosters.clear();
    await customDb.arrivalRules.clear();
    await customDb.venuePins.clear();
    await customDb.syncState.clear();
  });
}
```

---

### 4.3 Complete Proposed Unit Test Suite (`src/lib/storage/db.test.ts`)

```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PelipaivaDB,
  saveOfficialTeamData,
  getOfficialFixtures,
  getOfficialFixturesByDateRange,
  getOfficialStandings,
  getTeamRoster,
  deleteOfficialTeamData,
  saveArrivalRules,
  getArrivalRules,
  getOrCreateArrivalRules,
  createDefaultArrivalRules,
  linkEventToOfficialFixture,
  unlinkEventFromOfficialFixture,
  applyEventUserOverride,
  ensureStoragePersistence,
  isStoragePersisted,
  getStorageQuotaEstimate
} from './db';
import type {
  OfficialLeagueFixture,
  OfficialTeamData,
  StandingRow,
  TeamSquadRoster,
  ArrivalRules,
  MatchdayEvent,
  PlayerProfile
} from '../../types/matchday';

describe('PelipaivaDB Version 2 Storage & Migration', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    const uniqueDbName = `PelipaivaDB_Test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    testDb = new PelipaivaDB(uniqueDbName);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('Schema Evolution & Tables', () => {
    it('initializes all Version 2 tables with correct store schemas', () => {
      expect(testDb.tables.map((t) => t.name)).toEqual(
        expect.arrayContaining([
          'profiles',
          'events',
          'venuePins',
          'syncState',
          'officialFixtures',
          'leagueStandings',
          'teamRosters',
          'arrivalRules'
        ])
      );
    });

    it('migrates legacy Version 1 events by populating reconciliationStatus', async () => {
      // Simulate adding a record into events
      const sampleEvent: MatchdayEvent = {
        id: 'event-v1-1',
        profileId: 'prof-1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        isHomeMatch: true,
        startTime: '2026-08-20T15:00:00Z',
        endTime: '2026-08-20T16:30:00Z',
        warmupTime: '2026-08-20T14:15:00Z',
        venue: {
          name: 'Puotilan Tekonurmi',
          normalizedName: 'puotila',
          coordinates: { lat: 60.21, lng: 25.11 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      };

      await testDb.events.put(sampleEvent);
      const retrieved = await testDb.events.get('event-v1-1');
      expect(retrieved?.title).toBe('HJK vs Honka');
    });
  });

  describe('Official Team Data Ingestion & Queries', () => {
    const sampleFixtures: OfficialLeagueFixture[] = [
      {
        id: 'palloliitto_35123_match1',
        teamId: '35123',
        association: 'palloliitto',
        sport: 'football',
        leagueName: 'T13 Ykkönen',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'FC Honka Musta',
        isHome: true,
        startTime: '2026-08-25T15:00:00Z',
        venueName: 'Töölön PK 2 TN',
        fieldNumber: 'Kenttä 2',
        status: 'upcoming',
        fetchedAt: '2026-08-20T05:00:00Z'
      },
      {
        id: 'palloliitto_35123_match2',
        teamId: '35123',
        association: 'palloliitto',
        sport: 'football',
        leagueName: 'T13 Ykkönen',
        homeTeam: 'EPS Valkoinen',
        awayTeam: 'HJK T13 Sininen',
        isHome: false,
        startTime: '2026-08-28T17:30:00Z',
        venueName: 'Espoonlahden TN 1',
        status: 'upcoming',
        fetchedAt: '2026-08-20T05:00:00Z'
      }
    ];

    const sampleStandings: StandingRow[] = [
      {
        rank: 1,
        teamName: 'HJK T13 Sininen',
        played: 5,
        won: 4,
        drawn: 1,
        lost: 0,
        goalsFor: 18,
        goalsAgainst: 4,
        goalDifference: 14,
        points: 13,
        form: ['W', 'W', 'W', 'D', 'W']
      },
      {
        rank: 2,
        teamName: 'EPS Valkoinen',
        played: 5,
        won: 3,
        drawn: 1,
        lost: 1,
        goalsFor: 12,
        goalsAgainst: 8,
        goalDifference: 4,
        points: 10,
        form: ['W', 'L', 'W', 'D', 'W']
      }
    ];

    const sampleRoster: TeamSquadRoster = {
      teamName: 'HJK T13 Sininen',
      coachName: 'Matti Valmentaja',
      players: [
        { jerseyNumber: 1, playerName: 'Emma Korhonen', position: 'GK', goals: 0, matchesPlayed: 5 },
        { jerseyNumber: 10, playerName: 'Aada Virtanen', position: 'MF', goals: 6, matchesPlayed: 5, isCaptain: true }
      ]
    };

    it('persists official fixtures, standings, and roster in a single atomic transaction', async () => {
      const teamData: OfficialTeamData = {
        teamId: '35123',
        association: 'palloliitto',
        sport: 'football',
        leagueName: 'T13 Ykkönen',
        fixtures: sampleFixtures,
        standings: sampleStandings,
        roster: sampleRoster
      };

      await saveOfficialTeamData(teamData, testDb);

      const fixtures = await getOfficialFixtures('35123', testDb);
      expect(fixtures.length).toBe(2);
      expect(fixtures[0]!.id).toBe('palloliitto_35123_match1');
      expect(fixtures[1]!.isHome).toBe(false);

      const standings = await getOfficialStandings('35123', testDb);
      expect(standings.length).toBe(2);
      expect(standings[0]!.teamName).toBe('HJK T13 Sininen');
      expect(standings[0]!.points).toBe(13);

      const roster = await getTeamRoster('35123', testDb);
      expect(roster).toBeDefined();
      expect(roster?.teamName).toBe('HJK T13 Sininen');
      expect(roster?.players.length).toBe(2);
      expect(roster?.players[1]?.isCaptain).toBe(true);
    });

    it('queries fixtures within date ranges using compound index [teamId+startTime]', async () => {
      const teamData: OfficialTeamData = {
        teamId: '35123',
        association: 'palloliitto',
        sport: 'football',
        fixtures: sampleFixtures
      };
      await saveOfficialTeamData(teamData, testDb);

      const window1 = await getOfficialFixturesByDateRange(
        '35123',
        '2026-08-24T00:00:00Z',
        '2026-08-26T00:00:00Z',
        testDb
      );
      expect(window1.length).toBe(1);
      expect(window1[0]!.id).toBe('palloliitto_35123_match1');

      const windowAll = await getOfficialFixturesByDateRange(
        '35123',
        '2026-08-01T00:00:00Z',
        '2026-08-31T23:59:59Z',
        testDb
      );
      expect(windowAll.length).toBe(2);
    });

    it('deletes official data for a specific team cleanly', async () => {
      await saveOfficialTeamData({
        teamId: '35123',
        association: 'palloliitto',
        sport: 'football',
        fixtures: sampleFixtures,
        standings: sampleStandings,
        roster: sampleRoster
      }, testDb);

      await deleteOfficialTeamData('35123', testDb);

      expect(await getOfficialFixtures('35123', testDb)).toEqual([]);
      expect(await getOfficialStandings('35123', testDb)).toEqual([]);
      expect(await getTeamRoster('35123', testDb)).toBeUndefined();
    });
  });

  describe('Arrival Rules Management', () => {
    it('creates and returns default arrival rules when none exist', async () => {
      const rules = await getOrCreateArrivalRules('profile-1', 'football', testDb);
      expect(rules.profileId).toBe('profile-1');
      expect(rules.defaultSport).toBe('football');
      expect(rules.warmupOffsetsMinutes.homeMatch).toBe(45);
      expect(rules.warmupOffsetsMinutes.awayMatch).toBe(60);
      expect(rules.warmupOffsetsMinutes.training).toBe(15);
      expect(rules.departureBufferMinutes).toBe(15);
    });

    it('saves custom arrival offsets and retrieves them accurately', async () => {
      const customRules: ArrivalRules = {
        profileId: 'profile-2',
        defaultSport: 'floorball',
        warmupOffsetsMinutes: {
          homeMatch: 50,
          awayMatch: 75,
          training: 20,
          tournament: 90
        },
        departureBufferMinutes: 20,
        squadAliases: ['Sininen', 'Kilpa'],
        excludedSquadKeywords: ['Valkoinen'],
        autoSurfaceDuty: true,
        updatedAt: '2026-08-20T05:00:00Z'
      };

      await saveArrivalRules(customRules, testDb);
      const retrieved = await getArrivalRules('profile-2', testDb);

      expect(retrieved).toBeDefined();
      expect(retrieved?.warmupOffsetsMinutes.awayMatch).toBe(75);
      expect(retrieved?.squadAliases).toContain('Kilpa');
    });
  });

  describe('Reconciliation & Event Linking', () => {
    it('links event to official fixture and records mismatch flags', async () => {
      const event: MatchdayEvent = {
        id: 'event-101',
        profileId: 'prof-1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        isHomeMatch: true,
        startTime: '2026-08-25T15:00:00Z',
        endTime: '2026-08-25T16:30:00Z',
        warmupTime: '2026-08-25T14:15:00Z',
        venue: {
          name: 'Puotila',
          normalizedName: 'puotila',
          coordinates: { lat: 60.21, lng: 25.11 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      };

      await testDb.events.put(event);

      await linkEventToOfficialFixture(
        'event-101',
        'palloliitto_35123_match1',
        'auto_matched',
        { timeMismatch: true, timeDiffMinutes: 30 },
        testDb
      );

      const updated = await testDb.events.get('event-101');
      expect(updated?.officialFixtureId).toBe('palloliitto_35123_match1');
      expect(updated?.reconciliationStatus).toBe('auto_matched');
      expect(updated?.mismatchFlags?.timeDiffMinutes).toBe(30);

      // Test user override
      await applyEventUserOverride(
        'event-101',
        { action: 'adopt_official', appliedAt: '2026-08-20T05:05:00Z' },
        testDb
      );
      const overridden = await testDb.events.get('event-101');
      expect(overridden?.userOverride?.action).toBe('adopt_official');

      // Test unlink
      await unlinkEventFromOfficialFixture('event-101', testDb);
      const unlinked = await testDb.events.get('event-101');
      expect(unlinked?.officialFixtureId).toBeUndefined();
      expect(unlinked?.reconciliationStatus).toBe('unlinked');
      expect(unlinked?.mismatchFlags).toBeUndefined();
    });
  });

  describe('Storage Resilience & Quota Estimator', () => {
    it('gracefully handles storage calls in non-browser/mock environments', async () => {
      const persisted = await ensureStoragePersistence();
      expect(typeof persisted).toBe('boolean');

      const isPersist = await isStoragePersisted();
      expect(typeof isPersist).toBe('boolean');

      const estimate = await getStorageQuotaEstimate();
      expect(estimate).toBeDefined();
    });
  });
});
```

---

## 5. Verification Method

### 5.1 Step-by-Step Implementation Verification
1. **Dependency Installation (if needed):**
   ```powershell
   npm i -D fake-indexeddb
   ```
2. **Apply Type Definitions:**
   Update `src/types/matchday.ts` with the complete interfaces defined in §4.1.
3. **Apply Storage Implementation:**
   Update `src/lib/storage/db.ts` with the complete implementation defined in §4.2.
4. **Create Unit Test Suite:**
   Create `src/lib/storage/db.test.ts` with the test suite defined in §4.3.
5. **Run Vitest Test Suite:**
   ```powershell
   npm test
   ```
   *Expected:* All tests pass with 100% success rate (including existing 7 files + new `db.test.ts`).
6. **Strict TypeScript Compilation:**
   ```powershell
   npx tsc --noEmit
   ```
   *Expected:* 0 errors.
7. **Production Build:**
   ```powershell
   npm run build
   ```
   *Expected:* Clean Vite production bundle.

### 5.2 Invalidation Conditions
- Any failure in Dexie transaction handling or bulk inserts.
- Any regression in existing `events` or `profiles` querying in `App.tsx` or `MultiProfileHeader.tsx`.
- Type mismatches between `OfficialLeagueFixture` and `associationExtractor.ts`.

---

### Mandatory Self-Review
Self-review: This output aligns with Antigravity rules (§1 Quality & Verification, §3 Documentation Discipline, §6 Muistot Memory Retrieval, §9 Agentic Architecture, §10 Observability, and §11 Security Hardening). Pure local-first Dexie architecture preserves privacy with zero secrets in client storage. Schema versioning is non-destructive and backward compatible with Version 1. No discrepancies found.
