## 2026-08-20T05:07:22Z
You are Explorer 3 (Dexie v2 Persistence & Schema Migration Specialist) for Milestone 1 (M1).
Working directory: c:\dev2\pelipaiva\.agents\sub_orch_m1_explorer_3
Project root: c:\dev2\pelipaiva

MANDATORY FIRST STEP: Read:
1. c:\dev2\pelipaiva\ORIGINAL_REQUEST.md
2. c:\dev2\pelipaiva\PROJECT.md
3. c:\dev2\pelipaiva\.agents\sub_orch_m1\SCOPE.md
4. c:\dev2\pelipaiva\src\lib\storage\db.ts
5. c:\dev2\pelipaiva\src\types\matchday.ts

YOUR TASK:
Investigate and design Dexie Database Version 2 migration & persistence in `src/lib/storage/db.ts` and `src/types/matchday.ts`:
1. Analyze existing `PelipaivaDB` Version 1 schema and determine clean Version 2 schema:
   - `profiles`: add `associationUrl`, `associationType`, `teamId`, `clubId`, `lastOfficialSyncAt`.
   - `events`: add `officialFixtureId`, `reconciliationStatus`, `mismatchFlags`, `userOverride`.
   - Add new table `officialFixtures`: schema `'id, teamId, association, sport, startTime, [teamId+startTime]'`.
   - Add new table `leagueStandings`: schema `'id, teamId, leagueName, fetchedAt'`.
   - Add new table `teamRosters`: schema `'id, teamId, teamName, fetchedAt'`.
   - Add new table `arrivalRules`: schema `'profileId, defaultSport'`.
2. Define complete TypeScript types in `src/types/matchday.ts`:
   - `OfficialLeagueFixture`, `OfficialTeamData`, `StandingRow`, `TeamSquadRoster`, `ArrivalRules`, `ReconciliationStatus`.
3. Design CRUD and query helpers in `src/lib/storage/db.ts`:
   - `saveOfficialTeamData(teamData: OfficialTeamData): Promise<void>`
   - `getOfficialFixtures(teamId: string): Promise<OfficialLeagueFixture[]>`
   - `getOfficialStandings(teamId: string): Promise<StandingRow[]>`
   - `getTeamRoster(teamId: string): Promise<TeamSquadRoster | undefined>`
   - `saveArrivalRules(rules: ArrivalRules): Promise<void>`
   - `getArrivalRules(profileId: string): Promise<ArrivalRules | undefined>`
   - Offline resilience & storage persistence handling (`ensureStoragePersistence()`).
4. Design comprehensive unit tests in `src/lib/storage/db.test.ts` (using `fake-indexeddb` or Dexie in-memory).

Write your comprehensive findings and implementation proposal to:
`c:\dev2\pelipaiva\.agents\sub_orch_m1_explorer_3\handoff.md`.
Use `send_message` to notify the parent when complete.
