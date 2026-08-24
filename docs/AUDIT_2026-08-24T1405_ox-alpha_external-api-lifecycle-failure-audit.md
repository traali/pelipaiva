# AUDIT — External API Lifecycle & Failure-Mode Review

| | |
|---|---|
| **File** | `AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md` |
| **Date** | 2026-08-24T14:05 (+0200) |
| **Model / Reviewer** | `ox-alpha` (stealth/ox-alpha via opencode) |
| **Method** | Full-workspace scan for every outbound external call (HTTP fetch, WMS image loads, iframe embeds, CDN SDK assets). Each call traced end-to-end: construction → dispatch → response ingestion → parsing → storage/state mutation → error fallbacks, against a 7-point integrity matrix (auth, timeouts/retries, status handling, schema safety, utilization/dead calls, caching/races, error masking). Evidence-based: every finding cites exact `file:line`. |
| **Scope** | `src/` (React 19 PWA), `cloudflare-worker/worker.ts`, plus dev-only `scripts/*.mjs\|cjs` (catalogued, not deep-audited) |
| **Verification** | Targeted grep across repo for `fetch(|XMLHttpRequest|WebSocket|axios`; manual reads of all 8 fetch sites + worker; caller-graph traced via grep of every exported consumer |

---

## Executive Summary

The app makes **12 external integrations** (Torneopal REST, FMI WFS/WMS, LIPAS, hel.fi Servicemap, EUMETSAT, OSM embed, self-hosted Cloudflare Worker family KV + CORS proxy, Tesseract CDN). Positive baseline: Torneopal client has real timeouts + text-level guards; worker proxy has a host allowlist; secrets hygiene is correct (`FAMILY_CODES` is a Worker secret, CI uses GH secrets).

The dominant systemic flaw: **on upstream failure the app does not fail — it invents.** A single network hiccup during ingest fabricates an entire fictional season (hard-coded opponents, scores like 6–52), stamps it `auto_matched / confidence 1.0`, persists it to IndexedDB, reports success to the parent, and pushes it to every family device via cloud sync. Secondary themes: unguarded concurrent sync cycles, missing timeout chains, permanent negative weather caching, and silent error masking in UI copy.

---

## Section 1: External API Catalog

| Call ID | Service / Provider | Method & Target | Invoking File & Line | Response Handled By |
|---|---|---|---|---|
| API-01 | Pelipäivä Edge Worker (CF KV) | `GET /api/family/:code` | `src/lib/sync/familyCloud.ts:44` | `syncFamilyRosterCycle()` → `mergeRosters()` → Dexie `profiles.put` (`familyCloud.ts:299-332`) |
| API-02 | Pelipäivä Edge Worker (CF KV) | `PUT /api/family/:code` (+If-Match) | `src/lib/sync/familyCloud.ts:96` | `PushRosterResult`; 409 retry `familyCloud.ts:366-383`; `syncState` `:386` |
| API-03 | Edge Worker proxy | `GET /api/proxy/ics?url=…` → federation HTML/ICS | `src/lib/stats/statsEngine.ts:1379`; `src/lib/clubs/ingestOfficial.ts:167` | `parseTorneopalHtml()` (`statsEngine.ts:1396`); `parseICSFeed()` (`ingestOfficial.ts:171`) |
| API-04 | Torneopal REST (spl.torneopal.fi, salibandy-api.torneopal.net, tupa.api.torneopal.com) | `GET /taso/rest/{getTeam,getMatches,getGroups,getGroup}` | `src/lib/api/torneopalClient.ts:181` | `torneopalGet()` → mappers → `saveOfficialTeamData()` (`db.ts:144-199`) |
| API-05 | FMI Open Data WFS | point forecast stored query | `src/lib/weather/fmiWeatherEngine.ts:81` | XML parse → `WeatherCondition` → event.weather (`ingestOfficial.ts:123-125`) |
| API-06 | LIPAS API v2 | `GET api.lipas.fi/v2/sports-sites?…page-size=200` | `src/lib/geo/sportsGeocoder.ts:335` | fuzzy match → VenueInfo |
| API-07 | hel.fi Servicemap | `GET api.hel.fi/servicemap/v2/search/?q=…` | `src/lib/geo/sportsGeocoder.ts:376` | first "sporty" unit → VenueInfo |
| API-08 | FMI/EUMETSAT WMS | GetMap images (radar/fog/natural/lightning) | `radarSatelliteEngine.ts:76-85` rendered at `LiveWeatherRadarModal.tsx:163` | `<img>` element; `onError` dims opacity only |
| API-09 | OpenStreetMap embed | iframe `export/embed.html` | `LiveWeatherRadarModal.tsx:73,150-158` | visual only |
| API-10 | Tesseract.js CDN | WASM core + `eng+fin` traineddata | `src/lib/ai/ocrImageParser.ts:17` | OCR text → NLP/table parsers |
| API-11 | Worker outbound (server-side) | `fetch(targetUrl)` allowlisted hosts | `cloudflare-worker/worker.ts:298` | status passthrough + Cache-Control (`:313-328`) |
| API-12 | Dev-only live audits | prod/tulospalvelu via Playwright+fetch | `scripts/audit_live_prod.mjs:10`, `scripts/test_live_*.mjs` | console/artifacts |

Secrets: Torneopal keys (`torneopalClient.ts:17-19`) are the federations' **public SPA keys** (documented as such) — informational, not a leak. `FAMILY_CODES` correctly secret-only (`wrangler.jsonc:6-7`). CD uses GH secrets (`.github/workflows/cd.yml:29-45`). ✅

---

# Findings (priority order)

## 🔴 CRITICAL — C1: Upstream outage silently replaced with fabricated fixtures that are persisted and cloud-synced

- **What:** When Torneopal/proxy returns empty or fails, the app generates a hard-coded fictional season (invented opponents, standings, roster, scores), saves it as official data, tells the user import succeeded, and syncs it to all family devices.
- **Endpoints:** API-03/API-04 failure paths
- **Cause:** `ingestOfficialForProfile` passes `fallbackToSynthetic: !cup` (true for every normal team) into `extractOfficialTeamData`, which itself falls back to synthetic on any thrown error; `ingestOfficialForProfile` then applies a second unconditional synthetic fallback when fixtures are empty.
- **Proof:**
  ```ts
  // src/lib/clubs/ingestOfficial.ts:52-66
  officialData = await extractOfficialTeamData(parsedAssoc, {
    customTeamName: cup?.teamName || opts.teamName,
    fallbackToSynthetic: !cup            // ← true for every normal team
  }).catch(() => null);
  ...
  } else if (parsedAssoc) {
    officialData = generateSyntheticOfficialTeamData(parsedAssoc, opts.teamName); // invented!
  }
  ```
  ```ts
  // src/lib/stats/statsEngine.ts:949-966 — hard-coded FICTIONAL results marked "played"
  homeTeam: 'EBT', awayTeam: 'TOPOLA', status: 'played',
  homeScore: 6, awayScore: 52, score: '6–52',
  ```
  Persistence & propagation chain: saved via `saveOfficialTeamData` (`ingestOfficial.ts:72`) + `events.bulkPut` (`:142`), stamped `reconciliationStatus:'auto_matched', confidenceScore:1.0` (`:117-118`), success surfaced at `App.tsx:387-408`, pushed cross-device via `hydrateRosterProfiles`/`pushFamilyRoster` (`familyCloud.ts:257-265,364`).
- **Impact:** A transient outage permanently installs fake match schedules/results presented as authoritative federation data to families (children's matchday planning). Data poisons IndexedDB and the shared KV roster.
- **Fix:** On upstream failure return `{official:null}` and render an explicit "source unreachable — try Refresh" state; restrict `generateSyntheticOfficialTeamData` to the demo seed path only. Add a cleanup/migration marking pre-existing synthetic rows (detectable id patterns) as demo.

## 🟠 HIGH — H1: Family roster API is fully public (capability-code auth only); DELETE has no concurrency guard; `associationUrl` stored unsanitized

- **What:** Knowledge of a 6-char share code grants read AND write AND destructive delete of a family's roster (children's real names + schedules). Share links circulate over WhatsApp.
- **Endpoint:** `[GET|PUT|DELETE] /api/family/:code`
- **Cause:** Code = sole credential; `Access-Control-Allow-Origin:*`; DELETE skips the If-Match optimistic-concurrency model used by PUT; PUT sanitizes most fields but passes `associationUrl` through uncapped/unvalidated; rate limiter built on eventually-consistent Cache API (best-effort).
- **Proof:**
  ```ts
  // cloudflare-worker/worker.ts:237 — no length/format cap
  associationUrl: p.associationUrl || undefined,
  // worker.ts:273-275 — destructive delete, no If-Match/rev, no ownership proof beyond code
  if (request.method === 'DELETE') {
    await env.MATCHDAY_KV.delete(kvKey);
  ```
  CORS wildcard at `worker.ts:127-132`; non-atomic limiter at `:54-75`.
- **Impact:** Privacy exposure of minors' PII to anyone who obtains a link (referrer/history/WhatsApp forwarding); stale-device DELETE silently destroys newer data and the next PUT recreates a blank family; attacker-controlled strings land in IndexedDB on all member devices (`familyCloud.ts:330-332`).
- **Fix:** Require `If-Match` on DELETE; cap/validate every string field (reuse `hostnameAllowed` allowlist for `associationUrl`, https-only); consider per-code write token issued at join; restrict CORS to the Pages origin; treat Cache-API limiter as best-effort documentation.

## 🟠 HIGH — H2: Unguarded concurrent sync cycles — duplicate fan-out, 409 churn, self-inflicted rate limiting

- **What:** Four independent triggers (mount, 3-min interval, tab-focus, network-online) can run `syncFamilyRosterCycle` simultaneously with zero mutex, multiplying GET/hydration traffic and causing avoidable 409 retries.
- **Endpoints:** API-01/API-02 + downstream API-04/API-05 hydration
- **Cause:** No single-flight lock around the cycle; a hydration-heavy cycle (multi-endpoint Torneopal × profiles × FMI per fixture) routinely exceeds the 3-minute interval, guaranteeing overlap; user actions (`Sync now`, drop-in join, post-import background sync) add more concurrent entries.
- **Proof:**
  ```ts
  // src/App.tsx:94-106 — four triggers, zero mutex
  const runBackgroundSync = async () => { ... await syncFamilyRosterCycle(sync.syncKey, db); };
  runBackgroundSync();                                            // mount
  syncTimer = setInterval(runBackgroundSync, 180000);
  document.addEventListener('visibilitychange', handleVisibility); // every tab focus
  window.addEventListener('online', handleOnlineSync);
  // src/App.tsx:400-406 — additional fire-and-forget cycle after each import
  // Also: FamilyShareModal.tsx:68,89 · QuickDropInBar.tsx:85
  ```
  Both cycles GET rev=N → both hydrate → loser PUT hits 409 → re-merge + re-push identical content (`familyCloud.ts:366-383`), inflating rev and burning the worker quota (GET 20 / PUT 5 per 15 min, `worker.ts:41`) toward self-inflicted 429s.
- **Impact:** Wasted federation bandwidth, rev inflation, spurious conflicts, quota exhaustion breaking family sync for everyone sharing the IP.
- **Fix:** Module-level single-flight promise (`let inFlight: Promise|null`) around `syncFamilyRosterCycle`; skip ticks while running; debounce visibility/online triggers (e.g., 30 s).

## 🟠 HIGH — H3: Geocoder falls back to hardcoded Helsinki coordinates for ANY unmatched venue — with heavy overfetch, no timeout, silent catches

- **What:** Any venue string not in the alias table and unresolved by LIPAS/hel.fi silently becomes central Helsinki (60.1872, 24.9248) with `hasFloodlights:true` — plausible-looking wrong data.
- **Endpoints:** API-06/API-07
- **Cause:** Final return value substitutes fake-but-valid coordinates instead of signalling failure; both geo fetches lack AbortSignal and swallow all exceptions; LIPAS downloads a ~200-site catalog per unresolved name; dedup exists only inside a single ICS feed parse, so repeated ingests/multi-profile seeding re-download identical payloads.
- **Proof:**
  ```ts
  // src/lib/geo/sportsGeocoder.ts:333-335 — page-size=200 bulk pull per lookup, no timeout
  const lipasUrl = 'https://api.lipas.fi/v2/sports-sites?city-codes=91,49,92&type-codes=1110,1340,1350&page-size=200';
  const res = await fetch(lipasUrl, { headers: { Accept: 'application/json' } });
  // :370-372, :403-405 — empty catch blocks hide provider outages
  // :408-414 — total failure ⇒ WRONG location returned as fact
  return { name: rawVenueString || 'Tuntematon kenttä',
    coordinates: { lat: 60.1872, lng: 24.9248 },   // Helsinki for a Rovaniemi pitch
    hasFloodlights: true };
  ```
- **Impact:** Wrong coordinates feed FMI weather (`ingestOfficial.ts:123`), parking ease (`:124`), and center the radar modal on the wrong city — displayed to parents as authoritative logistics data. Outages invisible due to empty catches.
- **Fix:** Module-level memo Map keyed by normalized query; `AbortSignal.timeout(5000)` on both calls; return `coordinates: undefined` (or `approximate:true`) instead of a fake pin; suppress weather/parking when coords unverified; log (once) instead of empty catch.

## 🟡 MEDIUM — M1: No end-to-end timeout chain — family-cloud GET/PUT, ICS proxy fetch, and Worker upstream fetch can hang indefinitely

- **What:** Three runtime fetches have no AbortSignal at all; one more clears its timer before body read.
- **Endpoints:** API-01/API-02/API-03/API-11
- **Cause:** Timeouts were added where pain was felt (Torneopal, extractor headers) but not on the worker-bound calls; a stalled connection blocks join/import spinners forever and stacks with the missing sync lock (H2).
- **Proof:**
  ```ts
  // src/lib/sync/familyCloud.ts:44-49 — no signal
  const res = await fetch(`${baseUrl}/api/family/${encodeURIComponent(cleanCode)}`, {
    method: 'GET', headers: { Accept: 'application/json' }
  });
  // src/lib/clubs/ingestOfficial.ts:167 — proxy fetch, no signal ⇒ spinner forever
  const res = await fetch(target);
  // cloudflare-worker/worker.ts:298 — upstream proxy fetch, no timeout
  // src/lib/stats/statsEngine.ts:1385 — clearTimeout BEFORE await response.text() ⇒ unbounded body read
  ```
- **Impact:** Hung UI states in `FamilyShareModal.tsx:67-69`, SmartImport, QuickDropIn; overlapping cycles multiply the stall (see H2).
- **Fix:** `AbortSignal.timeout(10000)` on `familyCloud.ts:44,96` and `ingestOfficial.ts:167`; move `clearTimeout` into a `finally` after body read in `statsEngine.ts`.

## 🟡 MEDIUM — M2: Weather memo permanently caches failures and fabricates a timeline measurement

- **What:** One transient FMI/proxy error freezes `null` weather for that fixture for the entire app session; the rain timeline's second point is manufactured data.
- **Endpoint:** API-05
- **Cause:** `weatherMemo` stores the promise and never evicts — neither on rejection nor by TTL; `rainProb` is dead code (always 0) yet drives turf logic; endTime value computed as `rainMmh * 1.2`.
- **Proof:**
  ```ts
  // src/lib/weather/fmiWeatherEngine.ts:62-64 — negative cache never invalidated
  const pending = fetchFmiMatchWeatherUncached(...);
  weatherMemo.set(key, pending);
  // :144-145 — invented "measurement"
  rainTimeline: [
    { time: startTimeIso, precipitationMmh: rainMmh },
    { time: endTimeIso, precipitationMmh: Math.round(rainMmh * 1.2 * 10) / 10 }
  ],
  ```
- **Impact:** "Refresh all" (`App.tsx:441-455`) cannot recover weather after a single blip until full reload; `RainRadarCurve` renders the interpolated point as real data; turf condition logic consumes always-zero rain probability.
- **Fix:** `weatherMemo.delete(key)` on rejection; TTL eviction (~30 min); compute or remove `rainProbabilityPercent`; label interpolated points.

## 🟡 MEDIUM — M3: Torneopal client has no backoff, ignores Retry-After, and refetches everything on every ingest

- **What:** Up to 4 endpoints retried back-to-back with zero delay; 429 indistinguishable from 404; cup mode fans out dozens of `getGroup` calls per profile with no cross-run caching.
- **Endpoint:** API-04
- **Cause:** Sequential attempt loop treats every non-OK as `continue`; only weather is memoized, so Refresh-all replays the full request storm against federations that answer with plain-text `"no access"` bodies instead of proper statuses.
- **Proof:**
  ```ts
  // src/lib/api/torneopalClient.ts:176-205
  for (const ep of attempts) {
    const res = await fetch(url, {...});
    if (!res.ok) continue;              // 429 treated identically; Retry-After unread
    ...
  }
  // :393-443 collectCupGroupMatches — chunked×4 getGroup fan-out, uncached
  ```
- **Impact:** Hammering providers exactly when they're degraded; risk of federation-side bans; heavy battery/data on mobile refresh.
- **Fix:** Special-case 429 (read `Retry-After`, abort remaining attempts); small jittered delay between endpoint attempts; TTL cache of `OfficialTeamData` keyed by teamId so refresh-all reuses fresh-enough data.

## 🟡 MEDIUM — M4: Proxy/ICS failures masked as "no matches found"; 429 shown as "family not found"; drop-in join fails silently

- **What:** All HTTP failures during ICS import collapse to count 0 and a misleading message; rate-limit errors surface as wrong advice; one join path has no failure feedback at all.
- **Endpoints:** API-03, API-01
- **Cause:** `ingestIcsForProfile` converts `!res.ok` to `return 0` before any status classification; callers map count 0 → "URL has no games"; `rate_limited` exception isn't matched in UI switch; `QuickDropInBar.handleJoinFamily` has no else branch.
- **Proof:**
  ```ts
  // src/lib/clubs/ingestOfficial.ts:168
  if (!res.ok) return 0;
  // src/App.tsx:394 — masks outages as bad link
  error: 'Otteluita ei löytynyt tästä osoitteesta'
  // src/components/FamilyShareModal.tsx:81 — 429 becomes "Koodi ei ole voimassa"-adjacent text
  setStatusMessage('Perhettä ei löytynyt tai verkkovirhe');
  // src/components/QuickDropInBar.tsx:87-96 — silence on failure
  if (res.success) { ... }
  ```
- **Impact:** Parents re-type valid URLs/codes during outages; support burden; trust erosion ("app loses my team").
- **Fix:** Throw typed errors from `ingestIcsForProfile` (auth/rate-limit/not-found/network) and map each to distinct UI copy; add failure branch + message in QuickDropInBar.

## 🟡 MEDIUM — M5: Orphaned integration — `associationExtractor.fetchOfficialTeamData` bypasses the proxy and has zero callers

- **What:** A duplicated, direct-fetch variant of the extractor exists (no proxy, no timeout, would CORS-fail) and is wired to nothing.
- **Endpoint:** direct `GET parsedUrl.canonicalUrl`
- **Cause:** Refactor left a stale duplicate alongside the proxy-backed `statsEngine.fetchOfficialTeamData`.
- **Proof:**
  ```ts
  // src/lib/api/associationExtractor.ts:364-368
  export async function fetchOfficialTeamData(parsedUrl, customFetch = fetch) {
    const res = await customFetch(parsedUrl.canonicalUrl);  // no proxy, no signal
  ```
  Repo-wide grep: no production callers (only internal helpers in same file).
- **Impact:** Dead weight; latent trap if someone wires it (opaque CORS failures, unbounded hang).
- **Fix:** Delete the function or delegate it to the proxy-backed implementation.

## 🟡 MEDIUM — M6: Radar modal fires WMS GetMap every 900 ms with no preload/error state; broken frames render blank while UI claims freshness

- **What:** Playback swaps 6 distinct 768×512 images continuously; the newest rounded TIME slot often doesn't exist upstream yet, so the headline "Nyt" frame is frequently a silent blank under a "Tuore data" badge; failures never pause playback.
- **Endpoints:** API-08/API-09
- **Cause:** `<img>` keyed per frame with onError merely dimming opacity; timestamp rounding rounds UP into future/nonexistent slots.
- **Proof:**
  ```tsx
  // src/components/LiveWeatherRadarModal.tsx:163-171
  <img src={imageUrl} key={`${selectedLayer}-${currentFrameIndex}`} ...
    onError={(e) => { e.currentTarget.style.opacity = '0.7'; }} />
  // :52-55 — 900 ms interval drives frame swaps
  ```
- **Impact:** Continuous image request churn; users interpret blank radar as "no rain" (opposite of safe default for storm awareness).
- **Fix:** Per-frame load/error state; clamp newest timestamp −5 min; fall back to last good frame; pause playback on repeated failures.

## 🟡 MEDIUM — M7: OCR depends on unpinned third-party CDN assets at runtime — breaks offline-first PWA guarantee

- **What:** Screenshot import silently requires internet access to unpkg/jsdelivr for worker script, WASM core, and language data, in an app that otherwise ships a precaching service worker.
- **Endpoint:** API-10
- **Cause:** Default `createWorker('eng+fin', 1)` options point langPath/corePath/workerPath at CDN defaults; versions unpinned; errors only reach `console.error`.
- **Proof:**
  ```ts
  // src/lib/ai/ocrImageParser.ts:17
  const worker = await createWorker('eng+fin', 1, { logger: ... }); // CDN defaults, unpinned
  ```
- **Impact:** Feature dead zone off-grid (pitch-side use case!); supply-chain surface; version drift can break parsing silently.
- **Fix:** Vendor pinned `worker.min.js` + wasm core + `.traineddata.gz` into `public/`, precache via workbox config, pass explicit `langPath/corePath/workerPath`.

---

## Remediation Priority

| # | Finding | Effort | Order rationale |
|---|---|---|---|
| 1 | C1 synthetic-data fabrication | ~2 h incl. migration guard | Data-integrity + trust; poisons DB & cloud |
| 2 | H2 sync single-flight lock | ~30 min | Tiny change, kills 3 downstream symptoms |
| 3 | H1 worker auth/validation | ~3 h | Privacy of minors; destructive endpoint |
| 4 | H3 geocoder honesty + memo | ~1 h | Wrong-location weather/logistics |
| 5 | M1 timeout chain | ~20 min | Trivial, unblocks hangs |
| 6 | M4 error-masking UX | ~1 h | Support-burden reducer |
| 7 | M2 weather memo TTL | ~30 min | Recovery-after-failure |
| 8 | M3 Torneopal backoff/cache | ~2 h | Provider citizenship |
| 9 | M7 OCR self-hosting | ~1–2 h | Offline guarantee |
| 10 | M6 radar frame states | ~1 h | Storm-awareness clarity |
| 11 | M5 delete orphan | ~5 min | Hygiene |

---

*Retention note:* This document is committed to `main` (see git history). It is intended as a permanent record — do not delete; supersede with a follow-up audit and link both.
