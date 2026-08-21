# Specification Mining & Codebase Survey Report: R2.7, R3 & Quality Gates

**Agent:** `survey_spec_miner_3` (`teamwork_preview_spec_miner`)  
**Working Directory:** `c:\dev2\pelipaiva\.agents\survey_spec_miner_3`  
**Date:** 2026-08-20  
**Target Project:** `c:\dev2\pelipaiva` (Pelipäivä)  
**Assigned Scope:**
1. **R2.7:** Fuzzy Match & Conservative Reconciliation Engine (Auto-linking criteria ±3h, non-merging of low-confidence/conflicts, multi-language naming FI/SV/EN, informal abbreviations).
2. **R3:** Visual Mismatch & Conflict Diagnostics (Before/after timestamps, venue/opponent diffs, 1-tap sync/override actions).
3. **Test Suite & Quality Gates:** Vitest test suite inventory, missing coverage across Tiers 1–4, TypeScript configuration, type checking, build pipeline.

---

## 1. Observation

### 1.1 Existing Codebase & Implementation State

1. **Calendar Parser (`src/lib/calendar/icsParser.ts`, lines 1–143):**
   - Implements `isTrainingEvent(title, description)` (lines 8–33) identifying practice sessions (`harjoitukset`, `treenit`, `fysiikka`, `lajivuoro`, `aamujää`, etc.).
   - Implements `parseICSFeed(icsContent, profileId, sport)` (lines 39–142) converting RFC 5545 iCalendar data via `ical.js`.
   - Extracts opponents using rudimentary string splitting on delimiters `[' vs ', ' - ', ' v ', ' @ ']` (lines 90–105).
   - **Observation:** There is *zero* fuzzy matching, zero tokenization, zero multi-language alias normalization (e.g. `Sininen`/`Blå`/`Blue`), and *no* reconciliation against official Torneopal or association fixtures.

2. **Types & Data Model (`src/types/matchday.ts`, lines 1–244):**
   - Defines `SportType`, `EventType`, `VenueInfo`, `WeatherCondition`, `LightningSafetyAlert`, `ParkingInfo`, `PlayerProfile`, `FullMatchStats`, `MatchdayBriefing`, and `MatchdayEvent`.
   - `MatchdayBriefing` contains `conflictWarning?: string;` (line 218).
   - **Observation:** `MatchdayEvent` lacks fields for fixture reconciliation, e.g.:
     - `torneopalMatchId?: string`
     - `reconciliationStatus?: 'auto_matched' | 'manual_matched' | 'conflict_mismatch' | 'unlinked'`
     - `confidenceScore?: number`
     - `mismatches?: { timeDiffMinutes?: number; officialStartTime?: string; officialVenue?: VenueInfo; officialOpponent?: string }`
     - `userDecision?: 'use_official' | 'keep_calendar_notes' | 'split'`

3. **Deterministic AI Reasoner (`src/lib/ai/deterministicReasoner.ts`, lines 60–84):**
   - Implements conflict detection across sibling profiles (`overlapping.length > 0 && overlapping[0]`) returning `⚠️ AIKATAULURUUHKI: Peli menee päällekkäin tapahtuman "${overlapping[0].title}" kanssa!` (line 82).
   - **Observation:** This only checks calendar overlap between different family members; it does *not* detect or diagnose mismatches between a calendar entry and an official league fixture.

4. **UI Components (`src/components/MatchdayCard.tsx`, lines 84–89, 127–141, 144–170):**
   - Renders `event.briefing.conflictWarning` in a yellow pill for schedule overlaps.
   - Renders kickoff and warmup time as static text or live badge (`KÄYNNISSÄ`).
   - Renders venue and opponent as static strings.
   - **Observation:** There are no UI components for:
     - Before/after timestamp diff (e.g., `Nimenhuuto: 15:00 ➔ Torneopal: 15:30`).
     - Venue discrepancy badge (e.g., `Kalenteri: Puotila Bubu ➔ Palloliitto: Töölön PK 2`).
     - 1-tap resolution action buttons ("Käytä virallista aikaa", "Säilytä omat muistiinpanot", "Pidä erillisinä").

5. **Storage Schema (`src/lib/storage/db.ts`, lines 21–36):**
   - Dexie database `PelipaivaDB` contains tables: `profiles`, `events`, `venuePins`, `syncState`.
   - Table `events` is keyed on `id` with indices `id, profileId, sport, startTime, [profileId+startTime]`.
   - **Observation:** No dedicated tables or indexes exist for official league fixtures (`officialFixtures`), team subscriptions, or reconciliation audit records.

---

### 1.2 Test Suite Execution & Quality Verification

1. **Vitest Test Suite Run (`vitest run`):**
   - Executed command: `npm test`
   - Output:
     ```
     RUN  v4.1.11 C:/dev2/pelipaiva
     Test Files  7 passed (7)
          Tests  22 passed (22)
       Start at  08:04:50
       Duration  2.35s
     ```
   - Test files inventory:
     1. `src/lib/ai/deterministicReasoner.test.ts` (4 tests) — Footwear recommendation rules & sibling schedule conflict.
     2. `src/lib/calendar/icsParser.test.ts` (2 tests) — Training vs match detection, ICS parsing.
     3. `src/lib/geo/sportsGeocoder.test.ts` (2 tests) — Finnish field slang resolution & alias dictionary size.
     4. `src/lib/parking/parkingEaseEngine.test.ts` (3 tests) — Tieliikennelaki 2020 parking disc rounding, ease scores.
     5. `src/lib/stats/statsEngine.test.ts` (3 tests) — Full match stats generation, division rosters, floorball league names.
     6. `src/lib/weather/lightningSafety.test.ts` (3 tests) — 30/30 rule lightning safety machine.
     7. `src/lib/weather/radarSatelliteEngine.test.ts` (5 tests) — FMI radar, EUMETSAT URLs, loop timestamps, layer metadata.

2. **TypeScript Strict Type Check (`npx tsc --noEmit`):**
   - Executed command: `npx tsc --noEmit`
   - Result: **0 errors** (Exit code 0).

3. **Production Build (`npm run build`):**
   - Executed command: `npm run build` (`tsc -b && vite build`)
   - Output:
     ```
     vite v6.4.3 building for production...
     ✓ 2286 modules transformed.
     dist/assets/index-Bk8adlky.css            41.29 kB │ gzip:  7.54 kB
     dist/assets/index-DE8M5j3b.js            337.71 kB │ gzip: 98.20 kB
     ✓ built in 6.66s
     ```
   - Result: **Build succeeds cleanly** (Exit code 0).

---

## 2. Features Discovered Table & Edge Cases Table

### 2.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R2.7 Reconciliation | Conservative Fuzzy Match Engine | Auto-matches calendar events with Torneopal/association league fixtures when date matches, time is within ±3h, and opponent similarity >= 0.85 | Calendar event + Official fixture list | `ReconciliationResult` (matched, candidate, or unlinked) | Returns separate unmerged entries when confidence < 0.85 | `ORIGINAL_REQUEST.md` §R2.7 |
| 2 | R2.7 Reconciliation | Multilingual & Alias Token Normalizer | Strips prefixes/suffixes, normalizes team colors across FI (`Sininen`), SV (`Blå`), EN (`Blue`), normalizes age tags (`T13`, `P11`, `U14`), and maps Finnish club slang abbreviations (`HJK`, `KäPa`, `GrIFK`, `PPJ`, `VJS`, `ErVi`) | Raw team title strings | Normalized token set and canonical club ID | Falls back to exact normalized string comparison | `ORIGINAL_REQUEST.md` §R2.1, §R2.4, §R2.7 |
| 3 | R2.7 Reconciliation | Time-Window ±3h Warmup Compensator | Disentangles warmup/gathering start time (e.g. 14:15 in Nimenhuuto) from official kickoff (15:00 in Torneopal) | Start timestamps from both sources | Time offset delta in minutes + confidence modifier | Flags large delta (>180 min) as distinct event | `ORIGINAL_REQUEST.md` §R2.3, §R2.7 |
| 4 | R2.7 Reconciliation | Non-Destructive Event Isolation | Never overwrites or merges ambiguous/conflicting entries destructively; preserves both calendar event and league fixture | List of unconfirmed or conflicting fixtures | Preserved separate entries with proposed resolution links | Safely renders both in timeline without data loss | `ORIGINAL_REQUEST.md` §R2.7, Acceptance Criteria |
| 5 | R3 Diagnostics | Visual Timestamp Mismatch Banner | Displays clear visual diff between calendar time and official association kickoff (e.g. `Nimenhuuto: 15:00 ➔ Torneopal: 15:30`) | Linked event with `timeDiffMinutes != 0` | Rendered before/after time diff badge on card | Suppressed when times match within tolerance | `ORIGINAL_REQUEST.md` §R3, Acceptance Criteria |
| 6 | R3 Diagnostics | Venue Discrepancy Warning | Detects when official assigned pitch differs from calendar location (e.g. `Puotila Bubu` vs `Töölön PK 2`) | Geocoded venue coordinates & names | Visual warning pill with venue comparison | Highlighted as potential venue change/relocation | `ORIGINAL_REQUEST.md` §R3, Acceptance Criteria |
| 7 | R3 Diagnostics | 1-Tap Conflict Resolution Actions | Provides quick 1-tap user actions to adopt official league data, retain private notes, or unlink | User click on resolution button | Updated Dexie event state + toast confirmation | Logs resolution to storage; reversible | `ORIGINAL_REQUEST.md` §R3, Acceptance Criteria |
| 8 | R4 Arrival Rules | Configurable Warmup & Departure Offsets | Dynamic warmup arrival offsets (e.g. 45 min home, 60 min away, 15 min training) | Profile settings + match venue | Computed warmup timestamp and departure countdown | Falls back to 45m match / 15m training defaults | `ORIGINAL_REQUEST.md` §R4, `src/lib/calendar/icsParser.ts` |
| 9 | R2.5 Duties | Talkoovahti Volunteer Window Parsing | Detects `☕ Kahviovuoro`, `⏱️ Toimitsijavuoro`, `🛡️ Järkkäri`, `📝 Kirjuri/Kello` with specific duty hours | Description string | Duty badge and schedule injection | Fallback to generic title tag | `src/lib/calendar/icsParser.ts:69-80` |

### 2.2 Edge Cases

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| 1 | Fuzzy Match | Tournament with 4 mini-matches on same day at same venue | Must match individual fixtures by opponent tokens, NOT merge all into one event. |
| 2 | Multilingual Naming | `HJK T13 Sininen` vs `HJK F13 Blå` vs `HJK T-13 Blue` | Normalizer extracts Club=`HJK`, Gender=`T/F`, Age=`13`, Color=`Sininen/Blå/Blue` -> Similarity = 1.0. |
| 3 | Sibling Schedule Conflict | Two kids playing at different venues at exact same time | `deterministicReasoner` triggers `AIKATAULURUUHKI` warning banner on both cards. |
| 4 | Postponed / Rescheduled Match | Calendar has old Saturday date, Torneopal has new Sunday date | Date mismatch (>24h delta) flags candidate match with explicit "Peli siirretty sunnuntaille!" diagnostic banner. |
| 5 | Warmup vs Kickoff Offset | Calendar starts 14:15, Torneopal starts 15:00 (45m diff) | Fuzzy matcher identifies as high confidence match (within ±3h window); flags 45m warmup offset rather than conflict. |
| 6 | Informal Pitch Slang | "Bubu", "Väiski", "Kisis", "Mosahalli", "Braku" | `sportsGeocoder` resolves to official LIPAS venue and surface type accurately. |

---

## 3. Deep Dive: Logic Chain & Gap Analysis

### 3.1 R2.7: Fuzzy Match & Conservative Reconciliation Engine

```
[Observation 1.1.1] icsParser.ts only performs rudimentary split on ' vs ' or ' - '.
[Observation 1.1.2] MatchdayEvent type has no reconciliation state or match confidence.
[Observation 1.1.5] No official association fixture store or matching algorithm exists in src/lib/.
        │
        ▼ (Inference Step 1)
The application currently operates solely on raw calendar feeds without cross-referencing official Palloliitto/Salibandyliitto/Basket.fi/Torneopal league data.
        │
        ▼ (Inference Step 2)
To fulfill R2.7, an independent reconciliation module (`reconciliationEngine.ts` and `teamNameMatcher.ts`) must be introduced with:
1. Multi-language token normalizer:
   - Club roots: 'hjk', 'käpa', 'grifk', 'honka', 'vjs', 'ppj', 'ervi', 'tips', 'fcfj', 'ilves', etc.
   - Squad colors: FI ('sininen', 'valkoinen', 'musta', 'keltainen', 'punainen'), SV ('blå', 'vit', 'svart', 'gul', 'röd'), EN ('blue', 'white', 'black', 'yellow', 'red').
   - Level tags: 'kilpa', 'haaste', 'harraste', 'edustus', 'akatemia', 'yj' (yhteisjoukkue), '1', '2', 't1', 't2'.
   - Age categories: 't13', 'p11', 'u14', 'b-tytöt', 'p12', '2013', '2014'.
2. Scoring algorithm:
   - `dateScore`: 1.0 if exact same calendar day (EET/EEST normalized), 0.5 if ±1 day (rescheduled candidate), 0.0 otherwise.
   - `timeScore`: 1.0 if |time_cal - time_league| <= 90 min (warmup difference), 0.7 if <= 180 min (±3h window), 0.0 if > 180 min.
   - `opponentScore`: Jaccard token similarity + Levenshtein / soundex on club root.
   - `totalConfidence = (dateScore * 0.4) + (timeScore * 0.2) + (opponentScore * 0.4)`.
3. Conservative Thresholds:
   - `totalConfidence >= 0.85` ➔ Auto-link (`reconciliationStatus: 'auto_matched'`).
   - `0.50 <= totalConfidence < 0.85` ➔ Suggested Match (`reconciliationStatus: 'candidate_match'`).
   - `totalConfidence < 0.50` ➔ Keep Separate (`reconciliationStatus: 'unlinked'`).
```

### 3.2 R3: Visual Mismatch & Conflict Diagnostics

```
[Observation 1.1.3] deterministicReasoner only generates sibling overlap warnings.
[Observation 1.1.4] MatchdayCard renders static kickoff/venue and lacks before/after diff UI or 1-tap actions.
        │
        ▼ (Inference Step 1)
When an event is linked to an official league fixture, discrepancies can arise:
- Time mismatch: Calendar feed was set to warmup time or outdated kickoff vs official Torneopal time.
- Date mismatch: Match was postponed or rescheduled by the league.
- Venue mismatch: Match moved from grass to artificial turf or another venue.
- Opponent mismatch: Team name in calendar was informal ("Honka") vs official registered name ("FC Honka Musta 2").
        │
        ▼ (Inference Step 2)
To fulfill R3, the following UI and diagnostic features are required:
1. `MismatchDiagnosticPill` / `BeforeAfterDiff` component in `MatchdayCard.tsx`:
   - Visual before/after pill: `Nimenhuuto klo 15:00 ➔ Palloliitto klo 15:30 (Kickoff)`
   - Visual venue diff: `📍 Kalenteri: Puotila Bubu ➔ 🏟️ Virallinen: Töölön PK 2`
2. 1-Tap Action Bar on Mismatches:
   - Button 1: `✨ Ota virallinen aika & kenttä` (Adopts official league start time and geocoded venue, updating Dexie record).
   - Button 2: `📝 Säilytä kalenterin merkintä` (Dismisses warning, preserves custom calendar notes/warmup time).
   - Button 3: `🔗 Erota erillisiksi` (Unlinks fixture, keeping both as separate calendar entries).
```

### 3.3 Quality Gates & Vitest Test Coverage Gap Analysis (Tiers 1–4)

```
[Observation 1.2.1] Vitest runs 7 test files with 22 unit tests, covering AI reasoning, basic ICS parsing, geocoding, parking disc logic, stats engine, and weather/radar.
[Observation 1.2.2] TypeScript strict typecheck passes with 0 errors.
[Observation 1.2.3] Production build compiles with Vite in 6.66s without errors.
        │
        ▼ (Inference Step 1)
The project has solid foundational unit tests for ancillary features (parking, weather, stats, footwear), but lacks tests for the core business logic in R1, R2.7, R3, and R4.
        │
        ▼ (Inference Step 2)
Test Suite Coverage Matrix across Tiers 1–4:
```

| Tier | Area | Existing Test Coverage | Missing / Target Test Coverage |
|---|---|---|---|
| **Tier 1 (Unit)** | URL Parsers (R1) | None | Unit tests for Palloliitto, Salibandyliitto, Basket.fi, and Torneopal team URL parsing & ID extraction. |
| **Tier 1 (Unit)** | Fuzzy Matcher (R2.7) | None | Unit tests for team token normalizer (FI/SV/EN colors, age tags), Jaccard similarity, and ±3h time window. |
| **Tier 1 (Unit)** | Reconciliation Engine (R2.7) | None | Unit tests for high confidence auto-link, low-confidence non-merge, and candidate matching. |
| **Tier 1 (Unit)** | Mismatch Detector (R3) | None | Unit tests for kickoff time delta detection, venue divergence detection, and opponent naming diffs. |
| **Tier 1 (Unit)** | Talkoovahti & Arrival (R4) | Partial (1 test for basic duty in `icsParser.test.ts`) | Comprehensive duty time window extraction and configurable warmup offset tests. |
| **Tier 2 (Integration)** | Storage & Dexie DB | None | Integration tests for saving official fixtures, linked event state mutations, and persistent offline queries. |
| **Tier 2 (Integration)** | Sync & 1-Tap Resolution | None | Integration tests verifying that 1-tap "Adopt League Data" updates time/venue without erasing user notes. |
| **Tier 3 (Component/UX)**| Mismatch UI & Badges | None | Component tests for `MatchdayCard` mismatch banner rendering, before/after timestamp diffs, and button clicks. |
| **Tier 4 (E2E / Smoke)**| End-to-End Workflow | None | Smoke test for importing an ICS feed + Torneopal URL, reconciling fixtures, and resolving a mismatch. |

---

## 4. Caveats

1. **Live Network APIs:** Tests must use deterministic mock fixtures or recorded HTTP responses for Torneopal, Palloliitto, LIPAS, and FMI to ensure deterministic offline execution without network flakiness.
2. **CORS Edge Proxy:** Real-time ICS calendar ingestion from external domains (`nimenhuuto.com`, `myclub.fi`, `jopox.fi`) in the browser requires the Cloudflare Worker streaming proxy (`cloudflare-worker/worker.ts`), which is already deployed at `https://pelipaiva-edge.sakkoja.workers.dev`.
3. **Local-First Privacy:** All reconciliation state and user decisions must remain 100% in IndexedDB (Dexie) without transmitting private calendar notes to external servers.

---

## 5. Conclusion

1. **R2.7 (Fuzzy Match & Reconciliation Engine):**
   - The current codebase parses single ICS calendar events but lacks team name normalization, ±3h time-window tolerance matching, and conservative reconciliation logic against official league fixtures.
   - An isolated, deterministic `reconciliationEngine.ts` and `teamNameMatcher.ts` should be built with multilingual color tokens (FI/SV/EN), club abbreviation dictionaries, age group extractors, and strict confidence thresholds (>=0.85 auto-link, 0.50–0.84 candidate, <0.50 keep separate).

2. **R3 (Visual Mismatch & Conflict Diagnostics):**
   - The UI currently only flags sibling family schedule overlaps.
   - It needs explicit before/after diff UI (`Nimenhuuto: 15:00 ➔ Torneopal: 15:30`), venue difference indicators, and 1-tap interactive resolution buttons ("Ota virallinen aika", "Säilytä omat muistiinpanot", "Pidä erillisinä") directly on the `MatchdayCard`.

3. **Test Suite & Quality Gates:**
   - Vitest suite currently runs **7 test files / 22 tests** with 100% pass rate.
   - TypeScript strict check has **0 errors**.
   - Production build succeeds cleanly.
   - New unit tests (Tier 1) and integration tests (Tier 2) must be added for URL parsing, team token normalization, reconciliation scoring, mismatch detection, and 1-tap resolution state transitions.

---

## 6. Verification Method

To independently verify all findings in this report:

1. **Verify Test Suite (7 test files, 22 passed):**
   ```bash
   npm test
   ```
2. **Verify TypeScript Strict Types (0 errors):**
   ```bash
   npx tsc --noEmit
   ```
3. **Verify Production Build (Success):**
   ```bash
   npm run build
   ```
4. **Inspect Source Files:**
   - `src/lib/calendar/icsParser.ts`
   - `src/types/matchday.ts`
   - `src/components/MatchdayCard.tsx`
   - `src/lib/ai/deterministicReasoner.ts`
