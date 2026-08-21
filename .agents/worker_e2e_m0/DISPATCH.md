## 2026-08-20T05:09:10Z
You are the Worker for Milestone E2E-M0: Test Harness, Vitest Configuration & Test Fixtures on Pelipäivä.
Your working directory is: c:\dev2\pelipaiva\.agents\worker_e2e_m0

MANDATORY FIRST STEPS:
1. Read c:\dev2\pelipaiva\ORIGINAL_REQUEST.md
2. Read c:\dev2\pelipaiva\PROJECT.md
3. Read c:\dev2\pelipaiva\.agents\e2e_testing_orchestrator\SCOPE.md
4. Read c:\dev2\pelipaiva\.agents\explorer_e2e_survey\survey_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

YOUR MISSION:
1. Install `fake-indexeddb` as a devDependency (`npm i -D fake-indexeddb`).
2. Update `vitest.config.ts` so that `include` covers both `src/**/*.test.ts` and `tests/**/*.test.ts` (e.g. `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']` or `include: ['**/*.test.ts']`, and configure setupFiles if needed).
3. Create test helper infrastructure in `tests/helpers/`:
   - `tests/helpers/setupDexie.ts`: IndexedDB setup using `fake-indexeddb/auto` and helper for isolated test databases.
   - `tests/helpers/fixtureLoader.ts`: Helper to load ICS, HTML, and JSON fixture files.
   - `tests/helpers/mockFetch.ts`: Helper for mock fetch responses for Finnish sports associations, LIPAS, and weather endpoints.
4. Create fixture files in `tests/fixtures/`:
   - `tests/fixtures/ics/`:
     - `nimenhuuto_hjk_multisquad.ics` (Nimenhuuto sample with Sininen and Valkoinen squads, matches vs opponents, training sessions, volunteer kahviovuoro duties, pitch slang like Bubu and Väiski).
     - `myclub_ervi_talkoovahti.ics` (MyClub sample with Salibandy matches, training, talkoovahti duties like Toimitsija/Kirjuri/Kello/Järkkäri with time windows).
     - `jopox_honka_warmup_kickoff.ics` (Jopox basketball sample with warmup DTSTART 14:15 vs kickoff 15:00 in description, meetings).
     - `torneopal_puma_volleyball.ics` (Torneopal volleyball tournament with set scores and multiple matches).
     - `dst_fall_spring_transitions.ics` (Events spanning EET and EEST daylight saving boundaries).
   - `tests/fixtures/html/`:
     - `palloliitto_team_page.html` (Realistic Palloliitto team page HTML with fixtures, standings, and roster).
     - `salibandy_team_page.html` (Salibandyliitto team page HTMLmin with fixtures, standings, and roster).
     - `basket_fi_team_page.html` (Basket.fi team page HTML with fixtures, standings, and roster).
     - `torneopal_taso_team_page.html` (Torneopal taso team page HTML with fixtures, standings, and roster).
   - `tests/fixtures/json/`:
     - `lipas_venues_sample.json` (LIPAS sports facility JSON mock).
     - `fmi_weather_sample.json` (FMI weather report sample).
5. Write a harness verification test `tests/helpers/harness.test.ts` to verify that `fake-indexeddb`, fixture loaders, and mock fetch work smoothly.
6. Run `npm test` and `npx tsc --noEmit` to verify all tests pass.

Write your report to `c:\dev2\pelipaiva\.agents\worker_e2e_m0\report.md` and `handoff.md`.
Send a message when complete.
