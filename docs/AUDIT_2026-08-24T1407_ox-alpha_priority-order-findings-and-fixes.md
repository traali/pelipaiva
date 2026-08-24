# AUDIT — Prioritized Findings & Fixes

| | |
|---|---|
| **File** | `AUDIT_2026-08-24T1407_ox-alpha_priority-order-findings-and-fixes.md` |
| **Date** | 2026-08-24T14:07 (+0200) |
| **Model / Reviewer** | `ox-alpha` (stealth/ox-alpha via opencode CLI) |
| **What this is** | Full-repository audit re-organized into **priority order**: every finding with its cause, line-level proof, and concrete fix. Companion to the evidence catalog `AUDIT_2026-08-24_ox-alpha.md` (methodology, 20-agent debate, vote tally) |
| **Scope** | `src/` (~28k lines TS/TSX), `cloudflare-worker/worker.ts`, `tests/`, `scripts/`, `docs/`, CI configs |
| **Evidence standard** | Every proof below was verified by direct file read on 2026-08-24 against working tree based on `main` @ `494c902`. Re-verify commands in §6. |

---

## Priority Index

| Priority | Item | Findings | Votes | One-line summary |
|---|---|---|---|---|
| **P0** | 0-1 Invalid end-time crash | F-01 | 5 | `"HH:24"` time throws RangeError on late-kickoff imports |
| **P0** | 0-2 Unguarded venue coordinates | F-02 | 2 | TypeError on Navigate click when coords missing |
| **P0** | 0-3 No global failure net | F-04 | 6 | No ErrorBoundary / rejection trap / safe JSON.parse |
| **P0** | 0-4 Family-cloud integrity gaps | F-03, F-19 | 8 | Weak code entropy, rev-less DELETE, corrupt-KV DoS, CORS `*` |
| **P1** | 1-1 Fabricated/synthetic data shipped | F-14, F-13(data) | 10 | Invented stats + real children's names in prod bundle |
| **P1** | 1-2 Reconciliation contract violations | F-10 | 4 | UTC-day equality vs promised ±24h; alias over-matching |
| **P1** | 1-3 ICS ingestion correctness | F-11 | 5 | Device-TZ times, no RRULE, duplicate ids |
| **P1** | 1-4 Fetch timeouts & cache bounds | F-16 | 6 | Signal-less fetches; rejected promises cached forever |
| **P1** | 1-5 Lightning-safety edge cases | F-07 | 2 | 0 km strike returns "clear" (truthiness bug) |
| **P1** | 1-6 Test honesty & browser CI gate | F-05 | 5 | "E2E" are Node tests; vacuous security asserts; Playwright not in CI |
| **P1** | 1-7 Security headers | F-03(hdr) | — | `_headers` has no CSP/XFO/HSTS at all |
| **P2** | 2-1 Split god-modules | F-13(struct), F-21(dupes) | 7 | statsEngine 1735 ln; App 942 ln; duplicated DST/proxy/helpers |
| **P2** | 2-2 Storage typing, keys & indexes | F-22 | 4 | `\|any` tables; 3 id conventions; full scans; no-op unlink |
| **P2** | 2-3 De-flake test suite | F-20 | 6 | Wall-clock asserts; timing thresholds; setTimeout IDB mock |
| **P2** | 2-4 Cover the uncovered | F-06 | 5 | 5 zero-test lib modules; zero component tests |
| **P2** | 2-5 Docs & scripts truth pass | F-18 | 5 | Phantom endpoints; stale milestones; personal Windows paths |
| **P2** | 2-6 DST & locale sweep | F-12, F-25 | 5 | Fall-back-Sunday ranges 1 h short; en-US ICU coupling |
| **P3** | 3-1 Accessibility elevation | F-17, F-24 | 6 | 17 aria-less components; Lighthouse gates unwired |
| **P3** | 3-2 PWA offline navigation & SW lifecycle | — | — | Missing navigateFallback breaks `/ambient` offline |
| **P3** | 3-3 Dead code & sentinels | F-21(resid), F-23 | 8 | Unused exports; unreachable branches; date sentinel collisions |
| **P3** | 3-4 Observability & ops ergonomics | F-15(resid) | 4 | Silent swallows surfaced as badges/logging; script portability |

---

# P0 — IMMEDIATE BLOCKERS (fix within 1–7 days)

## 0-1 · Invalid `"HH:24"` end time crashes event import
**Finding F-01** · 5 votes · Critical

**What**: Importing any message with a late-evening kickoff ("alkaa klo 23:05") and no explicit end time crashes with `RangeError: Invalid time value`.

**Cause**: Hour derived without modulo wraparound produces hour `"24"`, which JavaScript `Date` rejects when converted downstream.

**Proof**:
```ts
// src/lib/ai/messageParserNLP.ts:143-148
if (!end) {
  const [hStr = '15', mStr = '00'] = kickoff.split(':');
  const h = Number(hStr);
  const endH = (h + 1).toString().padStart(2, '0');   // ← 23 + 1 = "24"
  end = `${endH}:${m.toString().padStart(2, '0')}`;
}
```
```ts
// src/lib/ai/localAiEngine.ts:50-52  — throws on "24:xx"
const endTime = new Date(`${extracted.dateStr}T${extracted.endTime}:00${offset}`).toISOString();
```
Sibling warmup logic (`messageParserNLP.ts:154-155`) *does* wrap correctly (`totalMins < 0 → += 1440`) — the omission is accidental.

**Fix**:
1. `const rolled = h + 1 >= 24; const endH = String((h + 1) % 24).padStart(2,'0')`; carry the day-roll into `dateStr` (better: store **duration minutes**, not wall-clock end).
2. Regression tests: kickoffs `23:00`, `23:59`, next-day `00:15`; warmup parity vs :154-155.
3. Backstop: validate `HH < 24` in `convertExtractedToMatchdayEvent` (`localAiEngine.ts:35-60`); throw typed `ParseError` instead of raw RangeError.

---

## 0-2 · Unguarded venue coordinate dereference on navigation
**Finding F-02** · 2 votes · High

**What**: Clicking "Navigate" on an event whose fixture lacked coordinates throws `TypeError` inside the click handler — dead button / broken handler.

**Cause**: Type says coordinates are required (`VenueInfo.coordinates`, `src/types/matchday.ts:39`) but source data carries optional `venueLat?/venueLng?` (`src/types/matchday.ts:244-245`). Two call sites dereference blindly.

**Proof**:
```ts
// src/App.tsx:754-757 AND identically src/App.tsx:831-834
window.open(
  `https://www.google.com/maps/dir/?api=1&destination=${ev.venue.coordinates.lat},${ev.venue.coordinates.lng}`, ...)
```

**Fix**:
1. Materialize coordinates once at ingest via an `ensureVenueInfo()` builder in `src/lib/clubs/attachTeam.ts`.
2. At both call sites: fall back to text-destination Maps URL using `ev.venue.name`, or disable the button.
3. Optionally make `coordinates` optional in the type so tsc enforces handling.

---

## 0-3 · No global failure net anywhere
**Finding F-04** · 6 votes · Critical

**What**: Any render exception white-screens the app with no recovery UI; several async paths reject with no handler; two `JSON.parse` calls can throw on corrupt stored data and abort features (including the entire family sync).

**Cause**: Verified absences — repo-wide grep for `ErrorBoundary|componentDidCatch|unhandledrejection|window.onerror` returns **zero hits**. App mounts bare.

**Proof**:
```ts
// src/main.tsx:6-10 — bare mount
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
```
Unguarded paths:
- `runBackgroundSync()` bare every 180 s + on visibility/online — `src/App.tsx:103,:110,:116`
- URL-param join/import async IIFEs without `.catch()` — `src/App.tsx:140-147,:155-163`
- `handleClearData`: two awaited clears, no try/catch, wired directly to buttons — `src/App.tsx:278-283`
- `JSON.parse(existingStr)` on localStorage — `src/App.tsx:477`
- `JSON.parse(localTombstonesStr)` aborts whole sync — `src/lib/sync/familyCloud.ts:297`

**Fix**:
1. Class ErrorBoundary around `<App/>` in `main.tsx` with Finnish fallback UI ("Jotain meni rikki — päivitä sivu. Tietosi ovat turvassa.") that works offline.
2. `window.addEventListener('unhandledrejection'|'error', …)` logging tagged `[PELIPAIVA:*]`.
3. Wrap the four async paths with try/catch + user-visible toast.
4. Add `safeJsonParse<T>(raw|null, fallback:T)` util; replace both unguarded parses.

---

## 0-4 · Family-cloud integrity gaps (entropy, destructive DELETE, corrupt KV, CORS)
**Findings F-03 + F-19** · 8 combined votes · High/Critical

**What**: Family rosters (children's first names, team URLs) sit behind ~31M-keyspace codes generated with `Math.random()`, readable via unauthenticated GET under wildcard CORS; one corrupted KV record permanently breaks reads for that family (HTTP 1101); DELETE requires no concurrency token.

**Cause & Proof**:
```ts
// src/lib/sync/familyCode.ts:14-16 — Math.random(), 5+1 Crockford chars ≈ 2^35 keyspace
const pick = () => CROCKFORD_ALPHABET[Math.floor(Math.random() * CROCKFORD_ALPHABET.length)];
```
```ts
// cloudflare-worker/worker.ts
:128  'Access-Control-Allow-Origin': '*'            // wildcard CORS on family data
:179  const data = JSON.parse(dataStr)               // GET: unguarded — corrupt row ⇒ 1101
:212  JSON.parse(existing)                           // PUT precheck: unguarded
:273-277  DELETE has no If-Match/rev requirement     // unrecoverable erase, no concurrency control
:51-53   XFF fallback for rate-limit identity       // spoofable where present
```
Plaintext payload fields incl. names: `familyCloud.ts:343-353`.
**Mitigations already present (verified)**: fail-closed 403 for unknown codes (`worker.ts:160-165`); rate limits GET 20 / PUT 5 / DELETE 3 per 900 s per IP-PoP (`worker.ts:40-41`); codes never committed to repo.

**Fix**:
1. Generate codes with `crypto.getRandomValues()` (works in browsers and Workers).
2. Guard both Worker parses → return `503 corrupt_record` instead of crashing.
3. Require matching `If-Match` on DELETE (mirror PUT logic at `worker.ts:214-227`).
4. Narrow CORS `*` → `https://pelipaiva.pages.dev`.
5. Prefer `CF-Connecting-IP` only for rate limiting.
6. Optional: lengthen code to 7+1 chars; client-side encrypt payloads keyed from the code.

---

# P1 — HIGH PRIORITY (fix within 1–30 days)

## 1-1 · Fabricated data presented as real; synthetic real-child data shipped to production
**Findings F-14 + F-13(data part)** · 10 combined votes · Medium-High/High

**What**: Standings/rank/form values are invented when parsing fails; OCR fabricates metadata; and ~430 lines of hardcoded synthetic fixtures/standings containing **real children's names** compile into the production bundle despite being self-described as test-only.

**Cause & Proof**:
```ts
// src/lib/api/associationExtractor.ts
:272   form: ['W']                                   // hardcoded placeholder form
:345   matchesPlayed: 1                              // fabricated activity
:238   parseInt(tds[0]) || standings.length + 1      // parse failure masked as rank

// src/lib/stats/statsEngine.ts
:916-1348   generateSyntheticOfficialTeamData — literal rows keyed to real teamIds ('203621','34013')
:1045,:1196 real child names ("Lilli Oinonen", "Simo Oinonen")
:1432-1435  comment: "Test-only invented magazine. Production ingest never calls this."
:1436        …yet exported and bundled (no build exclusion in vite.config.ts:44-64)

// src/lib/ai/ocrImageParser.ts:64-69 — fallback fabricates totalRows:1, unrecognizedRows:0
```

**Fix**:
1. Move synthetic generators out of the prod graph → `tests/fixtures/` or `import.meta.env.DEV`-gated module; strip real names/teamIds.
2. Return `null` / explicit unknown markers for unparsed fields; render "ei tietoa"; log failing HTML snippet instead of inventing ranks.
3. Delete fabricated OCR metadata; report honest row counts.

---

## 1-2 · Reconciliation contradicts its own matching contract
**Finding F-10** · 4 votes · High

**What**: Calendar↔fixture auto-matching both misses valid matches and merges wrong ones.

**Cause & Proof** — three verified defects in `src/lib/reconciliation/`:
1. Day comparison uses **UTC calendar-day equality** while the adjacent comment claims "within 24h":
   ```ts
   // reconciliationEngine.ts:83-85
   // Date must match or be within 24h
   if (eventDayKey !== fixDayKey) continue;
   ```
   Keys built via `getUTCFullYear/Month/Date` (:76,:82). Affected: events 00:00–02:59 local map to previous UTC day (overnight tournaments, mis-zoned feeds). Fact-checked: evening events are NOT affected.
2. Learned aliases grant similarity **1.0 on substring containment** (`reconciliationEngine.ts:100-105`) — alias "honka" blesses "FC Honka Musta" ↔ "Honka II".
3. Missing-component generosity adds +0.1 twice when age-group/squad merely absent (`teamNameMatcher.ts:283-285,:299-300`) — bare "HJK" vs "HJK T13 Sininen" scores 0.8 on unproven squad equality; auto-match threshold is ≥0.85 (`reconciliationEngine.ts:139-141`).

**Fix**:
1. Build day keys in Europe/Helsinki (reuse `getFinnishTimezoneOffset`, `statsEngine.ts:481-497`) or compare absolute instants within true ±24 h.
2. Alias match must equal the canonical club token, not substring-contain it.
3. Make absence of components neutral (no bonus).

---

## 1-3 · ICS ingestion cluster: wrong-TZ times, no recurrence, duplicate ids, serial IO
**Finding F-11** · 5 votes · High

**What**: Description times land on wrong instants off-Helsinki devices; recurring trainings appear once ever; duplicates accumulate across re-syncs; large feeds ingest slowly.

**Cause & Proof** — `src/lib/calendar/icsParser.ts`:
```ts
:249-250,:267-268   runtime-local setHours() applies "klo 15:00" in device TZ
:489-493            iterates VEVENTs only — zero RRULE/RDATE/EXDATE expansion
:226-231            all-day DATE values flow through kickoff fabrication (15/45-min defaults)
:545                id fallback `event-${Date.now()}-${random}` — unstable across re-syncs
:491,:538-542       venue geocoding awaited serially per event (O(n) network)
```

**Fix**:
1. Derive wall times with explicit `Europe/Helsinki` formatter (pattern exists: `helsinkiDateISO`, `src/lib/agents/time.ts:4-11`).
2. Expand recurrence via ical.js recurrence iterator; skip EXDATEs.
3. Detect all-day (`isDate`) and handle separately.
4. Stable id = hash of UID (fallback UID-only).
5. Batch geocode, concurrency cap ≈4.

---

## 1-4 · Fetches without timeout; unbounded client caches
**Finding F-16** · 6 votes · High

**What**: Network hangs block imports indefinitely; one transient weather outage poisons forecasts for the whole session (rejected promise cached forever).

**Cause & Proof**:
- No AbortSignal/timeout: family GET/PUT (`src/lib/sync/familyCloud.ts:44,:96`), geocoders (`src/lib/geo/sportsGeocoder.ts:335,:376`), ICS ingest (`src/lib/clubs/ingestOfficial.ts:167`)
- Unbounded memo caching **rejected** promises: `src/lib/weather/fmiWeatherEngine.ts:50,:58-64`
- Tombstones grow forever: `familyCloud.ts:296-307`

**Counter-proof (correct pattern already in repo)**:
```ts
// src/lib/api/torneopalClient.ts:187
signal: AbortSignal.timeout(10000),
```

**Fix**:
1. Apply `AbortSignal.timeout(8000)` at every listed site (copy torneopalGet pattern).
2. FMI Map: delete entry on rejection; cap ~200 entries (simple LRU).
3. Cap tombstones at 500/family, FIFO trim.

---

## 1-5 · Lightning-safety truthiness bugs at the edges
**Finding F-07** · 2 votes · High (safety-critical module)

**What**: The module that recommends suspending children's matches misclassifies edge inputs.

**Cause & Proof** — `src/lib/weather/lightningSafety.ts`:
```ts
:58   if (nearestStrikeKm && nearestStrikeKm <= 20)   // strike at exactly 0 km is falsy → status 'clear'
:35   !mostRecentStrikeWithin10kmTimeMs               // epoch-0 treated as "none"
:43-44 negative elapsed (future-strike/clock-skew) satisfies <30 → danger w/ inflated countdown
:26-31 strikesWithin30kmCount counts strikes of ANY age (stale feeds inflate)
```

**Fix**: `!== undefined` guards; clamp negative elapsed to 0; add feed-age parameter (ignore strikes older than N hours); extend `lightningSafety.test.ts` with 0-km, epoch-0, future-strike, 29/31-minute boundary cases.

---

## 1-6 · Test honesty: fake "e2e" taxonomy, vacuous security asserts, no browser gate in CI
**Finding F-05** · 5 votes · High

**What**: Everything named tier0–tier5 "e2e" actually runs in Node; the adversarial XSS/SQLi suites pass even if the parser rejects ALL input including legitimate URLs; CI never launches a browser.

**Cause & Proof**:
```ts
// vitest.config.ts:6-8    environment:'node'; include:['tests/**/*.test.ts']
// playwright.config.ts:4   testDir:'./tests/e2e/playwright'   ← only these 2 specs are browser tests
// .github/workflows/ci.yml:27-37   tsc + vitest + build — no Playwright step

// tests/e2e/tier5_adversarial/m1_adversarial_parser_extractor.test.ts:52-61 (also :93-101,:115-122)
const result = parseAssociationUrl(url);
if (result) {          // ← vacuous guard: rejects-everything also passes
  expect(result.sport)…
}
```

**Fix**:
1. Rename `tests/e2e/tierX` → `tests/integration/tierX`.
2. Rewrite guards: unconditional two-direction assertions — legitimate URLs MUST parse, malicious MUST return null.
3. Add Playwright job to ci.yml (Chromium already a devDependency).
4. Set `reuseExistingServer: !process.env.CI` (`playwright.config.ts:35`).

---

## 1-7 · No security headers on the Pages site
**Part of F-03 cluster**

**Cause & Proof**: `public/_headers:1-11` contains only Cache-Control rules — no CSP, no `X-Frame-Options`, no `X-Content-Type-Options`, no Referrer-Policy, no HSTS.

**Fix**: Add to `_headers`:
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://pelipaiva-edge.sakkoja.workers.dev https://*.torneopal.fi https://*.torneopal.net https://*.torneopal.com https://fmi.fi; img-src 'self' data: https://*.fmi.fi
```
(Validate against actual third-party needs; ship `Content-Security-Policy-Report-Only` first.)

---

# P2 — MEDIUM PRIORITY (fix within 30–60 days)

## 2-1 · Split the god-modules (largest coalition finding)
**Findings F-13(structure) + F-21(dedupe)** · 7 + 6 votes · High architectural debt

**What**: `statsEngine.ts` (1735 lines) mixes ≥8 unrelated responsibilities; `App.tsx` (942 lines) is one component holding state hub, demo seeding, decision trees, and duplicated JSX trees. Duplicated helpers drift independently.

**Cause & Proof**:
- `statsEngine.ts`: URL routing :23-354 · i18n labels :366-410 (duplicates `sportMeta.ts`) · TZ math :481-536 · HTML scraping :623-911 (~290 ln) · synthetic generators :916-1348 · stats generator :1436-1735 · proxy re-export :17
- `App.tsx`: 15 useState (:49-75) · inline demo seed w/ rollback (:196-275) · duplicated Maps URL builders (:754-757 vs :831-834) · duplicated modal trees (:563-583 vs :842-900) · inline stats fallback in JSX (:907-932)
- Duplication clusters: DST ×2 (`statsEngine.ts:481-497` vs `torneopalClient.ts:79-89`) · proxy template ×2 (`proxyUrl.ts:5` vs `ingestOfficial.ts:166`) · `childName()` ×2 byte-identical (`conflictAgent.ts:5-7` vs `planner.ts:27-29`) · weekday maps ×2 within `time.ts`

**Fix**:
1. Extract `lib/association/{urlParser,htmlParser,tz}.ts` from statsEngine; single DST helper consumed by torneopalClient too.
2. Move demo seeding → `lib/matchday/demoSeed.ts`.
3. Single proxy builder used by `ingestOfficial.ts:166`.
4. Shared name util replaces twin `childName`s; unify modal host.

---

## 2-2 · Storage layer: type escapes, polymorphic keys, scan-instead-of-index, no-op unlink
**Finding F-22** · 4 votes · Medium

**Cause & Proof** — `src/lib/storage/db.ts`:
```ts
:46-47     Table<LeagueStandingsRecord | any, string>  ×2   // type holes
:156/:163/:172   standings written under THREE id conventions; rosters :186/:194
:237-254,:266-290 readers triple-probe all conventions, casting through `as any`
:214-227   date filtering fetches ALL fixtures then filters in JS — ignores [teamId+startTime] index
:389-391   unlink writes undefined via .update() — Dexie skips undefined ⇒ fields never removed
```

**Fix**: Schema v3 migrating to one canonical key convention; `.where('[teamId+startTime]').between(...)` queries; `.modify()` with key-deletion semantics for unlink; remove `| any`.

---

## 2-3 · De-flake the suite
**Finding F-20** · 6 votes · Medium-High

**Cause & Proof**:
- No `vi.useFakeTimers` anywhere; wall-clock assertions: `tests/unit/local_ai_parser.test.ts:236-244`
- Six hard wall-time thresholds: `m1_adversarial….test.ts:144-148,:157-161,:560-565`; `boundary_calendar_permutations.test.ts:319-326`; `m1_storage_concurrency.test.ts:854-867`
- Concurrency "ACID proofs" run on hand-rolled polyfill with timer-based commits: `tests/helpers/setupDexie.ts:168-176` (`setTimeout 10`), `:688-693` (`setTimeout 50`) — measures the mock, not IndexedDB
- `fake-indexeddb` installed (devDeps) but unused by setup

**Fix**: inject clock (thread existing `now` param, cf. `planner.ts:175`); replace ms-thresholds with operation-count assertions; migrate setup to `fake-indexeddb`; keep race tests but mark tolerances honestly.

---

## 2-4 · Cover the uncovered modules and components
**Finding F-06** · 5 votes · Medium-High

**Cause & Proof**: grep across all `*.test.ts`/`*.spec.ts` finds **zero references** to: `ai/ocrImageParser.ts`, `api/proxyUrl.ts`, `clubs/ingestOfficial.ts`, `clubs/popularClubsCatalog.ts`, `weather/fmiWeatherEngine.ts`. Also `src/components/**` contains no `*.test.tsx` (UI covered only by 6 Playwright flows). Two URL parsers exist (`statsEngine.ts:129` vs `api/associationUrlParser.ts`); only one is fuzz-tested.

**Fix**: unit tests for the five (WFS XML fixture already exists: `tests/fixtures/json/fmi_weather_sample.json`); add React Testing Library + tests for `OnboardingWizard.tsx` + `MatchdayCard.tsx`; consolidate to one URL parser tested by both fuzz and feature suites.

---

## 2-5 · Docs & scripts drift from reality
**Finding F-18** · 5 votes · Medium

**Cause & Proof**:
- Phantom endpoints: `docs/AUDIT.md:19-22` + `FAMILY_SYNC_ARCHITECTURE.md:20,:157` describe `/api/sync/:key`, `/api/nest/brief`, `src/routes/api/proxy/ics.ts` — none exist (Worker routes verified: only `/api/family/:code`, `/api/proxy/ics`; `familyCloud.test.ts:45-46` asserts their absence). `AGENT_GRAPH.md:30` repeats it.
- `PROJECT.md:45-51`: milestones say M1 IN_PROGRESS / M2-M4 PLANNED — product is deployed.
- `README.md:91` documents build via Windows `deploy.ps1` only (real command: `npm run build`); `README.md:99` claims "13 tests in ~250ms" vs ~392 actual cases.
- Personal Windows paths in live-prod scripts: `scripts/audit_live_prod.mjs:31,:43,:48`, `verify_live_prod.mjs:38`, `test_live_all_teams.mjs:12,:19`, +5 more sites.

**Fix**: remove phantom references; update PROJECT.md statuses; README gets real commands + e2e + worker-deploy instructions; scripts take base URL/output dir from env vars.

---

## 2-6 · DST window bug & locale coupling in time utilities
**Findings F-12 + F-25** · 5 combined votes · Medium/Low

**Cause & Proof**:
```ts
// src/lib/agents/time.ts
:21-25   helsinkiWall probes DST at 12:00 UTC, stamps WHOLE day with that offset
:60,:98  week/weekend ends land 1 h early on October fall-back Sunday (23:59 local = +02:00, probe said +03:00)
:36      addHelsinkiDays silently repairs garbage (y||2026, m||1, d||1)
:43-55,:79-91  weekday derived via 'en-US' names with silent ?? 1 / ?? 5 fallbacks
// src/lib/agents/planner.ts:42,:103 — literal '+03:00' hardcoded
```

**Fix**: compute per-instant offsets via `Intl.DateTimeFormat('fi-FI',{timeZone:'Europe/Helsinki',hourCycle:'h23'})` shared by time.ts + planner.ts; exhaustive fi-FI weekday switch that throws on unknown; fail loudly on malformed date parts.

---

# P3 — POLISH (fix within 60–90 days)

## 3-1 · Accessibility elevation
**Findings F-17 + F-24** · 6 combined votes · Medium-High

**Cause & Proof**: 17 of 30 components have zero `aria-*` (incl. `OnboardingWizard.tsx`, `KitChecklist.tsx`, `TalkooBoard.tsx`, `DifficultDayAlert.tsx`, `AmbientView.tsx`, `QuickDropInBar.tsx`, `RainRadarCurve.tsx`, …); repo-wide `tabIndex` count = 0; exactly 1 image alt. `index.html:18` blank pre-JS (no noscript/loading); dark theme class-only, no `color-scheme` meta (`index.html:2,:13`). Irony: `lighthouserc.json:11` demands a11y=1.0 but no workflow runs Lighthouse (grep `.github/workflows/*` = none); mobile Playwright project named "iPhone 15 Viewport" uses Pixel 7 descriptors (`playwright.config.ts:18-23`). Positives exist: `MatchdayCard.tsx:339,:509,:522,:541`.

**Fix**: ARIA pass over the 17; focus-management verification for modals (Radix traps); `color-scheme: dark light` meta; noscript message; wire lhci job; fix device descriptor naming.

---

## 3-2 · PWA offline navigation & service-worker lifecycle
**No separate finding ID** (surfaced by Taiwan agent; F-16 adjacent)

**Cause & Proof**: `vite.config.ts:35-40` configures Workbox without `navigateFallback`, while the app routes on `/ambient` (`App.tsx:133`) — deep links/offline loads of that path fail. `skipWaiting:true` + `clientsClaim:true` force mid-session SW takeover with no update prompt UX.

**Fix**: add `navigateFallback: 'index.html'` (with `/ambient` allowlist); switch to prompt-to-update flow using the registerSW lifecycle.

---

## 3-3 · Dead code, unreachable branches, sentinel collisions
**Findings F-21 (residual) + F-23** · 8 combined votes · Low-Medium

**Cause & Proof**:
- Dead exports: `tournamentAgent.ts:80-84` (`tournamentLeaveHint`), `time.ts:77-112` (`sportsWeekendRange`), `types.ts:41` (`'oma-kyyti'` never assigned)
- Unreachable: `messageParserNLP.ts:46,:52,:56,:60,:88` (`|| sentinel` after `.split('T')[0]`), `:293`; no-op else `carpoolAgent.ts:48`
- Sentinel collisions: legit `2026-08-24` dates overwritten by hint check `messageParserNLP.ts:379`; venue twin `'Töölön Pallokenttä 1 (Bollis)'` at `:382`
- Contradictory comments about sync interval: `App.tsx:91` vs actual 180000 ms at `App.tsx:106`

**Fix**: delete dead exports/branches; replace magic-string sentinels with `undefined` optionality threaded explicitly; unify duplicated modal trees (`App.tsx:563-583` vs `:842-900`); correct interval comments.

---

## 3-4 · Observability & ops ergonomics
**Finding F-15 (residual)** · 4 votes · Medium-High visibility issue

**Cause & Proof**: empty catch swallowing LLM failures (`localAiEngine.ts:296-298`); HTTP failure returning 0 silently (`ingestOfficial.ts:168`); geocoder silently substituting Helsinki for any unrecognized venue nationwide (`sportsGeocoder.ts:408-415`); bare `catch {}` (`db.ts:109-114`); inconsistent log tags (only `torneopalClient.ts:201` uses `[PELIPAIVA:TORNEOPAL]`); wrangler version mismatch `cd.yml:46` ('4.24.0') vs `cloudflare-worker/package.json:12` ('^4.124.0').

**Fix**: tag all logs `[PELIPAIVA:<DOMAIN>]`; degraded-fallback flags rendered as small UI badges ("arvioitu sijainti: Helsinki"); env-var configuration for live scripts; pin wrangler version to match package.json.

---

## §6 · Re-verify any proof

```bash
sed -n '140,160p' src/lib/ai/messageParserNLP.ts && sed -n '45,55p' src/lib/ai/localAiEngine.ts   # 0-1
sed -n '750,760p' src/App.tsx; sed -n '828,836p' src/App.tsx                                      # 0-2
rg -n "ErrorBoundary|unhandledrejection|componentDidCatch" src/                                    # 0-3 (expect: none)
grep -n 'JSON.parse\|Allow-Origin' cloudflare-worker/worker.ts                                     # 0-4
grep -n 'Test-only invented' src/lib/stats/statsEngine.ts                                          # 1-1
sed -n '76,105p' src/lib/reconciliation/reconciliationEngine.ts                                    # 1-2
sed -n '55,60p' src/lib/weather/lightningSafety.ts                                                 # 1-5
grep -n 'testDir' playwright.config.ts                                                             # 1-6
cat public/_headers                                                                                # 1-7
grep -n '| any' src/lib/storage/db.ts                                                              # 2-2
grep -rn 'lhci\|lighthouse' .github/workflows/                                                     # 3-1 (expect: none)
```

*Generated by ox-alpha on 2026-08-24T14:07. Companion evidence/methodology doc: `AUDIT_2026-08-24_ox-alpha.md`. Earlier session review: `AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md`.*
