# Pelipäivä Family Sync — Architecture Plan

Version: 1.0  
Date: 2026-08-23  
Status: approved direction (B+A), not yet implemented  
Product: Pelipäivä PWA — https://pelipaiva.pages.dev  
Repo: https://github.com/traali/pelipaiva (branch: main)

## 1. One-sentence goal

When one parent adds a child, team or cup, every family phone shows the same roster. Matches are not copied. Each phone loads them from tulospalvelu using the shared team URL.

## 2. What exists today (gap)

| Piece | Today | Gap |
| --- | --- | --- |
| Dexie `PelipaivaDB` | Local profiles, events, officialFixtures | Per browser only |
| `?share=` QR | Stubs: id, playerName, teamName, sport, calendarUrl, colorHex | No teamId, no associationUrl, no season query, no ingest |
| JSON backup v2 | profiles + arrivalRules + aliases + pins | No events, manual file |
| Worker `MATCHDAY_KV` | PUT `/api/sync/:key` (key at least 16 chars, 7d TTL) for Nest Hub | No GET for family, no 6-char code |
| ICS proxy | GET `/api/proxy/ics?url=` | Keep as-is |
| WhatsApp | Generated talkoo / post-match / logistics lines; paste-parse in Quick Drop | No family-join template, no `?perhe=` |
| Identity | `profile-${Date.now()}` | Two phones mint two ids for the same child+URL |

Constitution (do not break):

- Zero auth / no family login
- Dexie remains source of truth on the device
- No product LLM
- No kids medical / injury / nimenhuuto secrets in the cloud
- Offline hall must still render the HUD from Dexie

## 3. Architecture (winner: B bus + A hydrate)

```
 Phone A (aiti)                         Cloudflare                         Phone B (isa)
 +---------------------+                +------------------+               +---------------------+
 | Dexie profiles      |  PUT roster    | MATCHDAY_KV      |  GET roster   | Dexie profiles      |
 |  Aada + TOPOLA URL  |--------------->| family:SAIMA-4   |-------------->|  Aada + TOPOLA URL  |
 |                     |  ~2 KB, 7d     | rev, tombstones  |  on focus     |                     |
 | extractOfficial...  |                +------------------+               | extractOfficial...  |
 | mergeOfficialWith...|        ^                                          | mergeOfficialWith...|
 | officialDataToEvents|        | WhatsApp synthetic                       | officialDataToEvents|
 | -> events (local)   |        | "Pelipaiva-perhe SAIMA-4"                | -> events (local)   |
 +---------------------+        |                                          +---------------------+
        |                       |
        |  tulospalvelu / Torneopal / Espoo Liikkuu / KW / hc2026
        +-----------------------+-------- each phone fetches matches itself
```

Cloudflare stores who plays where.  
Tulospalvelu stores when and against whom.

## 4. What is stored where

### 4.1 Cloudflare KV — `family:{CODE}` (~2 KB)

```ts
interface FamilyRosterV1 {
  v: 1;
  rev: number;                 // monotonic, If-Match
  updatedAt: string;           // ISO
  profiles: FamilyRosterRow[];
  tombstones: Array<{ id: string; deletedAt: string }>;
}

interface FamilyRosterRow {
  id: string;                  // stable: see section 5
  playerName: string;          // first name only
  teamName: string;
  sport: SportType;
  colorHex: string;
  calendarUrl: string;         // RAW url, keep ?season=hc2026&category=B13-8
  associationUrl?: string;
  associationType?: string;
  teamId?: string;
}
```

Forbidden in KV:

- events
- officialFixtures
- weather
- parking
- stats
- briefing
- injury
- arrivalRules
- venuePins
- nimenhuuto cookies
- last names
- photos

TTL: `expirationTtl: 604800` (7 days). Slide TTL on every successful PUT. Idle 7 days means the code dies (print a new one). Season-long identity would need accounts (out of scope).

### 4.2 Dexie (unchanged tables)

On GET:

1. Union incoming rows by stable id (section 5)
2. Apply tombstones (delete local profile + its events)
3. For each new/changed URL, run existing ingest: `parseAssociationUrl` then `extractOfficialTeamData({ fallbackToSynthetic: false })` then `mergeOfficialWithCupFallback` then write `officialFixtures` + events
4. Set `lastOfficialSyncAt`

`syncState` row (already in schema, unused by UI):

```
key: 'family'
syncKey: 'SAIMA-4'
lastSyncedAt: ISO
```

### 4.3 WhatsApp — not a store

WhatsApp is transport only. The app generates copy-paste text. The family group is the human bus. Cloudflare never stores the thread.

## 5. Stable identity

Stop using `profile-${Date.now()}`.

```
id = "p:" + slug(playerName) + ":" + teamSourceKey(calendarUrl)
```

`teamSourceKey` already exists in `src/lib/clubs/attachTeam.ts`:

- Palloliitto league: `tulospalvelu.palloliitto.fi:185085`
- Helsinki Cup: `tulospalvelu.palloliitto.fi:185085:hc2026`
- Espoo Liikkuu: `espooliikkuutournament.fi:203621`
- KW Memorial: `kwmemorialcup26.torneopal.fi:34013:eräviikingit_0005`

Same child + same team URL = one row on every phone.

League 185085 is not cup 185085?season=hc2026. Keep the raw query string in `calendarUrl`. `parseAssociationUrl` currently strips season if you canonicalize — do not share the canonicalized URL.

Merge: `findExistingTeamProfile(profiles, playerName, url)` before insert.

## 6. Family code

Format: Crockford-32, 6 chars, display `SAIMA-4` (5 + hyphen + 1).

```
Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ  (no I, L, O, U)
Regex:    /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$/
Entropy:  32^6 ≈ 1.07e9
```

Generate on first "Luo perhe-koodi". Retry if KV key occupied. Rotate = new code, copy roster, DELETE old key. Possession of the code = membership. No logins.

Deep link: `https://pelipaiva.pages.dev/?perhe=SAIMA-4`

## 7. Worker API

Base: `https://pelipaiva-edge.sakkoja.workers.dev`

Do not reuse `/api/sync/:key` (Nest briefing, key at least 16 chars, PUT-only).

```
GET    /api/family/:code
PUT    /api/family/:code
DELETE /api/family/:code
OPTIONS (CORS as today)

CORS:
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, If-Match
```

PUT body = `FamilyRosterV1`  
Header `If-Match: {rev}` (optional on first PUT, required after).

- stale rev -> 409 `{ error: 'rev_conflict', rev }`
- missing / expired / invalid code -> 404 (same body for all three)
- malformed code -> 400

Rate limit (Cache API counter per IP, 15 min):

- GET 20
- PUT 5
- DELETE 3
- Over -> 429

KV key: `family:{CODE}` where CODE is the hyphenated uppercase form.

Client loop:

- PUT debounce 1.5 s after profile add/update/delete
- GET on `visibilitychange` / focus + every 30 s while document visible
- Pause in background (battery)
- On 409: GET, union by id, drop tombstones, rev+1, PUT
- New URL after GET -> ingest path above (never write synthetic league names)

Sandbox (Grok preview): TanStack route `/api/family/$code` proxies the same worker. Dexie stays source of truth.

## 8. WhatsApp synthetics (copy templates)

All generated on device. Deterministic. No LLM.

### 8.1 Join (once, fridge / family group)

```
Pelipäivä-perhe {CODE}
Avaa: https://pelipaiva.pages.dev/?perhe={CODE}

Etunimi ja joukkue-URL Cloudflareen 7 pv.
Ottelut tulospalvelusta. Ei sukunimeä, ei vammoja.
```

Use `wa.me/?text=` plus `navigator.clipboard.writeText`.  
QR of the URL only (short). Do not send names to qrserver.com — encode QR in-canvas or omit.

### 8.2 Roster delta (after add-team)

```
Pelipäivä: {playerName} → {teamName}
{cupOrLeagueName}
{rawCalendarUrl}
```

Example:

```
Pelipäivä: Aada → TOPOLA
Espoo Liikkuu Tournament 2026
https://espooliikkuutournament.fi/team/203621
```

### 8.3 Talkoo (existing `talkooWhatsAppLine`, keep)

```
Talkoo:
• Simo 09:45 Kahvio @ Tapanilan Mosahalli
• Aada 10:30 Kellotus @ Esport Center 2
```

### 8.4 Parse-back (Quick Drop / Smart Import)

If pasted text matches:

- `/?perhe=([A-Z0-9-]{6,7})`
- `Pelipäivä-perhe ([A-Z0-9-]{6,7})`

then join that code (GET + hydrate).

If pasted text is a known association URL (espooliikkuu / kwmemorial / palloliitto / salibandy / basket) then existing attach-team flow for the active child, then PUT roster.

Example test fixtures (ship in `src/lib/sync/familyWhatsApp.examples.ts`):

```
1) Join
   Pelipäivä-perhe SAIMA-4
   Avaa: https://pelipaiva.pages.dev/?perhe=SAIMA-4

2) Add cup
   Pelipäivä: Aada → TOPOLA
   Espoo Liikkuu Tournament 2026
   https://espooliikkuutournament.fi/team/203621

3) Add KW
   Pelipäivä: Eemil → EräViikingit
   KW Memorial Cup 2026
   https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=EräViikingit_0005&sarja=2546

4) Add Helsinki Cup
   Pelipäivä: Simo → PPJ/Laru sin
   Helsinki Cup 2026
   https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8

5) Coach noise (must NOT join)
   Muistakaa nappikset ja vesi. Kokoontuminen 14.15 Pyrkällä.
```

## 9. Client UX

FamilyShareModal tabs:

1. Perhe-koodi — show CODE, copy join message, WhatsApp, rotate, leave
2. Jaa linkki — `?perhe=` (not fat `?share=` stubs)
3. Tiedosto — JSON backup v2 remains airgap (no KV needed)

After `handleImportCalendar` succeeds: sheet "Jaa perheeseen?" opens tab 1 with join + delta messages.

Onboarding / empty state: "Liity koodilla" input. Accept `SAIMA-4` or paste a full WhatsApp blob.

Honest copy (replace the false "ilman valikasia" line):

```
Etunimi ja joukkue-URL Cloudflareen 7 päivää.
Ottelut haetaan tulospalvelusta tällä puhelimella.
Ei käyttäjätunnusta.
```

## 10. GDPR / kids

- Legal basis: household / parental use
- Data: first name + public team URL
- Processor: Cloudflare Workers + KV (existing DPA)
- Minimization: 7-day TTL, no events, no last name, no photos
- UI disclosure before first PUT (checkbox once, localStorage flag)
- Rotate/DELETE wipes KV
- Leave family = delete `syncState`, stop polling
- Do not log request bodies
- Same 404 for missing, expired, invalid (no oracle)

Accept residual: anyone with the code is a "parent". Fine for first name + public tulospalvelu URL. Not fine for medical. Injury notes stay Dexie-only.

## 11. Failure modes

| Failure | Effect | Mitigation |
| --- | --- | --- |
| Code leaked (fridge photo, WA) | Stranger sees first names + public URLs | Rotate; rate-limit; 7d TTL |
| Two parents add at once | 409 | GET + union by stable id + tombstones |
| Colour-only edit lost | Last rev wins | Debounce 1.5s; tell UI |
| KW Memorial 503 | Empty live fixtures | Existing canned cup fallback; never synthetic 25301 names |
| hc2026 vs league 185085 | Wrong series | Share raw URL; teamSourceKey season tag |
| Offline at hall | No GET/PUT | Dexie HUD still works; queue PUT on online |
| 7d idle expiry | Code gone | PUT on every open slides TTL; reprint after holiday |
| Worker down | No sync | File/QR airgap (backup v2) |
| PWA old Dexie demo | Fake ToPo cards | User clears site data; new ingest refuses synthetic |

## 12. Phases

### Phase 0 — no Worker change (1 PR)

- Widen `generateSharePayload` / `unpackSharePayload`: associationUrl, teamId, raw calendarUrl, colorHex
- On `?share=` and file import: run cup ingest (`fallbackToSynthetic: false`)
- Stable ids via teamSourceKey
- In-canvas QR or copy-only; kill qrserver.com name leak
- Prompt Jaa perheeseen after add-team
- Tests: TOPOLA + hc2026 + KW roundtrip; league 185085 is not cup 185085

### Phase 1 — this plan (2nd PR)

- Worker `GET|PUT|DELETE /api/family/:code`
- Client poll/PUT + `?perhe=`
- Three WhatsApp synthetics + parse-back
- Example fixtures file + unit tests
- Disclosure copy

### Out of scope

- Accounts / family login
- Yjs CRDT / Durable Objects
- In-car WebRTC
- Storing events or WhatsApp threads in KV
- Changing Nest `/api/sync`

## 13. Files to touch

Worker:

- `cloudflare-worker/worker.ts` — add `/api/family/:code`; leave `/api/sync` and `/api/proxy/ics`

App:

- `src/lib/sync/familyShare.ts` — roster snapshot, merge, code, WhatsApp templates
- `src/lib/sync/familyCloud.ts` — GET/PUT/poll, 409 retry
- `src/lib/sync/familyWhatsApp.examples.ts` — synthetic messages + parser tests
- `src/lib/clubs/attachTeam.ts` — stable id helper (reuse teamSourceKey)
- `src/lib/storage/db.ts` — write syncState.family
- `src/App.tsx` — `?perhe=` join, ingest after GET, PUT after add/delete
- `src/components/FamilyShareModal.tsx` — code UI, WA buttons, disclosure
- `src/components/QuickDropInBar.tsx` / `SmartImportModal.tsx` — parse-back

Tests:

- `src/lib/sync/familyCloud.test.ts` — merge, tombstone, rev, hc2026 vs league
- `src/lib/sync/familyWhatsApp.test.ts` — 5 fixtures above
- Keep `tests/e2e/tier0_recovery/t0_family_share_backup.test.ts` for v2 file

## 14. Acceptance (family Saturday)

1. Phone A: add Aada + https://espooliikkuutournament.fi/team/203621
2. Phone A: copy join WhatsApp, send to family group
3. Phone B: open https://pelipaiva.pages.dev/?perhe=SAIMA-4 (or paste the message)
4. Phone B HUD shows Aada / TOPOLA / Espoo Liikkuu / Esport Center 2
5. No `Basket.fi / ToPo (5756346)`, no fake 22p table
6. Airplane mode on B: HUD still shows the cup from Dexie
7. Phone A deletes Aada’s team → within ~30s B drops it (tombstone)
8. KV body is roster only (no fixtures)

## 15. Decision log

- Winner of agentic gauntlet: B (KV family code) + A (roster hydrate)
- C (fat file) kept as airgap, not the live path
- D (CRDT) rejected: 5 rows, rare dual-edit
- E (WebRTC) rejected: fails for "lisasin toissa"
- Matches stay on tulospalvelu so we never reintroduce synthetic league cards
