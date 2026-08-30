# DATA trace — Pelipäivä @ 20bad06

**Agent:** DATA  
**SHA:** `20bad06e559d77310bd8cc1971c2e1f1ff988f95`  
**Date:** 2026-08-30  
**Scope:** `src/lib/storage/db.ts`, `homeLocation.ts`, `familyCloud.ts`, `familyCode.ts`, `cloudflare-worker/worker.ts` KV get/put/delete/TTL, localStorage keys in `src/`.  
**Out of scope:** src edits, git commit, PUT/DELETE against prod family slots.

---

## 0. Q-003 answer (ORCH → DATA)

**Question:** Does PUT family roster ever include events or last names?

**Answer:**

| Payload field | In PUT `FamilyRosterV1`? | Evidence |
|---|---|---|
| **events** (Dexie `MatchdayEvent[]`, fixtures, notes, volunteerDuty) | **NO** | Client maps 9 profile scalars + tombstones only (`familyCloud.ts` L387–403). Worker re-allowlists the same fields (`worker.ts` L339–363). Extra JSON keys are dropped, not stored. |
| **weather** | **NO** | `WeatherCondition` lives on `MatchdayEvent.weather` (`matchday.ts` L536). Not a roster field. Hydration fetches weather **after** GET, device-side (`hydrateRosterProfiles` `includeWeather: true`, L277). |
| **parking** | **NO** | `ParkingInfo` lives on `MatchdayEvent.parking` (`matchday.ts` L538). Not a roster field. |
| **last names** | **NOT AS A FIELD — but YES if the parent typed them into `playerName`** | Schema is a single `playerName: string` (docs say “first name only”). No client split, no Worker regex. Worker only `trim().slice(0, 30)` (`worker.ts` L341). `"Maija Virtanen"` (14) and `"Aino-Kaisa Kärkkäinen-Mäkelä"` (29) both fit. |

**Also not in PUT (constitution hold):** injuries (no field anywhere except free-text `MatchdayEvent.notes` / `playerLog.notes` in Dexie), photos (OCR is on-device, not persisted as blobs), home address, venue pins, arrival rules, officialFixtures, standings, teamRosters, LLM prefs, kit packed state.

**Related egress that is NOT the PUT body:** Worker `GET /api/calendar?perhe=` fetches each roster `calendarUrl` ICS and prefixes `SUMMARY` with `playerName` (`worker.ts` L152–158, L518–521). That is derived match text, not stored event blobs. Leftover read of `fam_events_${code}` would be events-in-KV if anything wrote it — nothing at this SHA writes it.

---

## 1. Commands run

```
git rev-parse HEAD
# 20bad06e559d77310bd8cc1971c2e1f1ff988f95

rg localStorage src
rg fam_events_ .
rg clearAllDatabaseData
rg MATCHDAY_KV\.(put|get|delete)

# GET-safe probes only
curl https://pelipaiva-edge.sakkoja.workers.dev/api/family/DKJVB-H
# 403 {"error":"unknown_family"}  (26 bytes)

curl https://pelipaiva.pages.dev/api/calendar?perhe=DKJVB-H
# 403 {"error":"unknown_family"}  (26 bytes)

curl https://pelipaiva-edge.sakkoja.workers.dev/
# 200 {"status":"Pelipäivä Edge API Active"}
```

No PUT/DELETE issued. Live `FAMILY_CODES` values not printed.

---

## 2. Dexie `PelipaivaDB` — schema v1 / v2

Source: `src/lib/storage/db.ts` L42–85.

### v1 stores (baseline)

```
profiles:     id, teamName, sport
events:       id, profileId, sport, startTime, [profileId+startTime]
venuePins:    normalizedQuery, venueName
syncState:    key, syncKey
```

### v2 stores (current)

```
profiles:          id, teamName, sport, associationUrl, teamId, associationType
events:            id, profileId, sport, startTime, officialFixtureId, reconciliationStatus, [profileId+startTime]
officialFixtures:  id, teamId, association, sport, startTime, [teamId+startTime]
leagueStandings:   id, teamId, leagueName, fetchedAt
teamRosters:       id, teamId, teamName, fetchedAt
arrivalRules:      profileId, defaultSport
venuePins:         normalizedQuery, venueName
customAliases:     pattern, canonicalClub, createdAt
syncState:         key, syncKey
```

v2 upgrade (`db.ts` L75–81): walks `events` and sets `reconciliationStatus = 'unlinked'` when missing. No other migration. New tables are empty on first v2 open.

**Dexie is document-store:** indexes are for query, not a column whitelist. A `MatchdayEvent` put from the UI carries the whole object: `venue`, `weather`, `lightning`, `parking`, `transit`, `stats`, `playerLog`, `briefing`, `chatMessages`, `notes`, `volunteerDuty` (`matchday.ts` L517–559). That is **device-local**. Same for `PlayerProfile` extras (`arrivalRules`, `lastOfficialSyncAt`, `preferredTransitMode`, `squadName`) — they survive `profiles.put` locally and are **stripped** on KV PUT.

**Federation last names on device:** `torneopalClient.ts` L369 concatenates `${first_name} ${last_name}` into `TeamSquadRoster.players[].playerName`. `saveOfficialTeamData` writes that into Dexie `teamRosters` (`db.ts` L182–200). Junior Palloliitto often withholds this (UI copy in `MatchStatsModal.tsx` L632). Either way it does **not** enter KV.

**Typing smell (not a finding):** `leagueStandings!: Table<LeagueStandingsRecord | any, string>` and same for `teamRosters` (`db.ts` L46–47). `saveOfficialTeamData` dual-keys standings/rosters by `teamId` **and** `teamName` (L170–198) so lookups by Finnish club name work.

### Persistence helpers

| Symbol | Lines | Role |
|---|---|---|
| `ensureStoragePersistence` | L90–102 | `navigator.storage.persist()` — best-effort, logs grant |
| `isStoragePersisted` | L107–116 | |
| `getStorageQuotaEstimate` | L121–139 | |
| `clearAllDatabaseData` | L430–442 | Clears **all 9** tables (incl. `customAliases`) |

`App.tsx` L187–189 calls `ensureStoragePersistence()` on mount.

---

## 3. What is uploaded — `familyCloud.ts`

### Roster types (`familyCloud.ts` L11–34)

```ts
FamilyRosterRow {
  id, playerName, teamName, sport, colorHex,
  calendarUrl,            // RAW, keeps ?season=hc2026&category=B13-8
  associationUrl?, associationType?, teamId?
}
FamilyRosterV1 { v: 1, rev, updatedAt, profiles[], tombstones[] }
```

Comment on `id` (L12): `p:{slug(playerName)}:{teamSourceKey(calendarUrl)}`. Slug is alphanumeric lowercase, 24 chars (`attachTeam.ts` `slugPlayerName` L65–71) — a last name in `playerName` is **baked into the stable id**.

### PUT body construction (`executeSyncFamilyRosterCycle` L387–403)

```ts
const rosterToPush: FamilyRosterV1 = {
  v: 1,
  rev: remote ? remote.rev + 1 : 1,
  updatedAt: new Date().toISOString(),
  profiles: mergedProfiles.map((p) => ({
    id: p.id,
    playerName: p.playerName,          // unsanitized string
    teamName: p.teamName,
    sport: p.sport,
    colorHex: p.colorHex || '#3b82f6',
    calendarUrl: p.calendarUrl || '',  // raw URL, query intact
    associationUrl: p.associationUrl,
    associationType: p.associationType,
    teamId: p.teamId
  })),
  tombstones
};
```

409 retry (L417–430) remaps the **same** 9 fields. No `events`, `weather`, `parking`, `notes`, `home`, `arrivalRules`.

`pushFamilyRoster` (`L83–134`) `JSON.stringify(roster)` with `If-Match: "{rev}"` and `X-Pelipaiva-Rev`. 10 s abort. Worker base `https://pelipaiva-edge.sakkoja.workers.dev` (L9).

### Merge / hydrate (local only)

- `mergeRosters` (L153–242): union by stable id, tombstones win, remote colorHex is family truth. Local `...lp` spread keeps Dexie-only fields on the device.
- `hydrateRosterProfiles` (L247–289): if a profile has 0 events or no `lastOfficialSyncAt`, ingest from `associationUrl || calendarUrl` with `includeWeather: true`. Weather/parking/events land in **this phone’s Dexie**, not KV.
- Demo ids (`profile-ppj-` / `profile-topola-` / `profile-kw-` / `profile-hjk-demo`) filtered out of PUT (L335–342). Constitution M-08 hold.
- Single-flight mutex per code (L291–324).

### Tombstones

Stored in **localStorage** `pelipaiva_tombstones_${cleanCode}` (L344–355), merged into the roster, then uploaded as `{id, deletedAt}[]`. Cascade: tombstoned profile + its Dexie events deleted locally (L357–376) before PUT.

---

## 4. Worker KV — get / put / delete / TTL

Source: `cloudflare-worker/worker.ts`. Binding `MATCHDAY_KV` id `10b2dc844fe04f01920bdfba6fdecda5` (`wrangler.jsonc` L8–13) — public binding, not a mint secret (Q-001 is SEC).

### Tenancy

- Path `/api/family/:code` → Crockford-32 `XXXXX-C` (`worker.ts` L231–238, same regex as `familyCode.ts` L5).
- Fail-closed: empty or missing `FAMILY_CODES` **or** code not in set → **403 `unknown_family`** (L243–248). Confirmed live on `DKJVB-H`.
- KV key: **`family:${code}`** (L251). Possession of an issued code **is** membership. No user table, no cookies, no Origin check on the JSON API itself (CORS only echoes first-party origins L200–216).
- Rate limit (cache API, not KV): GET 20 / PUT 5 / DELETE 3 per IP per 900 s (L40–76).

### GET (`L254–279`)

`MATCHDAY_KV.get(kvKey)` → 404 `not_found` if empty, 500 `corrupt_data` if JSON.parse fails, else raw `dataStr` with `ETag: "{rev}"`, `Cache-Control: no-store`. **GET does not rewrite TTL.**

### PUT (`L283–378`)

1. Require `v === 1` and `profiles` array (L294–298).
2. Null profile entries → 400 (L302–305). `colorHex` not `/^#[0-9a-fA-F]{6}$/` → coerced to `#3b82f6` (L306–308).
3. Existing key: missing/stale `If-Match` or `X-Pelipaiva-Rev` → **409** `rev_conflict` (L326–335). Matches `existingRosterPutConflicts` (`familyCode.ts` L41–45).
4. **Sanitized store object** (L339–363) — this is the constitution enforcement at the edge:

```ts
id,
playerName:  trim.slice(0, 30) || 'Pelaaja',
teamName:    trim.slice(0, 60) || 'Joukkue',
sport:       || 'football',          // no enum check
colorHex:    || '#10b981',
calendarUrl: String(...).slice(0, 400),
associationUrl,                      // NO length cap
associationType,                     // NO enum check
teamId                               // NO length cap
```

Tombstones mapped to `{id, deletedAt}` only (L351–354). Unknown body keys (`events`, `weather`, `parking`, `home`, `notes`, …) **die here**.

5. `MATCHDAY_KV.put(kvKey, JSON.stringify(toStore), { expirationTtl: 604800 })` (L365–367) — **7-day TTL, slides only on successful PUT.**

No max `profiles.length`. Calendar ICS later slices to 10 (`L164`). A PUT of 200 rows would store.

### DELETE (`L383–406`)

If the slot has data, same If-Match proof as PUT, then `MATCHDAY_KV.delete(kvKey)`. **No client caller** of DELETE at this SHA (`rg DELETE` in `src/` is HTTP method strings in worker only). UI “Tyhjennä tiedot” does not hit this.

### Calendar path leftover (`L464–474`) — not the family PUT

```ts
const eventsKey = `fam_events_${familyCode}`;
const existingEventsStr = await env.MATCHDAY_KV.get(eventsKey);
```

Then iterates `customEvents` into VEVENTs including `notes`, `volunteerDuty`, `kitAdvice`, `venue.name` (L490–516). **Zero writers** of `fam_events_` in the repo. Dead read. If a previous Worker version wrote it, those blobs would still render until TTL. Constitution risk, not a current PUT.

Calendar **family** check: `if (issued.size > 0 && !issued.has(familyCode))` (L444–449) — **fail-open when the secret is empty**, unlike `/api/family`. Prod secret is non-empty (DKJVB-H → 403). Flag for API/SEC; not DATA’s primary.

Calendar also `collectRosterIcsEvents` (L161–191): server-side fetch of up to 10 `calendarUrl` ICS feeds, prefix SUMMARY with `playerName`. That republishes **club events + first names** to anyone who can GET the webcal URL. Derived from roster URLs, not from Dexie events.

---

## 5. `familyCode.ts`

| Symbol | Lines | Notes |
|---|---|---|
| `CROCKFORD_ALPHABET` | L2 | No I L O U |
| `FAMILY_CODE_REGEX` | L5 | `^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$` |
| `normalizeFamilyCode` | L7–12 | Uppercase; insert hyphen for 6-char |
| `generateFamilyCode` | L14–21 | **Still in client.** Zero UI callers (`rg generateFamilyCode` → definition only). ARC/SEC dead-code. Public repo can theoretically mint a valid *format*; Worker secret still fail-closes issuance. |
| `isValidFamilyCode` | L23–26 | Format only — not membership |
| `parseFamilyAllowlist` | L29–38 | Empty → empty set (fail closed) |
| `existingRosterPutConflicts` | L41–45 | Missing If-Match on existing row → conflict |

Onboarding “create family” (`OnboardingWizard.tsx` L288–305) does **not** call `generateFamilyCode`. User pastes an already-issued key into `syncState.family.syncKey`. Join-only. Docs `FAMILY_SYNC_ARCHITECTURE.md` L140 “Generate on first Luo perhe-koodi” is stale vs FINAL + code.

---

## 6. Home location — local only

`src/lib/storage/homeLocation.ts`.

- Storage key `pelipaiva_home_location` (L53).
- `saveHomeLocation` (L92–114): writes **localStorage** + Dexie `syncState` row `key: 'home_location'` with `syncKey = JSON.stringify(HomeLocation)`.
- `getHomeLocation` (L59–87): Dexie first, then localStorage, then `DEFAULT_HOME_LOCATION` Lauttasaari (L31–39).
- `HomeLocation` (`matchday.ts` L34–42): `name`, `address`, `coordinates`, walk/bike km, `defaultTransitMode`, `updatedAt`.

**Not referenced in `familyCloud.ts` PUT map. Not in Worker `FamilyRosterRow`. Not in JSON backup (`familyShare.ts` L5–12 exports profiles/arrivalRules/aliases/venuePins only).**

UI reads the same Dexie/localStorage path (`App.tsx` L196–223). Family manage modal displays the address on-device (`FamilyManageModal.tsx` L207–221).

**Third-party (not KV):** `geocodeAddress` (L119–177) sends the typed address to `api.hel.fi/servicemap` then `nominatim.openstreetmap.org`. GPS via `navigator.geolocation` (L182–201). Residual: home address can leave the device toward HEL/OSM when the parent geocodes; it still never hits `MATCHDAY_KV`.

---

## 7. localStorage inventory (`src/` + `index.html`)

| Key | Writer | Survives `clearAllDatabaseData`? | PII? |
|---|---|---|---|
| `theme` | `ThemeToggle.tsx` L21/24, bootstrap `index.html` L9 | yes | no |
| `pelipaiva_onboarding_done` | `OnboardingWizard` / `App.tsx` | yes (`removeItem` only when re-opening wizard L979) | no |
| `pelipaiva_home_location` | `homeLocation.ts` | **yes** | **yes — street address + lat/lng** |
| `pelipaiva_tombstones_${code}` | `familyCloud.ts`, `FamilyManageModal`, `App.tsx` handleRemoveImportedTeam | **yes** | profile ids (include slug of playerName) |
| `pelipaiva_kit_${eventId}` | `KitChecklist.tsx` L13–42 | yes | packing ticks, keyed by event id |
| `pelipaiva_ondevice_llm` | `onDeviceLlmPrefs.ts` | yes | preference only; constitution: not on family bus |
| `pelipaiva_ondevice_llm_loaded` | same | yes | no |

No `sessionStorage` usage in `src/`. Playwright specs `localStorage.clear()` for test isolation only.

---

## 8. GDPR erase path

### What exists

```ts
// db.ts L430-442
export async function clearAllDatabaseData(...) {
  await Promise.all([
    profiles, events, officialFixtures, leagueStandings, teamRosters,
    arrivalRules, venuePins, syncState, customAliases
  ].map(t => t.clear()));
}
```

UI: MissionControlHUD “Tyhjennä tiedot” → confirm → `onClear` → `App.tsx` `handleClearData` L235–239:

```ts
if (!window.confirm('Haluatko varmasti tyhjentää kaikki tiedot?')) return;
await clearAllDatabaseData();
setActiveProfileId('all');
setIsOnboardingActive(true);
```

Tests: `m1_storage_concurrency.test.ts` L768–827 asserts 8 table counts == 0 after clear. **Does not assert `customAliases`** (9th table). Function does clear it. Test title “all 8 tables” is stale vs v2.

JSON backup (`familyShare.ts` `exportFamilyBackup`) is airgap restore, not a cloud copy. It omits events/weather/parking/home. Restore hydrates fixtures from tulospalvelu (`FamilyShareModal.tsx` L180–199).

Worker DELETE exists and requires If-Match. GDPR docs (`FAMILY_SYNC_ARCHITECTURE.md` L302): “Rotate/DELETE wipes KV”.

### What is missing (finding)

`handleClearData` does **not**:

1. Read `syncState.family.syncKey` **before** wiping (after wipe the code is gone).
2. `DELETE /api/family/:code` — other phones and Cloudflare keep the roster until 7-day TTL or a parent DELETEs out-of-band.
3. `localStorage.removeItem` for home address, tombstones, kit, onboarding, LLM prefs, theme.
4. `navigator.storage` / IndexedDB `deleteDatabase` — `clear()` empties tables but the IDB database `PelipaivaDB` remains.

So “GDPR erase = clear Dexie” (specialist brief) is **necessary and implemented**, and **not sufficient** for the constitution’s “Rotate/DELETE wipes KV” or for the street address sitting in `pelipaiva_home_location`.

Leave-family is also incomplete: there is no dedicated “unjoin” that deletes `syncState.family` and stops polling without wiping the whole DB.

---

## 9. Tenancy model

```
issued Crockford code in Worker secret FAMILY_CODES
        │
        ├─ KV      family:{CODE}          FamilyRosterV1, TTL 7d on PUT
        ├─ KV read fam_events_{CODE}      leftover, no writer @ 20bad06
        ├─ webcal  /api/calendar?perhe=   Pages Function → Worker ICS
        └─ Dexie   per browser origin     source of truth
```

- No accounts. No `userId`. Family code **is** the tenant id.
- Client stores the code in Dexie `syncState` key `'family'`, field `syncKey` (`familyCloud.ts` L434–439; onboarding L264–268).
- Format-valid but unissued → 403, client logs “operating in local mode” (`familyCloud.ts` L446–447) and keeps Dexie. Local-first hold.
- Anyone with the code is a parent (docs residual, ARCHITECTURE L307). Fine for first name + public team URL. Not fine for last names, ICS tokens, medical, home address — those must not be in that blob.

---

## 10. First-name policy vs code

| Layer | Behavior |
|---|---|
| Docs FINAL §4.1 / ARCHITECTURE L69 | `playerName // first name only` |
| Onboarding copy | “Kirjoita lapsen tai pelaajan **etunimi**” (`OnboardingWizard.tsx` L601), placeholder `"Esim. Simo, Eemil, Aada..."` (L610) |
| Input | `<input type="text">` no maxLength, no space/last-name reject (L605–611). FamilyManage add-player same (L148–154). |
| Client PUT | `playerName: p.playerName` as typed (L393) |
| Worker | `trim().slice(0, 30)` (L341) |
| Stable id | `slugPlayerName` keeps `[a-z0-9åäö]` so `Maija Virtanen` → `maijavirtanen` inside `id` |

Copy is honest; enforcement is not. 30 chars is enough for typical Finnish first+last.

---

## 11. `calendarUrl` as a secret channel

`calendarUrl` is **required** to be raw (season query must survive). That also preserves `?token=` on MyClub ICS.

Evidence the product already knows such URLs exist:

`src/lib/stats/statsEngine.test.ts` L385  
`webcal://id.myclub.fi/flow/calendar_subscriptions/9577.ics?token=77b47985c9cd2e780af46734e813317b7d7e79b9`

Worker stores `calendarUrl.slice(0, 400)` (token URLs are well under 400). Calendar feed then **server-fetches** that URL (`collectRosterIcsEvents` L170). Constitution: “nimenhuuto secrets” not in KV. MyClub token is the same class of secret.

`associationUrl` has **no** slice cap — a hostile client could PUT a multi-KB string. Cloudflare KV value limit is 25 MB; rate limit is the only brake.

---

## 12. JSON backup vs KV vs Dexie (where data lives)

| Data | Dexie | localStorage | KV `family:{code}` | JSON backup v2 | WhatsApp text |
|---|---|---|---|---|---|
| player first name | yes | tombstone ids | **yes** | yes | yes (join/delta) |
| player last name | if typed | if in id slug | **if typed into playerName** | if typed | if typed |
| team URL | yes | no | **yes, raw** | yes | yes |
| events / scores / notes | yes | kit ticks | no (PUT); calendar GET derives club ICS | **no** | talkoo lines |
| weather / parking / lightning | yes (on event) | no | **no** | no | no |
| officialFixtures / standings | yes | no | no | no (re-hydrate) | no |
| federation squad last names | teamRosters | no | no | no | no |
| arrivalRules / venuePins / aliases | yes | no | no | **yes** | no |
| home address + GPS | syncState `home_location` | **yes** | **no** | **no** | no |
| photos | no (OCR transient) | no | no | no | no |
| injury | only free-text notes | no | no | no | no |
| on-device LLM choice | no | yes | no | no | no |
| family code | syncState `family` | tombstone key suffix | key itself | no | yes (`?perhe=`) |

---

## 13. FINDING drafts

### F-DATA-001 — PUT roster allowlist holds for events / weather / parking

- **severity:** S4 note  
- **confidence:** high  
- **evidence:** `src/lib/sync/familyCloud.ts` L387–403 (client map); `cloudflare-worker/worker.ts` L339–363 (edge re-allowlist + 7d TTL); `src/types/matchday.ts` L517–538 (`weather`/`parking` on `MatchdayEvent` only).  
- **blast radius:** All family-bus phones. Confirms constitution item 5 for those three classes.  
- **why it matters:** Q-003. A future “sync the weekend” feature that spreads `...event` into PUT would be an S0. The allowlist is the control.  
- **recommended action:** Keep the explicit map. Add a vitest that `JSON.stringify(rosterToPush)` must not match `/weather|parking|"events"/`.  
- **open questions:** none  
- **related:** Q-003, F-DATA-006, F-DATA-008  

### F-DATA-002 — `playerName` is not first-name-only at rest in KV

- **severity:** S1  
- **confidence:** high  
- **evidence:** `familyCloud.ts` L393 `playerName: p.playerName`; `worker.ts` L341 `slice(0, 30)`; `OnboardingWizard.tsx` L605–611 unconstrained text input; `attachTeam.ts` L65–77 slug embeds the whole name in `id`; docs `FAMILY_SYNC_FINAL.md` L83 “first name only”.  
- **blast radius:** Every issued family slot; calendar ICS SUMMARY prefix (`worker.ts` L152–158); WhatsApp join text. Kids’ surnames in Cloudflare KV for up to 7 days after last PUT, readable by anyone with the code (GET).  
- **why it matters:** Constitution item 5 + GDPR minimization. S0 is “kids PII leak”; this is policy-unforced PII, not a bypass of the allowlist. S1 not S0 because the field is the intended first-name slot and copy asks for etunimi.  
- **recommended action:** Worker: reject `playerName` matching `/\s/` or a small last-name particle list, or split and store only the first token. Client: `maxLength={20}` + strip after first space on blur, with a one-line “vain etunimi” error. Do not change existing ids without a migration (slug is in `id`).  
- **open questions:** Product OK with residual “Aada-Liina” hyphenated first names? (should stay).  
- **related:** X-DATA-001, Q-DATA-002 → UIX  

### F-DATA-003 — Raw `calendarUrl` can persist MyClub/Nimenhuuto tokens in KV

- **severity:** S1  
- **confidence:** high  
- **evidence:** PUT stores `calendarUrl` raw (`familyCloud.ts` L397; `worker.ts` L345 slice 400); fixture URL with `?token=` in `src/lib/stats/statsEngine.test.ts` L385; Worker then fetches that URL server-side (`worker.ts` L161–191); constitution FINAL L61 “nimenhuuto secrets” not in KV.  
- **blast radius:** Family GET returns the token to every joined phone; webcal fetch uses it from the edge; KV snapshot lives 7d. Rotating the club calendar secret does not rewrite KV until next PUT.  
- **why it matters:** Secrets in a zero-auth tenant blob. Different class from public tulospalvelu URLs.  
- **recommended action:** Strip known secret query keys (`token`, `auth`, `access_token`, `key`, `sig`) on PUT sanitize. Prefer storing association HTML URLs, not subscription ICS, on the bus. QUESTION SEC for the denylist.  
- **open questions:** Are live Nimenhuuto URLs cookie-gated (not in query) so only MyClub `token=` is the practical case?  
- **related:** Q-DATA-001 → SEC, F-DATA-008  

### F-DATA-004 — Device “Tyhjennä tiedot” does not erase KV or localStorage PII

- **severity:** S1  
- **confidence:** high  
- **evidence:** `App.tsx` L235–239 `handleClearData` → only `clearAllDatabaseData()`; `db.ts` L430–442 Dexie tables only; Worker DELETE `worker.ts` L383–406 has **no** `src/` caller; `pelipaiva_home_location` written in `homeLocation.ts` L101–102 and never removed on clear; tombstone keys L344. Docs ARCHITECTURE L302 “Rotate/DELETE wipes KV”.  
- **blast radius:** Parent thinks they wiped the child off the internet; Cloudflare still serves first names + team URLs to the co-parent and to anyone with the code until TTL. Street address remains in localStorage on that phone.  
- **why it matters:** GDPR erase / household offboarding. Order bug: wipe Dexie first destroys `syncState.family.syncKey`, so a later DELETE cannot be issued.  
- **recommended action:**  
  1. Read family code + current rev **before** clear.  
  2. Best-effort `DELETE /api/family/:code` with If-Match (ignore 403/409; surface “pilvi ei tyhjentynyt”).  
  3. `localStorage` remove: `pelipaiva_home_location`, `pelipaiva_tombstones_*`, `pelipaiva_kit_*`, onboarding, LLM keys. Theme optional.  
  4. Then `clearAllDatabaseData`.  
- **open questions:** Should erase also be offered as “leave family but keep local matches”?  
- **related:** X-DATA-002, Q-DATA-004 → SEC, Q-DATA-005 → REL  

### F-DATA-005 — Home location is local-only (not on the family bus)

- **severity:** S4 note  
- **confidence:** high  
- **evidence:** `homeLocation.ts` L53–114; no `HomeLocation` field in `FamilyRosterRow` (`familyCloud.ts` L11–21, `worker.ts` L7–17); backup omit (`familyShare.ts` L5–12). Geocode to hel.fi/Nominatim is third-party, not KV (`homeLocation.ts` L134–170).  
- **blast radius:** Walk/bike/car plans differ per phone until each parent sets koti. Product-correct per constitution.  
- **why it matters:** Mission question. Do not “fix” by syncing home onto KV — that would be new PII in the tenant blob.  
- **recommended action:** Keep. Optionally add a one-liner in FamilyShare GDPR footer: “Kotiosoite vain tällä puhelimella.”  
- **related:** F-DATA-004 (localStorage leftover on erase)  

### F-DATA-006 — Dead KV key `fam_events_${code}` is an events-in-cloud schema

- **severity:** S3  
- **confidence:** high (no writer at 20bad06; unknown whether prod KV rows exist)  
- **evidence:** `worker.ts` L464–516 read + VEVENT emit; `rg fam_events_` → worker only.  
- **blast radius:** If any historical writer populated the key, GET calendar would publish notes / talkoo / kit / venue under the family code without If-Match.  
- **why it matters:** Constitution “events not in KV”. Dead code is a footgun for the next calendar feature.  
- **recommended action:** Delete the read (or gate behind a comment + test `not.toContain('fam_events_')` like the `/api/sync/` ban in `familyCloud.test.ts` L47). Ops: list KV keys `fam_events_*` and delete.  
- **open questions:** Did an older Worker on this KV namespace write it? → REL/ops.  
- **related:** Q-DATA-003 → API, F-DATA-001  

### F-DATA-007 — 7-day TTL slides on PUT only; idle GET does not keep the family alive

- **severity:** S3  
- **confidence:** high  
- **evidence:** `worker.ts` L365–367 `expirationTtl: 604800` only in PUT; GET L255 has no `put` refresh; client `shouldPut` L384–411 is `hasChanges || pendingUpload || !remote`. ARCHITECTURE L319 “PUT on every open slides TTL” vs FINAL §4.1 “slide on PUT”.  
- **blast radius:** A family that only views the HUD for 8 days loses the KV row (404). Local Dexie remains. Next PUT without If-Match on missing key is allowed (no existing → no 409). Co-parent with a stale rev may 409 after recreation.  
- **why it matters:** Product copy “Cloudflareen 7 päivää” is true; “slides while you use the app” is false unless someone mutates roster.  
- **recommended action:** Either (a) Worker GET with a cheap TTL touch (CF KV get does not slide; needs a put of the same bytes), or (b) client periodic no-op PUT, or (c) fix docs/UI to “7 päivää viimeisestä muutoksesta”. Prefer (c) + honest footer unless ops wants season-long slots.  
- **related:** X-DATA-003  

### F-DATA-008 — Calendar GET is a derived event egress (not PUT)

- **severity:** S3  
- **confidence:** high  
- **evidence:** `worker.ts` L161–191, L518–521; Pages proxy `functions/api/calendar.js` L1–14; live unknown code 403. `calendarFeedGenerator.ts` is the **on-device** ICS (includes notes, leave-by, venue address L92–129) used by `FamilyCalendarModal` download — that file never hits KV.  
- **blast radius:** Issued-code holders (and anyone they forwarded `?perhe=`) receive first names + club match summaries from the edge. Device-generated ICS can contain richer Dexie fields if the parent downloads it — that’s a file the parent created, not Cloudflare.  
- **why it matters:** Q-003 “does PUT include events?” — no. “Can Cloudflare emit events?” — yes, by fetching club ICS. Residual accepted if URLs are public; not accepted if `calendarUrl` had a token (F-DATA-003).  
- **recommended action:** SEC to confirm webcal is intentionally unauthenticated beyond code possession. Do not copy Dexie events into `fam_events_`.  
- **related:** F-DATA-003, Q-DATA-006 → SEC  

---

## 14. QUESTION drafts (for `board/questions.md`)

| ID | From | To | Question |
|---|---|---|---|
| Q-003 | ORCH | DATA | **ANSWERED** — see §0. Events/weather/parking: no. Last names: only if typed into `playerName` (no field, no guard). |
| Q-DATA-001 | DATA | SEC | Strip `token`/`auth` query params from `calendarUrl` on Worker PUT? |
| Q-DATA-002 | DATA | UIX | Enforce etunimi-only on the name input, or accept residual last names in 30 chars? |
| Q-DATA-003 | DATA | API | Confirm `fam_events_${code}` has no writer in current or recently deployed Worker. Safe to delete the read? |
| Q-DATA-004 | DATA | SEC | Is incomplete erase (Dexie without KV DELETE) an S1 GDPR finding you will own, or keep as F-DATA-004? |
| Q-DATA-005 | DATA | REL | KV wipe runbook for family offboarding / code rotation? |
| Q-DATA-006 | DATA | SEC | Webcal `/api/calendar?perhe=` is unauthenticated beyond code possession — intended? |
| Q-DATA-007 | DATA | API | Calendar path fail-open when `FAMILY_CODES` empty (`issued.size > 0 &&`) vs family API fail-closed — bug or leftover? |

---

## 15. CONTRADICTION drafts (for `board/contradictions.md`)

| ID | A | B | Suggested verdict |
|---|---|---|---|
| X-DATA-001 | FINAL §4.1 / ARCHITECTURE L69: `playerName` first name only | `familyCloud.ts` L393 + `worker.ts` L341: unconstrained 30-char string | **Code wins.** Policy is copy. Finding F-DATA-002. |
| X-DATA-002 | ARCHITECTURE L302: “Rotate/DELETE wipes KV” | `App.tsx` L235–239: Dexie clear only; no DELETE caller | **Code wins.** Finding F-DATA-004. Docs overclaim GDPR. |
| X-DATA-003 | ARCHITECTURE L319: “PUT on every open slides TTL” | `familyCloud.ts` L384–411 PUT only on change/pending/missing; GET does not put | **Code wins.** FINAL §4.1 “slide on PUT” matches Worker. Finding F-DATA-007. |
| X-DATA-004 | Constitution: events not in KV | `worker.ts` L465 reads `fam_events_${code}` into VEVENTs | **Code has a dead events schema.** No writer @ 20bad06. Finding F-DATA-006. Do not treat as live leak without ops KV list. |
| X-DATA-005 | ARCHITECTURE L140: “Generate on first Luo perhe-koodi” | FINAL L121: join-only, no mint; `generateFamilyCode` unused by UI | **FINAL + code win.** Mint function is dead. ARC/SEC. |

---

## 16. Board promotion (ORCH)

Please append to `board/index.md`:

| ID | Agent | Sev | Title | Status | Evidence (short) |
|---|---|---|---|---|---|
| F-DATA-001 | DATA | S4 | PUT roster allowlist omits events/weather/parking | OPEN | familyCloud.ts L387–403; worker.ts L339–363 |
| F-DATA-002 | DATA | S1 | playerName not first-name-enforced; last names fit in 30 chars | OPEN | familyCloud.ts L393; worker.ts L341; OnboardingWizard.tsx L605 |
| F-DATA-003 | DATA | S1 | Raw calendarUrl can store MyClub `?token=` in KV | OPEN | worker.ts L345, L170; statsEngine.test.ts L385 |
| F-DATA-004 | DATA | S1 | Tyhjennä tiedot does not DELETE KV or clear home localStorage | OPEN | App.tsx L235–239; db.ts L430; worker.ts L383 |
| F-DATA-005 | DATA | S4 | Home location local-only (Dexie syncState + localStorage) | OPEN | homeLocation.ts L53–114 |
| F-DATA-006 | DATA | S3 | Dead KV read `fam_events_${code}` | OPEN | worker.ts L464–516; no writer |
| F-DATA-007 | DATA | S3 | TTL 7d slides on PUT only, not GET | OPEN | worker.ts L365 vs L255; familyCloud.ts L384 |
| F-DATA-008 | DATA | S3 | Calendar GET republishes club ICS + playerName | OPEN | worker.ts L161–191, L518 |

Stamp Q-003 Answer column with the §0 paragraph.

---

## 17. Unknowns

| Item | Resolves with |
|---|---|
| Whether prod KV contains any `fam_events_*` keys | REL wrangler kv key list (do not dump values) |
| Whether any issued family has a last name in `playerName` | GET an issued slot (ops only; DATA must not) |
| Whether live MyClub URLs in the wild use `?token=` | sample from support / not in this clone |
| IndexedDB persistence grant rate on iOS Safari | physical device (UIX/QA) |

End of DATA trace.
