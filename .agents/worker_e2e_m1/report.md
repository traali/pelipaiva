# Milestone Report: E2E-M1 (Tier 1 Feature Coverage Tests 1–19)

**Target:** `c:\dev2\pelipaiva`  
**Milestone:** E2E-M1  
**Status:** Completed (100% Pass Rate, 0 TypeScript Errors, Production Build Successful)  
**Date:** 2026-08-20  

---

## 1. Executive Summary

Milestone E2E-M1 establishes comprehensive Feature Coverage (Tier 1) testing across all 19 core features of Pelipäivä.
All 19 test files were created in `tests/e2e/tier1_features/`, with each file containing 5 distinct test cases (total 95 Tier 1 test cases).
In addition, all required underlying modules were created or enhanced in `src/` to satisfy the interface contracts specified in `PROJECT.md`.

### Final Test Execution Metrics
- **Total Test Files:** 27 passed (0 failed)
- **Total Test Cases:** 182 passed (0 failed)
- **Tier 1 Feature Tests:** 19 files, 95 tests (100% passing)
- **Harness & Helper Tests:** 1 file, 15 tests (100% passing)
- **Core Domain Unit Tests:** 7 files, 72 tests (100% passing)
- **Execution Time:** ~1.96 seconds (total test execution)
- **TypeScript Typecheck:** `tsc -b` / `npx tsc --noEmit` exits with **0 errors**.
- **Production Build:** `npm run build` succeeds cleanly in **5.29 seconds**.

---

## 2. Tier 1 Test Suite Inventory (Features 1–19)

| # | Test File | Feature Name | Tests | Key Areas Tested |
|---|-----------|--------------|-------|------------------|
| 1 | `f01_palloliitto_url.test.ts` | Palloliitto Team URL Parser | 5 | Standard URL parsing, query params (`season`, `category`, `tab`), canonical URLs, protocol trimming, invalid path rejection |
| 2 | `f02_salibandy_url.test.ts` | Salibandyliitto Team URL Parser | 5 | Floorball URL parsing, series query extraction, trailing slash handling, non-team URL rejection, association detection |
| 3 | `f03_basket_url.test.ts` | Basket.fi Team URL Parser | 5 | Basketball URL parsing (`team_id`), subpaths (`/joukkue/{id}`), query params (`season_id`, `league_id`), invalid path rejection |
| 4 | `f04_torneopal_url.test.ts` | Torneopal Team URL Parser | 5 | Multi-sport detection by subdomain (volleyball, futsal, floorball, basket, football), parameter aliases (`joukkue`, `team`, `team_id`) |
| 5 | `f05_official_fixtures_ingestion.test.ts` | Official Fixtures & Standings Ingestion | 5 | Offline HTML parsing (fixtures, standings, rosters) across Palloliitto, Salibandy, Basket.fi, Torneopal, and mock fetch |
| 6 | `f06_dexie_schema_v2.test.ts` | Dexie Schema Version 2 Persistence | 5 | Dexie tables (`officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`, `syncState`), transactional saves, compound indexing |
| 7 | `f07_title_permutations.test.ts` | Complex Title Permutations | 5 | Standard vs, hyphenated `HJK-EPS peli`, embedded venue `Peli @ Bubu vs Honka`, round details `Ottelu: VJS - PPJ (Kierros 4)`, Swedish/Friendly |
| 8 | `f08_event_type_classification.test.ts` | Event Type Classification | 5 | Match (vs/ottelu), training (Harjoitukset/Treenit/Fysiikka/Lajivuoro/Aamujää/Träning), meeting (Vanhempainilta/Palaveri), tournament (Turnaus/Pelitapahtuma) |
| 9 | `f09_dual_timestamp_dst.test.ts` | Dual Timestamp & DST Disentanglement | 5 | Warmup DTSTART (14:15) vs kickoff (15:00), default training/match offsets, real-world DST transition parsing across EET and EEST |
| 10 | `f10_multi_squad_separation.test.ts` | Multi-Squad Feed Separation | 5 | Detection of squads (Sininen, Valkoinen, Musta, Kilpa, Haaste), filtering ICS by squad, parsing isolated single-squad matchday events |
| 11 | `f11_talkoovahti_duties.test.ts` | Talkoovahti Volunteer Duty Windows | 5 | Duty role extraction (Kahviovuoro, Toimitsija, Kirjuri/Kello, Järkkäri/Liivimies, Kioski, Makkaranpaisto) and exact time windows (`klo 14:30 - 16:00`) |
| 12 | `f12_pitch_nicknames.test.ts` | 100+ National Pitch Slang Nicknames | 5 | Resolution of 100+ Finnish pitch nicknames (Bubu, Väiski, Sahara, Bollis, Kupla, Kisis, Mosahalli, Kauppi, Kupittaa, etc.), coordinates, surface types |
| 13 | `f13_arrival_rules.test.ts` | Configurable Arrival Rules | 5 | Dynamic warmup offsets (home 45m, away 60m, training 15m, tournament 30/40m), departure countdowns, volunteer duty buffer (+15m) |
| 14 | `f14_fuzzy_reconciliation.test.ts` | Conservative Fuzzy Match & Reconciliation | 5 | Auto-link on date + ±3h time window + opponent similarity (>=0.85), candidate matches (0.60-0.84), unlinking non-matches and training sessions |
| 15 | `f15_multilingual_tokens.test.ts` | Multilingual & Alias Token Normalizer | 5 | Normalization of FI/SV/EN colors (Sininen/Blå/Blue, Valkoinen/Vit/White), age tags (T13/P11/F08/U14), club aliases (HJK, KäPa, GrIFK, ErVi, TiPS, VJS) |
| 16 | `f16_timestamp_diagnostics.test.ts` | Visual Timestamp Mismatch Diagnostics | 5 | Detection of kickoff discrepancies (diff >= 5 min), before/after timestamp strings, tolerance for minor skews, large delay handling |
| 17 | `f17_venue_diagnostics.test.ts` | Visual Venue & Opponent Diagnostics | 5 | Venue divergence detection between calendar and official pitch, opponent mismatch detection, combined multi-variable diagnostic flags |
| 18 | `f18_conflict_resolution.test.ts` | 1-Tap Conflict Resolution Actions | 5 | `use_official` (adopt official time/venue), `keep_calendar` (retain private calendar notes), `unlink` (sever match link), audit logging |
| 19 | `f19_onboarding_import_flow.test.ts` | UI Integration & Onboarding/Import Flow | 5 | Full end-to-end flow: URL parse -> fetch official fixtures -> import ICS -> split squad -> reconcile -> save to Dexie; multi-sport support |

---

## 3. Implemented Modules & Architecture Conformity

1. `src/lib/api/associationUrlParser.ts`:
   - `parseAssociationUrl(rawUrl)`
   - `detectAssociationType(rawUrl)`
   - `normalizeAssociationUrl(rawUrl)`
   - Full support for Palloliitto, Salibandyliitto, Basket.fi, Torneopal (*.torneopal.fi).

2. `src/lib/api/associationExtractor.ts`:
   - `extractFixturesFromHtml(html, parsedUrl)`
   - `extractStandingsFromHtml(html)`
   - `extractRosterFromHtml(html)`
   - `fetchOfficialTeamData(parsedUrl, customFetch)`

3. `src/lib/calendar/icsParser.ts`:
   - `parseMatchTitle(rawTitle, defaultTeamName)`
   - `classifyCalendarEvent(title, description)`
   - `resolveEventTimes(dtStart, dtEnd, title, description, isTraining, defaultWarmupOffsetMins)`
   - `extractVolunteerDuty(summary, description)`
   - `detectSquadGroups(icsContent)`
   - `splitICSBySquad(icsContent, squadName)`
   - `parseICSFeed(icsContent, profileId, sport)`

4. `src/lib/geo/sportsGeocoder.ts`:
   - Curated `NATIONAL_FIELD_ALIASES` expanded to 100+ national sports venues with whole-phrase boundary matching.
   - `resolveSportsVenue(rawVenueString)` with fallback coordinates and surface classification.

5. `src/lib/ai/deterministicReasoner.ts`:
   - `calculateDepartureCountdown(event, arrivalRules, userCoordinates)`
   - `generateMatchdayBriefing(event, allDayEvents, arrivalRules)`
   - `determineFootwear(surface, tempC, precipMmh, isIndoor)`

6. `src/lib/reconciliation/teamNameMatcher.ts`:
   - `normalizeTeamName(rawName)`
   - `calculateTeamSimilarity(nameA, nameB)`
   - `MULTILINGUAL_COLORS` & `CLUB_ALIASES`

7. `src/lib/reconciliation/reconciliationEngine.ts`:
   - `reconcileCalendarWithOfficial(calendarEvents, officialFixtures)`
   - `computeMismatchDiagnostics(calendarEvent, officialFixture)`
   - `applyResolutionDecision(event, officialFixture, decision)`

8. `src/lib/storage/db.ts`:
   - Dexie Schema Version 2 tables and indexing.
   - Helper methods: `saveOfficialTeamData`, `getOfficialFixtures`, `getOfficialFixturesByDateRange`, `getOfficialStandings`, `getTeamRoster`, `deleteOfficialTeamData`, `createDefaultArrivalRules`, `saveArrivalRules`, `getArrivalRules`, `getOrCreateArrivalRules`, `linkEventToOfficialFixture`, `unlinkEventFromOfficialFixture`, `applyEventUserOverride`, `saveSyncState`, `getSyncState`, `clearAllDatabaseData`.

---

## 4. Verification Evidence

- `npm test`: **27 test files passed, 182 test cases passed, 0 failures (1.96s)**.
- `tsc -b`: **0 compilation errors**.
- `npm run build`: **Success (built dist in 5.29s)**.
- Offline isolation: All tests execute without external network connections using in-memory IndexedDB (`fake-indexeddb`) and offline fixtures (`tests/fixtures/`).
