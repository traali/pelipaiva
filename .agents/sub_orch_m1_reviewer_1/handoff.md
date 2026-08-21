# Reviewer 1 Report: Milestone 1 (M1: Sports Association URL Parser, Extractor & Dexie Persistence)

**Author**: Reviewer 1 (Quality Reviewer & Adversarial Critic)  
**Target Milestone**: Milestone 1 (M1)  
**Project Root**: `c:\dev2\pelipaiva`  
**Working Directory**: `c:\dev2\pelipaiva\.agents\sub_orch_m1_reviewer_1`  
**Verdict**: `REQUEST_CHANGES`  
**Date**: 2026-08-20  

---

## 1. Observation

### 1.1 Scope & Codebase Direct Observations

1. **Test Suite & Type Checking State (`src/lib/stats/statsEngine.test.ts`)**:
   - `src/lib/stats/statsEngine.test.ts` (lines 25–45) imports the following functions from `../storage/db`:
     ```typescript
     import {
       PelipaivaDB,
       saveOfficialTeamData,
       getOfficialFixtures,
       getOfficialFixturesByDateRange, // MISSING in db.ts
       getOfficialStandings,
       getOfficialStandingsRecord,     // MISSING in db.ts
       getTeamRoster,
       deleteOfficialTeamData,         // MISSING in db.ts
       createDefaultArrivalRules,      // MISSING in db.ts
       saveArrivalRules,
       getArrivalRules,
       getOrCreateArrivalRules,        // MISSING in db.ts
       linkEventToOfficialFixture,     // MISSING in db.ts
       unlinkEventFromOfficialFixture,   // MISSING in db.ts
       applyEventUserOverride,         // MISSING in db.ts
       ensureStoragePersistence,
       isStoragePersisted,             // MISSING in db.ts
       getStorageQuotaEstimate,        // MISSING in db.ts
       clearAllDatabaseData            // MISSING in db.ts
     } from '../storage/db';
     ```
   - Direct inspection of `src/lib/storage/db.ts` (lines 1–153) reveals that `db.ts` only exports:
     - `PelipaivaDB`, `db`, `ensureStoragePersistence`, `saveOfficialTeamData`, `getOfficialFixtures`, `getOfficialStandings`, `getTeamRoster`, `saveArrivalRules`, `getArrivalRules`, `saveSyncState`, `getSyncState`.
   - **Result**: `npx tsc --noEmit` and `npx vitest run src/lib/stats/statsEngine.test.ts` will fail to compile due to 11 missing exports in `db.ts`.

2. **Schema & Primary Key Mismatch in `src/lib/storage/db.ts`**:
   - `db.ts` line 55: `leagueStandings: 'teamName'`
     - But in `src/types/matchday.ts` line 252, `LeagueStandingsRecord` defines `id: string` (`${teamId}_${leagueName}`), `teamId: string`, `rows: StandingRow[]`.
     - In `statsEngine.test.ts` line 661: `const standings = await getOfficialStandings('3512345', testDb); expect(standings.length).toBe(6);` expects `getOfficialStandings` to query by `teamId` and return `StandingRow[]`.
     - But `db.ts` line 109 defines `getOfficialStandings(teamName: string)` returning `StandingRow | undefined`.
   - `db.ts` line 56: `teamRosters: 'teamName'`
     - In `statsEngine.test.ts` line 666: `const roster = await getTeamRoster('3512345', testDb);` queries by `teamId`.
     - But `db.ts` line 116 defines `getTeamRoster(teamName: string)`.

3. **Module Duplication & Divergence (`src/lib/api/` vs `src/lib/stats/statsEngine.ts`)**:
   - **`src/lib/api/associationUrlParser.ts` vs `src/lib/stats/statsEngine.ts`**:
     - `src/lib/api/associationUrlParser.ts` (line 34): `pathname.match(/^\/team\/([a-zA-Z0-9_-]+)/i)` uses `[a-zA-Z0-9_-]+`, allowing non-numeric IDs like `/team/hjk-sininen` which violates `statsEngine.test.ts` line 359 (`expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/hjk-sininen')).toBeNull()`).
     - In contrast, `src/lib/stats/statsEngine.ts` (line 108) correctly enforces digits `^\/team\/(\d+)` and correctly parses `tab` from the path.
     - `src/lib/api/associationUrlParser.ts` is missing helper functions present in `statsEngine.ts`: `isAssociationUrl`, `getAssociationName`, `getAssociationShortName`, `getSportName`, `formatCanonicalTeamUrl`, `extractTeamIdFromUrl`, `getAssociationFromUrl`, `inferSportFromSubdomain`, `normalizeUrlString`, `SUBDOMAIN_SPORT_MAP`.
   - **`src/lib/api/associationExtractor.ts` vs `src/lib/stats/statsEngine.ts`**:
     - `src/lib/api/associationExtractor.ts` (line 50) uses crude DST approximation:
       `const isDST = month > 2 && month < 9; // Approx summer time (Apr-Sep)`
       This fails in October (where DST is in effect until the last Sunday) and in late March.
       Furthermore, line 54 returns `utcDate.toISOString()` (UTC timestamp `...Z`), whereas the requirement and test specification require Finnish timezone offset (e.g. `2026-05-24T15:00:00+03:00` / `2026-01-15T18:30:00+02:00`).
     - In contrast, `src/lib/stats/statsEngine.ts` (lines 352–397) implements exact astronomical calculation of the last Sunday of March and October (`getFinnishTimezoneOffset`) and formats proper ISO strings with `+03:00` / `+02:00`.
     - `src/lib/api/associationExtractor.ts` lacks `extractVenueAndField`, `normalizePlayerPosition`, `cleanHtmlText`, `parseHtmlTableRows`, `parseTorneopalHtml`, `generateSyntheticOfficialTeamData`, `extractOfficialTeamData`.

4. **Component Import Alignment**:
   - `src/components/CalendarImportModal.tsx` line 6:
     `import { parseAssociationUrl, getAssociationName } from '../lib/stats/statsEngine';`
   - `src/components/MatchdayCard.tsx` line 21:
     `import { generateOrResolveMatchStats } from '../lib/stats/statsEngine';`
   - The UI components correctly consume the working implementation in `statsEngine.ts`.

---

## 2. Logic Chain

1. **Step 1: Verification of Requirements Conformance in `src/lib/stats/statsEngine.ts`**:
   - ⚽ **Palloliitto**: `tulospalvelu.palloliitto.fi/team/{teamId}` with `\d+` regex, handles sub-tabs (`/fixtures`, `/standings`), query params (`season`, `category`), and canonical URL generation. *(CONFORMS)*
   - 🏑 **Salibandyliitto**: `tulospalvelu.salibandy.fi/team/{teamId}` with `\d+` regex, handles sub-tabs and query params. *(CONFORMS)*
   - 🏀 **Basket.fi**: `basket.fi/basket/sarjat/joukkue/?team_id={teamId}` and `/joukkue/{teamId}`, handles query params in any order. *(CONFORMS)*
   - 🏐 **Torneopal**: `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}` with subdomain sport mapping (`lentopallo` -> `volleyball`, `salibandy` -> `floorball`, `spl`/`jalkapallo`/`futis` -> `football`, `futsal` -> `futsal`, `jaakiekko`/`kiekko` -> `icehockey`, `turnaus` -> `other`). *(CONFORMS)*
   - **HTML Extractor**: Tokenizes HTML tables, matches dynamic headers (`pvm`, `aika`, `koti`, `vieras`, `tulos`, `kenttä`, `o`, `v`, `t`, `h`, `tm`, `pm`, `me`, `p`, `nro`, `nimi`, `paikka`), extracts bracketed/trailing field notations (`(Kenttä 1)`, `TN`), normalizes player positions (`GK`, `DF`, `MF`, `FW`), detects captaincy `(C)`. *(CONFORMS)*
   - **Timezone DST**: Accurately computes Finnish DST transition dates (last Sunday of March to last Sunday of October) and produces offset strings `+03:00` / `+02:00`. *(CONFORMS)*
   - **Synthetic Fallback**: Implements `generateSyntheticOfficialTeamData` for offline resilience. *(CONFORMS)*

2. **Step 2: Verification of Integrity & Façade Checks**:
   - The parser, extractor, tokenizer, and DST algorithms in `statsEngine.ts` contain genuine, robust logic with no hardcoded shortcuts or test evasion.
   - However, having duplicate divergent files in `src/lib/api/` with lower fidelity (`associationUrlParser.ts`, `associationExtractor.ts`) creates confusion and potential maintenance hazards.

3. **Step 3: Storage & Compilation Failure Analysis**:
   - `src/lib/storage/db.ts` was left incomplete and does not match the Dexie v2 specification designed in `.agents/sub_orch_m1_explorer_3/handoff.md`.
   - Because `statsEngine.test.ts` was written to test the complete Dexie v2 interface, the test suite and type check cannot pass until `db.ts` is updated with the missing exports, schema stores, and query helpers.

---

## 3. Caveats

1. **Execution Environment Permission**:
   - Terminal command execution for `npx vitest run` and `npx tsc --noEmit` timed out waiting for interactive prompt approval.
   - Independent verification was performed via strict static code analysis, AST tracing, regex simulation, and cross-file reference inspection.
2. **External Network Requests**:
   - Live HTTP calls to Finnish association servers in browser environments require routing through the Cloudflare Worker streaming CORS proxy (`/api/proxy/ics?url=...`). Offline resilience via synthetic fallback guarantees zero-crash behavior.

---

## 4. Conclusion & Required Changes

### Verdict: `REQUEST_CHANGES`

### Mandatory Actions to Pass M1 Review:

#### Action 1: Complete `src/lib/storage/db.ts`
Update `src/lib/storage/db.ts` to implement the full Dexie v2 schema and export all 11 missing helper functions:
1. **Schema Stores in `version(2)`**:
   ```typescript
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
     await tx.table('events').toCollection().modify((event: MatchdayEvent) => {
       if (!event.reconciliationStatus) {
         event.reconciliationStatus = 'unlinked';
       }
     });
   });
   ```
2. **Export Required CRUD Functions**:
   - `saveOfficialTeamData(teamData: OfficialTeamData, targetDb?: PelipaivaDB): Promise<void>`
   - `getOfficialFixtures(teamId: string, targetDb?: PelipaivaDB): Promise<OfficialLeagueFixture[]>`
   - `getOfficialFixturesByDateRange(teamId: string, startDateIso: string, endDateIso: string, targetDb?: PelipaivaDB): Promise<OfficialLeagueFixture[]>`
   - `getOfficialStandings(teamId: string, targetDb?: PelipaivaDB): Promise<StandingRow[]>`
   - `getOfficialStandingsRecord(teamId: string, leagueName?: string, targetDb?: PelipaivaDB): Promise<LeagueStandingsRecord | undefined>`
   - `getTeamRoster(teamId: string, targetDb?: PelipaivaDB): Promise<TeamSquadRoster | undefined>`
   - `deleteOfficialTeamData(teamId: string, targetDb?: PelipaivaDB): Promise<void>`
   - `createDefaultArrivalRules(profileId: string, defaultSport?: SportType): ArrivalRules`
   - `saveArrivalRules(rules: ArrivalRules, targetDb?: PelipaivaDB): Promise<void>`
   - `getArrivalRules(profileId?: string, targetDb?: PelipaivaDB): Promise<ArrivalRules | undefined>`
   - `getOrCreateArrivalRules(profileId: string, defaultSport?: SportType, targetDb?: PelipaivaDB): Promise<ArrivalRules>`
   - `linkEventToOfficialFixture(eventId: string, officialFixtureId: string, reconciliationStatus?: ReconciliationStatus, mismatchFlags?: MismatchFlags, targetDb?: PelipaivaDB): Promise<void>`
   - `unlinkEventFromOfficialFixture(eventId: string, targetDb?: PelipaivaDB): Promise<void>`
   - `applyEventUserOverride(eventId: string, override: UserOverrideDecision, targetDb?: PelipaivaDB): Promise<void>`
   - `ensureStoragePersistence(): Promise<boolean>`
   - `isStoragePersisted(): Promise<boolean>`
   - `getStorageQuotaEstimate(): Promise<{ usageBytes?: number; quotaBytes?: number; usagePercent?: number }>`
   - `clearAllDatabaseData(targetDb?: PelipaivaDB): Promise<void>`

#### Action 2: Align `src/lib/api/associationUrlParser.ts` and `src/lib/api/associationExtractor.ts`
Either:
- Re-export the authoritative implementations from `src/lib/stats/statsEngine.ts` in `src/lib/api/associationUrlParser.ts` and `src/lib/api/associationExtractor.ts`, OR
- Replace the stub files in `src/lib/api/` with the complete, production-grade parser and extractor implementations and import them in `statsEngine.ts`.

---

## 5. Verification Method

Once the changes in `db.ts` and `src/lib/api/` are applied, run:
```bash
# 1. Typecheck: Must pass with 0 errors
npx tsc --noEmit

# 2. Stats Engine & Storage Unit Tests: Must pass 100%
npx vitest run src/lib/stats/statsEngine.test.ts

# 3. Complete Test Suite: Must pass 100%
npm test
```

---

## Mandatory Self-Review

Self-review: This review output strictly adheres to Antigravity Global Rules (§1 Quality & Verification Philosophy, §5 Agent Output Discipline, §6 Long-Term Memory Protocol) and Reviewer/Critic workflow guidelines. All findings are strictly evidence-based with exact line numbers, verified contracts, and actionable fix blueprints. No implementation modifications were made to `src/` files directly, honoring the review-only constraint.
