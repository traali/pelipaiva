# API trace — specialist API @ 20bad06

Read-only. No `src/` edits. GET-safe probes only. SHA assumed `20bad06` (recon: `20bad06e559d77310bd8cc1971c2e1f1ff988f95`).

In scope: `cloudflare-worker/worker.ts`, `src/lib/api/**`, `ingestOfficial.ts`, `statsEngine.ts` extract path, `fmiWeatherEngine.ts`, `sportsGeocoder.ts`, `functions/api/**`. Out of scope: PUT/DELETE family slots; fuzzing allowlisted vendors.

---

## 1. Worker surface (`cloudflare-worker/worker.ts`)

Single `fetch` handler. Routes in order:

| Path | Methods | Auth | Notes |
|---|---|---|---|
| `OPTIONS *` | OPTIONS | none | Origin-echo CORS if first-party |
| `/api/family/:code` | GET PUT DELETE | issued `FAMILY_CODES` (fail closed) | KV `family:{CODE}`, If-Match, rate limit |
| `/api/calendar/feed/:code` and `/api/calendar?perhe=` | GET | issued codes **if secret non-empty** | ICS; see F-API-001 |
| `/api/proxy/ics?url=` | GET (any method that is not OPTIONS) | none; hostname allowlist | CORS proxy, not open |
| default | any | none | `{"status":"Pelipäivä Edge API Active"}` |

Pages Functions (`functions/api/calendar.js`, `functions/api/calendar/feed/[code].js`) are **GET-only reverse proxies** to `https://pelipaiva-edge.sakkoja.workers.dev` with no timeout. `public/_redirects` 302 fallback if Functions skipped.

Client family bus: `src/lib/sync/familyCloud.ts` `WORKER_BASE_URL = 'https://pelipaiva-edge.sakkoja.workers.dev'`. ICS/HTML/LIPAS client: `src/lib/api/proxyUrl.ts` `DEFAULT_PROXY_URL = '…/api/proxy/ics'`. **Allowlist lives only on the Worker.** The client will send any URL; the edge rejects.

---

## 2. CORS

```200:216:cloudflare-worker/worker.ts
    const allowedOrigins = new Set([
      'https://pelipaiva.pages.dev',
      'https://pelipaiva.fi',
      'https://www.pelipaiva.fi',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ]);
    const requestOrigin = request.headers.get('Origin');
    ...
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
      corsHeaders['Vary'] = 'Origin';
    }
```

Allow-Methods: `GET, POST, PUT, DELETE, OPTIONS`. Allow-Headers: `Content-Type, If-Match, X-Pelipaiva-Rev`. **Not `*`.** Unknown Origin → no `Access-Control-Allow-Origin` (browser blocks; curl/non-browser unaffected).

Prod probe: `Origin: https://pelipaiva.pages.dev` → echoed. `Origin: https://evil.example` → header absent.

Mismatch: Vite `server.port` is **3000** (`vite.config.ts` L72). CORS allowlist is **5173**. Local `npm run dev` Origin `http://localhost:3000` cannot read Worker responses. See F-API-008.

---

## 3. Family routes — fail closed, If-Match, rate limit

Crockford-32: `^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$`. Unhyphenated 6-char normalised (`DKJVBH` → `DKJVB-H`). Same regex as `familyCode.ts` (asserted in `familyCloud.test.ts`).

```243:248:cloudflare-worker/worker.ts
      const issued = await parseIssuedFamilyCodes(env.FAMILY_CODES);
      if (issued.size === 0 || !issued.has(code)) {
        return new Response(JSON.stringify({ error: 'unknown_family' }), {
          status: 403,
```

Empty secret **or** unknown code → 403. Constitution held on this path.

Rate limit (family only): window 900 s; GET 20 / PUT 5 / DELETE 3 per `CF-Connecting-IP` (else XFF first hop, else `unknown`). Counter in `caches.default` (per-colo, best-effort — SEC). 429 `{error:rate_limited}` + `Retry-After: 900`.

If-Match:
- PUT on **existing** key: missing or stale `If-Match` / `X-Pelipaiva-Rev` → 409 `{error:rev_conflict, currentRev}`. Never silent overwrite.
- PUT on **missing** key: create, no If-Match required.
- DELETE on existing: same 409 proof (comment M-12).
- GET returns `ETag: "{rev}"` and `X-Pelipaiva-Rev`. Cache-Control `no-store`.

Sanitise on PUT: `playerName` 30 chars, `teamName` 60, `calendarUrl` 400, `colorHex` `/^#[0-9a-fA-F]{6}$/` else `#3b82f6`. Schema `v===1` + `profiles` array. KV `expirationTtl: 604800` (7 d sliding). **Roster rows only** in the write path (no events, no last names, no weather). See DATA for payload proof. Worker **reads** a second key `fam_events_${code}` that nothing in `src/` writes (F-API-007).

Client timeouts: `fetchFamilyRoster` / `pushFamilyRoster` `AbortSignal.timeout(10_000)`. 403 → throw `unknown_family` (join does not mint). 404 GET → null (create path).

---

## 4. Calendar ICS

Two URLs, same handler: `/api/calendar?perhe=` and `/api/calendar/feed/:code`. GET only.

**Fail-open vs family (F-API-001):**

```444:449:cloudflare-worker/worker.ts
      const issued = await parseIssuedFamilyCodes(env.FAMILY_CODES);
      if (issued.size > 0 && !issued.has(familyCode)) {
        return new Response(JSON.stringify({ error: 'unknown_family' }), {
          status: 403,
```

If `FAMILY_CODES` is empty, calendar **does not** 403; it reads KV and emits ICS. Family path 403s. `docs/FAMILY_CODES_OPS.md` claims Worker-wide fail-closed. Prod today: secret **is** set — `DKJVB-H` calendar **and** family both 403 `unknown_family`.

Feed composition:
1. Custom events from `fam_events_*` (dead writer → always `[]`).
2. Up to 10 roster `calendarUrl`s via `collectRosterIcsEvents`: https only, `isIcsCalendarUrl`, `AbortSignal.timeout(8000)`, UA Chrome, Accept calendar. Prefix `SUMMARY` with `playerName`. Failures skipped.

Worker ICS escaping: title only `.replace(/,/g, '\\,')` — **not** RFC 5545 (client `calendarFeedGenerator.escapeIcsText` does `\\ ; , newline`). F-API-012.

`Cache-Control: public, s-maxage=180` on capability-URL ICS (code in query/path). CDN cache of family names if code leaks.

---

## 5. Proxy allowlist — answer to Q-002

### `hostnameAllowed` (L79–95)

Exact / suffix hosts:

- ICS: `nimenhuuto.com` + `*.nimenhuuto.com`, `myclub.fi` + `*.`, `jopox.fi` + `*.`
- Weather/geo: `opendata.fmi.fi`, `openwms.fmi.fi`, `api.lipas.fi`, `api.hel.fi`
- Federation HTML: `tulospalvelu.palloliitto.fi` + www, `tulospalvelu.salibandy.fi` + www, `basket.fi` + www + `tulospalvelu.basket.fi`, `espooliikkuutournament.fi` + www
- Torneopal JSON: **`koripallo-api.torneopal.net`**, `salibandy-api.torneopal.net`, `tupa.api.torneopal.com`, `spl.torneopal.fi`
- Wildcard: `*.torneopal.fi`, `*.torneopal.net`, `*.torneopal.com`

### `isAllowedProxyTarget` (L109–121)

1. WHATWG parse else false  
2. `protocol === 'https:'` (blocks `http:`, `webcal:`, `file:`)  
3. no username/password (`user:pass@host` SSRF)  
4. port empty or `443`  
5. hostname not IPv4 literal `/^[\d.]+$/` and not containing `:` (IPv6)  
6. `hostnameAllowed`

`/api/proxy/ics` (L538–544): missing or disallowed `url` → **400** `Disallowed or missing URL parameter`. Comment: “not an open proxy.”

`familyCloud.test.ts` L49: `expect(workerSrc).not.toMatch(/startsWith\('https:\/\/'\)/)` — guards against naive open-proxy regression.

### Q-002 verdict — **YES, covered; arbitrary URLs blocked**

| Claim | Evidence |
|---|---|
| `koripallo-api.torneopal.net` allowlisted | worker.ts L90 explicit **and** L91 `endsWith('.torneopal.net')` |
| Client uses that host for basket | `torneopalClient.ts` L35 `base: "https://koripallo-api.torneopal.net/taso/rest"`; `listTorneopalAttempts('basket',…)` test expects exactly that base |
| Arbitrary URL blocked | live `GET …/api/proxy/ics?url=https://example.com/` → **400** same JSON; `http://nimenhuuto.com/…` → 400; `https://1.1.1.1/` → 400; missing url → 400 |
| Did not hit koripallo-api through the proxy | constitution: do not burden vendors. Code coverage is sufficient. |

**Caveats (not Q-002 fails):**
- `tulospalvelu.lentopallo.fi` parsed in `parseAssociationUrl` (statsEngine.ts L280–304) **not** in `hostnameAllowed` → HTML fallback via proxy 400. JSON still goes to `tupa.api.torneopal.com` (allowlisted). F-API-003.
- `www.tulospalvelu.basket.fi` parsed, not allowlisted (apex + `tulospalvelu.basket.fi` are).
- `nominatim.openstreetmap.org`, `alerts.fmi.fi`, `eumetview.eumetsat.int`, `suomisport` — not on proxy list (Nominatim/EUMETSAT are browser-direct; CAP unused).
- Proxy `redirect: 'follow'` does **not** re-check final hostname (F-API-005 / SEC).
- Wildcard `*.torneopal.fi` is intentional (cup hosts) but wide.

---

## 6. Vendor table

| Vendor | Direction | Auth | Timeout | Fallback honesty | File |
|---|---|---|---|---|---|
| **Palloliitto JSON** `spl.torneopal.net` / `spl.torneopal.fi` | Browser **direct** (not proxy) | Public SPA key `PALL_KEY` in `Accept: json/{key}` + Referer `tulospalvelu.palloliitto.fi` | 10 s/attempt, 25 s sequence deadline | next endpoint; then HTML via proxy; ingest `fallbackToSynthetic: false` → empty fixtures | `torneopalClient.ts` ENDPOINTS.palloliitto, `listTorneopalAttempts` |
| **Salibandyliitto JSON** `salibandy-api.torneopal.net` | Browser direct | `SALIBANDY_KEY` + Referer | same | same | `torneopalClient.ts` |
| **Basket / koripallo-api** `koripallo-api.torneopal.net` | Browser direct | `TUPA_KEY` + Referer `tulospalvelu.basket.fi` | same | **skip HTML** (`extractOfficialTeamData` skipHtml for basket) → empty fixtures if JSON fails | `torneopalClient.ts` L34–38, `statsEngine.ts` L1404–1406 |
| **Generic Torneopal** `tupa.api.torneopal.com` | Browser direct | `TUPA_KEY` + Referer `tupa.torneopal.fi` | same | HTML via proxy | `torneopalClient.ts` L39–43 |
| **Cup `*.torneopal.fi/taso/rest`** | Browser direct **unless** subdomain matches cup/memorial (skipped — 403 without Referer / preflight stall) | key + Referer | skipped hosts go straight to federation API | federation JSON | `listTorneopalAttempts` L148–167, `shouldTryAssociationEndpoint` |
| **Federation HTML** tulospalvelu.* / basket.fi / espooliikkuu | Browser → **Worker proxy** → vendor | none | client 8 s (`timeoutMs` default); **Worker fetch has no AbortSignal** | empty `OfficialTeamData` (no synthetic on ingest path) | `statsEngine.ts` `extractOfficialTeamData` L1421–1467, `worker.ts` L537–579 |
| **Nimenhuuto / MyClub / Jopox ICS** | Browser → Worker proxy; Worker also pulls roster ICS for public feed | none; URL may carry feed token | client 10 s `ingestIcsForProfile`; Worker roster collect 8 s; **proxy route no timeout** | return `0` events / skip that profile’s blocks | `ingestOfficial.ts` L166–183, `worker.ts` `collectRosterIcsEvents` |
| **FMI WFS Harmonie** `opendata.fmi.fi` | Browser **direct** from ingest (proxyUrl optional, **not passed**) | none (open data) | 8 s | `null` weather omitted; no invented mm/h or PoP (comment M-06) | `fmiWeatherEngine.ts` L52–158; caller `ingestOfficial.ts` L133 |
| **FMI WMS radar / lightning** `openwms.fmi.fi` | Browser **img src** (no CORS) | none | n/a | broken image | `radarSatelliteEngine.ts` `buildImageryUrl` |
| **EUMETSAT WMS** `eumetview.eumetsat.int` | Browser img src | none | n/a | broken image; **not** on Worker allowlist (not needed) | `radarSatelliteEngine.ts` L78–82 |
| **FMI CAP alerts** `alerts.fmi.fi` | **unused** (`FMI_CONFIG.capAlertsUrl` never fetched) | — | — | — | `fmiWeatherEngine.ts` L11 |
| **LIPAS** `api.lipas.fi/v2/sports-sites` | Browser → proxy (`proxiedUrl`); Node direct | none | 5 s | Helsinki servicemap, then Töölö pin + `isApproximateLocation: true` | `sportsGeocoder.ts` L332–377, L414–424 |
| **Helsinki servicemap** `api.hel.fi` | Venue resolve: proxied. **Home geocode: direct** | none | 5 s venue / 4 s home | Nominatim (home) / Töölö (venue) | `sportsGeocoder.ts` L379–411; `homeLocation.ts` L133–150 |
| **Nominatim OSM** | Browser **direct**; **not** on Worker allowlist | `User-Agent: PelipaivaMatchdayApp/1.0` | 4 s | `null` coords | `homeLocation.ts` L152–173 |
| **Espoo Liikkuu** `espooliikkuutournament.fi` | Parse + Torneopal basket JSON; catalog seed if empty | none | via torneopal | **`officialFromExampleCup` canned rows** | `parseAssociationUrl` L145–170; `exampleTournaments.ts`; `ingestOfficial.ts` L70–72 |
| **Example cups HC2026 / KW Memorial** | Local catalog | none | n/a | Canned fixtures/scores/times when live cup empty — **constitution hole** | `exampleTournaments.ts` `weekendAt`, `officialFromExampleCup`; ingest L68–72 |
| **WhatsApp** `wa.me` | Outbound deep link | none | n/a | n/a | `FamilyShareModal`, `MatchdayCard`, `FamilyLogisticsModal` |
| **Google Maps / Waze / OSM embed** | Outbound navigation / iframe | none | n/a | n/a | `ParkingDetailModal`, cards, `parkingEaseEngine` |
| **Family KV bus** | Browser → Worker → `MATCHDAY_KV` | possession of issued code + If-Match on update | 10 s | stay on Dexie; `unknown_family` local mode | `familyCloud.ts`, `worker.ts` |
| **Public family ICS** | Calendar client → Pages Function → Worker | issued code (when secret set) | Function: none; upstream ICS 8 s | 403 unknown; else VCALENDAR possibly empty | `functions/api/calendar*.js`, `worker.ts` L417–534 |

Transit (`transitEngine.ts`) is **Haversine local** — no HSL/GTFS vendor.

Lightning 30-30 (`lightningSafety.ts`) is pure; no live strike feed wired to `capAlertsUrl`.

---

## 7. Ingest honesty (`ingestOfficial.ts` + extract)

```60:76:src/lib/clubs/ingestOfficial.ts
    // FAMILY_SYNC_FINAL §3 constitution: fallbackToSynthetic is false — a failed
    // federation fetch must fail closed, never fabricate a season.
    officialData = await extractOfficialTeamData(parsedAssoc, {
      customTeamName: cup?.teamName || opts.teamName,
      fallbackToSynthetic: false
    }).catch(() => null);
  }
  officialData = mergeOfficialWithCupFallback(cup, officialData);
  if (!officialData || officialData.fixtures.length === 0) {
    if (cup) {
      officialData = officialFromExampleCup(cup);
```

`generateSyntheticOfficialTeamData` (HJK/PPJ canned leagues) is **not** on the UI ingest path (`fallbackToSynthetic: false`). Tests still call it with `true` (QA). Residual factory `generateOrResolveMatchStats` is uncalled from UI (G-01 / ARC).

**Hole:** `officialFromExampleCup` / `mergeOfficialWithCupFallback` still materialise catalog rows when live cup is empty (G-03, F-API-002). Helsinki Cup seeds use `weekendAt(6, 10, 0)` = **this Saturday 10:00**, not federation kickoff. Espoo Liikkuu seeds include scores `6–52`, `55–6`.

Torneopal JSON mapping: `mapFixture` drops undated matches; year filter `>= 2024`; DST via last-Sunday March/October (Europe/Helsinki). `"no access"` / non-ok JSON skipped. `call.status !== 'ok'` skipped.

HTML path uses Worker proxy of `parsed.canonicalUrl`. Basket + cup subdomains skip HTML (proxy 403 / SPA shells).

ICS path always proxies; weather/parking attached; reconciliation vs official fixtures if `teamId` present.

---

## 8. Parser / extractor notes

`associationUrlParser.ts` re-exports `parseAssociationUrl` from `statsEngine.ts` plus `detectAssociationType` / `normalizeAssociationUrl`.

Hardcodes (F-API-006, F-API-017):
- Torneopal **player** page → `teamId: '34013'` always; `playerId === '146432'` → `playerName: 'Pelaaja 55'` (`statsEngine.ts` L332–338).
- Espoo Liikkuu **`/match/:id`** → `teamId: '203621'` (`statsEngine.ts` L159–168).

Adversarial URL tests (`m1_adversarial_parser_extractor.test.ts`, `boundary_urls_and_api.test.ts`) reject `javascript:`, `file:`, lookalike hosts, non-numeric team ids. Parser itself does not call the network.

Public SPA keys in client (`TUPA_KEY`, `PALL_KEY`, `SALIBANDY_KEY`) — comment “used by official tulospalvelu frontends.” Expected public; still git-visible (F-API-011 S4).

---

## 9. Geo / weather fallback honesty

LIPAS query hardcodes `city-codes=91,49,92` (Helsinki, Espoo, Vantaa) + type-codes 1110/1340/1350, page-size 200. National alias table covers many Finnish pitches first.

Unknown venue → `60.1872, 24.9248` (Töölön Pallokenttä) with **`isApproximateLocation: true`** (M-15/G-06). Honest flag; still a Helsinki pin.

FMI: omit rather than fabricate precipitation probability; single timestep `rainTimeline`; negative-cache of failures deleted (`pending.catch` removes memo). Ingest does not pass `proxyUrl` — relies on FMI CORS. If CORS fails, weather silently omitted (honest).

Home address: servicemap **unproxied**, then Nominatim **unproxied** (CORS/UA policy risk outside HKI). F-API-009.

---

## 10. GET-safe probes (2026-08-30 ~06:21 UTC, this session)

```
GET https://pelipaiva.pages.dev/                                          200 text/html lang=fi
GET https://pelipaiva.pages.dev/api/calendar?perhe=DKJVB-H                 403 {"error":"unknown_family"}
GET https://pelipaiva.pages.dev/api/calendar/feed/DKJVB-H                  403 {"error":"unknown_family"}
GET https://pelipaiva-edge.sakkoja.workers.dev/                            200 {"status":"Pelipäivä Edge API Active"}
GET https://pelipaiva-edge.sakkoja.workers.dev/api/family/DKJVB-H          403 {"error":"unknown_family"}
GET https://pelipaiva-edge.sakkoja.workers.dev/api/calendar?perhe=DKJVB-H  403 {"error":"unknown_family"}
GET https://pelipaiva-edge.sakkoja.workers.dev/api/family/SAIMA-4          400 {"error":"invalid_code_format"}
GET …/api/proxy/ics                                                       400 Disallowed or missing URL parameter
GET …/api/proxy/ics?url=https://example.com/                              400 (arbitrary blocked)
GET …/api/proxy/ics?url=http://nimenhuuto.com/feed.ics                    400 (https-only)
GET …/api/proxy/ics?url=https://1.1.1.1/                                  400 (IP literal)
OPTIONS …/api/family/DKJVB-H Origin: https://pelipaiva.pages.dev          200 ACAO echoed
OPTIONS …/api/family/DKJVB-H Origin: https://evil.example                 200 ACAO absent
```

Did **not** PUT/DELETE. Did **not** proxy allowlisted vendor URLs.

Pages home also sends `access-control-allow-origin: *` (Pages asset, not Worker). SEC may note; not an open proxy.

---

## 11. FINDING drafts (promote to `board/index.md`)

### F-API-001 — Calendar ICS fail-open if `FAMILY_CODES` empty

- **severity:** S2  
- **confidence:** high  
- **evidence:** `worker.ts` family L243–248 `issued.size === 0 || !issued.has` vs calendar L444–449 `issued.size > 0 && !issued.has`. `FAMILY_CODES_OPS.md` L17 “Empty or unknown → 403”. Prod currently secret-set (probe 403).  
- **blast radius:** If secret wiped/unset, any Crockford-shaped code would get an ICS (usually empty) while family API stayed 403.  
- **why:** Constitution “fail-closed family bus” is path-dependent.  
- **action:** Use the family predicate on calendar. Add Worker unit test empty-secret calendar → 403.  
- **related:** Q-002 (proxy is fine); REL/SEC for secret ops.

### F-API-002 — Catalog cup fallback invents match times/scores on ingest UI path

- **severity:** S1  
- **confidence:** high  
- **evidence:** `ingestOfficial.ts` L70–72 `officialFromExampleCup`; `exampleTournaments.ts` `weekendAt()` HC2026 seeds; Espoo scores 6–52 / 55–6; `mergeOfficialWithCupFallback` L309–310 returns catalog when live cup empty. Constitution item 4; G-03.  
- **blast radius:** Parents pasting those three catalog URLs see **this weekend’s** invented kickoffs / canned scores in Dexie + HUD when federation returns no cup rows.  
- **why:** `fallbackToSynthetic: false` is true but a second factory writes events anyway.  
- **action:** Do not `bulkPut` catalog fixtures unless live matches exist; surface “cup not published”. Keep catalog for onboarding copy only.  
- **related:** G-03; QA tests that assert cup rows appear.

### F-API-003 — `tulospalvelu.lentopallo.fi` parsed but not proxy-allowlisted

- **severity:** S2  
- **confidence:** high  
- **evidence:** `parseAssociationUrl` L280–304 canonical `https://tulospalvelu.lentopallo.fi/team/{id}`; OnboardingWizard sample that URL; `hostnameAllowed` L79–95 has no `lentopallo.fi`. HTML fetchUrl = proxy + canonical → 400. JSON may still work via `tupa.api.torneopal.com`. `www.tulospalvelu.basket.fi` same class.  
- **blast radius:** Volleyball HTML fallback dead; onboarding sample may show “source unreachable” if JSON CORS/key fails.  
- **action:** Add `tulospalvelu.lentopallo.fi` + www (and `www.tulospalvelu.basket.fi`) to `hostnameAllowed`.  
- **open:** Confirm live JSON CORS from a browser for lentopallo team 57672 (do not burden in this pass).

### F-API-004 — `/api/proxy/ics` has no timeout and no body cap

- **severity:** S2  
- **confidence:** high  
- **evidence:** `worker.ts` L547–564 `fetch(targetUrl, { redirect: 'follow', headers })` — no `AbortSignal.timeout`. Contrast roster ICS L172 `timeout(8000)`, client extract 8 s, ICS ingest 10 s, FMI 8 s, LIPAS 5 s. `feedRes.text()` unbounded.  
- **blast radius:** Slow allowlisted origin holds a Worker subrequest; client aborts; amplification vs vendors; large ICS/HTML can bloat isolate. Proxy is unauthenticated (F-API-013).  
- **action:** `AbortSignal.timeout(8000)` + max bytes (e.g. 2 MiB) + 502 on timeout.

### F-API-005 — Proxy follows redirects without re-validating hostname (SSRF shape)

- **severity:** S2  
- **confidence:** medium  
- **evidence:** L549 `redirect: 'follow'` after allowlist check on **request** URL only. Open redirect on `nimenhuuto.com` / `*.torneopal.fi` could land off-allowlist.  
- **blast radius:** Classic allowlist-bypass SSRF; Worker egress only (not parent LAN).  
- **action:** `redirect: 'manual'` or re-run `isAllowedProxyTarget` on each Location.  
- **related:** primary AREA could be SEC; do not triple-count. QUESTION SEC.

### F-API-006 — Player-page parser always binds team `34013` / demo name

- **severity:** S2  
- **confidence:** high  
- **evidence:** `statsEngine.ts` L332–338 `teamId: '34013'` (KW Memorial Indians catalog team); `playerId === '146432' ? 'Pelaaja 55'`. Any `*.torneopal.fi` player URL ingests **that** team.  
- **blast radius:** Wrong season in Dexie if a parent pastes a player link.  
- **action:** Require `joukkue` query or fail closed (`null`); delete demo name branch.

### F-API-007 — `fam_events_${code}` read, never written

- **severity:** S3  
- **confidence:** high  
- **evidence:** `worker.ts` L465–474 GET KV; grep `src/` zero writers. Calendar custom events / notes / talkoo never appear on webcal. Client `calendarFeedGenerator.ts` is the real ICS builder for local export.  
- **action:** Delete dead read **or** document “webcal = roster ICS only”. Do **not** start writing events to KV (constitution item 5).  
- **related:** DATA (KV contents).

### F-API-008 — CORS localhost:5173 vs Vite port 3000; proxy always prod Worker

- **severity:** S3  
- **confidence:** high  
- **evidence:** `worker.ts` L204–205 vs `vite.config.ts` L72 `port: 3000`. `DEFAULT_PROXY_URL` hardcoded prod. Local browser Origin not echoed → ingest HTML/ICS/LIPAS/FMI-via-proxy unreadable. Torneopal JSON may still work if vendor CORS allows.  
- **action:** Add `http://localhost:3000` and `127.0.0.1:3000`, or change Vite to 5173.

### F-API-009 — Nominatim / home servicemap unproxied; Nominatim not allowlisted

- **severity:** S3  
- **confidence:** medium  
- **evidence:** `homeLocation.ts` L133–173 direct `api.hel.fi` + `nominatim.openstreetmap.org`. Nominatim often blocks browser CORS; UA from `fetch` may be overwritten. Venue LIPAS **is** proxied.  
- **blast radius:** Kotiosoite outside HKI servicemap may fail silently (`null`).  
- **action:** Proxy servicemap (already allowlisted). Add Nominatim only with tight path + UA, or drop OSM and ask GPS.

### F-API-010 — FMI ingest skips proxy; CAP URL dead

- **severity:** S4  
- **confidence:** high  
- **evidence:** `fetchFmiMatchWeather(..., proxyUrl?)` default unproxied; ingest L133 omits proxy. `capAlertsUrl` unused; `alerts.fmi.fi` not allowlisted. Failure → `console.warn` + `null` (honest).  
- **action:** Pass `DEFAULT_PROXY_URL` from ingest (host already allowlisted) for Safari CORS parity. Remove or wire CAP.

### F-API-011 — Torneopal SPA keys in client source

- **severity:** S4  
- **confidence:** high  
- **evidence:** `torneopalClient.ts` L16–18. Same class as public tulospalvelu keys.  
- **action:** Keep; document. Do not treat as product secrets.

### F-API-012 — Worker ICS emitter does not RFC-escape text

- **severity:** S3  
- **confidence:** high  
- **evidence:** `worker.ts` L511–513 vs `calendarFeedGenerator.ts` L23–29 `escapeIcsText`. `UID` uses `Math.random()` for custom events.  
- **blast radius:** Newline/semicolon in `ev.title`/`notes` (if `fam_events` ever populated) splits VEVENT. Today writer is dead so latent.  
- **action:** Share `escapeIcsText` on the Worker if custom events stay.

### F-API-013 — Proxy unauthenticated and un-rate-limited

- **severity:** S3  
- **confidence:** high  
- **evidence:** Rate limit function only called under `/api/family/` L240. Proxy GET is public. Allowlist is the only brake.  
- **action:** Same Cache API limiter on `/api/proxy/ics` (e.g. 60/900s/IP) after F-API-004 timeout.  
- **related:** SEC.

### F-API-017 — Espoo `/match/:id` hardcodes team 203621

- **severity:** S3  
- **confidence:** high  
- **evidence:** `statsEngine.ts` L159–168. Any match URL on that host attaches TOPOLA’s team id + `seasonId: 'esli2026'`.  
- **action:** Parse team from page/API or refuse match-only URLs.

---

## 12. Q-002 official answer (for `board/questions.md`)

**From:** API  
**To:** ORCH  

Confirm proxy hostname allowlist covers koripallo-api and blocks arbitrary URLs.

**Answer:** **Yes / yes.** `koripallo-api.torneopal.net` is explicitly allowlisted (`worker.ts` L90) and also covered by `*.torneopal.net` (L91). Client basket ingest uses that host (`torneopalClient.ts` L34–38; unit test `listTorneopalAttempts` basket → only that base). Arbitrary URLs are rejected by `isAllowedProxyTarget` (https, no userinfo, no non-443 port, no IP literal, hostname allowlist). Live GET-safe: `url=https://example.com/` → **400** `Disallowed or missing URL parameter`; same for `http://` even on an allowlisted name and for `https://1.1.1.1/`. Residual: F-API-003 (lentopallo HTML host missing), F-API-005 (redirect follow).

---

## 13. Questions for other roles

| ID | To | Question |
|---|---|---|
| (new) | SEC | F-API-005 redirect-follow SSRF: treat as SEC primary or leave as API? Cache-API rate limit per-colo bypass — in scope? |
| (new) | DATA | Confirm PUT body never includes events; `fam_events_*` unused. Q-003. |
| (new) | QA | Do ingest tests still assert `officialFromExampleCup` rows (would fail F-API-002 fix)? `fallbackToSynthetic: true` still in `statsEngine.test.ts` L627. |
| (new) | REL | Worker proxy timeout + calendar fail-closed — deploy with wrangler; no OpenAPI. |
| (new) | UIX | If F-API-002 removed, cup-not-published copy needed on onboarding for HC2026 / EsLi / KW. |

---

## 14. Contradictions (candidates)

| ID | A | B |
|---|---|---|
| C-API-001 | `FAMILY_CODES_OPS.md` / constitution: empty secret → 403 all Worker family surfaces | `worker.ts` calendar L445 fail-open when `issued.size === 0` |
| C-API-002 | `ingestOfficial.ts` L60–64 “never fabricate a season” | L70–72 `officialFromExampleCup` fabricates cup fixtures/times/scores |
| C-API-003 | Parser accepts `tulospalvelu.lentopallo.fi` (onboarding sample) | Worker `hostnameAllowed` omits it → proxy 400 |

Do not overwrite G-03; F-API-002 is the API-area restatement with ingest-path evidence.

---

## 15. What is fine (do not re-open without new proof)

- CORS not `*` on Worker; evil Origin not echoed (live OPTIONS).  
- Family GET unknown code 403; illegal Crockford 400.  
- If-Match 409 on existing PUT/DELETE.  
- Proxy not open (Q-002). userinfo / http / IP blocked.  
- Ingest `fallbackToSynthetic: false` (M-04 denied).  
- FMI omits weather rather than inventing PoP.  
- Geocoder flags approximate Töölö.  
- Pages calendar Function is GET proxy only.  
- No cloud LLM vendor.

---

## Commands run

```bash
curl -sS -D - https://pelipaiva.pages.dev/
curl -sS https://pelipaiva.pages.dev/api/calendar?perhe=DKJVB-H
curl -sS https://pelipaiva-edge.sakkoja.workers.dev/api/family/DKJVB-H
# plus status, worker calendar, SAIMA-4, proxy negative tests, OPTIONS CORS — see §10
```

Files read in full or extract-path: `cloudflare-worker/worker.ts`, `wrangler.jsonc`, `proxyUrl.ts`, `ingestOfficial.ts`, `torneopalClient.ts` (+ test), `associationUrlParser.ts`, `associationExtractor.ts` (re-export + HTML rows), `statsEngine.ts` parser + `extractOfficialTeamData`, `fmiWeatherEngine.ts`, `radarSatelliteEngine.ts` (WMS URLs), `sportsGeocoder.ts` resolve + LIPAS/hel, `homeLocation.ts` Nominatim, `functions/api/calendar.js`, `functions/api/calendar/feed/[code].js`, `familyCloud.ts` GET/PUT, `exampleTournaments.ts`, `calendarFeedGenerator.ts` (escape contrast), `eventSourceResolver.ts` (SuomiSport label only).
