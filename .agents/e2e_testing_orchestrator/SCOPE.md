# Scope: E2E Testing Track (Pelipäivä)

## Architecture
- Framework: Vitest
- Test Layout:
  - `tests/e2e/tier1_features/`: Feature Coverage tests for Features 1–19 (>=5 tests per feature = >=95 test cases)
    - `f01_palloliitto_url.test.ts` (Feature 1)
    - `f02_salibandy_url.test.ts` (Feature 2)
    - `f03_basket_url.test.ts` (Feature 3)
    - `f04_torneopal_url.test.ts` (Feature 4)
    - `f05_official_fixtures_ingestion.test.ts` (Feature 5)
    - `f06_dexie_schema_v2.test.ts` (Feature 6)
    - `f07_title_permutations.test.ts` (Feature 7)
    - `f08_event_type_classification.test.ts` (Feature 8)
    - `f09_dual_timestamp_dst.test.ts` (Feature 9)
    - `f10_multi_squad_separation.test.ts` (Feature 10)
    - `f11_talkoovahti_duties.test.ts` (Feature 11)
    - `f12_pitch_nicknames.test.ts` (Feature 12)
    - `f13_arrival_rules.test.ts` (Feature 13)
    - `f14_fuzzy_reconciliation.test.ts` (Feature 14)
    - `f15_multilingual_tokens.test.ts` (Feature 15)
    - `f16_timestamp_diagnostics.test.ts` (Feature 16)
    - `f17_venue_diagnostics.test.ts` (Feature 17)
    - `f18_conflict_resolution.test.ts` (Feature 18)
    - `f19_onboarding_import_flow.test.ts` (Feature 19)
  - `tests/e2e/tier2_boundary/`: Boundary & Corner Cases (>=95 test cases across empty inputs, extreme offsets, corrupt/invalid URLs, non-ASCII/Finnish special chars, DST boundaries, rapid sync)
    - `boundary_urls_and_api.test.ts`
    - `boundary_calendar_permutations.test.ts`
    - `boundary_reconciliation_mismatches.test.ts`
    - `boundary_arrival_rules.test.ts`
  - `tests/e2e/tier3_combinations/`: Cross-Feature Pairwise Combinations (>=19 test cases)
    - `combinations_url_calendar_reconciliation.test.ts`
    - `combinations_dst_arrival_volunteer.test.ts`
  - `tests/e2e/tier4_realworld/`: Real-World Application Scenarios (>=10 scenarios)
    - `scenario_hjk_multi_squad.test.ts`
    - `scenario_ervip12_floorball_talkoovahti.test.ts`
    - `scenario_basket_honka_offsets.test.ts`
    - `scenario_volleyball_kuortane_sets.test.ts`
    - `scenario_multisport_weekend_tournament.test.ts`
  - `tests/fixtures/`: Fixture ICS files, HTML/JSON mock responses, league extracts.

## Feature Inventory Mapping
| # | Feature | Description | E2E Test Suite | Minimum Tests |
|---|---------|-------------|----------------|---------------|
| 1 | Palloliitto Team URL Parser | `tulospalvelu.palloliitto.fi/team/{teamId}` | `tier1_features/f01_palloliitto_url.test.ts` | 5 |
| 2 | Salibandyliitto Team URL Parser | `tulospalvelu.salibandy.fi/team/{teamId}` | `tier1_features/f02_salibandy_url.test.ts` | 5 |
| 3 | Basket.fi Team URL Parser | `basket.fi/basket/sarjat/joukkue/?team_id={teamId}` | `tier1_features/f03_basket_url.test.ts` | 5 |
| 4 | Torneopal Team URL Parser | `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}` | `tier1_features/f04_torneopal_url.test.ts` | 5 |
| 5 | Official Fixtures & Standings Ingestion | Extractor for fixtures, standings, rosters | `tier1_features/f05_official_fixtures_ingestion.test.ts` | 5 |
| 6 | Dexie Schema Version 2 Persistence | Store and query fixtures, rules, reconciliations | `tier1_features/f06_dexie_schema_v2.test.ts` | 5 |
| 7 | Complex Title Permutations | Parse FI match titles (vs, peli, @, Ottelu, Seriematch) | `tier1_features/f07_title_permutations.test.ts` | 5 |
| 8 | Event Type Classification | Match, training, meeting, tournament detection | `tier1_features/f08_event_type_classification.test.ts` | 5 |
| 9 | Dual-Timestamp & DST Disentanglement | Warmup DTSTART vs kickoff, EET/EEST transitions | `tier1_features/f09_dual_timestamp_dst.test.ts` | 5 |
| 10 | Multi-Squad Feed Separation | Split Sininen/Valkoinen/Musta/Kilpa/Haaste | `tier1_features/f10_multi_squad_separation.test.ts` | 5 |
| 11 | Talkoovahti Volunteer Duty Windows | Extract kahvio, toimitsija, järkkäri with time windows | `tier1_features/f11_talkoovahti_duties.test.ts` | 5 |
| 12 | 100+ National Pitch Slang Nicknames | Bubu, Väiski, Sahara, Bollis, Kupla, Kisis, etc. | `tier1_features/f12_pitch_nicknames.test.ts` | 5 |
| 13 | Configurable Arrival Rules | Warmup offsets (home/away/training), departure buffers | `tier1_features/f13_arrival_rules.test.ts` | 5 |
| 14 | Conservative Fuzzy Match & Reconciliation | Date + ±3h + opponent token similarity >= 0.85 | `tier1_features/f14_fuzzy_reconciliation.test.ts` | 5 |
| 15 | Multilingual & Alias Token Normalizer | FI/SV/EN colors, age tags, abbreviations | `tier1_features/f15_multilingual_tokens.test.ts` | 5 |
| 16 | Visual Timestamp Mismatch Diagnostics | Before/after kickoff diffs | `tier1_features/f16_timestamp_diagnostics.test.ts` | 5 |
| 17 | Visual Venue & Opponent Diagnostics | Pitch/venue divergence warnings | `tier1_features/f17_venue_diagnostics.test.ts` | 5 |
| 18 | 1-Tap Conflict Resolution Actions | Adopt official, Keep calendar notes, Unlink | `tier1_features/f18_conflict_resolution.test.ts` | 5 |
| 19 | UI Integration & Onboarding/Import Flow | Import wizard, squad picker, live preview | `tier1_features/f19_onboarding_import_flow.test.ts` | 5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E-M0 | Survey & Test Harness Setup | Inspect existing code & setup test helper harness | none | IN_PROGRESS |
| E2E-M1 | Tier 1 Feature Coverage Tests | Features 1–19 (>=95 tests) | E2E-M0 | PLANNED |
| E2E-M2 | Tier 2 Boundary & Corner Cases | Boundary conditions (>=95 tests) | E2E-M1 | PLANNED |
| E2E-M3 | Tier 3 Pairwise Combinations | Cross-feature interactions (>=19 tests) | E2E-M2 | PLANNED |
| E2E-M4 | Tier 4 Real-World Scenarios | Club scenarios (>=10 scenarios) | E2E-M3 | PLANNED |
| E2E-M5 | Test Verification & Publication | Full run, TEST_INFRA.md, TEST_READY.md | E2E-M4 | PLANNED |
