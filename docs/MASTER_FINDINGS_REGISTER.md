# MASTER FINDINGS REGISTER — the one list that rules them all

| | |
|---|---|
| **File** | `MASTER_FINDINGS_REGISTER.md` |
| **Date** | 2026-08-24T17:45 · tree `f1f0b4b` |
| **Authority** | Supersedes all per-audit catalogs for tracking. Every row absorbs ALL source IDs listed; fix once, close everywhere. Verdicts derive from the [full-corpus proof-or-deny pass](./AUDIT_2026-08-24T1730_ox-alpha_full-corpus-proof-or-deny.md) (fresh line refs, build exit 0, 401/401 tests). |
| **Sources absorbed** | ① 1358 council · ② council F-01…F-25 · ③ 1405 API-lifecycle · ④ 1407 priority (=②) · ⑤ 1408 canonical · ⑥ 1606 NEXUS UI/UX · ⑦ 1715 crosscheck (V/D/S/P/N items) · ⑧ 1730 proof-or-deny |
| **Status vocabulary** | OPEN · PARTIAL · FIXED (verified on main) · BY-DESIGN (documented intent) |

**Totals at creation:** 54 distinct findings. **Status after remediation sweep (see §Post-Sweep below):** 25 FIXED · 12 PARTIAL · 13 OPEN · 4 BY-DESIGN/rejected-class.

---

## Post-Sweep Status Update — 2026-08-24T22:10 @ `f325e50`

Full remediation sweep landed (hooks crash → ErrorBoundary adoption → P1/P2/P3 pass). Gates: `tsc -p tsconfig.app.json` = 0 · vitest **405/405** · production build OK. Per-item outcomes vs the original catalog:

### Now FIXED (verified in tree)
M-01 hooks order · M-02 ErrorBoundary+rejection net · M-03 `%24` wrap · M-04 `fallbackToSynthetic:false` + fail-closed ingest (+smoke test) · M-05 `isSynthetic` end-to-end (generator all sports → `Ei alkanut`, never persisted, conditional scoreboard/kuntopuntari/source footer) · M-06 weather honesty (rainProb fabrication removed, single measured timeline point, memo failure eviction, 8 s timeout) · M-07 consent gates + 9-table clear incl. aliases · M-08 demo-profile sync sandbox · M-09 QDIB save catch/join feedback + import zero-result notices · M-10 Worker KV parse guards · M-11 reconciliation producer wired into dual-source ingests (`mismatchFlags` populated, machine-safe `officialStartTimeIso`) · M-14 timeout chain complete · M-15 geocoder `isApproximateLocation` + card badge · M-16 single-flight sync mutex in `familyCloud.ts` · M-18 coordinate dereference guards on map navigation handlers · M-20 CI runs `tsc -p tsconfig.app.json --noEmit` · M-23 OCR asset hosting online CDN (by-design; repo root cleaned) · M-28 OPS-mandated `?perhe=` join errors · M-29 ambient exit wired (+URL strip) · M-30 backup copy truth + hydrate-on-import · M-32 venue correction writes event + normalized pins + typed surfaces · M-39 theme bootstrap (FOUC) · M-42 adopt-official ISO guard · M-45 import timer cleanup + Escape-block mid-save · M-46 clear-all covers customAliases · M-47 copilot honesty (context 15, logged fallbacks, confidence 0.75, label).

### Now PARTIAL (core fixed, residue tracked)
M-12 (CORS allowlist + guarded DELETE ✅; `associationUrl` scheme cap still open) · M-13 (edge guards + WATCH recency ✅; engine still has no live caller) · M-17 (immediate tombstones + undo retract ✅; KV record-TTL resurrection is architectural) · M-19 (Helsinki day keys ✅; alias-substring 1.0 remains spec-intentional w/o debug log) · M-22 (2 MB parse cap + vendor note; registry upgrade blocked) · M-25 (deadline ✅; cup count-fidelity untouched) · M-26 (three masks cleared; outage-vs-empty message + orphan-profile cleanup remain) · M-27 (selection-list autofill ✅; duplicate catalog teamIds remain) · M-34 (`@custom-variant dark` + daylight floodlight ≥4.8:1 ✅; touch-target/SR passes remain) · M-36 (vacuous guards fixed two-directional; node-tier naming unchanged) · M-37 (4 smoke tests; component-tree coverage still zero) · M-38 (wrangler aligned; lhci/playwright jobs absent) · M-40 (60 s clock tick ✅; sticky offsets + between-games hero card remain) · M-41 (hero/ambient rules passthrough ✅; global `_arrivalRules` arg still ignored) · M-44 (Tiivis keyboard-honest + strip wired; Kalenteri stays read-only) · M-50 (dead exports/carpool branch removed; extractor orphan remains) · M-51 (`y ??` + offset helper; weekday-map coupling documented-not-rewritten).

### Still OPEN (explicit deferrals — larger or design-level)
M-21 ICS recurrence/TZ-description-time/uid-hash · M-31 `?share=` producer implementation-or-spec-cut · M-33 focus traps ×8 modals · M-43 ghost-tab event migration on id remap · M-48 god-module splits · M-49 storage schema v3 typing/indexes · M-52 UI polish bundle (vocabulary, 🏀 fallback, badge diet, scroll affordances) · M-54 shell deploy twin · M-53 stays a watch item (precache 1456 KiB).

---

## TIER P0 — crashes, data corruption, dishonest data (days)

| # | Finding | Sources | Status | Fresh proof |
|---|---|---|---|---|
| M-01 | Rules-of-hooks crash: opening “Perhe” white-screens app (no boundary to catch it) | ⑥C2 ⑦N1 | OPEN | `FamilyManageModal.tsx:51→53→141` |
| M-02 | No global failure net (ErrorBoundary / unhandledrejection) | ①F1 ②F-04 ⑥H9 ⑦V2 | OPEN | grep → 0 hits |
| M-03 | `"HH:24"` RangeError kills freeform message import | ②F-01 ⑦V1 | OPEN | `messageParserNLP.ts:147` (warmup wraps correctly :154-156) |
| M-04 | Upstream outage → synthetic season persisted + family-synced; **contradicts FAMILY_SYNC_FINAL constitution (`fallbackToSynthetic:false`)** | ③C1 ⑤#2 ⑧P8 | OPEN | `ingestOfficial.ts:54` `!cup`, second fallback `:64` |
| M-05 | Fabricated match magazine persisted to db, rendered “Päättynyt 2–1” for upcoming games, misattributed to Torneopal | ②F-13data ②F-14 ⑦V14-V17 ⑥M11 | OPEN | `statsEngine.ts:1433` comment lie, `:1447` default score, `MatchStatsModal.tsx:218-224`, footer `:882` |
| M-06 | Weather honesty residue: negative-cache forever, `rainProb` never computed, ×1.2 invented timeline point *(offline fabrication itself FIXED)* | ③M2 ⑦V19-V20 | PARTIAL | catch→null FIXED (`fmiWeatherEngine.ts`); `:62-64`, `:101`, `:145` OPEN |
| M-07 | Demo start wipes user data without consent; total-failure rolls back to empty DB | ⑥M15 ⑦V64/N14 | OPEN | `App.tsx:193-194`, `:267-272`; auto-reseed loop already removed ✅ |
| M-08 | Demo profiles leak into real family-sync uploads | ⑦N2 | OPEN | `familyCloud.ts:294` unfiltered `toArray()` |
| M-09 | Silent import/join failures: QDIB join no else, save try/finally no catch; WhatsApp/Table/OCR zero-result renders blank | ③M4part ⑦V60,N13 ⑥H7 | OPEN | `QuickDropInBar.tsx:83ff/:99ff`; `SmartImportModal.tsx:200` |
| M-10 | Worker KV unguarded JSON.parse bricks a family slot on one corrupt record | ②F-19 ⑦V38 | OPEN | `worker.ts:179`, `:212` |
| M-11 | Reconciliation pipeline unwired — mismatch banner unreachable, `unlink` unimplemented; **specified by REQ-10/11 + SPEC §5.3-5.4** | ⑥C5 | OPEN | only `mismatchFlags: undefined` writers exist; `ingestOfficial.ts:123` hardcodes auto_matched |

## TIER P1 — security, privacy, safety integrity (weeks)

| # | Finding | Sources | Status | Fresh proof |
|---|---|---|---|---|
| M-12 | Family-API cluster: capability-code only, CORS `*`, DELETE w/o If-Match, unsanitized passthroughs, non-atomic limiter | ③H1 ②F-03/F-19 ①F5 ⑦S1-S2 | OPEN | `worker.ts:127-132`, `:273-278`, `:51-75`, `:230-240` |
| M-13 | Lightning safety: engine dead code + truthiness edges (0 km, epoch-0, future strike) + WATCH has no recency filter | ②F-07 ⑦V4-V5 ⑦P1 | OPEN | zero prod callers; `lightningSafety.ts:58-67`, `:35`, `:42-44` |
| M-14 | No timeout chain: familyCloud GET/PUT, ICS ingest, LIPAS/hel.fi — hangs stack with M-16 | ③M1 ②F-16 ⑦V18 | OPEN | AbortSignal count = 0 in those modules |
| M-15 | Geocoder invents Helsinki for any unmatched venue behind empty catches | ③H3 ⑥M14 ⑦V21 | OPEN | `sportsGeocoder.ts:411` |
| M-16 | Concurrent sync cycles: 4 triggers, zero single-flight → duplicate fan-out, 409 churn, self-429; background failure never surfaces | ③H2 ⑥M13 | OPEN | `App.tsx:103-116`; lock grep → 0 |
| M-17 | Tombstone lifecycle: KV sliding-TTL erases history → deleted kids resurrect after 7 d gap; 5 s undo timer loses tombstones on tab close | ⑦N3/N4 | OPEN | `worker.ts:256-258`; `FamilyManageModal.tsx:83/:113` timers |
| M-18 | Unguarded venue-coordinate deref can throw in Navigate handlers (type lies: required coords vs optional sources) | ②F-02 ⑦V3 | OPEN | `App.tsx:755`, `:832` |
| M-19 | Reconcile matcher contradicts contract: UTC-day gate vs ±24h comment (00:00–02:59 FI events), alias substring ⇒ 1.0, bare-vs-full 0.8 double bonus | ②F-10 ⑦V6-V9 ⑧P2 | OPEN | `reconciliationEngine.ts:76-106`; `teamNameMatcher.ts:275-300` |
| M-20 | CI cannot gate main: post-hoc only AND root `tsc --noEmit` type-checks nothing (solution config) | ①F3 ⑧P9 | OPEN | `.github/workflows/ci.yml`; `tsconfig.json` files:[] |

## TIER P2 — robustness, honesty, process (30–60 d)

| # | Finding | Sources | Status | Fresh proof |
|---|---|---|---|---|
| M-21 | ICS correctness cluster: device-TZ setHours, zero RRULE/RDATE/EXDATE, unstable random uids, serial geocoding | ②F-11 ⑦V10-V13 | OPEN | grep RRULE → 0; `icsParser.ts:250/:545` |
| M-22 | xlsx ^0.18.5 known advisories parse untrusted uploads | ①F4 ⑦V28 | OPEN | `package.json:34` |
| M-23 | OCR fetches unpinned CDN wasm/langdata at runtime — breaks offline-first | ③M7 ⑦V29 | OPEN | `ocrImageParser.ts:17` no paths |
| M-24 | Radar modal mounted per-card forever; timestamp interval ungated by isOpen | ③M6corr ⑦V48 | OPEN | `RainRadarCurve.tsx:138`; deps `[]` at `LiveWeatherRadarModal.tsx:41-46` |
| M-25 | Torneopal citizenship: no backoff/Retry-After, 429≡404, worst-case ~40 s hang; cup router counts pre-cancelled fixtures (imported>0 lie) | ③M3 ⑦V45/V47 | OPEN | `torneopalClient.ts:187-189`; `ingestOfficial.ts:80-82` vs `:210` |
| M-26 | Failure-masking UX: proxy outage = “Otteluita ei löytynyt”, 429 = “Perhettä ei löytynyt”, orphan profile on failed import | ③M4 ⑥low | OPEN | `ingestOfficial.ts` `!res.ok→0`; `FamilyShareModal` 429 msg |
| M-27 | Club quick-search silently overwrites form fields; two catalog clubs share one live teamId (185085) → wrong-team imports | ⑥H6 | OPEN | `SmartImportModal.tsx:513-521`; catalog `:25/:58` |
| M-28 | `?perhe=` deep-link join failure shows nothing — OPS §7 *mandates* specific error strings; retry preserved since success-gated replaceState | ⑥H1 | PARTIAL | App perhe block success-only branch |
| M-29 | Ambient mode exit control unwired; `/ambient` re-traps on reload; receives filtered events | ⑥H2 | OPEN | `AmbientView.tsx:121` vs App render w/o `onExit` |
| M-30 | Backup airgap: copy oversells (“kaikki”); file-import doesn’t run spec’d hydration (roster-only exclusion itself BY-DESIGN) | ⑥H3→D-I/D-II | OPEN | `familyShare.ts` export fields; FINAL Phase-0 spec |
| M-31 | `?share=` receive path fully built, producer never written (spec’d Phase 0); manual-profile id collision `p:{name}:''` | ⑥H4 ⑧ | OPEN | `generateSharePayload` zero callers |
| M-32 | Venue correction triple-loss: event never updated, pin keyed/stored inconsistently w/ normalizer, illegal surface values via `as any` | ⑦V58/N7 ⑥M9 | OPEN | `VenueCorrectionModal.tsx:30/:40-48/:129` |
| M-33 | All 8 modals: no focus trap/initial focus/restore; 5 lack role=dialog/Escape; 4 unnamed closes (Radix unused dep) | ⑥H8 | OPEN | hand-rolled overlay pattern repo-wide |
| M-34 | A11y debt bundle: 17 components zero aria, tabIndex=0 repo-wide, 1 img alt-less, daylight-theme accent pairs 3.1–3.6:1, `dark:` keyed to OS not toggle, <44 px resolve/stepper targets, SR naming/live-region gaps | ②F-17 ⑥M1/M2/M7/M10 ⑦V | OPEN | tokens.css `#8a8000/#faff69`; 0 `@custom-variant`; `MatchdayCard:187` ≈27 px |
| M-35 | Docs drift catalog: USE_CASES salamavahti “Existing” (dead engine), SPEC ±24h vs UTC-day, FINAL 30 s vs 180 s poll + dropped dual-header still honored, AUDIT.md phantom endpoints/routes, ARCHITECTURE “no LLM” vs Gemini session, SPEC §8 perf criterion unwired, README 13-tests | ⑦§5 ②F-18 ①F2 ⑧P4/P6/P7 | OPEN | sites per 1730 pass |
| M-36 | Test honesty: vacuous `if(result)` guards, Node-env “e2e”, wall-clock thresholds, `reuseExistingServer:true`, browser specs out of CI | ②F-05/F-20 ⑦V22/V24 | OPEN | quoted guard `m1_adversarial…:55-61`; `vitest.config.ts:6`; `playwright.config.ts:35` |
| M-37 | Coverage holes: ocrImageParser/proxyUrl/ingestOfficial/popularClubsCatalog/fmiWeatherEngine + entire component tree untested | ②F-06 ⑦V23 | OPEN | 0 test refs each |
| M-38 | Quality gates decorative: lighthouserc never runs, Playwright never runs, wranglerVersion 4.24.0 vs ^4.124.0 | ②F-24 ①F7 ⑦V25 | OPEN | workflow greps |
| M-39 | Theme pref write-only (FOUC); `<html class="dark">` hardcoded | ⑦V55/N15 | OPEN | getItem('theme') → 0 hits; `index.html:2` |
| M-40 | Temporal-freshness UI: snapshot memo w/o clock dep → countdown frozen; sticky-stack hides day headers/departure; hero vanishes >2 h post-event | ⑥M3/M4/M5 ⑦V62/N8 | OPEN | `App.tsx:300-304`; `TimelineCalendarView:140` top-12; `planner.ts:179` |
| M-41 | Hero/Ambient countdowns bypass custom arrival rules; global `_arrivalRules` planner arg dead | ⑦V49-V50/N11 | OPEN | bare calls `HeroMatchCard:30`, `AmbientView:92` vs `planner.ts:185` |
| M-42 | Adopt-official stamps override even when falling back to calendar time | ⑦V59/N6 | OPEN | `App.tsx:494-505` `\|\| ev.startTime` + unconditional action |
| M-43 | Family-join remap leaves ghost tabs (legacy rows keep events) — violates stable-id design FINAL §4.2; forced `'sininen'` on merged rows | ⑥M12 ⑦V65 | OPEN | `familyCloud.ts:178`, remap block :308-330 region |
| M-44 | Inconsistent click contracts: Tiivis rows pointer-only/no keyboard, training taps animate-nothing, Kalenteri inert, WeekendStrip hover-buttons no-op | ⑥M6 | OPEN | no tabIndex/role/onKeyDown in TimelineCalendarView; WeekendStrip gets no onSelectEvent |
| M-45 | SmartImport late success timers fire post-close; Escape doesn’t cancel in-flight imports | ⑦V61/N13 | OPEN | `SmartImportModal.tsx:101-109`, `:234/:274` |
| M-46 | Clear-all clears 2 tables; complete clearer exists unused; learned aliases survive everywhere | ②F-08 ⑦V54 | OPEN | `App.tsx:278-283`; `db.ts:430` unused |
| M-47 | Copilot honesty: 5-event context slice, hardcoded 0.98 confidence, silent catch, “100 % laitekohtainen” while silently using Gemini sessions | ⑦V51-V52 ⑧P6 | OPEN | `localAiEngine.ts:270-298`; `AskCopilotModal.tsx:95` |

## TIER P3 — structure & polish (60–90 d)

| # | Finding | Sources | Status | Fresh proof |
|---|---|---|---|---|
| M-48 | God modules block safe change: statsEngine 1735 ln, App 942 ln (root cause of merge collisions) | ②F-13struct ①F6 | OPEN | measured today |
| M-49 | Storage layer: `\| any` ×2, JS-side filtering despite indexes *(the .update(undefined) sub-claim is DENIED — do not reopen)* | ②F-22 ⑧denial | OPEN-partial | `db.ts:46-47`, `:214-227` |
| M-50 | Dead/duplicated code: tournamentLeaveHint, sportsWeekendRange, duplicated DST/proxy helpers, orphan associationExtractor.fetchOfficialTeamData | ②F-21 ③M5 ⑦V30/V46 | OPEN | zero callers greps |
| M-51 | Locale-hardened time math needed (en-US weekday coupling, `y\|\|2026` repair, +03:00 hardcodes, DST fall-back week off-by-1h) | ②F-12/F-25 ⑦V33-V34 | OPEN | `time.ts:36/:55/:91`; `planner.ts:42/:103` |
| M-52 | UI language/polish bundle: badge soup (~14 pill styles), ottelu/tapahtumaa/peliä drift, 🏀 swallows 3 sports, mixed time formats, “Tulitus”, hidden-scroll affordances, ambient staleness/burn-in/wake | ⑥lows ⑦V | OPEN | screenshot + line evidence per 1606 doc |
| M-53 | Precache budget watch (1439.73 KiB / 30 entries today) — fine, but trend-untracked until lhci wired (pairs M-38) | ①F7 ⑦V36 | OPEN-watch | fresh build output |
| M-54 | Deploy automation PowerShell-only on macOS-first repo | ①F8 | OPEN | no `.sh` twin |

---

## RESOLVED during audit windows (verified — do not reopen)

| Item | Proof |
|---|---|
| Mid-merge broken tree (conflict markers ×10 files) | resolved by `494c902`; grep markers → 0 |
| Offline “Päivitä sää” fabricated forecasts | `fmiWeatherEngine.ts` catch → `return null` |
| Refresh never re-fetching schedules | `handleRefreshAll` loops `ingestSourceForProfile` (residual per-team error surfacing → folded into M-26) |
| Onboarding trash deleting nothing | `OnboardingWizard.tsx:195` routes to real delete+tombstones |
| Demo auto-reseed loop (`needsDemoRefresh`) | effect removed on main (consent issue remains as M-07) |
| 26 TS errors / empty test file / static tesseract import | build exit 0 · 401/401 · dynamic import `localAiEngine.ts:325` |

## DEBUNKED (closed forever, with authority)

| Claim | Refutation |
|---|---|
| “`.update(undefined)` unlink is a no-op” (canonical #23 sub-claim) | `db.ts:389` writes undefined field; `m1_storage_concurrency.test.ts:299` asserts applied; suite green |
| “WFS fixture exists unused” | consumed at `mockFetch.ts:100` + asserted `harness.test.ts:129` |
| “No navigateFallback/skipWaiting config whatsoever” | skipWaiting/clientsClaim present `vite.config.ts:37-39` (only navigateFallback missing → folded into M-38 scope) |
| “Rate limiter XFF-spoofable in threat model” | CF-Connecting-IP primary header; direct-origin out of scope (hygiene note kept in M-12) |
| Federation keys as secret leak / i18n missing / backend rewrite | BY-DESIGN per source comments + project constitution |

## BY-DESIGN (documented intent — closed)

Operator-issued family codes, fail-closed worker (FAMILY_CODES_OPS) · roster-only KV/bus + per-phone hydrate (FAMILY_SYNC_FINAL §0/§3) · single-market FI (no i18n) · local-first + edge-proxy architecture · public federation SPA constants.

---

*Register generated by ox-alpha, 2026-08-24T17:45 @ `f1f0b4b`. Traceability: every Sources cell lists the original audit IDs absorbed; per-finding full proofs live in the linked source audits and the 1730 proof-or-deny pass. Fix order recommendation: P0 M-01→M-11 sequentially (each ≤ half-day except M-04/M-11), then P1 numerically.*
