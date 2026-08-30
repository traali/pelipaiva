# DOC trace — Pelipäivä @ `20bad06`

**Agent:** DOC  
**SHA:** `20bad06e559d77310bd8cc1971c2e1f1ff988f95`  
**Date:** 2026-08-30  
**Scope:** README, PROJECT.md, docs/**, COMPETITIVE_AI_FINAL_FINDINGS.md, docs/agency/*, CHANGELOG.md, llms.txt vs code.  
**Rule:** code wins. A finding without a path is a rumor.

Mission check (explicit): `package.json` scripts, `.github/workflows/ci.yml` (no lint, no playwright), `App.tsx` onboarding (no demo button), `ingestOfficial` `fallbackToSynthetic: false`, `ErrorBoundary` exists.

---

## How a stranger would actually start

| Question | Answer at `20bad06` |
|---|---|
| Can they run from README? | **No.** Root [README.md](../../../../README.md) describes an “Audit Summary System”, not the PWA. |
| Can they test from README? | **No.** README never mentions `npm test` / vitest / playwright. |
| Can they deploy from README? | **No.** Deploy lives in [.github/workflows/cd.yml](../../../../.github/workflows/cd.yml) + [docs/FAMILY_CODES_OPS.md](../../../FAMILY_CODES_OPS.md). |
| If they ignore README and open `package.json`? | **Yes, locally:** `npm ci && npm run dev` (Vite port **3000**), `npm test` (vitest). `npm run test:e2e` exists but is **not** a CI gate. `npm run lint` exists but eslint config is a stub. |
| Best human on-ramp that actually exists? | [docs/agency/README.md](../../../agency/README.md) + [FAMILY_CODES_OPS.md](../../../FAMILY_CODES_OPS.md) + [FAMILY_SYNC_FINAL.md](../../../FAMILY_SYNC_FINAL.md) §3. Buried; not linked from root README. |
| CONTRIBUTING / SECURITY.md / TEST_READY.md? | **Absent.** |

---

## What we know (code-proven)

### Product vs the files that claim to introduce it

1. **Root README is not a product README.**  
   Claim: “This system performs comprehensive audit verification by: 1. Reading all audit documents from the `docs/` directory…” ([README.md](../../../../README.md) L1–9).  
   Reality: this repo is the FamDay PWA (`package.json` `"name": "pelipaiva"`, `src/App.tsx`, Cloudflare Pages). No `audit_summary.py` on disk.

2. **CHANGELOG.md is the same ghost product.**  
   Claim: “Audit Summary System — 2026-08-28” + `python audit_summary.py --output docs/audit-summary-…` ([CHANGELOG.md](../../../../CHANGELOG.md) L1–27).  
   Reality: no such script; product changelog does not exist.

3. **`docs/README.md` is the real product index, but it is a broken map.**  
   It stars 12+ `docs/AUDIT_*.md` files and `MASTER_FINDINGS_REGISTER.md` ([docs/README.md](../../../README.md) L16–29). **None of those files exist** under `docs/` at this SHA (directory listing: agency/, ARCHITECTURE.md, FAMILY_*, PRODUCT_UX_REVIEW, SPECIFICATIONS, USE_CASES, USER_JOURNEYS*, REVERSE_REQUIREMENTS, screenshots — no AUDIT_*).  
   Same file also says agency pack “Supersedes older OPEN registers for planning” (L16) while still marking the missing 2026-08-28 Muse Spark audit ⭐⭐⭐ as “FINAL”.

4. **CI does not lint and does not run Playwright.**  
   Job name: `"Lint, Typecheck & Vitest"` ([.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) L15).  
   Steps actually run: `npx tsc -p tsconfig.app.json --noEmit` (L31–32), `npx vitest run` (L34), `npm run build` (L37). Zero `npm run lint`, zero `npx eslint`, zero `npm run test:e2e` / playwright.  
   [package.json](../../../../package.json) L8–12 still advertises `"lint": "eslint ."` and `"test:e2e": "playwright test"`.  
   [eslint.config.js](../../../../eslint.config.js) L6–9 turns `no-unused-vars` and `no-undef` **off** — even a local `npm run lint` is decorative.  
   [playwright.config.ts](../../../../playwright.config.ts) exists (`tests/e2e/playwright/`, three Chrome projects, no WebKit). [lighthouserc.json](../../../../lighthouserc.json) exists (a11y/PWA minScore 1.0) and is also not a CI step.

5. **Onboarding has no demo button.**  
   [src/App.tsx](../../../../src/App.tsx) L541–560 renders `OnboardingWizard` only (local / Luo perhe / Liity). No `handleStartDemo`. Repo-wide grep: the only remaining mention is a **comment** in [familyCloud.ts](../../../../src/lib/sync/familyCloud.ts) L334 (“Demo ids are seeded by handleStartDemo”).  
   [OnboardingWizard.tsx](../../../../src/components/OnboardingWizard.tsx) L348–413: three choices, none is demo.  
   Leftover: `isDemoActive` heuristic (App.tsx L225–233) + [DemoBanner.tsx](../../../../src/components/DemoBanner.tsx) still mount if every profile id looks like `profile-ppj-*` / `profile-hjk-demo`. There is no UI to seed those ids.

6. **`fallbackToSynthetic: false` on the UI ingest path.**  
   [src/lib/clubs/ingestOfficial.ts](../../../../src/lib/clubs/ingestOfficial.ts) L60–65:

   ```ts
   officialData = await extractOfficialTeamData(parsedAssoc, {
     customTeamName: cup?.teamName || opts.teamName,
     fallbackToSynthetic: false
   }).catch(() => null);
   ```

   Default in [statsEngine.ts](../../../../src/lib/stats/statsEngine.ts) `extractOfficialTeamData` is also `fallbackToSynthetic = false` (L1392). Matches FAMILY_SYNC_FINAL §3.

7. **`ErrorBoundary` exists and is wired.**  
   [src/components/ErrorBoundary.tsx](../../../../src/components/ErrorBoundary.tsx) L11 class component; [src/main.tsx](../../../../src/main.tsx) L4 import, L13–15 wrap `<App />`. Unhandled-rejection logger at main.tsx L6–8.

8. **COMPETITIVE_AI_FINAL_FINDINGS.md is a stale OPEN-P0 register.** Proven false at this SHA:

   | Stale claim | Doc | Code |
   |---|---|---|
   | M-02 “No ErrorBoundary, grep → 0 hits” OPEN | COMPETITIVE L26 | `ErrorBoundary.tsx` + `main.tsx:4` |
   | M-04 `fallbackToSynthetic` circumventing spec at `ingestOfficial.ts:54` OPEN | COMPETITIVE L28 | `ingestOfficial.ts:64` is `false`; line 54 is a different symbol |
   | M-07 “Demo start wipes user data” `App.tsx:193-194` OPEN | COMPETITIVE L32 | No `handleStartDemo`; L193–194 is Dexie live query |
   | M-20 “CI tsc --noEmit checks nothing” OPEN | COMPETITIVE L49 | `ci.yml` L31 uses `-p tsconfig.app.json` (root `tsconfig.json` `files: []` is real but **not** what CI runs) |
   | Toolchain “Lint exit 0 · 401/401 tests” | COMPETITIVE L13 | Lint is not in CI; 53 `*.test.ts`/`*.spec.ts` files on disk, not 401 |
   | M-11 “only `mismatchFlags: undefined` writers” | COMPETITIVE L35 | `ingestOfficial.ts:250–264` **writes** mismatchFlags |

   Grok already denied M-02/M-04/M-20 at SHA `2e45f97` ([GROK_AUDIT_2026-08-30.md](../../../agency/GROK_AUDIT_2026-08-30.md) L84–93). COMPETITIVE was never rewritten. Agency README says COMPETITIVE is historical (agency/README.md L3) — but COMPETITIVE itself still presents OPEN P0s as current.

9. **`PROJECT.md` names a file that does not exist and freezes the product in PLANNED.**  
   - `src/components/CalendarImportModal.tsx` (PROJECT.md L150) — **no such file**. Importer is `SmartImportModal.tsx`. Same ghost in [REVERSE_REQUIREMENTS_TRACEABILITY.md](../../../REVERSE_REQUIREMENTS_TRACEABILITY.md) L28, L59.  
   - Milestones E2E/M1 `IN_PROGRESS`, M2–M4 `PLANNED` (PROJECT.md L47–51) while prod is `https://pelipaiva.pages.dev` and CD deploys on `main`. Agency FORWARD_PLAN F-14 already asked to mark SHIPPED (FORWARD_PLAN.md L33) — not done.  
   - `TEST_READY.md` (PROJECT.md L47) — **absent**.

10. **Parser modules advertised as the implementation are re-export facades.**  
    [associationUrlParser.ts](../../../../src/lib/api/associationUrlParser.ts) L6–32 and [associationExtractor.ts](../../../../src/lib/api/associationExtractor.ts) L10–36 re-export `parseAssociationUrl` / `extractOfficialTeamData` from `src/lib/stats/statsEngine.ts`. Production ingest imports statsEngine directly (`ingestOfficial.ts` L2–5).  
    PROJECT.md L8–9, L55–70, L141–142 and SPECIFICATIONS.md L63 still describe those files as the engines.  
    Extra trap: `associationExtractor.ts` **also** has its own `fetchOfficialTeamData` (L364–377) that `customFetch(parsedUrl.canonicalUrl)` **without the Worker proxy**. Tests import this module; UI ingest does not.

11. **FAMILY_SYNC_FINAL constitution vs cup canned fallback (still live).**  
    Doc: “`fallbackToSynthetic: false` — never write `Basket.fi / ToPo (5756346)`” (FAMILY_SYNC_FINAL.md L63) and hydrate step 2 (L156).  
    Code: after that false flag, [ingestOfficial.ts](../../../../src/lib/clubs/ingestOfficial.ts) L68–73 still:

    ```ts
    officialData = mergeOfficialWithCupFallback(cup, officialData);
    if (!officialData || officialData.fixtures.length === 0) {
      if (cup) {
        officialData = officialFromExampleCup(cup);
    ```

    [exampleTournaments.ts](../../../../src/lib/clubs/exampleTournaments.ts) L275–287 / L310 `officialFromExampleCup` materialises catalog rows (Grok G-03 PARTIAL; FORWARD_PLAN F-9 still open).

12. **Family-code copy vs constitution.**  
    FAMILY_SYNC_FINAL L122: `Client: join-only. No “Luo perhe-koodi”.`  
    FAMILY_CODES_OPS L20–21: same.  
    UI: OnboardingWizard L382 label **“Luo perhe (Pilvisynkronointi)”**. The handler (L288–305) does **not** call `generateFamilyCode()` — it asks the user to type an already-issued key. So this is copy drift, not a mint.  
    But [familyCode.ts](../../../../src/lib/sync/familyCode.ts) L14–21 **still exports** `generateFamilyCode()` (crypto.random Crockford). Zero UI callers. Constitution: “public repo must not mint”. FORWARD_PLAN F-2 still open. Grok G-02 OPEN.

13. **`llms.txt` Nest Hub KV token is dead.**  
    Claim: “Nest Display: 10-foot Ambient View (/ambient) with ephemeral 7-day Cloudflare KV sync token” ([llms.txt](../../../../llms.txt) L20).  
    Worker has `/api/family/`, `/api/calendar`, `/api/proxy/ics` — **no `/api/sync`** (familyCloud.test.ts even asserts `workerSrc` does not contain `/api/sync/`). FAMILY_SYNC_FINAL L132: “Do **not** reuse `/api/sync/:key` (Nest Hub).” Ambient view is a client route in App.tsx L140–141 (`?ambient=true` / `/ambient`), Dexie-backed, not a KV token.  
    `llms.txt` also omits family bus, FAMILY_CODES fail-closed, on-device LLM opt-in — the live constitution.

14. **Poll interval: spec Saturday acceptance vs code.**  
    FAMILY_SYNC_FINAL L147: GET every 180s (raised from 30s). L276 Saturday #7: “B drops them within **~30s**”.  
    App.tsx L98 comment still says “every 30s”; L112–113 comment admits the raise and `setInterval(..., 180000)`.

15. **SPECIFICATIONS Dexie snippet is wrong.**  
    SPECIFICATIONS.md L29 `profiles: 'id, teamName, sport, isFavorite'` — grep `isFavorite` in `src/` = **0 hits**.  
    L42 `EventType: 'match' | 'training' | 'meeting' | 'other'` — code [matchday.ts](../../../../src/types/matchday.ts) L12 is `'match' | 'training' | 'tournament' | 'meeting' | 'school' | 'other'`.  
    Schema snippet omits `customAliases` which [db.ts](../../../../src/lib/storage/db.ts) L50, L73 actually has.

16. **REVERSE_REQUIREMENTS names functions/files that do not exist (or are aliases).**  
    - `extractLeagueStandingsFromHtml` / `extractTeamRosterFromHtml` (REVERSE L13) — actual names `extractStandingsFromHtml` / `extractRosterFromHtml` (associationExtractor.ts L209, L282).  
    - `src/lib/weather/fmiWeather.ts` (REVERSE L52) — file is `fmiWeatherEngine.ts`.  
    - `calculateParkingEase()` in `statsEngine.ts` (REVERSE L23) — lives in `parkingEaseEngine.ts`.  
    - `calculateNappisvahtiRecommendation()` (REVERSE L24) — actual export `generateMatchdayBriefing` (deterministicReasoner.ts L160).  
    - REQ-15 lists `generateOrResolveMatchStats()` as the **product** stats hub (REVERSE L25) — that function is the synthetic factory Grok G-01 wants **out** of the bundle (`statsEngine.ts:1485`).  
    - “100% Green / 321 Tests” (REVERSE L67) vs GROK “455 passed / 50 files” vs COMPETITIVE “401/401” vs USER_JOURNEYS_VALIDATION “46 test suites comprising 406 tests”. Disk: **53** `*.test.ts`/`*.spec.ts` files. Did not re-run vitest this session.

17. **USER_JOURNEYS corpus disagrees with itself.**  
    [USER_JOURNEYS.md](../../../USER_JOURNEYS.md) L1–4: “not constrained by current prototype”, UJ-01–UJ-20 visionary.  
    [USER_JOURNEYS_VALIDATION.md](../../../USER_JOURNEYS_VALIDATION.md) L6–29: “OFFICIALLY CERTIFIED & PASSED (100%)” of **9** different UJ titles, “406 tests”.  
    [PRODUCT_UX_REVIEW.md](../../../PRODUCT_UX_REVIEW.md) L14 also reviews those 9. UJ-01 in visionary doc is “Frictionless Zero-Login Family Setup”; UJ-01 in validation is “First-Time Onboarding & Multi-Child Roster Setup”. Same ID, different journeys.

18. **Worker CORS localhost port ≠ Vite port (undocumented).**  
    [worker.ts](../../../../cloudflare-worker/worker.ts) L200–206 allowlist includes `http://localhost:5173` and `http://127.0.0.1:5173` (Vite default).  
    [vite.config.ts](../../../../vite.config.ts) L71–73 `"port": 3000`. Playwright baseURL is 3000. No doc tells a stranger this. Hitting a **local** Worker from `npm run dev` would fail CORS Origin check. Hitting **prod** Worker from localhost:3000 also fails CORS (3000 not in the set) — family join from a local Vite session against prod edge is Origin-blocked. (Prod Pages origin `https://pelipaiva.pages.dev` is allowlisted.)

19. **Agency pack is the least-wrong docs, still pinned to an older SHA.**  
    GROK_AUDIT_2026-08-30.md header: SHA `2e45f97`. Current study SHA `20bad06`. Line refs checked this session that **still match**: ingestOfficial.ts:64, familyCode.ts:14, ErrorBoundary + main.tsx:4, ci.yml tsc -p tsconfig.app.json, generateOrResolveMatchStats at statsEngine.ts:1485, officialFromExampleCup at exampleTournaments.ts:275, worker CORS L200–214, X-Pelipaiva-Rev still accepted (worker.ts:210, familyCloud.ts:96). So Grok’s denied-list and G-01/G-02/G-03/G-05/G-14 remain valid; the file is not rewritten for `20bad06`.

20. **ARCHITECTURE.md agent graph matches code.**  
    `runMissionControlGraph` is the export ([planner.ts](../../../../src/lib/agents/planner.ts) L174, [agents/index.ts](../../../../src/lib/agents/index.ts) L1). Specialists exist as named files. Critic loop `familyMission.test.ts` exists. Dual-theme tokens exist ([tokens.css](../../../../src/styles/tokens.css) L1–8 Floodlight + Night Captain). This file is one of the few that is not lying.

21. **FAMILY_CODES_OPS runbook matches Worker behaviour** (except the Luo-perhe copy, #12).  
    Fail-closed 403 `unknown_family` (worker.ts L243–248), rate limits GET 20 / PUT 5 / DELETE 3 per 15 min (worker.ts L40–41), regex Crockford, secret not in wrangler vars, CD does not upload the secret ([cd.yml](../../../../.github/workflows/cd.yml) `wrangler deploy` only). Verify curls in OPS §3 are GET-safe.

---

## What we infer

- Root README/CHANGELOG were overwritten by an audit-summarizer session and never restored. The product never grew an onboarding README after that.
- COMPETITIVE_AI_FINAL_FINDINGS.md is a frozen snapshot at `7d36def` (its own footer). Later code and Grok’s deny-list landed; nobody regenerated the P0 table. A new agent that starts there will attempt to “fix” ErrorBoundary, demo wipe, and `fallbackToSynthetic` that are already done — or, worse, re-introduce a demo seed.
- `docs/README.md` numbering (`0…3` then another `3…`) and ⭐⭐⭐ on a **missing** file is consistent with a docs corpus that was pruned (AUDIT_* deleted or never copied into this clone) without rewriting the index.
- “Luo perhe” was kept as marketing copy for “paste an issued slot”, not a mint. Parents can still believe the app creates a code. `generateFamilyCode()` remaining in the module is the latent mint Grok flagged.
- Test-count inflation (321 / 401 / 406 / 455) is typical of successive audit passes counting different globs; none of the docs state the glob. `tests/e2e/tier*` are **vitest/node** tests with an “e2e” folder name, not Playwright.
- Agency FORWARD_PLAN P1 F-1/F-2/F-5/F-9 are still the live engineering list. PROJECT.md milestones are not.

---

## What we don’t know

| Unknown | What would resolve it |
|---|---|
| Whether vitest is still 455/50 at `20bad06` | `npx vitest run` (out of DOC scope this session; did not run) |
| Whether prod `pages.dev` HTML/JS is this SHA | CD run id + bundle grep (REL/API) |
| Whether `FAMILY_CODES` secret is populated | Operator; GET `/api/family/{issued}` — do not print values. DKJVB-H 403 is expected until then (G-10). |
| Whether localhost:3000 CORS vs prod Worker bites real local QA | Start `npm run dev`, join `?perhe=`, watch network (UIX/API) |
| Whether canned `officialFromExampleCup` rows still appear on prod HUD for KW/Espoo Liikkuu | Live cup ingest (API) |
| Whether `generateOrResolveMatchStats` is in the **prod** JS bundle (Grok said false in index at `2e45f97`) | Prod asset grep (REL) |
| Which AUDIT_* files existed at `7d36def` / `2e45f97` and were deleted vs never shipped in this clone | `git log -- docs/AUDIT` (not done; clone may be sparse) |
| Human Chrome 148 Nano QA / iPhone Safari radios (FORWARD_PLAN F-3, F-5) | Device. Not a doc defect. |

---

## Mission-item vs code (explicit)

| Mission item | Doc-side rumour | Code path:line | Verdict |
|---|---|---|---|
| package.json scripts | COMPETITIVE “Lint exit 0” as a toolchain gate | `package.json:8–12` has `lint` + `test:e2e`; `eslint.config.js:6–9` is a stub | Scripts exist; they are not gates |
| ci.yml no lint, no playwright | Job **name** “Lint, Typecheck & Vitest”; SUPER_PROMPT honestly says tsc+vitest+build | `ci.yml:15` name vs `ci.yml:30–37` steps | Name lies; steps match SUPER_PROMPT |
| App.tsx onboarding no demo button | COMPETITIVE M-07; USE_CASES “Demo family (this build)”; REVERSE “OnboardingWizard & demo” | `App.tsx:541–560`; no `handleStartDemo` anywhere | **Confirmed: no demo button** |
| ingestOfficial `fallbackToSynthetic: false` | FAMILY_SYNC_FINAL §3; COMPETITIVE M-04 claims violation | `ingestOfficial.ts:64` | **Matches constitution.** M-04 is false. Cup canned fallback is a *different* hole (`:70–73`). |
| ErrorBoundary exists | COMPETITIVE M-02 OPEN; Grok M-02 DENIED | `ErrorBoundary.tsx:11`, `main.tsx:4,13–15` | **Exists.** M-02 is false. |

---

## FINDING drafts

### F-DOC-001

- **title:** Root README.md and CHANGELOG.md describe a non-existent “Audit Summary System”
- **severity:** S1
- **confidence:** high
- **evidence:** [README.md](../../../../README.md) L1–9; [CHANGELOG.md](../../../../CHANGELOG.md) L1–27 (`python audit_summary.py`); no `audit_summary.py` on disk; real app is `src/App.tsx` + `package.json` name `pelipaiva`.
- **blast radius:** Every stranger, recruiter, and LLM that opens the repo. Zero chance of `npm ci && npm run dev` from the front door. Deploy/test/FAMILY_CODES runbooks are invisible.
- **why it matters:** Constitution and agency pack assume a human can find FAMILY_SYNC_FINAL. They cannot from README. Also a supply-chain smell (wrong product identity).
- **recommended action:** Replace README with: what it is (Finnish family sports PWA), `npm ci && npm run dev` (port 3000), `npm test`, prod URL, pointer to `docs/agency/README.md` + `docs/FAMILY_CODES_OPS.md`. Move or delete the audit-summary CHANGELOG; start a real product changelog from `20bad06`.
- **open questions:** Was README overwritten in a drive-by PR? `git log -1 -- README.md` (REL).
- **related:** F-DOC-002, F-DOC-003

### F-DOC-002

- **title:** `docs/README.md` is a broken map: starred AUDIT_* / MASTER_FINDINGS files are missing; two canons (agency pack vs “FINAL” 2026-08-28)
- **severity:** S1
- **confidence:** high
- **evidence:** [docs/README.md](../../../README.md) L16–29 links `./agency/README.md` as ⭐⭐⭐ **and** `./AUDIT_2026-08-28_muse-spark_full-corpus_final.md` as ⭐⭐⭐ FINAL, plus MASTER_FINDINGS_REGISTER.md and nine more AUDIT_* paths. `ls docs/` at this SHA has none of those AUDIT_* files. Numbering duplicates “3.”.
- **blast radius:** Any agent following “Start here” hits 404s, then falls back to COMPETITIVE OPEN P0s (F-DOC-003).
- **why it matters:** The index both says agency supersedes old registers **and** tells you the missing Muse Spark file is current truth.
- **recommended action:** Rewrite `docs/README.md` to: agency pack → FAMILY_SYNC_FINAL §3 → FAMILY_CODES_OPS → ARCHITECTURE. Mark missing audits “historical, not in tree”. Do not ⭐ a path that 404s.
- **open questions:** Were AUDIT_* deleted after `7d36def` or never present in this clone?
- **related:** F-DOC-003, F-DOC-011

### F-DOC-003

- **title:** COMPETITIVE_AI_FINAL_FINDINGS.md still publishes OPEN P0s that current code (and Grok’s deny-list) contradict
- **severity:** S1
- **confidence:** high
- **evidence:**
  - M-02 OPEN “grep ErrorBoundary → 0” (COMPETITIVE L26) vs `src/components/ErrorBoundary.tsx:11` + `src/main.tsx:4`.
  - M-04 OPEN `ingestOfficial.ts:54` (COMPETITIVE L28) vs `ingestOfficial.ts:64` `fallbackToSynthetic: false`.
  - M-07 OPEN demo wipe `App.tsx:193-194` (COMPETITIVE L32) vs those lines are Dexie live queries; no `handleStartDemo`.
  - M-20 OPEN CI tsc checks nothing (COMPETITIVE L49) vs `ci.yml:31` `tsc -p tsconfig.app.json --noEmit`.
  - Header “Lint exit 0 · 401/401 tests” (COMPETITIVE L13) vs `ci.yml` has no lint; 53 test files on disk.
  - Grok deny-list GROK_AUDIT L84–93 already recorded M-02/M-04/M-20 DENIED at `2e45f97`.
- **blast radius:** Planning from this file sends a team at DAY-1 “fixes” that would no-op or regress (re-adding a demo seed, toggling fallbackToSynthetic).
- **why it matters:** Agency README L3 says COMPETITIVE is historical; COMPETITIVE’s own title is “Final Priority Document” with 🔴 OPEN P0s. Two truths, code wins.
- **recommended action:** Banner at top of COMPETITIVE: **HISTORICAL @ `7d36def`. Do not plan from this.** Point at agency/GROK_AUDIT + this study. Do not silently edit old IDs; add the banner.
- **open questions:** None for the four P0s above. M-01 FamilyManageModal hooks — hooks are at top of `FamilyManageModal.tsx:34–40` (no early return before hooks in the first 80 lines); Grok denied; UIX should re-confirm full file.
- **related:** F-DOC-006, Grok G-13, G-03

### F-DOC-004

- **title:** CI job title and package.json oversell quality gates: no lint, no Playwright, eslint is a no-op stub, lighthouserc unused
- **severity:** S2
- **confidence:** high
- **evidence:** `ci.yml:15` name `"Lint, Typecheck & Vitest"`; steps L30–37 = tsc app + vitest + build only. `package.json:8` `"lint"` / L12 `"test:e2e"`. `eslint.config.js:6–9` disables the only two rules. `playwright.config.ts` + `tests/e2e/playwright/*.spec.ts` exist. `lighthouserc.json` a11y/PWA 1.0 never invoked. GROK_AUDIT L21 awarded Tests+CI **40/40** “Gates main” — true for tsc+vitest+build, oversell if a reader thinks lint/e2e/lhci gate.
- **blast radius:** Merges can land unused-vars, broken Playwright journeys, a11y 1.0 regressions. PROJECT.md “Dual Track E2E” (L40, L47) is not a merge gate.
- **why it matters:** SUPER_PROMPT.md L45 honestly describes CI as tsc+vitest+build. COMPETITIVE and the **job name** do not.
- **recommended action:** Rename CI job to “Typecheck, Vitest & Build”. Either add `npm run lint` after making eslint real, or delete the script. Document Playwright as manual (`npm run test:e2e`). REL owns adding jobs; DOC owns the name/docs.
- **open questions:** To QA: which Playwright specs still pass on Chromium-only CI?
- **related:** F-DOC-005, COMPETITIVE M-38, GROK Tests+CI 40/40

### F-DOC-005

- **title:** PROJECT.md and REVERSE_REQUIREMENTS_TRACEABILITY.md cite ghost files/symbols and freeze shipped work as PLANNED
- **severity:** S2
- **confidence:** high
- **evidence:**
  - `PROJECT.md:150` `CalendarImportModal.tsx` — file missing; `SmartImportModal.tsx` is the importer. Same path REVERSE L28, L59–61.
  - `PROJECT.md:47–51` E2E+M1 IN_PROGRESS, M2–M4 PLANNED; `TEST_READY.md` missing. Prod+CD exist. FORWARD_PLAN F-14 still open.
  - REVERSE L13 `extractLeagueStandingsFromHtml` / `extractTeamRosterFromHtml` — actual `extractStandingsFromHtml` / `extractRosterFromHtml`.
  - REVERSE L52 `fmiWeather.ts` — actual `fmiWeatherEngine.ts`.
  - REVERSE L23 `calculateParkingEase` in statsEngine — actual `parkingEaseEngine.ts`.
  - REVERSE L25 REQ-15 presents `generateOrResolveMatchStats()` as the stats product — `statsEngine.ts:1485` is the synthetic factory (G-01).
  - REVERSE L67 “321 Tests”; PROJECT L40 “Dual Track E2E Tiers 1-4”.
- **blast radius:** New contributors open the wrong file; REQ-15 legitimises the fake-stats factory the constitution forbids.
- **why it matters:** PROJECT.md is the “architecture + feature inventory” a PM would trust. It is a pre-ship snapshot.
- **recommended action:** Stamp PROJECT.md “historical @ pre-Pages; see docs/agency/FORWARD_PLAN.md”. Replace CalendarImportModal refs with SmartImportModal. Drop REQ-15’s synthetic factory as a requirement or mark BY-DESIGN forbidden.
- **open questions:** None.
- **related:** F-DOC-010, F-DOC-011, G-01, FORWARD_PLAN F-14

### F-DOC-006

- **title:** Onboarding has no demo button; COMPETITIVE M-07, USE_CASES “Demo family”, and REVERSE “& demo” are leftover; DemoBanner can still appear
- **severity:** S2
- **confidence:** high
- **evidence:** `App.tsx:541–560` onboarding tree = OnboardingWizard + SmartImport + FamilyShare. No demo CTA in `OnboardingWizard.tsx:348–413`. `handleStartDemo` grep = 1 comment (`familyCloud.ts:334`). `App.tsx:225–233` `isDemoActive` if every profile id is `profile-ppj-*` / `profile-topola-*` / `profile-kw-*` / `profile-hjk-demo`; `App.tsx:604–608` mounts `DemoBanner`. USE_CASES.md L30–32 “Demo family (this build): PPJ/Laru…”. REVERSE L61 “OnboardingWizard … & demo”. COMPETITIVE M-07 L32.
- **blast radius:** Docs tell a tester to look for a demo path that cannot start. If someone manually Dexie-inserts those ids, DemoBanner + familyCloud demo-id filter still run. `seedWeekendExtras.ts` (no importers, G-14) still contains `profile-ppj-185085` demo events.
- **why it matters:** M-07 as OPEN P0 would make someone re-implement destructive demo. Constitution wants no synthetic seasons in the UI path.
- **recommended action:** Delete or quarantine DemoBanner/isDemoActive/seedWeekendExtras together with F-2/F-1 (ARC). Strike demo sentences in USE_CASES + REVERSE. Keep COMPETITIVE M-07 as HISTORICAL/FIXED.
- **open questions:** Can onboarding presets (PPJ/Laru URLs in OnboardingWizard L56–79) create `profile-ppj-*` stable ids via `generateStableProfileId` and thus trip `isDemoActive` on a **real** first-run? DATA/ARC: read `attachTeam.ts` id scheme vs the `profile-ppj-` prefix heuristic.
- **related:** F-DOC-003, G-14, USE_CASES L30

### F-DOC-007

- **title:** FAMILY_SYNC_FINAL §3 “never write synthetic league names” vs `officialFromExampleCup` still writing catalog cups
- **severity:** S2 (constitution honesty; not UI 2–1 scores)
- **confidence:** high
- **evidence:** FAMILY_SYNC_FINAL.md L63, L156, L160 (“Empty live cup → existing canned cup seed, never synthetic league names”). `ingestOfficial.ts:68–73` + `exampleTournaments.ts:275–287,310`. Grok G-03 PARTIAL; FORWARD_PLAN F-9.
- **blast radius:** KW Memorial / Espoo Liikkuu empty live → HUD shows canned HJK/KäPa-class rows, labelled as official. Saturday acceptance #5 (FINAL L274) “No `Basket.fi / ToPo (5756346)`, no fake 22p” can still pass while cups lie.
- **why it matters:** The spec **documents** the canned cup seed in §7 L160, which contradicts §3. Internal spec contradiction, implemented.
- **recommended action:** Primary: API/ARC implement F-9 (empty cup → “ei julkaistu”). DOC: strike L160 canned seed; keep §3 as the law. Do not file a second API finding if API takes F-DOC-007 as related.
- **open questions:** To API: does `isUglyTeamName` still let `Basket.fi / ToPo (5756346)` through on league miss, or only cups?
- **related:** G-03, FORWARD_PLAN F-9, ingestOfficial.ts

### F-DOC-008

- **title:** Docs say “no Luo perhe-koodi / join-only”; UI labels “Luo perhe”; `generateFamilyCode()` still ships in the client module
- **severity:** S2
- **confidence:** high
- **evidence:** FAMILY_SYNC_FINAL L119–122; FAMILY_CODES_OPS L20–21. `OnboardingWizard.tsx:371–389` button “Luo perhe (Pilvisynkronointi)”; L288–305 `handleCreateFamilySubmit` stores typed code, does not mint. `familyCode.ts:14–21` `generateFamilyCode()` uses `crypto.getRandomValues`. Zero UI callers (G-02). SUPER_PROMPT L25–26 “generateFamilyCode in the client is forbidden in UI”.
- **blast radius:** Parents think they created a family; Worker 403s unknown codes. Public bundle still contains a mint function (constitution: public repo must not mint). Placeholders `PERHE-1` / `PERHE-2` (OnboardingWizard L441, L452) are legal Crockford and will 403 unless issued.
- **why it matters:** Copy lies; mint function is latent. Fail-closed Worker is correct (OPS).
- **recommended action:** Rename button to “Käytä perheavainta” / “Liity myönnetyllä koodilla”. Delete `generateFamilyCode` (FORWARD_PLAN F-2). Keep join + `?perhe=`.
- **open questions:** UIX: is “Luo perhe” vs “Liity perheeseen” distinguishable enough that parents paste the same issued code in both?
- **related:** G-02, F-2, FAMILY_CODES_OPS §7

### F-DOC-009

- **title:** llms.txt advertises Nest Hub 7-day KV sync token and omits the live constitution (family bus, fail-closed codes, on-device LLM)
- **severity:** S2
- **confidence:** high
- **evidence:** llms.txt L20 Nest Display KV token; L5–8 “Cloudflare Live Verification Mandate”. Worker paths: family/calendar/proxy only. FAMILY_SYNC_FINAL L132 do-not-reuse `/api/sync`. Ambient is `App.tsx:140–141` client flag. llms.txt file list L22–35 has no `familyCloud.ts`, `familyCode.ts`, `onDeviceLlm.ts`, `ingestOfficial.ts`.
- **blast radius:** RAG/coding agents using llms.txt will look for Nest `/api/sync` and miss FAMILY_CODES.
- **why it matters:** llms.txt claims to be “Comprehensive context file for AI agents”.
- **recommended action:** Rewrite llms.txt against FAMILY_SYNC_FINAL §3 + agency SUPER_PROMPT stack. Keep live URLs. Drop Nest KV token. Add Dexie SoT, fail-closed codes, `fallbackToSynthetic: false`, opt-in `pelipaiva_ondevice_llm`.
- **open questions:** Does `/ambient` still work as a 10-foot HUD on a Nest display as a **local** PWA tab? (UIX) That can stay; the KV token cannot.
- **related:** FAMILY_SYNC_ARCHITECTURE.md (superseded) still describes `/api/sync`

### F-DOC-010

- **title:** associationUrlParser.ts / associationExtractor.ts are re-export facades; PROJECT.md/SPECIFICATIONS treat them as the engines; extractor also has a proxy-less fetch used by tests
- **severity:** S2
- **confidence:** high
- **evidence:** `associationUrlParser.ts:6–32` re-export from statsEngine; `associationExtractor.ts:10–36` re-export `extractOfficialTeamData`; `ingestOfficial.ts:2–5` imports statsEngine. `associationExtractor.ts:364–377` `fetchOfficialTeamData` hits `canonicalUrl` with `customFetch`, no `DEFAULT_PROXY_URL`. Tests: `f05_official_fixtures_ingestion.test.ts`, `f19_onboarding_import_flow.test.ts` import associationExtractor. PROJECT.md L8–9, L141–142; SPECIFICATIONS L63.
- **blast radius:** “Fix the extractor” in the advertised file does not change UI ingest. Tests can pass on a code path the PWA never uses (no CORS proxy).
- **why it matters:** Dual ingest stories. QA hunters can stay green while prod uses statsEngine JSON+proxy.
- **recommended action:** DOC: say “facade; implementation `statsEngine.ts`”. QA: stop treating associationExtractor `fetchOfficialTeamData` as the prod path. ARC: consider deleting the proxy-less fetch or making it call `extractOfficialTeamData`.
- **open questions:** To QA: do f05/f19 mock fetch at canonicalUrl and never exercise the Worker proxy?
- **related:** F-DOC-005, F-DOC-007

### F-DOC-011

- **title:** USER_JOURNEYS.md (20 visionary UJs) vs USER_JOURNEYS_VALIDATION.md (9 UJs “100% CERTIFIED”) vs PRODUCT_UX_REVIEW (those 9) — same IDs, different journeys, certification theater
- **severity:** S2
- **confidence:** high
- **evidence:** USER_JOURNEYS.md L1–4, L40–52 UJ-01 = Zero-Login Setup, UJ-01…UJ-20. USER_JOURNEYS_VALIDATION.md L6 “OFFICIALLY CERTIFIED & PASSED (100%)”, L18 UJ-01 = First-Time Onboarding, L28–29 “46 test suites comprising 406 tests”, L50 cites `tests/e2e/playwright/user_flows.spec.ts` as PASS (Playwright is not in CI). PRODUCT_UX_REVIEW.md L14 “9 foundational journeys”.
- **blast radius:** PM reads 100% certified; visionary doc says it is not constrained by implementation. Playwright “PASS” is not a merge gate (F-DOC-004).
- **why it matters:** Certification language on a visionary spec is a lie to operators.
- **recommended action:** Relabel USER_JOURNEYS.md as “north star, not shipped”. Relabel VALIDATION as historical adjudication @ its date; do not claim Playwright PASS unless CI runs it. Do not reuse UJ-01… IDs across the two taxonomies.
- **open questions:** None.
- **related:** F-DOC-004, PRODUCT_UX_REVIEW

### F-DOC-012

- **title:** Family poll documented as both 180s (rate-limit) and ~30s (Saturday acceptance); App.tsx comment still says 30s
- **severity:** S3
- **confidence:** high
- **evidence:** FAMILY_SYNC_FINAL L147 (180s), L276 (~30s). App.tsx L98 “every 30s”, L112–113 `180000` with comment “30s interval → 3 min”.
- **blast radius:** Support/QA expecting 30s roster propagate; Worker GET:20/15min budget assumes 180s.
- **why it matters:** Spec disagrees with itself; comment disagrees with the next line.
- **recommended action:** Fix FINAL Saturday #7 to “within one poll (~3 min, on focus immediately)”. Fix App.tsx L98 comment. Code interval is the truth.
- **open questions:** None.
- **related:** worker.ts FAMILY_RATE_LIMITS GET:20

### F-DOC-013

- **title:** SPECIFICATIONS.md Dexie/EventType contracts do not match `db.ts` / `matchday.ts`
- **severity:** S3
- **confidence:** high
- **evidence:** SPECIFICATIONS.md L29 `isFavorite` (0 hits in src); L42 EventType missing `tournament`/`school`; snippet omits `customAliases`. db.ts L65–74 v2 stores; matchday.ts L12 EventType.
- **blast radius:** Schema work against the spec will add a column the app ignores, or miss customAliases.
- **why it matters:** SPECIFICATIONS claims “Tuotantovalmis”.
- **recommended action:** Either generate the schema block from db.ts or stamp SPECIFICATIONS historical and point at matchday.ts + db.ts.
- **open questions:** None.
- **related:** F-DOC-005

### F-DOC-014

- **title:** Worker CORS allowlist is Vite’s default 5173; app and Playwright use 3000; no doc mentions either port
- **severity:** S2
- **confidence:** high
- **evidence:** worker.ts L204–205 `localhost:5173`; vite.config.ts L71–73 port 3000; playwright.config.ts L11, L40 baseURL 3000; recon 00-recon.md L50 (this study) is the only mention. Root README silent. FAMILY_CODES_OPS local-dev section does not exist.
- **blast radius:** Stranger `npm run dev` + family join against prod Worker or a local wrangler: CORS omit Origin / no Allow-Origin. Looks like “Koodi ei ole voimassa” if the client maps network failure poorly (M-28 was PARTIAL).
- **why it matters:** Operator runbook is otherwise the best doc in the tree; it skips local CORS.
- **recommended action:** Add 3000 to Worker allowlist **or** set Vite to 5173; document in FAMILY_CODES_OPS + README. Do not use `*` (G-13 PASS).
- **open questions:** To API/SEC: is localhost CORS required, or is local QA expected to use pages.dev?
- **related:** G-13 CORS allowlist, F-DOC-001

### F-DOC-015

- **title:** Test-count theater across docs (321 / 401 / 406 / 455) with no glob; “e2e” folder is mostly vitest
- **severity:** S3
- **confidence:** high
- **evidence:** REVERSE L67 “321”; COMPETITIVE L13 “401/401”; USER_JOURNEYS_VALIDATION L29 “406” / “46 test suites”; GROK_AUDIT L7 “455 passed / 50 files”. Disk at `20bad06`: 53 `*.test.ts`/`*.spec.ts`. `tests/e2e/tier0–5` import vitest; Playwright is only `tests/e2e/playwright/`.
- **blast radius:** Audits claim coverage that cannot be reproduced without the original command line.
- **why it matters:** SUPER_PROMPT scoring “Tests + CI 40” used 455; a later auditor with a different glob will “disagree” without a product change.
- **recommended action:** One line in agency README: `npx vitest run` is the gate; print the number in CI logs; do not hardcode counts in markdown.
- **open questions:** To QA: run vitest at this SHA and post the number.
- **related:** F-DOC-004, GROK_AUDIT L7

---

## Matches (docs that agree with code — do not “fix”)

| Claim | Doc | Code |
|---|---|---|
| `fallbackToSynthetic: false` on ingest | FAMILY_SYNC_FINAL §3 L63 | ingestOfficial.ts:64; statsEngine default L1392 |
| Fail-closed unknown/empty FAMILY_CODES → 403 `unknown_family` | FAMILY_CODES_OPS L17; FINAL L121 | worker.ts:243–248 |
| Rate limits GET 20 / PUT 5 / DELETE 3 / 15 min | OPS §5; FINAL L143 | worker.ts:40–41 |
| Dexie v2 SoT, listed tables | PROJECT.md L4; ARCHITECTURE “Shared memory = Dexie” | db.ts L42–81 (+ customAliases extra) |
| Agent graph planner → 5 specialists, no fetch | ARCHITECTURE.md L7–21 | planner.ts L174; agents/index.ts |
| ErrorBoundary wired | GROK G-13 / denied M-02 | main.tsx:4,13–15 |
| CI = tsc app + vitest + build | SUPER_PROMPT.md L45 | ci.yml:30–37 |
| No `/api/sync` reuse | FINAL L132 | worker.ts has no such path; familyCloud.test.ts asserts absence |
| X-Pelipaiva-Rev deprecated but still accepted | FINAL L47 note; G-05 OPEN | worker.ts:210,324,394; familyCloud.ts:96 |
| Safari cannot do Core AI | native/ios/README.md L3–14; SUPER_PROMPT L36 | Swift stub only; no .xcodeproj |
| qrserver.com killed | FINAL L203 | no `qrserver` in src/; FamilyShareModal is copy/WhatsApp (no in-canvas QR either — copy-only, allowed) |

---

## Questions for other roles

| ID | From | To | Question |
|---|---|---|---|
| Q-DOC-001 | DOC | QA | Run `npx vitest run` at `20bad06` and post file/test counts so F-DOC-015 can be numbered, not ranged. |
| Q-DOC-002 | DOC | ARC | Do onboarding preset URLs produce `profile-ppj-*` ids via `generateStableProfileId`, tripping `isDemoActive`? |
| Q-DOC-003 | DOC | API | Confirm `officialFromExampleCup` is the only remaining synthetic write on the UI ingest path (vs `generateSyntheticOfficialTeamData`, only when `fallbackToSynthetic: true` in tests). |
| Q-DOC-004 | DOC | UIX | Should “Luo perhe” be copy-fixed only, or is the create-vs-join split confusing enough to collapse to one join screen? |
| Q-DOC-005 | DOC | REL | `git log --follow -- README.md` — when did Audit Summary overwrite the product README? |
| Q-DOC-006 | DOC | SEC | Localhost CORS 5173 vs 3000: add 3000, or document “no local Worker”? Do not widen to `*`. |

---

## Contradictions for `board/contradictions.md`

Format: claim A (source) vs claim B (source) → suggested ORCH verdict (code wins).

| ID | A | B | Suggested verdict |
|---|---|---|---|
| C-DOC-01 | COMPETITIVE M-02 OPEN: no ErrorBoundary, grep 0 (COMPETITIVE L26) | Grok M-02 DENIED (GROK L88); `ErrorBoundary.tsx:11` + `main.tsx:4` | **B.** ErrorBoundary exists. COMPETITIVE historical. |
| C-DOC-02 | COMPETITIVE M-04 OPEN: ingest still synthetic, `ingestOfficial.ts:54` (L28) | FAMILY_SYNC_FINAL §3; `ingestOfficial.ts:64` `false`; Grok M-04 DENIED (GROK L89) | **B** for league synthetic flag. Residual **cup** canned seed is C-DOC-08, not M-04. |
| C-DOC-03 | COMPETITIVE M-07 OPEN: demo start wipes data `App.tsx:193-194` (L32) | No `handleStartDemo`; App.tsx:193–194 is live query; onboarding has no demo button | **B.** Demo start removed. Leftover DemoBanner heuristic is F-DOC-006 residue, not M-07. |
| C-DOC-04 | COMPETITIVE M-20 OPEN: CI `tsc --noEmit` checks nothing (L49); docs/README L21 P9 same | `ci.yml:31` `tsc -p tsconfig.app.json --noEmit`; Grok M-20 DENIED (GROK L93) | **B.** Root `tsconfig.json` `files:[]` is real but unused by CI. |
| C-DOC-05 | COMPETITIVE L13 “Lint exit 0” as toolchain gate; `ci.yml:15` job name “Lint, …” | `ci.yml` steps have no lint; `eslint.config.js` is a stub | **Neither fully.** Scripts exist; they do not gate. Rename job. |
| C-DOC-06 | FAMILY_SYNC_FINAL L122 / OPS L20 “No Luo perhe-koodi. Join-only.” | OnboardingWizard.tsx:382 “Luo perhe (Pilvisynkronointi)” | **A is policy, B is copy.** Handler does not mint. Delete `generateFamilyCode` anyway (G-02). |
| C-DOC-07 | FAMILY_SYNC_FINAL L276 Saturday: B sees delete in ~30s | FINAL L147 + App.tsx:113: 180s poll | **Code 180s.** Spec Saturday line is stale. Focus GET is immediate. |
| C-DOC-08 | FAMILY_SYNC_FINAL §3 never write synthetic league names | FINAL §7 L160 “Empty live cup → existing canned cup seed” + ingestOfficial.ts:70–73 `officialFromExampleCup` | **§3 is constitution.** L160 is the loophole G-03/F-9. Do not treat L160 as permission to invent league cards. |
| C-DOC-09 | llms.txt L20 Nest `/ambient` 7-day KV sync token | Worker has no `/api/sync`; FINAL L132 forbids reuse; Ambient is client Dexie | **B.** llms.txt stale Nest copy. |
| C-DOC-10 | PROJECT.md L47–51 milestones IN_PROGRESS/PLANNED; Grok G-08 DRIFT | Live `pelipaiva.pages.dev` + cd.yml on main; FORWARD_PLAN F-14 | **Shipped product, stale PROJECT.md.** |
| C-DOC-11 | USER_JOURNEYS_VALIDATION L6 “100% CERTIFIED” of 9 UJs + Playwright PASS | USER_JOURNEYS.md L1–4 visionary 20 UJs “not constrained by prototype”; Playwright not in CI | **Neither is current product truth.** Visionary ≠ certified. Playwright un-gated. |
| C-DOC-12 | REVERSE REQ-15: `generateOrResolveMatchStats` is the stats hub | SUPER_PROMPT L29 + G-01: must not be reachable from UI; function still in statsEngine.ts:1485 | **Constitution wins.** REQ-15 is a doc bug that legitimises a hunter target. |
| C-DOC-13 | docs/README L16 agency pack supersedes old OPEN registers | docs/README L17 same page ⭐⭐⭐ missing Muse Spark file as FINAL | **Agency pack is the planning canon** (and still SHA-lagged). Missing files cannot be FINAL. |
| C-DOC-14 | GROK Tests+CI 40/40 “Gates main” | No lint, no Playwright, no lhci in ci.yml | **Partial.** tsc+vitest+build gate main. Do not score 40 if the rubric implied e2e/lint. ORCH: keep 40 for the stated SUPER_PROMPT CI bar; log F-DOC-004 as hygiene. |
| C-DOC-15 | worker.ts L204 CORS localhost:5173 | vite.config.ts:71 port 3000 | **Vite 3000 is local truth.** CORS list is copy-paste Vite default. |
| C-DOC-16 | PROJECT.md / SPECIFICATIONS: associationExtractor is the HTML engine | ingestOfficial imports statsEngine; associationExtractor is a re-export + a second proxy-less fetch | **statsEngine is the UI ingest engine.** Facade + test-only fetch is F-DOC-010. |
| C-DOC-17 | COMPETITIVE M-11 OPEN: mismatch banner unreachable, only `undefined` writers | ingestOfficial.ts:250–264 writes mismatchFlags; MatchdayCard.tsx:198 renders them | **B** if ingest is on the calendar+official path. UIX should confirm the banner is reachable in UI, not just assigned. |
| C-DOC-18 | Root README “Audit Summary System” | Every other current file (package.json, App, Worker, agency) is FamDay PWA | **Code/product identity wins.** README is wrong. |
| C-DOC-19 | CHANGELOG “python audit_summary.py” | File does not exist | **CHANGELOG is wrong.** |
| C-DOC-20 | GROK_AUDIT SHA `2e45f97` as the baseline to beat (agency README) | Study SHA `20bad06` | **Re-prove, don’t rubber-stamp.** Line checks this session: Grok deny-list still holds; G-01/G-02/G-03/G-05/G-14 still OPEN. Not a contradiction of facts — a SHA lag. |

ORCH: do not overwrite Grok IDs. Prefer F-DOC-* as the doc-drift records; leave G-01/G-02/G-03 with ARC/API as code defects the docs already (partially) know about.
