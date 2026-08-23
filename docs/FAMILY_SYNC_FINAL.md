# Pelipäivä Family Sync — Final Build Plan

Version: 2.0 (final)  
Date: 2026-08-23  
Status: **this is the document to implement**  
Supersedes for build order: [FAMILY_SYNC_ARCHITECTURE.md](./FAMILY_SYNC_ARCHITECTURE.md) (v1.0 product) and [FAMILY_SYNC_ENHANCEMENTS.md](./FAMILY_SYNC_ENHANCEMENTS.md) (v1.1 notes)  
Product: https://pelipaiva.pages.dev  
Repo: https://github.com/traali/pelipaiva (`main`)

---

## 0. One sentence

One parent adds a child, team or cup. Every family phone shows the same roster. Matches are not copied. Each phone loads them from tulospalvelu.

Cloudflare = who plays where (~2 KB, 7 days).  
Tulospalvelu = when and against whom.

---

## 1. What we are building

| Layer | Mechanism | Role |
| --- | --- | --- |
| Bus | Family code `PERHE-2` on existing `MATCHDAY_KV` | Other phone sees new roster row in ~30s |
| Engine | Existing ingest (`extractOfficialTeamData` + cup fallback) | Each phone hydrates Espoo Liikkuu / KW / Helsinki Cup itself |
| Airgap | JSON backup v2 + short `?perhe=` link | Works if Worker is down |
| Human transport | WhatsApp synthetics (copy/paste, no LLM) | Join + delta + talkoo |

Not building: accounts, CRDT, WebRTC, event blobs in KV, WhatsApp thread storage.

---

## 2. Cut from the hardening spec

Taken from v1.1. Only these enter the build.

| Keep | Why |
| --- | --- |
| Hydrate pool (max 2 parallel) | 4 association fetches on hall 4G will time out |
| Cascade tombstone on child delete | Aada with football + TOPOLA is two rows |
| Offline mutation queue | Dexie first; PUT when `online` |

| Drop | Why |
| --- | --- |
| 30-day tombstone GC | KV TTL is 7 days; the whole record dies first |
| Dual `If-Match` + `X-Pelipaiva-Rev` | This Worker is the only hop. Quote `If-Match` if you want. Stop there. |
| `localColorHex` vs family color | Kit is family truth. Last-write-wins on `colorHex`. |

| Optional | Why |
| --- | --- |
| Crockford checksum as last digit of `XXXXX-C` | Stops mum typos before a GET. Not security. Rate-limit is. Do in Phase 1 if cheap. |

---

## 3. Constitution (do not break)

- Zero auth / no family login
- Dexie is source of truth on the device
- No product LLM
- No last names, injuries, nimenhuuto secrets, photos, events, weather, parking in KV
- Offline hall still renders HUD from Dexie
- `fallbackToSynthetic: false` — never write `Basket.fi / ToPo (5756346)` or `Salibandy / ErVi (25301)`
- Share the **raw** team URL (`?season=hc2026` must survive). League 185085 ≠ Helsinki Cup 185085.

---

## 4. Data

### 4.1 KV `family:{CODE}` (~2 KB, TTL 604800, slide on PUT)

```
FamilyRosterV1 {
  v: 1
  rev: number
  updatedAt: ISO
  profiles: FamilyRosterRow[]
  tombstones: { id, deletedAt }[]
}

FamilyRosterRow {
  id              // p:{slug(playerName)}:{teamSourceKey(calendarUrl)}
  playerName      // first name only
  teamName
  sport
  colorHex        // family kit; last-write-wins
  calendarUrl     // RAW, keep query string
  associationUrl?
  associationType?
  teamId?
}
```

### 4.2 Stable id

```
p:aada:espooliikkuutournament.fi:203621
p:simo:tulospalvelu.palloliitto.fi:185085:hc2026
p:eemil:kwmemorialcup26.torneopal.fi:34013:eräviikingit_0005
```

Reuse `teamSourceKey` in `src/lib/clubs/attachTeam.ts`. Stop `profile-${Date.now()}`.

### 4.3 Dexie `syncState`

```
key: 'family'
syncKey: 'PERHE-2'
lastSyncedAt: ISO
pendingUpload: boolean   // offline queue flag (keep 2.6)
```

---

## 5. Family code

Display: `XXXXX-X` (Crockford-32, no I/L/O/U).

**Issued slots:** 10 codes live only in the Cloudflare Worker secret `FAMILY_CODES`. They are not in this repo, not in the PWA bundle, and the app cannot mint new ones.

- Worker: code not in the secret → 403 `unknown_family` (fail closed if the secret is empty)
- Client: join-only. No “Luo perhe-koodi”.
- Deep link: `https://pelipaiva.pages.dev/?perhe={issued-code}`

Possession of an issued code = membership. Do not commit values.

---

## 6. Worker

Base: `https://pelipaiva-edge.sakkoja.workers.dev`  
Do **not** reuse `/api/sync/:key` (Nest Hub).

```
GET    /api/family/:code
PUT    /api/family/:code      body FamilyRosterV1, If-Match: "{rev}"
DELETE /api/family/:code
```

- stale rev → 409 `{ error: "rev_conflict", rev }`
- missing / expired / invalid → same 404
- malformed code → 400
- rate limit per IP / 15 min: GET 20, PUT 5, DELETE 3 → 429

On 409: GET → union by id → apply tombstones → rev+1 → PUT.

Client: PUT debounce 1.5s after add/update/delete. GET on focus + every 30s while visible. Pause in background.

---

## 7. Hydrate after GET (keep 2.3)

For each new/changed profile URL:

1. `parseAssociationUrl` (keep raw query)
2. `extractOfficialTeamData({ fallbackToSynthetic: false })`
3. `mergeOfficialWithCupFallback`
4. Write `officialFixtures` + events (`fixture-${profileId}-${fixture.id}`)

Pool: **max 2 parallel**. A failing KW 503 must not block TOPOLA. Use `Promise.allSettled`. Empty live cup → existing canned cup seed, never synthetic league names.

---

## 8. Offline queue (keep 2.6)

1. Mutation writes Dexie immediately, `pendingUpload = true`
2. Listen `online` + `visibilitychange`
3. On reconnect: GET → union → bump rev → PUT
4. HUD never waits for the network

---

## 9. Cascade delete (keep 2.5)

`deletePlayer(playerName)` tombstones **every** profile with that first name (football + cup + basketball). One child gone on phone A → all her rows gone on phone B.

---

## 10. WhatsApp synthetics (not stored)

Join:

```
Pelipäivä-perhe PERHE-2
Avaa: https://pelipaiva.pages.dev/?perhe=PERHE-2

Etunimi ja joukkue-URL Cloudflareen 7 pv.
Ottelut tulospalvelusta. Ei sukunimeä, ei vammoja.
```

Delta after add:

```
Pelipäivä: Aada → TOPOLA
Espoo Liikkuu Tournament 2026
https://espooliikkuutournament.fi/team/203621
```

Talkoo: keep `talkooWhatsAppLine`.

Parse-back in Quick Drop: `/?perhe=` or `Pelipäivä-perhe ` → join. Coach noise must not join.

Kill `qrserver.com` (names leak). In-canvas QR of the short URL, or copy-only.

Disclosure before first PUT:

```
Etunimi ja joukkue-URL Cloudflareen 7 päivää.
Ottelut haetaan tulospalvelusta tällä puhelimella.
Ei käyttäjätunnusta.
```

---

## 11. Phases

### Phase 0 — client only (PR 1)

- Stable ids
- Widen share payload: associationUrl, teamId, raw calendarUrl, colorHex
- `?share=` / file import → ingest (`fallbackToSynthetic: false`)
- Prompt Jaa perheeseen after add-team
- In-canvas QR or copy-only
- Tests: TOPOLA, KW, hc2026 vs league 185085

### Phase 1 — Worker + WhatsApp (PR 2)

- `/api/family/:code`
- `?perhe=` join, poll, PUT, 409 retry
- Offline queue, hydrate pool, cascade delete
- Three WhatsApp templates + parse-back + 5 fixtures
- Optional checksum digit
- Disclosure copy

### Out of scope

Accounts, Yjs, WebRTC, events in KV, Nest `/api/sync` changes, local color forks, 30-day tombstone GC.

---

## 12. Files

Worker: `cloudflare-worker/worker.ts`

App:

- `src/lib/sync/familyShare.ts`
- `src/lib/sync/familyCloud.ts`
- `src/lib/sync/familyWhatsApp.examples.ts`
- `src/lib/clubs/attachTeam.ts`
- `src/lib/storage/db.ts`
- `src/App.tsx`
- `src/components/FamilyShareModal.tsx`
- `src/components/QuickDropInBar.tsx`
- `src/components/SmartImportModal.tsx`
- `src/components/FamilyManageModal.tsx` (cascade delete)

Tests:

- `src/lib/sync/familyCloud.test.ts`
- `src/lib/sync/familyWhatsApp.test.ts`
- existing `tests/e2e/tier0_recovery/t0_family_share_backup.test.ts`

---

## 13. Saturday acceptance

1. Phone A adds Aada + https://espooliikkuutournament.fi/team/203621
2. Phone A sends join WhatsApp
3. Phone B opens `?perhe=PERHE-2` (or pastes the message)
4. Phone B HUD: Aada / TOPOLA / Espoo Liikkuu / Esport Center 2
5. No `Basket.fi / ToPo (5756346)`, no fake 22p
6. Airplane mode on B: cup still on HUD
7. Phone A deletes Aada (all her teams) → B drops them within ~30s
8. KV body is roster only
9. Hall offline add on A, walk outside → B sees it after GET

---

## 14. Decision log

- Agentic winner: B (KV code) + A (roster hydrate). C file = airgap.
- D CRDT and E WebRTC rejected.
- Hardening v1.1: keep hydrate pool, cascade delete, offline queue. Drop 30d GC, dual ETag, localColorHex. Checksum optional.
- Matches stay on tulospalvelu so synthetic league cards cannot return via sync.
