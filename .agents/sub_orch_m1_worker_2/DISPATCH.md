## 2026-08-20T05:21:12Z
You are Worker 2 (Remediation & Fix Specialist) for Milestone 1 (M1).
Working directory: c:\dev2\pelipaiva\.agents\sub_orch_m1_worker_2
Project root: c:\dev2\pelipaiva

MANDATORY FIRST STEP: Read:
1. c:\dev2\pelipaiva\ORIGINAL_REQUEST.md
2. c:\dev2\pelipaiva\PROJECT.md
3. c:\dev2\pelipaiva\.agents\sub_orch_m1\SCOPE.md
4. c:\dev2\pelipaiva\.agents\sub_orch_m1_reviewer_1\handoff.md (Reviewer 1 feedback: missing db.ts exports, API module alignment)
5. c:\dev2\pelipaiva\.agents\sub_orch_m1_reviewer_2\handoff.md (Reviewer 2 feedback: TypeScript build errors, test runner failures, transaction atomicity)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own and must fix/update the following files:
1. `src/lib/storage/db.ts` - Implement all missing Dexie v2 methods and schema store definitions:
   - Stores: `profiles`, `events`, `officialFixtures: 'id, teamId, association, sport, startTime, [teamId+startTime]'`, `leagueStandings: 'id, teamId, leagueName, fetchedAt'`, `teamRosters: 'id, teamId, teamName, fetchedAt'`, `arrivalRules: 'profileId, defaultSport'`, `venuePins`, `syncState`.
   - Upgrade step in version 2 to non-destructively set `reconciliationStatus = 'unlinked'`.
   - Export all required functions: `saveOfficialTeamData` (with `targetDb.transaction('rw', [targetDb.officialFixtures, targetDb.leagueStandings, targetDb.teamRosters], ...)`), `getOfficialFixtures`, `getOfficialFixturesByDateRange`, `getOfficialStandings`, `getOfficialStandingsRecord`, `getTeamRoster`, `deleteOfficialTeamData`, `createDefaultArrivalRules`, `saveArrivalRules`, `getArrivalRules`, `getOrCreateArrivalRules`, `linkEventToOfficialFixture`, `unlinkEventFromOfficialFixture`, `applyEventUserOverride`, `ensureStoragePersistence`, `isStoragePersisted`, `getStorageQuotaEstimate`, `clearAllDatabaseData`.
2. `src/lib/stats/statsEngine.ts` - Fix all TypeScript strict compilation errors (add safe optional chaining / non-null assertions on regex array indexes like `trMatches?.[1]`, `dateParts?.[1]`, etc.).
3. `src/lib/api/associationUrlParser.ts` and `src/lib/api/associationExtractor.ts` - Align / re-export cleanly with `statsEngine.ts` so there is zero drift.
4. `src/lib/stats/statsEngine.test.ts` & `src/lib/storage/db.test.ts` (if applicable) - Ensure test execution succeeds cleanly.
5. Verify:
   - Run `npx tsc --noEmit` -> Must exit 0 with 0 errors.
   - Run `npx vitest run` -> All tests must pass (100%).
   - Run `npm run build` -> Vite production build must succeed.

Document exact command outputs in `c:\dev2\pelipaiva\.agents\sub_orch_m1_worker_2\handoff.md`.
Send completion message via `send_message` when done.
