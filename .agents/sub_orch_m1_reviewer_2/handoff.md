# Handoff Report — Reviewer 2 (Milestone 1)

**Milestone**: M1: Sports Association URL Parser, Extractor & Dexie Persistence  
**Reviewer**: Reviewer 2 (Reviewer & Adversarial Critic)  
**Date**: 2026-08-20T08:21:00+03:00  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Build & Static Analysis (`npm run build`)
Command executed: `npm run build` (`tsc -b && vite build`)  
**Result**: Build FAILED with exit code 1 and 30+ TypeScript compilation errors in `src/lib/stats/statsEngine.ts`.

Verbatim errors:
```
src/lib/stats/statsEngine.ts(383,24): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/lib/stats/statsEngine.ts(384,26): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/lib/stats/statsEngine.ts(409,23): error TS2532: Object is possibly 'undefined'.
src/lib/stats/statsEngine.ts(420,21): error TS2532: Object is possibly 'undefined'.
src/lib/stats/statsEngine.ts(493,30): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/lib/stats/statsEngine.ts(530,13): error TS18048: 'row' is possibly 'undefined'.
src/lib/stats/statsEngine.ts(532,41): error TS18048: 'row' is possibly 'undefined'.
src/lib/stats/statsEngine.ts(542,25): error TS18048: 'matchCode' is possibly 'undefined'.
src/lib/stats/statsEngine.ts(603,13): error TS18048: 'row' is possibly 'undefined'.
src/lib/stats/statsEngine.ts(605,31): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/lib/stats/statsEngine.ts(653,13): error TS18048: 'row' is possibly 'undefined'.
src/lib/stats/statsEngine.ts(667,21): error TS18048: 'rawName' is possibly 'undefined'.
```

### 1.2 Automated Test Suite (`npx vitest run`)
Command executed: `npx vitest run`  
**Result**: 8 test suites failed, 7 individual tests failed out of 27 test files (122 passed, 7 failed):

1. **`src/lib/stats/statsEngine.test.ts`**:
   ```
   FAIL src/lib/stats/statsEngine.test.ts
   Error: Cannot find package 'fake-indexeddb/auto' imported from C:/dev2/pelipaiva/src/lib/stats/statsEngine.test.ts
   ```
   `package.json` contains `"fake-indexeddb": "^6.0.0"` in `devDependencies`, but `fake-indexeddb` is not present in `node_modules`.

2. **`tests/e2e/tier1_features/f05_official_fixtures_ingestion.test.ts`**:
   ```
   FAIL tests/e2e/tier1_features/f05_official_fixtures_ingestion.test.ts
   AssertionError: expected undefined to be defined
     94| expect(data.roster).toBeDefined();
   ```
   In `src/lib/api/associationExtractor.ts`, `extractRosterFromHtml` lines 306-321 requires specific attributes (`player-row`, `player-name`, `jersey-number`, `pos`), failing to parse standard Torneopal player table rows (`<table class="pelaajataulukko"><tr><td>3</td><td>...</td>`).

3. **`src/lib/calendar/icsParser.test.ts`**:
   ```
   AssertionError: expected '☕ Kahviovuoro (klo 14:30 - 16:00)' to be '☕ Kahviovuoro'
   ```
   Discrepancy between Talkoovahti time-window tag generation and unit test expectation.

4. **`tests/e2e/tier1_features/f08_event_type_classification.test.ts`**:
   ```
   AssertionError: expected false to be true
     38| expect(isTrainingEvent('Kokoontuminen ja pelipalaveri')).toBe(true);
   ```

5. **`tests/e2e/tier1_features/f09_dual_timestamp_dst.test.ts`**:
   ```
   AssertionError: expected undefined to be defined
     52| expect(springEvent).toBeDefined();
   ```

6. **`tests/e2e/tier1_features/f10_multi_squad_separation.test.ts`**:
   ```
   AssertionError: expected 'harjoitukset / treenit (sininen & valkoinen)' not to contain 'valkoinen'
   ```

### 1.3 Dexie Version 2 Persistence & ACID Transaction Integrity (`src/lib/storage/db.ts`)
- **Schema & Indexes**: `PelipaivaDB` defines Version 2 with 8 stores (`profiles`, `events`, `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`, `venuePins`, `syncState`) and compound indexes (`[teamId+startTime]`, `[profileId+startTime]`).
- **ACID Transaction Violation**: `saveOfficialTeamData` in `src/lib/storage/db.ts` lines 120-159 performs separate sequential async writes across `officialFixtures`, `leagueStandings`, and `teamRosters` without wrapping them in `await targetDb.transaction('readwrite', ...)`. If any subsequent write fails, data integrity is compromised.

### 1.4 Architectural Duplication & Contract Drift
- `parseAssociationUrl` is implemented in duplicate in `src/lib/api/associationUrlParser.ts` and `src/lib/stats/statsEngine.ts`.
- `CalendarImportModal.tsx` imports from `../lib/stats/statsEngine` instead of canonical `../lib/api/associationUrlParser`.
- HTML table parsing logic exists in two divergent forms: `src/lib/api/associationExtractor.ts` vs `src/lib/stats/statsEngine.ts`.

---

## 2. Logic Chain

1. **Premise 1 (Acceptance Criteria & Mandate)**: `ORIGINAL_REQUEST.md` and Milestone 1 mandate 100% test pass rate on all automated tests (`npm test`), 0 TypeScript strict compiler errors (`npx tsc --noEmit` / `npm run build`), and ACID transactional persistence in `saveOfficialTeamData`.
2. **Premise 2 (Build Failure)**: Running `npm run build` produces 30+ TypeScript type errors in `src/lib/stats/statsEngine.ts` caused by `undefined` indexing and missing strict type guards.
3. **Premise 3 (Test Failures)**: Running `npx vitest run` results in 8 failed test suites / 7 failing tests, including `Cannot find package 'fake-indexeddb/auto'` in `statsEngine.test.ts` and HTML parser failures in `associationExtractor.ts`.
4. **Premise 4 (ACID Integrity Violation)**: `saveOfficialTeamData` in `src/lib/storage/db.ts` removed atomic transaction encapsulation, leaving database writes vulnerable to partial state corruption.
5. **Conclusion**: Because the code fails strict build verification, fails the automated test suite, contains architectural duplication, and violates transactional integrity requirements, the verdict must be **REQUEST_CHANGES**.

---

## 3. Caveats

- No caveats. All core files and test targets were directly inspected and verified via local tool execution.

---

## 4. Conclusion & Required Fixes

**Verdict**: **REQUEST_CHANGES**

### Actionable Fixes Required:
1. **Fix TypeScript Type Errors in `src/lib/stats/statsEngine.ts`**:
   - Add null checks and safe fallbacks for optional regex matches, table rows, and array access to satisfy `noUncheckedIndexedAccess`.
   - Ensure `npm run build` passes with 0 errors.
2. **Fix Test Suite Imports & HTML Extractor**:
   - In `src/lib/stats/statsEngine.test.ts`, replace `import 'fake-indexeddb/auto'` with the project's in-memory Dexie test harness `tests/helpers/setupDexie.ts` (or ensure `fake-indexeddb` is installed in `node_modules`).
   - In `src/lib/api/associationExtractor.ts`, relax `extractRosterFromHtml` to parse `<tr>` rows within `<table>` or `<section>` even when explicit class names like `player-row` are absent.
   - Align `src/lib/calendar/icsParser.test.ts` with Talkoovahti volunteer duty time window formatting.
3. **Restore ACID Transaction in `saveOfficialTeamData` (`src/lib/storage/db.ts`)**:
   - Wrap the writes to `officialFixtures`, `leagueStandings`, and `teamRosters` inside `await targetDb.transaction('readwrite', [targetDb.officialFixtures, targetDb.leagueStandings, targetDb.teamRosters], async () => { ... })`.
4. **Eliminate Duplication**:
   - Unify URL parsing and HTML extraction between `src/lib/api/` and `src/lib/stats/` to maintain a single source of truth.

---

## 5. Verification Method

To verify the resolved work:
1. Run strict production build:
   ```bash
   npm run build
   ```
   Must exit with code 0.
2. Run full test suite:
   ```bash
   npx vitest run
   ```
   Must achieve 100% pass rate across all test files.
3. Inspect `src/lib/storage/db.ts` to confirm `targetDb.transaction(...)` wraps all writes in `saveOfficialTeamData`.
