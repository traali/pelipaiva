# AUDIT — Cross-Check Verdicts: Every Prior Finding Re-Verified First-Hand

| | |
|---|---|
| **File** | `AUDIT_2026-08-24T1715_ox-alpha_crosscheck-verdicts.md` |
| **Date** | 2026-08-24T17:15 (+0300) |
| **Model / Author** | `ox-alpha` (stealth/ox-alpha via opencode CLI) |
| **Method** | Independent 20-agent user-journey audit (UJ-01…UJ-11, 11 journeys × 20 personas with peer-review debate and weighted voting), followed by a two-pass adversarial fact-check of **every claim in all five prior committed audits + every product doc**, re-verified directly against the working tree. No subagent hearsay in the final tables: every verdict below was confirmed by direct file read or grep during the pass. Where this audit's own earlier claims were wrong, they are corrected in §6. |
| **Verification commands** | `npm run build` → exit 0 · `npm run lint` → exit 0 · `npx vitest run` → 45 files / 401 tests passed · targeted `grep`/`sed` reads on ~60 claim sites · fresh `dist/sw.js` precache inspection (30 entries) |
| **Snapshot** | main @ `b1dba65` |
| **Inputs fact-checked** | ① `AUDIT_2026-08-24T1358_…20nation-council-review.md` · ② `AUDIT_2026-08-24_ox-alpha.md` (F-01…F-25) · ③ `AUDIT_2026-08-24T1405_…external-api-lifecycle-failure-audit.md` (C1,H1–H3,M1–M7) · ④ `AUDIT_2026-08-24T1407_…priority-order-findings-and-fixes.md` · ⑤ `AUDIT_2026-08-24T1408_…canonical-priority-merge.md` · ⑥ `1606 NEXUS UI/UX review` · product docs (`USE_CASES`, `SPECIFICATIONS`, `ARCHITECTURE`, `AGENT_GRAPH`, `AUDIT.md`, `FAMILY_SYNC_FINAL`, `FAMILY_CODES_OPS`) |

---

## 1. Executive summary

The five committed council audits are **high quality**: of all distinct verifiable claims extracted, **~96 % survive first-hand re-verification**. Exactly **two claims are debunked** (§3) — one refuted by the project's own passing test suite, one by a simple grep. Three claims are softened with mechanism-level corrections (§4). Six **product-doc-vs-code drift defects** are catalogued (§5). This audit additionally contributes **16 verified findings absent from all prior audits** (§7), including a React rules-of-hooks crash class and a demo-data-leak path into real family sync.

---

## 2. Claims VERIFIED VALID (evidence quoted first-hand)

| # | Claim (source) | Verdict | Proof |
|---|---|---|---|
| V1 | `"HH:24"` RangeError kills freeform import [② F-01, ③ C1-adjacent] | ✅ VALID | `messageParserNLP.ts:147` `const endH = (h+1).toString()…` — no modulo; sibling warmup wraps correctly via `totalMins < 0 ? += 1440` (`:154-156`); crash materializes at `new Date(…).toISOString()` (`localAiEngine.ts:50-52`) |
| V2 | No ErrorBoundary / unhandledrejection net anywhere [① F1, ② F-04] | ✅ VALID | repo-wide grep `ErrorBoundary\|componentDidCatch\|unhandledrejection` in `src/` → **0 hits**; `main.tsx` renders `<App/>` bare inside StrictMode only |
| V3 | Unguarded venue-coordinate deref on Navigate [② F-02] | ✅ VALID (type-lie real) | `coordinates: Coordinates` required (`matchday.ts:39`) vs optional sources `venueLat?/venueLng?` (`:244-245`); both call sites dereference unguarded (`App.tsx:754-757`, `:830-835`). Practical trigger requires legacy rows — ingest always fills coords today |
| V4 | Lightning-safety truthiness edges [② F-07] | ✅ VALID | exactly-0 km strike skipped: `if (nearestStrikeKm && nearestStrikeKm <= 20)` (`lightningSafety.ts:58`); epoch-0 treated as unset (`:35`); future strike → negative elapsed passes `< 30` (`:43-44`) |
| V5 | WATCH tier lacks recency filter *(this audit)* | ✅ VALID | `lightningSafety.ts:58-67` returns watch for any ≤20 km strike regardless of age; only the danger tier checks time (`:42-44`) |
| V6 | Reconciliation UTC-day equality contradicts ±24h comment [② F-10] | ✅ VALID | day key from UTC components (`reconciliationEngine.ts:76-85`) vs literal 180-min tolerance (`:88-89`) — self-contradictory windows |
| V7 | Blast radius = early-morning events, not evenings [② fact-check #2] | ✅ UPHELD — corrects this audit's earlier "evening" phrasing | UTC midnight ≈ 02:00–03:00 Helsinki ⇒ straddle window is 00:00–02:59 local |
| V8 | Learned alias forces similarity 1.0 on substring containment [② F-10] | ✅ VALID | `offOpponent.toLowerCase().includes(learnedAway.toLowerCase())` → `simAway = 1.0` (`reconciliationEngine.ts:97-106`). Design-intent note: `SPECIFICATIONS.md §5.2` documents learning-at-1.0 as *specified* behavior — collision risk remains an implementation hazard, not an accident |
| V9 | Bare "HJK" vs "HJK T13 Sininen" scores 0.8 double-bonus [② F-10] | ✅ VALID | arithmetic confirmed: base 0.6 (`teamNameMatcher.ts:275`) + no-age-tag +0.1 (`:284`) + else +0.1 (`:300`) = **0.80** |
| V10 | ICS: zero RRULE/RDATE/EXDATE support [② F-11] | ✅ VALID | grep across `icsParser.ts` → 0 hits |
| V11 | ICS unstable id fallback breaks dedupe [② F-11] | ✅ VALID | `` event.uid || `event-${Date.now()}-${Math.random()…}` `` (`icsParser.ts:545`) |
| V12 | ICS description times parsed device-local [② F-11] | ✅ VALID | `explicitKickoff.setHours(kHour, kMin, 0, 0)` on a runtime-local Date (`icsParser.ts:≈250`) |
| V13 | Serial per-event geocoding [② F-11] | ⚠️ PARTIAL | loop is serial awaits (`icsParser.ts:538-542`) **but** `venueCache` dedupes repeated venue strings — perf framing only |
| V14 | Synthetic rosters with real-looking child names shipped to prod bundle [② F-13] | ✅ VALID | full name/jersey/goals rows hardcoded incl. "Simo Oinonen", "Lilli Oinonen" (colliding with demo-family names) `statsEngine.ts:1041-1048`, `:1194-1200`; export graph-reachable at `:1436` |
| V15 | `generateOrResolveMatchStats` doc-comment lies about production usage [② F-14] | ✅ VALID | comment verbatim *"Test-only invented magazine. Production ingest never calls this."* (`statsEngine.ts:1432-1435`) while called from `MatchdayCard.tsx:100-102` (and **persists to IndexedDB**) and `App.tsx:909/:927` |
| V16 | Fabricated scores presented as finished ("Päättynyt") [② F-14 + this audit] | ✅ VALID | default `liveScore = { home: 2, away: 1, isLive: false, period: 'Päättynyt' }` (`statsEngine.ts:1447`); scoreboard renders `liveScore?.home ?? 0` + `period \|\| 'Päättynyt'` for upcoming matches (`MatchStatsModal.tsx:218-224`) |
| V17 | Misattribution footer + fake scout line [② F-14 + this audit] | ✅ VALID | `"Lähde: Palloliitto Tulospalvelu / Torneopal"` (`MatchStatsModal.tsx:882`); hardcoded kuntopuntari line `:874` |
| V18 | No timeout chain: familyCloud GET/PUT, geocoder, ICS ingest [③ M1] | ✅ VALID | no `AbortSignal` anywhere in `sportsGeocoder.ts` (grep 0); bare `fetch(target)` hand-building proxy URL bypassing `proxiedUrl()` (`ingestOfficial.ts:166-167`); familyCloud fetches unguarded |
| V19 | Weather memo negative-caches failures forever [③ M2] | ✅ VALID | `weatherMemo.set(key, pending)` stores promise **before settlement** (`fmiWeatherEngine.ts:63-64`); rejection cached permanently; underlying fetch has no timeout |
| V20 | rainProb hardcoded 0; ×1.2 fabricated timeline point; first-timestep-only sampling [this audit] | ✅ VALID | `let rainProb = 0` never reassigned (`:101`); parses only `lines[0]` (`:104`); `precipitationMmh: Math.round(rainMmh * 1.2 …)` second point (`:143-146`) rendered as data by `RainRadarCurve.tsx:70-95` |
| V21 | Geocoder silently falls back to Helsinki for any unmatched venue [③ H3] | ✅ VALID | final return `{ lat: 60.1872, lng: 24.9248 }` with empty catch above (`sportsGeocoder.ts:400-416`) |
| V22 | Vacuous adversarial guards [② F-05] | ✅ VALID | `if (result) { expect(result.canonicalUrl)… }` (`m1_adversarial_parser_extractor.test.ts:55-61`) — assertions skipped when parser returns null |
| V23 | Five lib modules zero-tested [② F-06] | ✅ VALID | ocrImageParser / proxyUrl / ingestOfficial / popularClubsCatalog / fmiWeatherEngine → 0 test-file refs each (grep). *But see D2 for the fixture sub-claim* |
| V24 | CI = npm ci + tsc --noEmit + vitest + build only; no lhci/playwright [① F3, ② F-24] | ✅ VALID | `.github/workflows/ci.yml:28-37` exactly those steps |
| V25 | Wrangler version drift [② F-24] | ✅ VALID | `cd.yml:46` pins `wranglerVersion: '4.24.0'` vs `cloudflare-worker/package.json:12` `"wrangler": "^4.124.0"` |
| V26 | README test-count drift [① F2, ② F-18] | ✅ VALID | `README.md:99` `"# Run Vitest test suites (13 tests in ~250ms)"` vs measured 45 files / 401 tests |
| V27 | Phantom endpoints/docs drift [② F-18] | ✅ VALID + EXTENDED (see §5 P7) | `/api/sync/:key`, `/api/nest/brief`, `src/routes/api/proxy/ics.ts` do not exist anywhere in the tree |
| V28 | xlsx@^0.18.5 known advisories parsing untrusted uploads [① F4] | ✅ VALID | pin confirmed (`package.json:34`); SheetJS CE 0.18.x prototype-pollution/ReDoS advisories are public record; consumed via `tableAndExcelParser` |
| V29 | OCR depends on unpinned CDN assets at runtime [③ M7] | ✅ VALID (in substance) | `createWorker('eng+fin', 1, { logger })` sets **no** workerPath/langPath/corePath (`ocrImageParser.ts:13-21`) → tesseract.js v7 library defaults fetch wasm/worker/langdata from public CDN; breaks offline-first guarantee |
| V30 | Dead exports `tournamentLeaveHint` / `sportsWeekendRange` [② F-21] | ✅ VALID | zero callers repo-wide; latter only re-exported (`agents/index.ts:7`), never consumed |
| V31 | Storage type escapes `Table<Record \| any>` ×2 [② F-22] | ✅ VALID | `db.ts:46-47` |
| V32 | Standings/range queries filter in JS despite compound index [② F-22] | ✅ VALID | `getOfficialFixturesByDateRange` loads table then JS-filters (`db.ts:214-227`) |
| V33 | time.ts en-US weekday coupling with silent `?? 1`/`?? 5` fallbacks; `y \|\| 2026` garbage repair [② F-25] | ✅ VALID | `sportsWeekRange` map+`\?\? 1` (`time.ts:52`), weekend variant `\?\? 5` (`:85`), `Date.UTC(y \|\| 2026, …)` (`:36`) |
| V34 | planner hardcodes `+03:00`; DST week-range off-by-one-hour [② F-12] | ✅ VALID | `` new Date(`${todayISO}T12:00:00+03:00`).getDay() `` also device-local weekday (`planner.ts:42-43`); repeated `:103` |
| V35 | No security headers on Pages [④ 1-7] | ✅ VALID | `public/_headers` contains **only Cache-Control rules** — no CSP / X-Frame-Options / HSTS / X-Content-Type-Options |
| V36 | Precache 30 entries [① F7] | ✅ VALID (count) | fresh `dist/sw.js` = exactly 30 revision entries; 1439 KiB figure not byte-re-measured |
| V37 | Resolved-items table (26 TS errors gone; 401 tests green; tesseract lazy-loaded) | ✅ RE-VERIFIED TODAY | build exit 0; dynamic import chain `localAiEngine.ts:315/:325`; suite 401/401 |
| V38 | Worker: unguarded KV JSON.parse bricks slot [② F-19, ⑤ #5] | ✅ VALID | `JSON.parse(dataStr)` GET (`worker.ts:179`) and PUT-read (`:212`), neither wrapped |
| V39 | DELETE without If-Match/rev guard [③ H1] | ✅ VALID | unconditional `MATCHDAY_KV.delete(kvKey)` (`worker.ts:273-278`) |
| V40 | CORS `Access-Control-Allow-Origin: '*'` on all responses incl. proxy [③ H1] | ✅ VALID | `worker.ts:127-132` |
| V41 | Rate limiter non-atomic Cache-API match→put; per-PoP semantics [① F5, ③ H1] | ✅ VALID (accepted limitation per ① consensus) | `worker.ts:54-69` |
| V42 | Sanitizer passthrough fields (id/sport/colorHex/associationUrl/teamId) [③ H1] | ✅ VALID | `worker.ts:230-240`: only `\|\| default` fallbacks — no hex/enum/scheme validation; tombstones unbounded; `profiles:[null]` would throw post-schema-check |
| V43 | Code keyspace ~31M (not billions) | ✅ VALID — corrects this audit's earlier 2⁶⁰-class estimate | alphabet 32 chars (`FAMILY_CODES_OPS.md:24`), format `XXXXX-C` = **5 random + check digit** → 32⁵ ≈ 33.5 M |
| V44 | `Math.random()` codegen non-CSPRNG [③ H1] | ✅ VALID, moot under ops-manual issuance | `familyCode.ts:14-17`; issuance is human-run via secret |
| V45 | Torneopal client 10 s timeout × up to 4 endpoint attempts, no overall deadline [this audit] | ✅ VALID | `AbortSignal.timeout(10000)` per attempt (`torneopalClient.ts:187`), attempt list built at `:150-169` |
| V46 | associationExtractor dead code in prod graph [③ M5] | ✅ VALID | only importers are 4 test files; zero src consumers |
| V47 | Cup count-fidelity mismatch [this audit] | ✅ VALID | cancelled fixtures filtered before persistence (`ingestOfficial.ts:80-82`) but router returns pre-filter `official.fixtures.length` (`:210`) — caller's `imported === 0` check can pass with zero persisted events |
| V48 | Radar modal interval runs while closed, mounted permanently per card [this audit] | ✅ VALID | `<LiveWeatherRadarModal>` rendered unconditionally (`RainRadarCurve.tsx:137-143`); timestamp effect deps `[]` ignores `isOpen` (`LiveWeatherRadarModal.tsx:41-46`). Animation loop *is* correctly gated (`:49-59`) |
| V49 | Hero/Ambient countdowns bypass custom arrival rules [this audit] | ✅ VALID | bare calls `calculateDepartureCountdown(event)` (`HeroMatchCard.tsx:30`, `AmbientView.tsx:92`) vs planner's `nextPlayer?.arrivalRules` (`planner.ts:185`) → contradictory departures when rules configured |
| V50 | Global `_arrivalRules` planner param accepted-but-ignored [this audit] | ✅ VALID | `planner.ts:176`; only per-profile rules consumed at `:185`. Nuance: per-*player* rules DO apply; the global defaults table does not |
| V51 | Copilot truncates context to 5 events + hardcoded 0.98 confidence + silent catch [this audit] | ✅ VALID | `events.slice(0, 5)` (`localAiEngine.ts:279`), `confidence: 0.98` (`:291`), empty `catch { // Fallback silently }` (`:296-298`) |
| V52 | "100% Laitekohtainen tekoäly" claim vs Gemini path [this audit + §5 P6] | ✅ VALID | `AskCopilotModal.tsx:95`; cloud-vendor model session at `localAiEngine.ts:271-293` when `window.ai` available |
| V53 | Upcoming matches rendered as finished 0–0 [this audit] | ✅ VALID | see V16 |
| V54 | Clear-data resets 2 of 9 tables; complete clearer unused; aliases survive everywhere [② F-08 + this audit extension] | ✅ VALID | `handleClearData` = `profiles.clear(); events.clear();` only (`App.tsx:278-283`); `clearAllDatabaseData` clears 8 but omits `customAliases` and is never called by UI (`db.ts:430-440`) |
| V55 | Theme preference write-only; dark FOUC [this audit] | ✅ VALID | zero `getItem('theme')` repo-wide; `index.html:2` hardcodes `<html lang="fi" class="dark">`; toggle writes `localStorage['theme']` unread (`ThemeToggle.tsx:21,:24`) |
| V56 | Clipboard false-success [this audit] | ✅ VALID | fire-and-forget `navigator.clipboard.writeText(...)` + unconditional `setCopied(true)` (`FamilyShareModal.tsx:121-136`) |
| V57 | deleteOfficialTeamData docstring claims ACID, isn't [this audit] | ✅ VALID | comment `:293` vs keys read outside tx (`:296-301`) then three separate bulkDeletes (`:306-310`) |
| V58 | Venue-correction triple loss [this audit] | ✅ VALID | event record never written (pin only, `VenueCorrectionModal.tsx:40-48`); pin key `name.toLowerCase().trim()` (`:30`) ≠ geocoder normalizer stripping `[.,\-\/()]` (`sportsGeocoder.ts:275-278`); illegal surfaces `indoor_turf/sand/ice` persisted via `as any` select (`VenueCorrectionModal.tsx:129,:135-136`) against closed `PitchSurface` union (`matchday.ts:13-19`) |
| V59 | Adopt-official stamps override even on silent fallback [this audit] | ✅ VALID | `ev.mismatchFlags.officialStartTime || ev.startTime` with unconditional `userOverride.action:'adopt_official'` (`App.tsx:494-505`) |
| V60 | QuickDropInBar save: try/finally with NO catch → silent failure [this audit] | ✅ VALID | `QuickDropInBar.tsx:99-145`; throwers documented at `localAiEngine.ts:40-45` |
| V61 | SmartImportModal success timers fire post-close; Escape doesn't cancel in-flight work [this audit] | ✅ VALID | uncleared `setTimeout(… onClose(), 1100/1000)` (`SmartImportModal.tsx:233-238`, `:273-278`); Escape handler closes regardless of `isSaving` (`:101-109`) |
| V62 | Frozen wall-clock snapshot — leave-by never ticks until DB change [this audit] | ✅ VALID | `useMemo(() => runMissionControlGraph(rawEvents, profiles, new Date(), …), [rawEvents, profiles, arrivalRules])` (`App.tsx:300-303`) |
| V63 | FamilyLogisticsModal recomputes entire mission graph per render while open [this audit] | ✅ VALID | unmemoized ternary calling `planFamilyLogistics(events, profiles)` → `runMissionControlGraph` (`FamilyLogisticsModal.tsx:22-23`; `localAiEngine.ts:96`) |
| V64 | Demo start destructively wipes user data without confirmation; rollback restores empty [this audit] | ✅ VALID | `db.profiles.clear(); db.events.clear()` pre-ingest (`App.tsx:193-194`); total-failure path returns to empty wizard (`:267-271`); no confirm dialog |
| V65 | Forced `'sininen'` primaryColor on remote merge rows (+ `associationType as any`) [this audit] | ✅ VALID | `familyCloud.ts:178,:180` |
| V66 | Walking-time falsy bug (`\|\| 3` makes explicit 0 impossible) [this audit] | ✅ VALID | `deterministicReasoner.ts:90` |
| V67 | Dead carpool branch reassigning default driver slot [this audit] | ✅ VALID | `else if (i > 0 && !isConflicted) driverSlot = 'kuski-1';` (`carpoolAgent.ts:48`) |

---

## 3. Claims DEBUNKED ❌

| # | Claim (source) | Verdict | Refutation |
|---|---|---|---|
| D1 | "`.update(undefined)` no-op unlink" (`db.ts:389-391`) [② F-22] | ❌ **INVALID** | Refuted by the project's own passing suite: `unlinkEventFromOfficialFixture` writes `officialFixtureId: undefined` and `m1_storage_concurrency.test.ts:297-299` asserts the field **is** undefined afterwards — 401/401 green. Dexie applies the update; index entry disappears as intended |
| D2 | "WFS fixture exists unused" (`tests/fixtures/json/fmi_weather_sample.json`) [⑤ #14] | ❌ **INVALID** | Used at `tests/helpers/mockFetch.ts:100` and asserted in `tests/helpers/harness.test.ts:129` |

---

## 4. Claims SOFTENED / mechanism-corrected 🟡

| # | Claim | Correction |
|---|---|---|
| S1 | XFF-spoofable rate limiting [② F-19] | Spoofing works only if `CF-Connecting-IP` is absent — always present for requests through Cloudflare. Direct-to-origin hits are out of threat scope. Keep `CF-Connecting-IP`-only cleanup as hygiene |
| S2 | 403/404 issuance oracle [② F-03 context] | Real but **design-accepted**: `FAMILY_CODES_OPS.md §3` documents 404-for-empty-slot as intentional operator verification. Enumeration cost remains materially raised by rate limits (GET 20/900 s/IP). Residual risk tracked in the zero-auth cluster finding |
| S3 | Federation API keys "shipped" [② F-09] | Confirmed public SPA constants by source comments; reframed as rotation/ToS fragility, not confidentiality breach (matches both audits' final framing) |

---

## 5. Product-doc-vs-code DRIFT (new catalog)

| # | Doc says | Code reality |
|---|---|---|
| P1 | `USE_CASES.md:18` "30/30 Salamavahti — **Existing**" | `compute30_30Rule` has zero production callers — safety engine is dead code; no lightning ingestion pipeline exists |
| P2 | `SPECIFICATIONS.md §5.1` "same day (±24 h)" date rule | Engine: same-**UTC-calendar-day** AND ±180 min (`reconciliationEngine.ts:76-89`) — different contract than spec |
| P3 | `FAMILY_SYNC_FINAL §6` "GET on focus + every **30 s** while visible" | Poll interval is **180 s** (`App.tsx:106`, comment admits the change) |
| P4 | `FAMILY_SYNC_FINAL §2` drops dual concurrency headers ("Stop there") | Both `If-Match` **and** legacy `X-Pelipaiva-Rev` still honored (`worker.ts:216-218`) |
| P5 | `docs/AUDIT.md:17-20` parking via "city WFS/signs"; Nest `/api/nest/brief`; `src/routes/api/proxy/ics.ts` | Parking engine is keyword-matching over hardcoded lot names with **synthesized coordinates** (`parkingEaseEngine.ts:35-101`); Nest endpoint and src/routes tree do not exist |
| P6 | `ARCHITECTURE.md:46` "no LLM in the product. Copilot is a keyword matcher" | Copilot silently upgrades to Chrome built-in Gemini Nano sessions when available (`localAiEngine.ts:270-298`) — constitution violated in code, undocumented |
| P7 | `SPECIFICATIONS.md §8` Tier 2 "< 100 ms for 500+ events" performance criterion | Only wall-clock thresholds exist in tests (`m1_storage_concurrency` 1500 ms/1000 ms asserts); no such benchmark wired |

---

## 6. Self-corrections (this audit's earlier claims that were wrong)

| Earlier claim (chat audit) | Corrected to |
|---|---|
| Family-code keyspace ≈ 32⁶ ≈ 1 B | 32⁵ ≈ 33.5 M — format is `XXXXX-C` (5 random + check digit), `FAMILY_CODES_OPS.md:23-25` |
| UTC-day straddle affects "evening kickoffs" | Affects early-morning local events (00:00–02:59 Helsinki); evenings are safely mid-UTC-day |
| Subagent-reported "evening straddle" phrasing | Withdrawn; V7 stands with corrected direction |

---

## 7. Verified findings present in NO prior committed audit (all first-hand proof)

| # | Finding | Key proof |
|---|---|---|
| N1 | **React rules-of-hooks violation** — conditional early return between `useState` blocks | `useState(undoState…)` at `FamilyManageModal.tsx:53` sits after `if (!isOpen) return null;` (`:51`); hook-count varies across open/close transitions → React error #310 class |
| N2 | Demo profiles leak into real family sync — no sandbox boundary | sync uploads `databaseInstance.profiles.toArray()` unfiltered (`familyCloud.ts:294`); demo-prefix rows would sync into joined families |
| N3 | Tombstone resurrection via KV sliding-TTL expiry | doc TTL 604800 (`worker.ts:256-258`) erases tombstone history; offline >7 d device or fresh joiner re-pushes deleted profiles fleet-wide |
| N4 | 5-second undo window loses tombstones on tab close → same resurrection loop | timer-based tombstone recording (`FamilyManageModal.tsx:83-86,:113-116`); closing app before fire = local deletion without tombstone |
| N5 | Cup count-fidelity lie (V47 above) | `ingestOfficial.ts:80-82` vs `:210` |
| N6 | Adopt-official mis-stamp on fallback (V59) | `App.tsx:494-505` |
| N7 | Venue-correction triple loss (V58) | modal/geocoder/persistence sites above |
| N8 | Frozen wall-clock snapshot (V62) | `App.tsx:300-303` |
| N9 | Logistics modal full-graph recompute per render (V63) | `FamilyLogisticsModal.tsx:22-23` |
| N10 | Radar interval-always-on per card (V48) | `RainRadarCurve.tsx:137-143` + `LiveWeatherRadarModal.tsx:41-46` |
| N11 | Hero/Ambient arrival-rule bypass (V49) + dead `_arrivalRules` param (V50) | `HeroMatchCard.tsx:30`; `AmbientView.tsx:92`; `planner.ts:176` |
| N12 | QuickDropInBar silent save failure (V60) | `QuickDropInBar.tsx:99-145` |
| N13 | SmartImportModal late timers + uncancellable imports (V61) | `SmartImportModal.tsx:101-109,:233-238,:273-278` |
| N14 | Destructive demo wipe without confirmation (V64) | `App.tsx:190-276` |
| N15 | Theme write-only + FOUC (V55) | `ThemeToggle.tsx`; `index.html:2` |
| N16 | Torneopal worst-case ~40 s hang, no overall deadline (V45) | `torneopalClient.ts:150-206` |

---

## 8. Consolidated priority position (union of everything, post-verification)

**P0 (days):**
1. `HH:24` modulo wrap + typed ParseError (V1)
2. Confirmation gate + full-table reset for demo/clear paths (V64, V54)
3. Guard Worker KV JSON.parse + body validation (V38, V42)
4. Stop persisting/misattributing fabricated stats & rain data (V15-V17, V20)
5. QuickDropInBar catch + error surface (V60); SmartImportModal timer/cancel fixes (N13)
6. Rules-of-hooks fix in FamilyManageModal (N1)
7. Global ErrorBoundary + unhandledrejection listener (V2)

**P1 (weeks):** worker auth cluster (If-Match DELETE, origin-scoped CORS, CSP headers V35/V39/V40) · wire lightning engine or remove the safety claim (P1/V4/V5) · demo-sync sandboxing (N2) · tombstone lifecycle (N3/N4) · timeout chain (V18/V19/V45) · coordinate invariant builder (V3)

**P2 (30-60 d):** fabrication quarantine behind DEV flag (V14) · docs truth-pass incl. §5 items · test-honesty upgrades (V22, fake-IDB migration) · Playwright/lhci into CI (V24) · wrangler alignment (V25) · storage typing/indexing (V31/V32) · xlsx upgrade (V28) · OCR asset self-hosting (V29)

**P3 (60-90 d):** god-module splits · dead-code sweep (V30) · a11y elevation · theme bootstrap fix (V55) · radar interval gating (V10/N10) · locale-hardened time utils (V33/V34)

---

## 9. Round 2 — NEXUS audit (`1606`) fully adjudicated + severity upgrades

> **Snapshot note:** Round-2 proofs below were verified against `b1dba65`. Remediation commits `a996755` / `f325e50` landed on main *while this pass ran*. Post-fix spot-check at `d289dfc` confirms the following Round-1/Round-2 findings are now **FIXED in code**: C2/N1 hooks ordering (all hooks above the `:168` early return), V1 `HH:24` wrap (`((h+1)%24)`), V2 ErrorBoundary (`src/components/ErrorBoundary.tsx` wired in `main.tsx`), V60 QuickDropInBar catch (`:148`), V38 worker KV guarded parse → `500 corrupt_data`, and C5's producer half — `reconcileCalendarWithOfficial` is now invoked from ingest (`ingestOfficial.ts:208`), plus `@custom-variant dark` class strategy landed (`index.css:6`). The remaining Open items in the [master register](./MASTER_FINDINGS_REGISTER.md) supersede the §8 priority list below.

Second pass extended the fact-check to every remaining NEXUS claim with direct evidence. Verdicts:

### Criticals
| ID | Verdict | Proof |
|---|---|---|
| C2 hooks crash | ✅ PROVEN (dup N1) | `FamilyManageModal.tsx:51/:53` |
| C5 reconciliation pipeline dead in prod | ✅ **PROVEN — upgraded to the single largest spec-vs-build gap** | `reconcileCalendarWithOfficial`: zero prod callers; `linkEventToOfficialFixture` exported (`db.ts:366`) but called **only by a test** (`statsEngine.test.ts:804`); production `mismatchFlags:` writes are exclusively `undefined` (`App.tsx:499,:511`); ingest stamps `'auto_matched'`, confidence `1.0` unconditionally (`ingestOfficial.ts:117-118`). The entire mismatch-diagnostics / 1-tap-resolution journey (UJ-04; SPEC §5.3–5.4, TRACEABILITY REQ-10/11) is unreachable at runtime |

### Highs
| ID | Verdict | Proof |
|---|---|---|
| H1 deep-link join silent failure | ✅ PROVEN | `App.tsx:139-147` success-only branch, no else/feedback (OPS §7 requires the messages) |
| H2 ambient trap | ✅ PROVEN | `AmbientView.tsx:12,87,102,121` call `onExit?.()`; App render passes no handler (`App.tsx:524`); `/ambient` reload re-traps |
| H4 `?share=` producer missing | ❌ **DEBUNKED** | Producer exists: `FamilyShareModal.tsx:111` `generateSharePayload(profiles)` → `:117` `${origin}/?share=${directPayload}`. Pass-2 proof missed the modal. Residual manual-profile empty-source-id edge remains unproven |
| H6 club search rewrites form | ✅ PROVEN, sub-claim PARTIAL | rewrite loop `SmartImportModal.tsx:509-522`; catalog entry pointing at live team 185085 exists (`popularClubsCatalog.ts:18-25`) but "multiple clubs → same page" not found (single entry) |
| H7 zero-result blank panels | ✅ PROVEN (dup V47-context/H7) | `SmartImportModal.tsx:199-200` early return before feedback |
| H8 modal focus management absent | ✅ PROVEN | consistent with modal sweep; `@radix-ui/react-dialog` is an unused dependency |
| H9 ErrorBoundary | ✅ PROVEN (dup V2) | grep = 0 |

### Mediums / Lows highlights
- **M2 theme — ✅ PROVEN and UPGRADED:** `@custom-variant` count repo-wide = 0; `dark:` utilities only in 3 components (Radar/MatchdayCard/ParkingDetail modals) and default to OS media; `index.css` contains **no `.dark` token block and no color-scheme media** ⇒ palette is static; **ThemeToggle is a functional placebo app-wide** (upgrades §7-N15/V55 from "write-only preference" to "toggle does nothing").
- **M4/M5 hero & countdown:** ✅ PROVEN — M5 stronger than stated: with all events >2 h old, `upcoming=[]` → `nextEvent=undefined` → **hero vanishes entirely** (`planner.ts:179-183`).
- **M7 offline badge:** ✅ `MissionControlHUD.tsx:84` `hidden … sm:inline`.
- **M10 targets:** ✅ `MatchdayCard.tsx:187,:194` ≈27 px controls.
- **M12 ghost tabs:** ⚠️ PARTIAL — id duplication real, but chips group **by playerName** (`MultiProfileHeader.tsx:22-26,69-89`), so duplicates collapse visually; residue limited to FamilyManageModal rows.
- **Lows:** all six spot-checked ✅ — "Tulitus" (`ThemeToggle.tsx:35,:39`), 🏀 fallback (`TimelineCalendarView.tsx:396`), count-noun drift (`:336,:352`), QDIB join-failure silence (`QuickDropInBar.tsx:82-96`, `if (res.success)` without else), copilot slices 3/5/8 (`localAiEngine.ts:155,:254,:280`), and:
- **CI blind spot — ✅ PROVEN EMPIRICALLY:** root `tsconfig.json` is solution-style `{files:[],references:[…]}`; ci.yml's `npx tsc --noEmit` therefore compiles **zero files** and exits 0 unconditionally (verified live). The build step's `tsc -b` still gates, but the dedicated type-check step is decorative. Fix: `npx tsc -p tsconfig.app.json --noEmit`.
- **NEXUS internal error found:** negative-space section credits Torneopal with "**4 s abort**" — actual: 10 s per attempt (`torneopalClient.ts:187`), 8 s for the statsEngine HTML fallback (`statsEngine.ts:1375-1377`).

---

## 10. Round-2 corrections to this document's own §7/§8

1. **§7/N-series context:** findings V58/V59 (venue correction, adopt-stamp) describe code on a journey that is itself unwired per §9-C5. They remain valid defects; their user-facing reachability is nil until reconciliation is wired. Priority: wire-or-hide decision precedes them.
2. **§8 priority deltas:** add to **P0**: "C5 decision — wire `reconcileCalendarWithOfficial` into ingest or hide mismatch UI until wired". Add to **P1**: "CI typecheck fix (`tsc -p tsconfig.app.json --noEmit`)" and "theme system: implement `.dark` token overrides + `@custom-variant dark`, or remove ThemeToggle".
3. **H4 retraction of NEXUS claim recorded** so future merges don't reinstate a phantom "missing producer" work item.

---

## 11. Final corpus scorecard

| Doc | Claims processed | Valid | Debunked | Softened/partial |
|---|---|---|---|---|
| 1358 council review | 12 | 10 | 0 | 2 |
| Main F-audit (F-01…F-25) | 25 | 23 | 1 (D1 unlink no-op) | 1 (S1 XFF) |
| 1405 API lifecycle (C1,H1–H3,M1–M7) | 12 | 11 | 0 | 1 (redirect nuance) |
| 1407 fixes companion | mirrors F-audit | ✔ | ✔ | ✔ |
| 1408 canonical merge | 27 | 25 | 1 (D2 fixture unused) | 1 (precache size) |
| 1606 NEXUS | 37 | 31 | **1 (H4 producer)** | 5 (M1, M3, M6-residual, M12, H6 sub-claim) + 1 detail error (4 s abort) |
| This crosscheck | self-corrected ×3 | — | — | keyspace 32⁵ · UTC-day direction · UJ-04 reachability |

**Union headline:** verified top-of-stack facts are (1) C5 unwired reconciliation vs explicit spec requirements, (2) C2/N1 hooks crash class, (3) fabrication persistence + misattribution cluster, (4) static/non-functional theme system, (5) vacuous CI type-check step, followed by the zero-auth worker cluster and timeout chain.

---

*Cross-check generated by ox-alpha, 2026-08-24T17:15; Round-2 NEXUS adjudication appended same day. Every verdict in §2–§11 was re-derived from direct source inspection; toolchain gates (build exit 0 · lint exit 0 · vitest 401/401) re-run at snapshot `b1dba65`.*
