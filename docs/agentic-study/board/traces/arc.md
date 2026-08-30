# ARC trace — Pelipäivä @ 20bad06

**Role:** ARC (architecture)  
**SHA:** `20bad06`  
**Date:** 2026-08-30  
**Scope:** `src/lib/**`, `src/App.tsx`, `src/types/matchday.ts`, `native/ios/**`  
**Out of scope:** Worker/KV payload details (DATA), vendor allowlist (API), implementing fixes.

Method: read + grep + `wc -l`. No `src/` edits. No git commit.

---

## 1. Topology — `src/lib` layers

One app. No package boundaries. Folders are **conventions**, not compile-time walls. Anything can import `statsEngine`.

```
src/
├── App.tsx                 1029  god shell (Dexie live queries → graph → layout)
├── types/matchday.ts        561  single domain model (event + stats + reconciliation)
└── lib/
    ├── storage/     Dexie SoT + homeLocation dual-write
    ├── agents/      pure planner + 5 specialists (no fetch, no db)
    ├── ai/          NLP / Copilot / on-device LLM opt-in
    ├── clubs/       ingestOfficial (the write path into Dexie)
    ├── api/         proxy URL, torneopal JSON, *facades over statsEngine*
    ├── stats/       GOD MODULE (URL parse + HTML + TZ + synthetics)
    ├── calendar/    ICS parse + outbound feed
    ├── geo/         LIPAS/Nominatim geocode + transit haversine
    ├── weather/     FMI + lightning + radar
    ├── parking/     Tieliikennelaki disc / fine risk
    ├── reconciliation/  calendar ⋈ official fixtures
    ├── sync/        familyCloud (Worker roster) + share/WhatsApp + familyCode
    ├── sport/       colors + glyphs
    ├── events/      source-badge resolver (pure)
    ├── matchday/    seedWeekendExtras.ts  ← DEAD
    └── motion/      spring tokens
```

Line counts (production `.ts`, tests omitted):

| Module | Lines | Role |
|---|---|---|
| `stats/statsEngine.ts` | **1784** | URL + HTML + TZ + synthetic factories |
| `App.tsx` | **1029** | UI orchestration |
| `types/matchday.ts` | 561 | domain types |
| `calendar/icsParser.ts` | 631 | ICS |
| `api/torneopalClient.ts` | 676 | JSON federation |
| `ai/messageParserNLP.ts` | 766 | WhatsApp/NLP |
| `sync/familyCloud.ts` | 453 | roster bus |
| `storage/db.ts` | 442 | Dexie schema + helpers |
| `geo/sportsGeocoder.ts` | 427 | venue resolve |
| `ai/onDeviceLlm.ts` | 397 | neural bus |
| `ai/chromeBuiltinAi.ts` | 350 | Prompt API + hybrid parse |
| `clubs/ingestOfficial.ts` | 304 | **the** ingest write path |
| `agents/planner.ts` | 263 | graph entry |

Runtime topology (device):

```
Browser PWA
  Dexie PelipaivaDB v2  ← source of truth
       │  useLiveQuery (profiles, events, arrivalRules, syncState)
       ▼
  runMissionControlGraph()  ← pure, no I/O
       ▼
  HUD / Hero / Weekend / Ambient / Copilot / WhatsApp

Writes into Dexie
  ingestOfficial (federation/ICS + weather + parking + briefing)
  familyCloud hydrate (re-calls ingest)
  components (MatchdayCard, QuickDropInBar, EventMerge, VenueCorrection, FamilyShare)
  App handlers (import, refresh, resolve mismatch, player log)

Edge (not Dexie)
  Worker GET/PUT /api/family/{code}  → KV roster ~2 KB (URLs, first names, team ids)
  Worker GET /api/proxy/ics?url=     → vendors
  Pages Function /api/calendar       → ICS subscribe
```

Native iOS is **not** in this topology. See §6.

---

## 2. App.tsx data flow

Single SPA, no router. `App` is the composition root.

### Boot effects

| Effect | Lines | What |
|---|---|---|
| online/offline | 85–96 | `navigator.onLine` → `isOffline` |
| family sync loop | 99–134 | every **180 s** + visibility + online: `syncFamilyRosterCycle` |
| `?perhe=` / `?share=` / ambient | 137–184 | join family or unpack QR profiles into Dexie |
| persist storage | 187–189 | `ensureStoragePersistence()` |

### Live queries (Dexie → React)

```191:196:src/App.tsx
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) || [];
  const eventsQuery = useLiveQuery(() => db.events.toArray(), []);
  const rawEvents = eventsQuery || [];
  const arrivalRules = useLiveQuery(() => db.arrivalRules.toArray(), []) || [];
  const homeSync = useLiveQuery(() => db.syncState.get('home_location'), []);
```

Home is **not** a Dexie table. It is stuffed into `syncState.syncKey` as JSON, with `localStorage['pelipaiva_home_location']` as fallback, then `DEFAULT_HOME_LOCATION` Lauttasaari (`App.tsx` 198–223, `homeLocation.ts` 31–39, 59–80).

### Graph

```291:295:src/App.tsx
  const snapshot = useMemo(
    () => runMissionControlGraph(rawEvents, profiles, new Date(), arrivalRules, homeLocation),
    [rawEvents, profiles, arrivalRules, clockTick, homeLocation]
  );
```

`clockTick` every 60 s (284–289) so leave-by does not freeze. `arrivalRules` is passed and **ignored** by the planner (see F-ARC-007).

Second graph callers (not App):

- `AmbientView.tsx:26` — `runMissionControlGraph(events, profiles, new Date())` — **drops homeLocation and arrivalRules**
- `localAiEngine.ts:129` `planFamilyLogistics` — `runMissionControlGraph(events, profiles, now, [], homeLocation)`

Three snapshots, three argument sets. HUD vs logistics vs ambient can disagree on leave-by.

### Write paths from App

- `handleImportCalendar` (336–411): color pick → `db.profiles.add/update` → `ingestSourceForProfile` → optional `syncFamilyRosterCycle`
- `handleRefreshAll` (435–453): per-profile ingest, `.catch(console.warn)` so one team fail does not stop others
- `handleRemoveImportedTeam` (455–476): delete events+profile+official; tombstone in **localStorage** `pelipaiva_tombstones_${code}`
- `handleResolveMismatch` (478–521): adopt official ISO or keep calendar; writes Dexie
- `handleEventUpdated` (242–247): `db.events.put(updated).catch(console.warn)`

Onboarding gate is **localStorage** `pelipaiva_onboarding_done`, not Dexie (66–70, 545–547). Zero profiles after wizard is allowed (539–540 comment).

---

## 3. Dexie as source of truth

`PelipaivaDB` v1→v2 (`src/lib/storage/db.ts` 42–85).

| Table | Key | Product writes? |
|---|---|---|
| `profiles` | `id` | yes (App, familyCloud, SmartImport, QuickDropIn) |
| `events` | `id` | yes (ingest + many components) |
| `officialFixtures` | `id` | yes (`saveOfficialTeamData`) |
| `leagueStandings` | `id` | yes (ingest) |
| `teamRosters` | `id` | yes (ingest) |
| `arrivalRules` | `profileId` | **backup/import only** (`familyShare.ts` 20–62). No UI editor. Tests only for `getOrCreateArrivalRules`. |
| `venuePins` | `normalizedQuery` | VenueCorrectionModal |
| `customAliases` | `pattern` | ingest reconciliation reads; write path thin |
| `syncState` | `key` | overloaded: `family` (Crockford code) **and** `home_location` (JSON blob in `syncKey`) |

Constitution hold: **device Dexie is SoT**. Family bus stores roster rows only; each phone re-ingests matches (`familyCloud.ts` `hydrateRosterProfiles` 250–278 → `ingestSourceForProfile`).

GDPR erase = `clearAllDatabaseData` (`db.ts` 430–441) + App confirm (235–240). Does **not** clear localStorage onboarding / home / LLM / tombstones. DATA should confirm.

SoT leaks / dual stores:

1. Home: Dexie `syncState['home_location']` **and** `localStorage.pelipaiva_home_location`
2. Arrival rules: table **and** `PlayerProfile.arrivalRules` (type `matchday.ts:492`). Planner uses the profile field.
3. Onboarding done / LLM choice: localStorage only
4. Family tombstones: localStorage `pelipaiva_tombstones_${code}` (`App.tsx` 469–473, `familyCloud.ts` 344–355)
5. Components write `db` directly — no repository. Write fan-out: App, MatchdayCard, QuickDropInBar, EventMergeModal, VenueCorrectionModal, FamilyShareModal, FamilyManageModal, EventInlineDropIn.

---

## 4. Agent graph — planner + specialist purity

Docs (`docs/ARCHITECTURE.md`) match code for the five specialists.

### Purity audit (grep `db.` / `fetch(` / `localStorage` under `src/lib/agents/` → **zero hits**)

| Agent | File | I/O | Notes |
|---|---|---|---|
| `conflictAgent` | `conflictAgent.ts:14` | none | reads `event.transit` or calls `resolveTransitPlan` (pure geo) |
| `carpoolAgent` | `carpoolAgent.ts:24` | none | **ordering constraint:** takes `conflicts[]` |
| `kitAgent` | `kitAgent.ts:143` | none | reads `event.weather` already on the row |
| `volunteerAgent` | `volunteerAgent.ts:31` | none | parses `volunteerDuty` strings |
| `tournamentAgent` | `tournamentAgent.ts:6` | none | planner passes **all** `events`, not `specialistEvents` (`planner.ts:199`) |
| `planner` | `planner.ts:174` | none | sequential; comment L169–171: “no LLM, no network” |

`AgentContext` (`types.ts:155–160`) is **unused** (grep: definition only). `AgentId` lists `calendar | weatherSafety | logistics | ambient | stats` which are **engines**, not graph nodes.

Weather / parking / stats / ICS run at **ingest** (`ingestOfficial.ts` 94–137, 194–200) and persist onto `MatchdayEvent`. Planner consumes Dexie rows. That matches ARCHITECTURE.md: “It does not fetch.” Stale weather is an ingest-freshness problem, not a graph impurity.

### Purity nits (not side effects)

1. `_arrivalRules` discarded (`planner.ts:178`). Leave-by uses `nextPlayer?.arrivalRules` (`planner.ts:188`). Same for carpool (`carpoolAgent.ts:44`) and tournament (`tournamentAgent.ts:51`).
2. `detectDifficultDays(..., _profiles, ...)` unused profiles param (`planner.ts:85`).
3. `time.ts:1` imports `getFinnishTimezoneOffset` from **statsEngine** — layer inversion (F-ARC-009).
4. Second graph in AmbientView omits `homeLocation` → walk/bike conflict resolution can flip vs HUD.

Critic tests: `familyMission.test.ts` (overlap, indoor shoes, talkoo, tournament, share text). Graph is the healthiest bounded context in `src/lib`.

---

## 5. On-device LLM — default **off**

Prefs module is the constitution lock:

```42:57:src/lib/ai/onDeviceLlmPrefs.ts
export function getOnDeviceLlmChoice(): OnDeviceLlmChoice {
  const raw = read(ONDEVICE_LLM_CHOICE_KEY);
  return isChoice(raw) ? raw : 'off';
}
/** True only when the user opted in. Missing key = off. */
export function isOnDeviceLlmEnabled(): boolean {
  return getOnDeviceLlmChoice() !== 'off';
}
```

Key: `pelipaiva_ondevice_llm` (`onDeviceLlmPrefs.ts:9`). Comment L1–4: not synced on family bus.

Gates:

- `parseSportsMessageHybrid` (`chromeBuiltinAi.ts:301–307`) — NLP unless opted in
- `createOnDeviceLanguageSession` (`onDeviceLlm.ts:285`) — returns `null` if off
- Native Swift `optedInChoice()` default `"off"`; `availability()` returns `"unavailable"` if off (`FamdayAiBridge.swift:72–79`); `prompt` throws `optedOut` (`105–107`)

`requestLoadOnDeviceModel` (`onDeviceLlm.ts:317–318`) is user-initiated; comment “Never called on first launch.”

**PASS** on constitution item 6 (neural net opt-in, never auto-download, not on family bus).

---

## 6. Native iOS stub vs product

Product = PWA at `pelipaiva.pages.dev`.  

`native/ios/` contains **three files**, no `.xcodeproj`, no `Info.plist`, no WKWebView host:

- `FamdayAi/FamdayAiBridge.swift` (178 lines) — `WKScriptMessageHandler`, iOS 26+ `FoundationModels` / `CoreAILanguageModels`, Qwen path on disk
- `FamdayAi/FamdayAiUserScript.js` (40 lines) — injects `window.FamdayNativeAi`
- `README.md` — “Safari cannot call Apple Intelligence. This folder is the native WKWebView shell.”

JS already speaks the bridge (`onDeviceLlm.ts` `FamdayNativeAi` / `webkit.messageHandlers.famdayAi`, `detectOnDevicePlatform` 72–87). Without a wrapper binary, platform is `ios-safari` → Apple/Qwen options `available: false`, reason `ios_safari_no_core_ai` (`onDeviceLlm.ts:188–208`).

Docs (`ARCHITECTURE.md` L46, `native/ios/README.md` L14) talk about TestFlight. **There is no app to TestFlight.** Stub vs product is a hard split, not a WIP xcode tree.

---

## 7. Dead code hunt

### 7.1 `generateOrResolveMatchStats` — dead from UI, alive in tests + same module as live extractors

```1485:1489:src/lib/stats/statsEngine.ts
export function generateOrResolveMatchStats(
  homeTeam: string,
  awayTeam: string,
  sport: SportType = 'football'
): FullMatchStats {
```

- Fake roster `Pelaaja 4` `goals: 1` (`statsEngine.ts:1518`)
- Fake standings, H2H scores, scout line (`1630–1781`)
- Marks `isSynthetic: true` (`1600`)
- Callers: **`statsEngine.test.ts` only** (grep across `src/` + `tests/` excluding the definition)
- UI `MatchStatsModal` (`MatchStatsModal.tsx:67–80`) builds a **blank** `FullMatchStats` when `stats` is missing — does **not** call the factory. Footer still knows `stats.isSynthetic` (`MatchStatsModal.tsx:260, 945, 956`)

Tree-shake: `SmartImportModal` imports `parseAssociationUrl` from `statsEngine`; `ingestOfficial` imports `extractOfficialTeamData`. Rollup *may* drop the unused export. **The factory remains in the production source module** next to the live extractor. Tests keep it green.

Sibling still on the live call graph: `generateSyntheticOfficialTeamData` (`statsEngine.ts:946`) is invoked from `extractOfficialTeamData` when `fallbackToSynthetic` (`1449–1450`, `1456–1457`). Ingest passes `false` (`ingestOfficial.ts:64`). Tests pass `true`. Flip the flag → invented season in Dexie.

### 7.2 `generateFamilyCode` — **zero callers**

```14:21:src/lib/sync/familyCode.ts
export function generateFamilyCode(): string {
  const getRandomChar = (): string => {
    const randomBuffer = new Uint8Array(1);
    crypto.getRandomValues(randomBuffer);
    return CROCKFORD_ALPHABET[(randomBuffer[0] ?? 0) % CROCKFORD_ALPHABET.length] ?? '0';
  };
  return `${Array.from({ length: 5 }, getRandomChar).join('')}-${getRandomChar()}`;
}
```

Grep `src/`: definition only. Not even tests. Neighbors `normalizeFamilyCode` / `isValidFamilyCode` **are** used (FamilyShareModal, FamilyCalendarModal, familyCloud, OnboardingWizard). Constitution: public repo must not mint live codes. Worker is the issuer. Function is a loaded gun.

### 7.3 `seedWeekendExtras.ts` — entire file dead

Exports `EXTRA_PROFILES` (`seedWeekendExtras.ts:117`) and `buildWeekendShowcaseEvents` (`147`). Grep: **no importers** outside the file and audit docs. 317 lines of canned Lauttasaari/Käpylä/Esport/Arena Center weekend + indoor weather stub (`100–111`). Distinct from **live** `exampleTournaments.ts` (wired into ingest — not dead).

### 7.4 Other dead / facade-only

| Symbol | Where | Callers |
|---|---|---|
| `AgentContext` | `agents/types.ts:155` | none |
| `getOrCreateArrivalRules` | `db.ts:351` | tests only |
| `associationUrlParser.ts` / `associationExtractor.ts` | `src/lib/api/` | **tests only**; they re-export statsEngine. UI imports statsEngine directly (`SmartImportModal.tsx:35`) |
| `fetchOfficialTeamData` | `statsEngine.ts:1471` | thin alias of `extractOfficialTeamData` |

**Not dead (contrast):** `exampleTournaments.ts` `EXAMPLE_TOURNAMENTS` / `officialFromExampleCup` / `mergeOfficialWithCupFallback` — production ingest path (`ingestOfficial.ts:68–73`). Canned cup fixtures with `weekendAt()` invented kickoffs (`exampleTournaments.ts:32–42`) can land in Dexie when federation returns empty for a known cup URL.

---

## 8. Circular imports — `chromeBuiltinAi` ↔ `onDeviceLlm`

Static:

```9:9:src/lib/ai/onDeviceLlm.ts
import { checkChromeAiCapabilities, createBuiltInLanguageSession } from './chromeBuiltinAi';
```

Dynamic (cycle breaker, still a cycle):

```323:325:src/lib/ai/chromeBuiltinAi.ts
    const { createOnDeviceLanguageSession } = await import('./onDeviceLlm');
    const boxed = await createOnDeviceLanguageSession(buildContextAwareSystemPrompt(context));
```

`chromeBuiltinAi.ts:3` also imports prefs (acyclic, good).

Duplicated type: `NeuralEngineId` defined in **both** files (`chromeBuiltinAi.ts:11`, `onDeviceLlm.ts:11`). They happen to match. Hybrid parse uses the chrome copy; Copilot uses the onDevice copy.

Load-time TDZ is avoided by the dynamic import. Runtime cycle remains: hybrid parse (QuickDropInBar) → onDevice session → chrome `createBuiltInLanguageSession`. Catch at `chromeBuiltinAi.ts:341–343` swallows native-path errors (`/* native path optional */`).

---

## 9. Error swallowing

Hunt target: `.catch(() => null)` on ingest.

```59:66:src/lib/clubs/ingestOfficial.ts
  if (parsedAssoc) {
    officialData = await extractOfficialTeamData(parsedAssoc, {
      customTeamName: cup?.teamName || opts.teamName,
      fallbackToSynthetic: false
    }).catch(() => null);
  }
```

`extractOfficialTeamData` **already** catch-closes to empty fixtures (`statsEngine.ts:1453–1467`) and does not rethrow. The outer `.catch(() => null)` only fires if something throws *before* that inner catch (e.g. unexpected throw from `fetchTorneopalTeamData`). Result: `officialData = null` → `mergeOfficialWithCupFallback` → possibly `officialFromExampleCup`. Federation failure is indistinguishable from “no fixtures.” App then:

```400:410:src/App.tsx
      return { success: true, count: imported };
    } catch (err: any) {
      ...
      return { success: false, count: 0, error: ... };
```

If ingest returns `0` without throwing (empty official + no cup), UI reports **success** with count 0.

ICS path is worse:

```178:183:src/lib/clubs/ingestOfficial.ts
  try {
    res = await fetch(target, { signal: AbortSignal.timeout(10000) });
  } catch {
    return 0;
  }
  if (!res.ok) return 0;
```

Network/proxy/timeout → silent 0. Same success:true in App.

Duplicate-fixture delete:

```271:273:src/lib/clubs/ingestOfficial.ts
        if (duplicateFixtureIdsToDelete.length > 0) {
          await database.events.bulkDelete(duplicateFixtureIdsToDelete).catch(() => {});
        }
```

Empty catch: leftover `fixture-*` rows stay, App dedupes in memory (`App.tsx:263–277`) so UI may look fine while Dexie holds ghosts.

Other swallows (ARC-relevant, not all S-level):

| Site | Behavior |
|---|---|
| `App.tsx:243, 1020` | `db.events.put/update.catch(console.warn)` — lost write, no user toast |
| `App.tsx:448` | refresh per-profile warn, continue |
| `fmiWeatherEngine.ts:66` | `pending.catch(() => {` — weather miss is OK (event still saved) |
| `chromeBuiltinAi.ts:341` | native hybrid path optional |
| `onDeviceLlm.ts:385` | unload native `.catch(() => undefined)` — OK |
| `familyCloud.ts:108` | 409 body parse fallback `{}` — OK |

---

## 10. Coupling hotspots

```
                    statsEngine.ts (1784)
                   /        |         \
          ingestOfficial   time.ts    SmartImportModal
          association*     localAi    eventChatEngine
          (facades)        Engine
                 \
                  App.tsx (1029)
                 /    |     \
          familyCloud  agents/planner  components→db
```

1. **`statsEngine.ts`** — URL parser + HTML tables + Finnish TZ + synthetic season + synthetic match stats. `agents/time.ts`, `localAiEngine.ts`, `eventChatEngine.ts` import TZ from it. `SmartImportModal` bypasses the `associationUrlParser` facade.
2. **`App.tsx`** — Dexie, ingest, family join, mismatch, layout, modal wiring. Not a view.
3. **`ingestOfficial.ts`** — federation + ICS + geocode + FMI + parking + briefing + reconciliation + Dexie writes. Correct *place* for a write-side orchestrator; too many silent exits.
4. **Dexie write fan-out** — 8+ components import `db` directly.
5. **`syncState` schema abuse** — family code and home JSON share one table/keyspace.
6. **`chromeBuiltinAi` ↔ `onDeviceLlm`** cycle + duplicated `NeuralEngineId`.
7. **Graph re-entry** — App / AmbientView / `planFamilyLogistics` with different args.

---

## 11. Rewrite this module first

**1. `src/lib/stats/statsEngine.ts` (do this first)**

Split along already-named facades:

| Move to | Contents (current line ranges) |
|---|---|
| `api/associationUrlParser.ts` (stop re-exporting) | `SUBDOMAIN_SPORT_MAP` … `getAssociationFromUrl` L23–489 |
| `lib/time/helsinki.ts` (new, under agents/time) | `getFinnishTimezoneOffset` L511, `parseFinnishDateTime` L533 |
| `api/htmlExtractor.ts` | `cleanHtmlText` … `parseTorneopalHtml` L612–941 |
| `tests/fixtures/syntheticOfficial.ts` | `generateSyntheticOfficialTeamData` L946–1378 |
| `tests/fixtures/syntheticMatchStats.ts` **or delete** | `generateOrResolveMatchStats` L1485–1783 |
| stay as thin `extractOfficialTeamData` | L1384–1468, default `fallbackToSynthetic: false`, **delete the true branch** from prod |

Until this split, every “did we ship fake rosters?” question requires a bundler audit of a 1.8k-line module.

**2. Then `App.tsx`** — extract `useFamilySync`, `useMatchdaySnapshot`, `useImportTeam`. Keep App as layout.

**3. Then break the AI cycle** — `chromeBuiltinAi` must not import `onDeviceLlm`. Hybrid native path belongs in `onDeviceLlm.ts` (or a third `hybridParse.ts` that imports both one-way).

Do **not** rewrite the agent graph first. It is the cleanest layer.

---

## 12. FINDING drafts

Promote to `board/index.md` as-is. ORCH/DATA/API may own adjacent slices; primary AREA is ARC unless noted.

### F-ARC-001 — statsEngine is a god module (coupling hotspot)

- **severity:** S2
- **confidence:** high
- **evidence:** `src/lib/stats/statsEngine.ts` L1–1784; exports at L23–1485 (URL parse, HTML, TZ, `generateSyntheticOfficialTeamData`, `extractOfficialTeamData`, `generateOrResolveMatchStats`). Importers: `ingestOfficial.ts:3–5`, `agents/time.ts:1`, `ai/localAiEngine.ts:8`, `ai/eventChatEngine.ts:10`, `SmartImportModal.tsx:35`, facades `associationUrlParser.ts` / `associationExtractor.ts`.
- **blast radius:** any TZ/parser/synthetic change can break ingest, HUD clocks, Copilot, and tests together.
- **why it matters:** bounded contexts exist as folders but this file is the real dependency root. Dead synthetics cannot be deleted without touching live extract.
- **recommended action:** split as §11. Point UI at `associationUrlParser`, agents at `lib/time`.
- **open questions:** none
- **related:** F-ARC-002, F-ARC-013, F-ARC-009

### F-ARC-002 — `generateOrResolveMatchStats` ships in src next to live extract; UI does not call it

- **severity:** S2
- **confidence:** high
- **evidence:** `statsEngine.ts:1485–1783` (`isSynthetic: true` at L1600; fake `Pelaaja 4` goals:1 at L1518; invented H2H scores L1743–1767). Grep UI importers: **none**. Tests: `statsEngine.test.ts:54–95`. Modal blank fallback: `MatchStatsModal.tsx:67–80`. Agency G-01 OPEN.
- **blast radius:** if anyone wires it to MatchStatsModal, kids see fake league tables/rosters as stats. Bundle inclusion is UNKNOWN without a prod grep of the built `dist` (Rollup may tree-shake).
- **why it matters:** constitution “no invented match times/scores in UI path.” Currently not on UI path; tests preserve the factory (QA).
- **recommended action:** move to `tests/` or delete. Do not keep in `src/lib`. Confirm `dist` after.
- **open questions:** Q-ARC-001 to QA — do hunter tests still require this factory?
- **related:** F-ARC-001, G-01

### F-ARC-003 — `generateFamilyCode()` has zero callers; client can mint Crockford codes

- **severity:** S2
- **confidence:** high
- **evidence:** `familyCode.ts:14–21`. Grep `src/`: definition only. Live helpers `isValidFamilyCode` / `normalizeFamilyCode` used by FamilyShareModal, familyCloud. Constitution item 3: public repo must not mint live codes.
- **blast radius:** one UI hook away from minting codes that Worker will 403 (`unknown_family`) unless they collide with `FAMILY_CODES`. Collision space is 32^6.
- **why it matters:** fail-closed bus is Worker-issued. Client mint is the opposite shape.
- **recommended action:** delete `generateFamilyCode`. Keep regex + normalize + allowlist parse (Worker-side helpers).
- **open questions:** Q-ARC-002 to SEC — any objection to deleting vs keeping for scripts/issue-family-codes.mjs?
- **related:** G-02. `scripts/issue-family-codes.mjs` is the operator tool (not this function).

### F-ARC-004 — `seedWeekendExtras.ts` is dead canned weekend

- **severity:** S3
- **confidence:** high
- **evidence:** `src/lib/matchday/seedWeekendExtras.ts` entire file (317 lines). Exports `EXTRA_PROFILES` L117, `buildWeekendShowcaseEvents` L147. Grep importers: none. Indoor weather stub L100–111 invents 20 °C dry.
- **blast radius:** none today. Confusion with live `exampleTournaments.ts`.
- **why it matters:** dead demo seed next to product ingest.
- **recommended action:** delete the file.
- **related:** G-14. Contrast: `exampleTournaments.ts` is **not** dead (F-ARC-005).

### F-ARC-005 — ingest `.catch(() => null)` + cup fallback can write canned fixtures as Dexie events

- **severity:** S1
- **confidence:** high
- **evidence:** `ingestOfficial.ts:59–73` (`.catch(() => null)` L65; `mergeOfficialWithCupFallback` L68; `officialFromExampleCup` L72). `extractOfficialTeamData` already returns empty fixtures on error (`statsEngine.ts:1453–1467`) with `fallbackToSynthetic: false`. Cup seeds use `weekendAt()` (`exampleTournaments.ts:32–42`) — invented kickoffs for HC/KW/Espoo Liikkuu. `App.tsx:400` `success: true` even when `imported === 0`. ICS silent 0: `ingestOfficial.ts:178–183`.
- **blast radius:** known cup URLs (PPJ 185085 + hc2026, TOPOLA 203621, Indians 34013) can show this-weekend times that are not federation. League URLs fail closed to empty but UI may still say success.
- **why it matters:** constitution item 4 — no invented match times in UI path. Cup fallback is the remaining inventor. Error swallow hides *why* federation failed.
- **recommended action:** (1) drop redundant `.catch(() => null)` or log+surface the error. (2) do not `officialFromExampleCup` unless user explicitly picked the example chip. (3) ICS `return 0` should throw or return `{ ok:false, reason }`. (4) App must not `success: true` on count 0.
- **open questions:** Q-ARC-003 to API — is cup seed considered “official” for those three URLs by product intent?
- **related:** primary ARC (orchestrator shape); API owns vendor honesty.

### F-ARC-006 — circular import `chromeBuiltinAi` ↔ `onDeviceLlm`

- **severity:** S3
- **confidence:** high
- **evidence:** `onDeviceLlm.ts:9` static import; `chromeBuiltinAi.ts:323–325` dynamic `import('./onDeviceLlm')`; catch L341–343. Duplicated `NeuralEngineId` (`chromeBuiltinAi.ts:11`, `onDeviceLlm.ts:11`).
- **blast radius:** hybrid parse (QuickDropInBar) + Copilot session creation. Cycle is load-safe due to dynamic import; refactor risk is high.
- **recommended action:** one-way: prefs ← chromeBuiltinAi ← onDeviceLlm ← hybridParse. Delete duplicate type.
- **related:** F-ARC-001 (second rewrite).

### F-ARC-007 — Dexie `arrivalRules` table is not the planner SoT

- **severity:** S2
- **confidence:** high
- **evidence:** App live-queries `db.arrivalRules` (`App.tsx:195`) and passes them into the graph (`292`). Planner signature `_arrivalRules` unused (`planner.ts:178`). Leave-by uses `nextPlayer?.arrivalRules` (`planner.ts:188`). `getOrCreateArrivalRules` / `saveArrivalRules` unused in `src/components`. `familyShare.ts:20–62` round-trips the table. Type exists on both table and `PlayerProfile.arrivalRules` (`matchday.ts:433–454, 492`).
- **blast radius:** a parent backup-restores arrival rules into Dexie; HUD still uses profile-embedded defaults (45/60/15). Two SoTs diverge.
- **why it matters:** “Dexie is SoT” is false for this table in the product path.
- **recommended action:** pick one: (A) planner reads `_arrivalRules` by `profileId`, or (B) delete the table and keep rules on the profile. Wire an editor or stop querying it.
- **open questions:** Q-ARC-004 to DATA — any v3 plan for injury/arrival on profiles?
- **related:** F-ARC-014 (syncState overload is the same “table used as bag” pattern).

### F-ARC-008 — native/ios is a stub; PWA is the product

- **severity:** S3
- **confidence:** high
- **evidence:** `native/ios/` = README + `FamdayAiBridge.swift` + `FamdayAiUserScript.js`. No xcodeproj. `onDeviceLlm.ts:188–208` Safari path `available: false`. Bridge fail-closes on `off` (`FamdayAiBridge.swift:72–79`).
- **blast radius:** docs/TestFlight claims overstate. Apple/Qwen radios in settings are correctly disabled on Safari (UIX).
- **why it matters:** architecture must not pretend a native runtime exists.
- **recommended action:** keep stub; label settings copy as “requires wrapper not shipped.” DOC to fix TestFlight language.
- **related:** DOC drift.

### F-ARC-009 — layer inversion: agent time imports statsEngine TZ

- **severity:** S3
- **confidence:** high
- **evidence:** `agents/time.ts:1, 29, 33` `getFinnishTimezoneOffset` from `../stats/statsEngine`. Also `localAiEngine.ts:8`, `eventChatEngine.ts:10`.
- **blast radius:** the pure agent graph transitively depends on the 1784-line stats module (and its `torneopalClient` import at `statsEngine.ts:13–15`).
- **why it matters:** planner purity is source-true, module-graph-false.
- **recommended action:** move TZ helpers next to `agents/time.ts`.
- **related:** F-ARC-001.

### F-ARC-010 — ICS / official ingest fail closed in data, open in UX

- **severity:** S2
- **confidence:** high
- **evidence:** `ingestIcsForProfile` `catch { return 0 }` and `if (!res.ok) return 0` (`ingestOfficial.ts:178–183`). `ingestSourceForProfile` returns `result.official?.fixtures.length || 0` (`297–303`) without error. `handleImportCalendar` `success: true` (`App.tsx:400`). `handleRefreshAll` per-profile `.catch(console.warn)` (`448`).
- **blast radius:** parent thinks import worked; HUD empty. Refresh can quietly skip a team.
- **why it matters:** fail-closed federation is undermined if the shell cannot distinguish 0 fixtures vs 0 because proxy died.
- **recommended action:** typed ingest result `{ ok, count, error }`. Surface in SmartImport / refresh HUD.
- **related:** F-ARC-005.

### F-ARC-011 — `generateSyntheticOfficialTeamData` remains on the production extract call graph

- **severity:** S2
- **confidence:** high
- **evidence:** `statsEngine.ts:946` factory; called from `extractOfficialTeamData` L1449–1450 and L1456–1457 when `fallbackToSynthetic`. Default `false` (`1392`). Ingest sets false (`ingestOfficial.ts:64`). `associationExtractor.ts:18,32` **re-exports** the factory. Tests opt in (`statsEngine.test.ts:627`).
- **blast radius:** one boolean flip (or a test-like caller from UI) writes a fake PPJ/HJK season into Dexie.
- **why it matters:** fail-closed is a parameter, not a type-system guarantee.
- **recommended action:** remove the true-branch from prod `extractOfficialTeamData`. Keep factory under `tests/` if hunters need it.
- **related:** F-ARC-001, F-ARC-002. QA owns hunters that pass `fallbackToSynthetic: true`.

### F-ARC-012 — `syncState` overloaded; home is not a first-class table

- **severity:** S3
- **confidence:** high
- **evidence:** schema `syncState: 'key, syncKey'` (`db.ts:74`). Keys used: `'family'` (`familyCloud.ts:434–438`) and `'home_location'` with JSON in `syncKey` (`homeLocation.ts:61–66`, `App.tsx:196–204`). Plus localStorage duplicate (`homeLocation.ts:53, 72–78`).
- **blast radius:** a naive `syncState.clear()` on family logout would drop home. JSON in `syncKey` has no type.
- **why it matters:** SoT modeling is ad hoc.
- **recommended action:** v3 table `homeLocation` or store home on a well-typed record. Stop dual-writing localStorage or make it cache-only.
- **related:** F-ARC-007. DATA owns schema v3.

### F-ARC-013 — agent graph re-entered with different arguments (HUD vs Ambient vs logistics)

- **severity:** S3
- **confidence:** high
- **evidence:** `App.tsx:291–292` (events, profiles, now, arrivalRules, homeLocation). `AmbientView.tsx:26` (events, profiles, now) — **no home**. `localAiEngine.ts:129` (events, profiles, now, `[]`, homeLocation).
- **blast radius:** walk/bike “conflict resolved” (`conflictAgent.ts:53–75`) depends on `homeLocation`. Ambient can show a conflict the HUD already resolved.
- **why it matters:** one graph is the contract (`docs/ARCHITECTURE.md`: “only entry the UI should call”). Three entries exist.
- **recommended action:** AmbientView and logistics must pass the same `homeLocation`. Kill the unused `_arrivalRules` param or use it (F-ARC-007).
- **related:** F-ARC-007.

---

## 13. Questions for other roles

| ID | To | Question |
|---|---|---|
| Q-ARC-001 | QA | Do `statsEngine.test.ts` / hunters still need `generateOrResolveMatchStats`, or can they assert `isSynthetic` absence + blank modal? |
| Q-ARC-002 | SEC | Delete `generateFamilyCode` from client? Operator minting is `scripts/issue-family-codes.mjs` + Worker secret. |
| Q-ARC-003 | API | Is `officialFromExampleCup` product-intent for the three cup URLs, or a leftover that violates “no invented times”? |
| Q-ARC-004 | DATA | v3: collapse `arrivalRules` table vs `profile.arrivalRules`; first-class `homeLocation` table vs `syncState` bag. |
| Q-ARC-005 | UIX | AmbientView graph without `homeLocation` — confirm leave-by / conflict copy vs HUD. |
| Q-ARC-006 | REL | After deleting synthetics, is there a bundle grep in CI (`generateOrResolveMatchStats` must not appear in `dist`)? |

---

## 14. Contradictions (for ORCH)

| ID | A | B |
|---|---|---|
| C-ARC-001 | `docs/ARCHITECTURE.md` L29: planner “consumes” arrival rules; L32 kit/volunteer/… “Side effects none” | `planner.ts:178` `_arrivalRules` unused; live query is cargo-cult |
| C-ARC-002 | `docs/ARCHITECTURE.md` L7: “runMissionControlGraph is the only entry the UI should call” (`AGENT_GRAPH.md` L7) | three callers with three signatures (App, AmbientView, localAiEngine) |
| C-ARC-003 | Agency G-14: `seedWeekendExtras` dead canned weekend | `exampleTournaments.ts` is live canned cup in ingest — different file, same honesty class |
| C-ARC-004 | `native/ios/README.md` L14 TestFlight neural net | no Xcode project; PWA is the only product |

Do not overwrite DATA/API findings on KV payload or proxy allowlist.

---

## 15. What is *not* a finding (held)

- Specialist functions are pure (no Dexie, no fetch). Graph design is sound. Carpool-after-conflict ordering is documented and implemented (`planner.ts:196–197`).
- On-device LLM default off is real, enforced in JS and Swift.
- `fallbackToSynthetic: false` on the ingest call is real (`ingestOfficial.ts:64`). Inner extract still contains a true-branch (F-ARC-011).
- `MatchStatsModal` does not call `generateOrResolveMatchStats`; blank stats object is honest (“Ei virallisia tilastoja”).
- Dexie v2 schema + `useLiveQuery` as the reactive SoT for profiles/events is the right shape.
- Family hydrate re-fetches vendors per device (`familyCloud.ts:270–278`) — matches FAMILY_SYNC_ARCHITECTURE “tulospalvelu stores when.”

---

## 16. Commands run

```
rg generateOrResolveMatchStats|generateFamilyCode|seedWeekendExtras
rg '\.catch\(\(\)\s*=>\s*null\)' src
rg 'from .*/stats/statsEngine' src
rg 'db\.|fetch\(|localStorage' src/lib/agents
rg generateFamilyCode src
rg EXTRA_PROFILES|buildWeekendShowcaseEvents
rg NeuralEngineId src/lib/ai
wc -l src/lib/**/*.ts src/App.tsx src/types/matchday.ts
```

All line numbers are as of SHA `20bad06`.
