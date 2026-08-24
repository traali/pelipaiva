# CANONICAL AUDIT — Priority-Ordered Merge of All Council Audits

| | |
|---|---|
| **File** | `AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md` |
| **Date** | 2026-08-24T14:08 (+0200) |
| **Model / Author** | `ox-alpha` (stealth/ox-alpha via opencode CLI) |
| **What was done** | Cross-checked three independent 20-agent council audits of Pelipäivä against each other and against a live-verified clean `main` (`494c902`: build exit 0 · 45/45 test files · 401/401 tests), deduplicated overlapping findings, and merged everything into one canonical, strictly priority-ordered catalog with What / Cause / Proof / Fix per finding. |
| **Source audits** | ① `AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md` (8 findings + resolved/non-findings) · ② `AUDIT_2026-08-24_ox-alpha.md` (25 findings F-01…F-25, weighted vote, fact-check verdicts) · ③ `AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md` (11 findings C1, H1–H3, M1–M7 across 12 external integrations) |
| **Dedup note** | Overlapping claims merged into single entries; `[source IDs]` after each title give full traceability. Line references verified at merge time unless marked *(re-verify)*. |

---

# P0 — Crashes & Data Corruption (fix within days)

## 1. `"HH:24"` invalid end time crashes message import `[F-01]`

- **What:** A freeform import ("alkaa klo 23:05") without explicit end time throws an unhandled `RangeError`, killing the whole import flow.
- **Cause:** `endH = h + 1` has no modulo wraparound (`messageParserNLP.ts:146-148`); hour `24` then hits `new Date(...)` in `localAiEngine.ts:50-52`. The sibling warmup derivation wraps correctly — omission is accidental.
- **Proof:** `messageParserNLP.ts:143-148` vs correct pattern at `:154-155`; crash site `localAiEngine.ts:50-52`.
- **Fix:** Wrap `(h+1) % 24`, carry day-roll (or store duration-in-minutes); add regression tests for 23:00 / 23:59 / 00:15; validate `HH < 24` in `convertExtractedToMatchdayEvent` and throw typed `ParseError`.

## 2. Upstream outage silently replaced by fabricated fixtures that are persisted and cloud-synced `[C1]` + `[F-14]`

- **What:** Failed federation fetches fall back to invented standings/form/rank data which is saved locally AND synced to family cloud — plausible-but-wrong data presented as real.
- **Cause:** Fabrication defaults scattered through extractors: hardcoded `form: ['W']` (`associationExtractor.ts:272`), `matchesPlayed: 1` (`:345`), rank fallback `|| standings.length + 1` (`:238`); parse-failure masking instead of error propagation.
- **Proof:** Source audit ③ §C1 lifecycle trace; `associationExtractor.ts` sites above.
- **Fix:** Fail closed on upstream errors (no persistence of synthetic rows); return `null`/"ei tietoa" markers; render unknown-state in UI; purge already-synced synthetic rows.

## 3. No global failure net: no ErrorBoundary, no rejection trap, unsafe JSON.parse `[F-04]` + `[1358-F1]`

- **What:** Any render exception or rejected promise = blank screen or silent failure with zero recovery UI — fatal for an offline PWA used at pitches.
- **Cause:** Never introduced; app mounts bare (`main.tsx:6-10`). Unguarded paths: `runBackgroundSync()` (`App.tsx:103,110,116`), URL-param IIFEs (`App.tsx:140-163`), `handleClearData` (`App.tsx:278-283`), `JSON.parse` on corrupt localStorage (`App.tsx:477`) and tombstones aborting sync (`familyCloud.ts:297`).
- **Proof:** Repo-wide grep for `ErrorBoundary|componentDidCatch|unhandledrejection` in `src/` → 0 hits (verified twice).
- **Fix:** Class ErrorBoundary around `<App/>` with Finnish recovery screen; register `unhandledrejection` listener; introduce `safeJsonParse<T>()`; wrap the four async paths with try/catch + toast.

## 4. Unguarded venue coordinate dereference crashes Navigate button `[F-02]`

- **What:** Clicking "Navigate" on events built from fixtures lacking coordinates throws `TypeError` inside the click handler.
- **Cause:** `VenueInfo.coordinates` typed required (`matchday.ts:39`) but sources are optional (`venueLat?/venueLng?`, `matchday.ts:244-245`); both call sites dereference directly.
- **Proof:** `App.tsx:754-757` and `App.tsx:831-834` (identical Maps URL builds).
- **Fix:** Invariant builder at ingest (`ensureVenueInfo()`); fallback to text-destination Maps URL via venue name; make `coordinates` optional so the compiler enforces handling.

---

# P1 — Security, Privacy & Safety Integrity (fix within weeks)

## 5. Family-cloud cluster: weak capability auth + destructive gaps `[H1]` + `[F-03]` + `[F-19]` + rate-limit atomicity `[1358-F5]`

- **What:** Children's names/schedules protected only by a ~31M-keyspace code; several integrity gaps around it.
- **Cause:** `Math.random()` code generation (`familyCode.ts:14-16`); GET unauthenticated + wildcard CORS (`worker.ts:128`); DELETE without If-Match/rev (`worker.ts:273-277`); unguarded `JSON.parse` on KV reads → one corrupt record = persistent 1101 for that family (`worker.ts:179,:212`); XFF fallback spoofable (`worker.ts:51-53`); rate counter via non-atomic Cache-API read/write (`worker.ts:54-75`, bursts can overshoot — accepted low-sev limitation).
- **Proof:** Sites listed above; mitigating facts verified: fail-closed 403 on unknown codes, GET capped 20/900s per IP-PoP, codes never committed.
- **Fix:** `crypto.getRandomValues()` codes (consider 7+1 chars); origin-scoped CORS; require If-Match on DELETE; guarded KV parse → 503 `corrupt_record`; `CF-Connecting-IP` only; optional per-code HMAC header + client-side payload encryption. Rate-limiter atomicity: annotate TODO, migrate to Durable Objects only if abuse appears.

## 6. Lightning-safety logic truthiness bugs at edges `[F-07]` — safety-critical

- **What:** Edge inputs produce wrong suspension advice from the module that recommends pausing children's matches.
- **Cause:** `if (nearestStrikeKm && ...)` skips exactly-0 km strike (`lightningSafety.ts:58`); epoch-0 timestamp treated as none (`:35`); future-dated strike yields negative elapsed passing `< 30` (`:43-44`); strike count includes any age (`:26-31`).
- **Proof:** Lines cited; extend `lightningSafety.test.ts`.
- **Fix:** `!== undefined` guards; clamp negative elapsed; feed-age parameter (ignore strikes older than N hours); boundary tests (0 km, epoch-0, future, 29/31 min).

## 7. Reconciliation contradicts its own contract `[F-10]`

- **What:** Wrong auto-matches can merge wrong fixture onto a child's calendar (threshold ≥0.85); early-morning local events never match.
- **Cause:** UTC calendar-day equality despite ±24h comment (`reconciliationEngine.ts:76-85`; affects 00:00–02:59 EET/EEST events); alias grants similarity 1.0 on substring containment (`:100-105`); missing-component generosity double-bonus scores bare "HJK" vs "HJK T13 Sininen" 0.8 (`teamNameMatcher.ts:283-300`).
- **Proof:** Fact-check narrowed blast radius to early-morning events, not evenings (audit ② §5.2).
- **Fix:** Helsinki-local day keys (reuse `getFinnishTimezoneOffset`); alias requires canonical-token equality; drop double bonus — absence is neutral evidence.

## 8. ICS ingestion correctness cluster `[F-11]`

- **What:** Wrong times off-device, recurring trainings appear once ever, duplicate cards after every re-sync, slow large feeds.
- **Cause:** Runtime-local `setHours()` for description times (`icsParser.ts:249-268`); zero RRULE/RDATE/EXDATE support (`:489-493`); all-day DATE through kickoff fabrication (`:226-231`); unstable id fallback `event-${Date.now()}-${random}` breaks dedupe (`:545`); serial per-event geocoding (`:538-542`).
- **Proof:** Audit ② F-11 line refs.
- **Fix:** Explicit `Europe/Helsinki` formatter (pattern: `helsinkiDateISO`, `agents/time.ts:4-11`); ical.js recurrence iterator; stable UID-hash ids; batch geocode ≈4 concurrency.

## 9. Synthetic data containing real children's names compiled into production bundle `[F-13 data-part]`

- **What:** Hardcoded demo fixtures/rosters keyed to real teamIds ('203621','34013') with real minors' names ship in prod JS — GDPR exposure.
- **Cause:** ~430 lines of test-only generators remain exported in prod graph (`statsEngine.ts:916-1348,:1432-1735`; own comment admits "Test-only invented magazine"); no build exclusion (`vite.config.ts:44-64`).
- **Proof:** Names at `statsEngine.ts:1045,:1196`; export at `:1436`.
- **Fix:** Move generators to `tests/fixtures/` or DEV-gate via `import.meta.env.DEV`; strip real names from any retained sample data.

---

# P2 — Robustness, Honesty & Process (fix within 30–60 days)

## 10. No timeout chain; caches grow forever and cache failures `[M1]` + `[M2]` + `[F-16]`

- **What:** Hung imports on flaky networks; one transient FMI outage poisons weather for the entire session; memory growth.
- **Cause:** No AbortSignal: family GET/PUT (`familyCloud.ts:44,:96`), LIPAS/HEL (`sportsGeocoder.ts:335,:376`), ICS ingest (`ingestOfficial.ts:167`); FMI memo is unbounded Map caching rejected promises permanently (`fmiWeatherEngine.ts:50,:58-64`); tombstones monotonic (`familyCloud.ts:296-307`). Correct pattern exists at `torneopalClient.ts:187`.
- **Proof:** Sites listed.
- **Fix:** `AbortSignal.timeout(8000)` everywhere (copy torneopalGet); evict rejected entries + LRU cap (~200); cap tombstones 500/family FIFO.

## 11. Concurrent sync cycles duplicate fan-out and self-rate-limit `[H2]`

- **What:** Multiple tabs/devices trigger overlapping sync cycles → duplicate work, 409 churn, self-inflicted 429s.
- **Cause:** No cross-tab/cycle leader election or backoff in family sync.
- **Proof:** Audit ③ §H2 trace.
- **Fix:** Single-flight guard (module-level promise + Web Locks/BroadcastChannel leader); jittered retry honoring Retry-After.

## 12. Geocoder silently falls back to hardcoded Helsinki for ANY unmatched venue `[H3]` + `[F-15 part]`

- **What:** Users in Turku/Oulu silently get Helsinki weather/parking — confidently-wrong UX.
- **Cause:** Fixed fallback coordinates 60.1872/24.9248 for unrecognized venues (`sportsGeocoder.ts:408-415`); failures swallowed elsewhere (`ingestOfficial.ts:168`, empty catch `db.ts:109-114`, silent LLM fallback `localAiEngine.ts:296-298`) — the broader silent-failure culture `[F-15]`.
- **Proof:** Audit ③ §H3; fact-check verdict: adaptation OK, concealment not (audit ② §5.1).
- **Fix:** Keep graceful degradation but surface it: `degraded:true` flag + "[PELIPAIVA:GEO]" logs + visible "arvioitu sijainti: Helsinki" badge.

## 13. Test honesty: vacuous guards, mislabeled suites, flake factories `[F-05]` + `[F-20]`

- **What:** Adversarial security tests can pass while rejecting everything; "e2e" tiers run in Node; timing-threshold tests measure scheduler noise; browser tests never run in CI.
- **Cause:** `if (result) {...}` wrapping assertions (`m1_adversarial_parser_extractor.test.ts:52-61,:93-101,:115-122`); vitest env 'node' for tier dirs vs Playwright's 2 specs (`playwright.config.ts:4`); wall-clock thresholds ×6 sites; IDB mock schedules via `setTimeout` (`setupDexie.ts:168-176,:688-693`); `reuseExistingServer: true`.
- **Proof:** Audit ② F-05/F-20; fact-check: "vanity coverage" charge mostly debunked — suite is genuinely strong except the conditional adversarial subset (§5.4).
- **Fix:** Two-direction unconditional assertions; rename tiers→integration; inject clocks / op-count asserts; migrate to installed `fake-indexeddb`; `reuseExistingServer: !CI`; Playwright job in ci.yml.

## 14. Coverage gaps: five lib modules + entire component tree untested `[F-06]`

- **What:** OCR pipeline, proxyUrl, ingestOfficial, popularClubsCatalog, fmiWeatherEngine have zero tests; zero component tests exist.
- **Cause:** Growth outran suite; WFS fixture exists unused (`tests/fixtures/json/fmi_weather_sample.json`).
- **Proof:** Grep of all test files → zero references (audit ② F-06).
- **Fix:** Unit-test the five modules; React Testing Library for `OnboardingWizard` + `MatchdayCard`; consolidate duplicate URL parsers under fuzz test.

## 15. CI cannot gate direct-to-main commits; quality gates decorative; wrangler drift `[1358-F3]` + `[F-24]`

- **What:** Broken trees reached local main (Session I: 26 TS errors); lighthouserc elite gates never invoked; deploy tooling version mismatch.
- **Cause:** ci.yml runs tsc+vitest+build but only post-push on direct commits; no branch protection/hooks; no lhci job; `cd.yml:46` pins wrangler 4.24.0 vs declared `^4.124.0`.
- **Proof:** Session I measurements (see source ①); grep workflows → no lighthouse.
- **Fix:** Branch protection requiring `verify` check + PR flow; pre-commit `tsc --noEmit && vitest --bail=1`; fail-on-empty-test-file guard; add lhci job; align wrangler versions.

## 16. xlsx@^0.18.5 known advisories parsing user-supplied files `[1358-F4]`

- **What:** Vulnerable SheetJS CE line processes untrusted Excel uploads (prototype pollution/ReDoS class).
- **Cause:** Dependency pinned old; no sandbox boundary before parse (`tableAndExcelParser.ts` via `localAiEngine.ts`).
- **Proof:** `package.json:34`.
- **Fix:** Upgrade to current vendor distribution; or parse in Web Worker with size caps. Local-only blast radius keeps this P2.

## 17. Docs & scripts drift from reality `[F-18]` + `[1358-F2,F8]`

- **What:** New developers follow instructions that fail; scripts break on other machines.
- **Cause:** Phantom endpoints in docs (`docs/AUDIT.md:19-22`, `FAMILY_SYNC_ARCHITECTURE.md:20,157`, `AGENT_GRAPH.md:30` describe `/api/sync/:key`, `/api/nest/brief`, `src/routes/api/proxy/ics.ts` — none exist); PROJECT.md milestone statuses stale; `README.md:99` "13 tests in ~250ms" vs actual 401 tests/~9s; `deploy.ps1` PowerShell-only on macOS-first repo; machine-specific Windows paths in 8 script sites (`scripts/audit_live_prod.mjs:31,:43,:48` et al.).
- **Proof:** Sites listed; README drift re-verified post-merge.
- **Fix:** Docs truth-pass (delete phantom refs, update statuses, document build/e2e/worker deploy + shell deploy path); env-var parameterize script paths.

## 18. Failure masking in UX: 429 shown as "family not found"; proxy errors = "no matches" `[M4]`

- **What:** Distinguishable failures collapse into misleading user messages.
- **Cause:** Status-code conflation in family client and ingest paths.
- **Proof:** Audit ③ §M4 traces.
- **Fix:** Map status codes to specific messages; distinguish empty-result from transport failure.

## 19. OCR depends on unpinned third-party CDN assets at runtime `[M7]`

- **What:** Offline-first guarantee breaks when tesseract worker/langdata fetches from CDN.
- **Cause:** Runtime asset URLs unpinned/unbundled in `ocrImageParser.ts`.
- **Proof:** Audit ③ §M7.
- **Fix:** Self-host worker + traineddata via Vite assets with SRI/integrity pinning; precache in SW.

## 20. Radar modal fires WMS GetMap every 900 ms with no preload/error state `[M6]`

- **What:** Request storm; broken frames render blank while UI claims freshness.
- **Cause:** Naive interval refresh, no frame load/error handling.
- **Proof:** Audit ③ §M6.
- **Fix:** Preload next frame before swap; error placeholder; back off interval; respect tile freshness headers.

## 21. Torneopal client: no backoff, ignores Retry-After, refetches everything `[M3]` + orphaned integration `[M5]`

- **What:** Ingest hammering upstream during incidents; dead code path bypasses proxy entirely.
- **Cause:** Missing retry policy; `associationExtractor.fetchOfficialTeamData` has zero callers and skips proxy (`associationExtractor.ts`).
- **Proof:** Audit ③ §M3/§M5.
- **Fix:** Exponential backoff honoring Retry-After; incremental fetch since last sync; delete or route the orphan through the allowlisted proxy.

---

# P3 — Structure & Polish (fix within 60–90 days)

## 22. God-modules concentrate risk `[F-13 struct]` + `[1358-F6]`

- **What:** `statsEngine.ts` (1735 ln, ≥8 responsibilities) and `App.tsx` (942 ln, 15 useState, duplicated modal trees/Maps URLs) block safe refactoring — the root cause of Session I's import collisions.
- **Proof:** Line counts re-verified on main; duplication sites `App.tsx:563-583` vs `:842-900`, `:754-757` vs `:831-834`.
- **Fix:** Split statsEngine → `lib/association/{urlParser,htmlParser,tz}.ts`; extract demo seeding → `lib/matchday/demoSeed.ts`; modal coordinator hook; target <300 ln shells.

## 23. Storage layer: type escapes, polymorphic ids, scan-instead-of-index `[F-22]`

- **Proof:** `Table<LeagueStandingsRecord | any>` ×2 (`db.ts:46-47`); three id conventions forcing triple-probe readers (`:156-194,:237-290`); JS-side filtering despite compound index (`:214-227`); `.update(undefined)` no-op unlink (`:389-391`).
- **Fix:** Schema v3 canonical key migration; `.where('[teamId+startTime]').between(...)`; `.modify()` deletion semantics; remove `| any`.

## 24. Dead & duplicated code clusters `[F-21]`

- **Proof:** Dead exports `tournamentLeaveHint` (`tournamentAgent.ts:80-84`), `sportsWeekendRange` (`time.ts:77-112`); unreachable sentinel fallbacks ×6; DST algorithm twice (`statsEngine.ts:481-497` vs `torneopalClient.ts:79-89`); byte-identical `childName()` twice; proxy builder twice.
- **Fix:** Delete dead branches; single-source shared helpers (pairs with #22 split and #7/#8 fixes).

## 25. DST/locale edge bugs in time math `[F-12]` + `[F-25]`

- **Proof:** Day-level offset probe stamps whole day (`time.ts:21-25`) → October fall-back Sunday ranges end 1h early; planner hardcodes `+03:00` (`planner.ts:42,:103`); en-US locale coupling with silent `?? 1` weekday fallbacks (`time.ts:43-55,:79-91`); garbage-input repair producing plausible dates (`:36`).
- **Fix:** Per-instant `Intl.DateTimeFormat('fi-FI', {timeZone:'Europe/Helsinki', hourCycle:'h23'})`; exhaustive weekday switch throwing on unknown; fail loudly on malformed components.

## 26. Accessibility debt across half the tree `[F-17]`

- **Proof:** 17/30 components zero aria-*; repo-wide tabIndex = 0; exactly one image alt; `index.html` lacks color-scheme meta + noscript; lighthouserc demands a11y 1.0 but unwired (#15); positive examples exist (`MatchdayCard.tsx:339,:509,:522,:541`).
- **Fix:** ARIA pass over the 17; color-scheme meta; noscript; live regions for HUD countdowns; wire lhci (closes #15 loop).

## 27. PWA SW lifecycle & bundle budget watch `[P3-2]` + `[1358-F7]`

- **Proof:** No navigateFallback / skipWaiting config (`vite.config.ts:35-40`) though `/ambient` route exists; precache measured **1439 KiB / 30 entries** at build; lighthouserc perf ≥0.95 unenforced.
- **Fix:** navigateFallback + prompt-to-update flow; lhci job (shared with #15/#26); track precache trend, lazy-load if >~1.6 MB.

---

## Resolved during audit window (verified on main `494c902` — do not reopen)

| Prior issue | Proof of resolution |
|---|---|
| 26 TypeScript build errors (duplicate exports/identifiers/import conflicts) | `npm run build` exit 0; grep `error TS` → 0 |
| `local_ai_parser.test.ts` collected 0 tests silently | 45/45 files, 401/401 tests pass |
| tesseract.js statically imported defeating lazy-load | Type-only refs + `await import()` at `localAiEngine.ts:325` |

## Rejected non-findings

- **Missing i18n** — deliberate single-market design (FMI/LIPAS/Tieliikennelaki domain); revisit on Nordic expansion only.
- **Backend/microservices rewrite** — local-first + edge proxy shape is correct.
- **Federation keys as "secret leak"** — public SPA constants per source comment; reframed as rotation/ToS fragility (#21, #5 context).

---

*Canonical merge generated by ox-alpha, 2026-08-24T14:08. Full per-finding detail, vote tallies, fact-check transcripts, and re-verification commands live in the three source audits.*
