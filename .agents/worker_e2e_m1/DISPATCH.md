## 2026-08-20T08:14:00Z

You are the Worker for Milestone E2E-M1: Tier 1 Feature Coverage Tests (Features 1–19) on Pelipäivä.
Your working directory is: c:\dev2\pelipaiva\.agents\worker_e2e_m1

MANDATORY FIRST STEPS:
1. Read c:\dev2\pelipaiva\ORIGINAL_REQUEST.md
2. Read c:\dev2\pelipaiva\PROJECT.md
3. Read c:\dev2\pelipaiva\.agents\e2e_testing_orchestrator\SCOPE.md
4. Read c:\dev2\pelipaiva\.agents\explorer_e2e_survey\survey_report.md
5. Read c:\dev2\pelipaiva\.agents\worker_e2e_m0\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

YOUR MISSION:
Implement all 19 Tier 1 Feature Coverage test files in `tests/e2e/tier1_features/`, with AT LEAST 5 comprehensive test cases per feature (total >= 95 test cases).
Ensure that all required module implementations in `src/` (such as `src/lib/api/associationUrlParser.ts`, `src/lib/api/associationExtractor.ts`, `src/lib/reconciliation/teamNameMatcher.ts`, `src/lib/reconciliation/reconciliationEngine.ts`, `src/lib/calendar/icsParser.ts`, `src/lib/storage/db.ts`, `src/lib/ai/deterministicReasoner.ts`, `src/lib/geo/sportsGeocoder.ts`) conform genuinely and authentically to the interface contracts in `PROJECT.md` and pass all tests.

The 19 test files in `tests/e2e/tier1_features/` to create:
1. `f01_palloliitto_url.test.ts` (>=5 tests): parse valid team URLs, extract teamId/sport/association, canonical URLs, reject invalid paths, query parameter handling.
2. `f02_salibandy_url.test.ts` (>=5 tests): parse valid Salibandyliitto team URLs, sport='floorball', association='salibandy', extract teamId, reject non-team URLs.
3. `f03_basket_url.test.ts` (>=5 tests): parse `basket.fi/basket/sarjat/joukkue/?team_id={teamId}`, sport='basketball', association='basket', query parameter extraction.
4. `f04_torneopal_url.test.ts` (>=5 tests): parse `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}`, extract subdomain (e.g. lentopallo, futsal, etc.), sport, association='torneopal'.
5. `f05_official_fixtures_ingestion.test.ts` (>=5 tests): parse HTML fixtures, standings, rosters from offline HTML fixtures, correct data structures and statuses.
6. `f06_dexie_schema_v2.test.ts` (>=5 tests): CRUD operations and queries on `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`, `syncState` in Dexie.
7. `f07_title_permutations.test.ts` (>=5 tests): parse complex Finnish title formats: `HJK T13 Sininen vs EPS`, `HJK-EPS peli`, `Peli @ Bubu vs Honka`, `Ottelu: VJS - PPJ (Kierros 4)`, `Seriematch: IFK - GrIFK`, `Friendly: KäPa vs Ilves`.
8. `f08_event_type_classification.test.ts` (>=5 tests): classify match (vs/ottelu), training (Harjoitukset/Treenit/Fysiikka/Lajivuoro/Aamujää/Träning), meeting (Vanhempainilta/Palaveri), tournament (Turnaus/Pelitapahtuma).
9. `f09_dual_timestamp_dst.test.ts` (>=5 tests): disentangle warmup DTSTART (14:15) vs kickoff (15:00) in summary/description, EET/EEST daylight savings handling, timezone normalization.
10. `f10_multi_squad_separation.test.ts` (>=5 tests): detect and split multi-squad shared feeds (Sininen, Valkoinen, Musta, Kilpa, Haaste, T1, T2) into isolated sub-feeds.
11. `f11_talkoovahti_duties.test.ts` (>=5 tests): extract parent volunteer duties: Kahviovuoro, Toimitsijavuoro/Kirjuri/Kello, Järkkäri/Liivimies, Kioski, Makkaranpaisto with exact time windows (`klo 14:30 - 16:00`).
12. `f12_pitch_nicknames.test.ts` (>=5 tests): resolve 100+ Finnish pitch nicknames (Bubu, Väiski, Sahara, Bollis, Kupla, Kisis, Mosahalli, Kauppi, Kupittaa, etc.) to canonical facility names and coordinates.
13. `f13_arrival_rules.test.ts` (>=5 tests): dynamic warmup offsets (home 45m, away 60m, training 15m, tournament 30m), departure buffer calculations, volunteer duty buffers.
14. `f14_fuzzy_reconciliation.test.ts` (>=5 tests): conservative auto-link on date + ±3h time window + opponent similarity (>=0.85), keep unlinked when ambiguous/conflicting.
15. `f15_multilingual_tokens.test.ts` (>=5 tests): normalize FI/SV/EN colors (Sininen/Blå/Blue, Valkoinen/Vit/White), age tags (T13/P11/F08), club abbreviations (HJK, KäPa, GrIFK, ErVi, TiPS).
16. `f16_timestamp_diagnostics.test.ts` (>=5 tests): detect and format before/after kickoff time differences (e.g. `Nimenhuuto: 15:00 ➔ Torneopal: 15:30`, timeDiffMinutes).
17. `f17_venue_diagnostics.test.ts` (>=5 tests): detect venue divergences between calendar and official league data, badge output, opponent mismatches.
18. `f18_conflict_resolution.test.ts` (>=5 tests): 1-tap conflict resolution operations: `use_official` (adopt official time & venue), `keep_calendar` (retain custom calendar notes), `unlink` (sever match link).
19. `f19_onboarding_import_flow.test.ts` (>=5 tests): end-to-end import orchestration flow: parse association URL -> fetch official fixtures -> import .ics feed -> reconcile -> apply arrival rules.

VERIFICATION REQUIREMENTS:
- Run `npm test` to verify ALL existing and Tier 1 tests pass (0 failures).
- Run `npx tsc --noEmit` to verify 0 TypeScript errors.
- Document test counts and execution times in your report.
