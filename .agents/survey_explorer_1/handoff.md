# Pelipäivä Architecture & Codebase Survey Report (R1 & Dexie Persistence)

## 1. Observation

### 1.1 Project Structure and Build Environment
- **Workspace root**: `c:\dev2\pelipaiva`
- **Frontend Stack**: Vite 6.1.0, React 19.0.0, TypeScript 5.7.3, TailwindCSS v4.0.0 with `@tailwindcss/vite`, Radix UI headless primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`), Lucide React icons, Motion v13.1.0 spring physics.
- **Client Storage**: `dexie` v4.4.5 + `dexie-react-hooks` v1.1.7.
- **Calendar & XML Tools**: `ical.js` v2.2.1, `fast-xml-parser` v5.11.0, `@turf/distance` v7.2.0.
- **Edge Infrastructure**: Cloudflare Worker in `cloudflare-worker/` with `worker.ts` providing KV snapshot sync (`/api/sync/:key`), Google Nest voice briefing (`/api/nest/brief`), and streaming CORS proxy (`/api/proxy/ics`).
- **Test Suite Status**: 7 test files, 22 unit tests passing via `vitest run` (100% pass rate). TypeScript strict verification `npx tsc --noEmit` exits 0 with 0 errors.

### 1.2 Inspection of Existing R1 Implementations & Gaps

#### A. Calendar & Match Parser (`src/lib/calendar/icsParser.ts`)
- **Current Capability**:
  - Parses iCalendar (.ics) string feeds using `ical.js`.
  - Distinguishes training from matches via `isTrainingEvent()` (checking Finnish keywords: `harjoitukset`, `treenit`, `fysiikka`, `lajiharjoitus`, `lajivuoro`, `kuntopiiri`, `aamujää`, etc. lines 8–33).
  - Basic matchup delimiter splitting (` vs `, ` - `, ` v `, ` @ ` lines 90–104).
  - Hardcoded warmup offset (45 minutes for matches, 15 minutes for training, line 67).
  - Rudimentary volunteer duty detection (`kahviovuoro` ➔ `☕ Kahviovuoro`, `toimitsija`/`kirjuri` ➔ `⏱️ Toimitsijavuoro`, `järkkäri` ➔ `🛡️ Järjestyksenvalvoja`, `kirjuri`/`kello` ➔ `📝 Kirjuri/Kello`, lines 71–80).
  - Links to `geocodeSportsVenue(location)` from `src/lib/geo/sportsGeocoder.ts`.
- **Identified Gaps for R1**:
  - **No Sports Association Team Page URL parser**: There is no function to parse `tulospalvelu.palloliitto.fi/team/{teamId}`, `tulospalvelu.salibandy.fi/team/{teamId}`, `basket.fi/basket/sarjat/joukkue/?team_id={teamId}`, or `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}`.
  - **No automated fixture/standings/roster scraper or API client**: The app only imports raw `.ics` strings from Nimenhuuto/MyClub. Official league data (official fixture times, field numbers, standings tables, player lists) cannot be retrieved from team page URLs.
  - **No volunteer duty exact time-window extraction**: Extracts duty title prefix only, ignoring time spans like `klo 11:30 - 13:00` in the calendar body.
  - **No multi-squad feed splitting**: Single .ics feed cannot currently be partitioned into separate squads (e.g. `Sininen`, `Valkoinen`, `Musta`, `Kilpa`, `Haaste`).

#### B. Match Statistics Engine (`src/lib/stats/statsEngine.ts`)
- **Current Capability**:
  - Implements `generateOrResolveMatchStats(homeTeam, awayTeam, sport)`.
  - Multi-sport score formats: Football/Floorball (goals), Volleyball (sets e.g. `25-22, 23-25`), Basketball (points e.g. `68-62`).
  - Provides full data models for: comparison bars (possession %, shots, corners, cards), standings table (`StandingRow[]`), top scorers (`TopScorer[]`), head-to-head history (`HeadToHeadMatch[]`), common opponents (`CommonOpponentComparison[]`), division-wide squad rosters (`divisionRosters: Record<string, TeamSquadRoster>`), and tactical scout analysis.
- **Identified Gaps for R1**:
  - Currently generates **mock/synthetic data** (hardcoded rosters with players like `Emma Korhonen`, `Maija Oinonen`, `Ella Virtanen` and mock standings table).
  - Does not ingest or persist real official Torneopal / Palloliitto / Salibandy / Basket.fi standings or rosters.

#### C. Database & Storage Architecture (`src/lib/storage/db.ts`)
- **Current Dexie Database**:
  - Database name: `PelipaivaDB` (Version 1).
  - Tables:
    1. `profiles`: `'id, teamName, sport'` (Table type: `PlayerProfile`)
    2. `events`: `'id, profileId, sport, startTime, [profileId+startTime]'` (Table type: `MatchdayEvent`)
    3. `venuePins`: `'normalizedQuery, venueName'` (Table type: `CustomVenuePin`)
    4. `syncState`: `'key, syncKey'` (Table type: `SyncStateRecord`)
  - Storage persistence: `ensureStoragePersistence()` requests `navigator.storage.persist()`.
- **Identified Gaps for Persistence & R1**:
  - **Missing Official Fixtures Table**: No Dexie table to store official association match schedules (`officialFixtures`) independent of private user calendars.
  - **Missing Standings & Roster Tables**: Standings tables and division rosters are embedded inside `MatchdayEvent.stats` rather than stored as normalized, queryable cached records with TTLs (`leagueStandings`, `teamRosters`).
  - **Missing Association Feed Metadata**: `PlayerProfile` has `calendarUrl: string`, but lacks fields for `associationUrl`, `teamId`, `clubId`, `associationType` (`palloliitto` | `salibandy` | `basket` | `torneopal`), and `lastOfficialSyncAt`.
  - **Missing MatchdayEvent Reconciliation Fields**: `MatchdayEvent` lacks fields to store reconciliation diagnostics (e.g. `officialFixtureId`, `reconciliationStatus`, `mismatchFlags`, `userOverride`).
  - **Missing User Arrival & Squad Configuration Table**: No Dexie storage for custom warmup offsets (home vs away vs training) or multi-squad filtering rules.

#### D. Cloudflare Worker Edge Proxy (`cloudflare-worker/worker.ts`)
- **Current Capability**:
  - `/api/proxy/ics`: Streaming CORS proxy that fetches remote URLs and sets CORS headers `Access-Control-Allow-Origin: *`.
  - Checks URL prefix: `https://nimenhuuto.com`, `https://myclub.fi`, `https://opendata.fmi.fi`, or `https://`.
- **Identified Gaps for R1**:
  - Allows fetching `https://tulospalvelu.palloliitto.fi`, `https://tulospalvelu.salibandy.fi`, `https://basket.fi`, and `*.torneopal.fi`, but does not perform server-side HTML/JSON extraction or caching. Edge proxy should ideally support association API fetching with response formatting or direct client-side parsing through the CORS proxy.

---

## 2. Logic Chain

### 2.1 Association URL Structure Analysis & Extraction Logic

Finnish sports associations follow standardized URL patterns:

1. **Football (Palloliitto Tulospalvelu)**:
   - Primary URL format: `https://tulospalvelu.palloliitto.fi/team/{teamId}`
   - Alternate formats: `https://tulospalvelu.palloliitto.fi/team/{teamId}/fixtures`, `https://tulospalvelu.palloliitto.fi/team/{teamId}/standings`
   - Extraction:
     - `sport`: `'football'`
     - `association`: `'palloliitto'`
     - `teamId`: regex `tulospalvelu\.palloliitto\.fi/team/(?<teamId>\d+)`
   - Under the hood, Palloliitto Tulospalvelu runs on Torneopal Taso engine. The team page contains:
     - Match fixtures: Date, time, home team, away team, field/venue name, category/series name.
     - Standings table: Rank, team, played, won, drawn, lost, goals for/against, points.
     - Player squad: Jersey numbers, names, positions, seasonal goal/card statistics.

2. **Floorball (Salibandyliitto Tulospalvelu)**:
   - Primary URL format: `https://tulospalvelu.salibandy.fi/team/{teamId}`
   - Extraction:
     - `sport`: `'floorball'`
     - `association`: `'salibandy'`
     - `teamId`: regex `tulospalvelu\.salibandy\.fi/team/(?<teamId>\d+)`
   - Shared architecture with Palloliitto Tulospalvelu (Torneopal Taso platform).

3. **Basketball (Koripalloliitto / Basket.fi)**:
   - Primary URL format: `https://basket.fi/basket/sarjat/joukkue/?team_id={teamId}` (also `https://www.basket.fi/basket/sarjat/joukkue/?team_id={teamId}&season_id={seasonId}&league_id={leagueId}`)
   - Extraction:
     - `sport`: `'basketball'`
     - `association`: `'basket'`
     - `teamId`: regex `basket\.fi/basket/sarjat/joukkue/.*\bteam_id=(?<teamId>\d+)`
   - Extracts game schedules, gym/hall venues, league standings, player scoring statistics.

4. **Volleyball & Generic Torneopal Taso (*.torneopal.fi)**:
   - Primary URL format: `https://{subdomain}.torneopal.fi/taso/joukkue.php?joukkue={teamId}` (e.g. `lentopallo.torneopal.fi`, `salibandy.torneopal.fi`, `turnaus.torneopal.fi`)
   - Extraction:
     - `sport`: inferred from subdomain (`lentopallo` ➔ `'volleyball'`, `salibandy` ➔ `'floorball'`, `jalkapallo` ➔ `'football'`, fallback `'other'`)
     - `association`: `'torneopal'`
     - `teamId`: regex `(?<subdomain>[a-zA-Z0-9_\-\.]+)\.torneopal\.fi/taso/joukkue\.php\?.*\bjoukkue=(?<teamId>\d+)`

### 2.2 Dexie Schema Evolution Plan (Version 2 Migration)

To support R1 and offline persistence for league fixtures, standings, and arrival rules:

```typescript
// Proposed Dexie Version 2 Stores
this.version(2).stores({
  profiles: 'id, teamName, sport, associationUrl, teamId',
  events: 'id, profileId, sport, startTime, officialFixtureId, reconciliationStatus, [profileId+startTime]',
  officialFixtures: 'id, teamId, association, sport, startTime, [teamId+startTime]',
  leagueStandings: 'id, teamId, leagueName, fetchedAt',
  teamRosters: 'id, teamId, teamName, fetchedAt',
  arrivalRules: 'profileId, defaultSport',
  venuePins: 'normalizedQuery, venueName',
  syncState: 'key, syncKey'
});
```

### 2.3 Comprehensive Matching & Reconciliation Logic (R2 & R3)

```
[ Calendar Feed (.ics) ]                 [ Official League Fixtures (Torneopal/Liitto) ]
(Nimenhuuto / MyClub / Jopox)             (Palloliitto / Salibandy / Basket / Torneopal)
           │                                                    │
           ▼                                                    ▼
    Parsed Events                                      Official Fixtures
  (Kickoff, Venue, Title)                             (Kickoff, Venue, Home/Away)
           │                                                    │
           └────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                     [ Conservative Fuzzy Matcher ]
                     - Date window: exact date or ±3h
                     - Opponent token similarity >= 0.75
                     - Sport match
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
         [ High Confidence Match ]          [ Unmatched / Conflict ]
         - Auto-link official fixture       - Retain as distinct calendar event
         - Compare Kickoff (e.g. 15:00 vs 15:30) - Flag suggested matches in UI
         - Compare Venue (Väiski vs Sahara)
         - Calculate arrival/warmup rules
                   │
                   ▼
         [ Visual Diagnostics UI (R3) ]
         - Kickoff mismatch badge (Nimenhuuto 15:00 ➔ Torneopal 15:30)
         - Venue mismatch warning
         - 1-tap resolution: Adopt official / Keep calendar notes
```

---

## 3. Caveats

1. **CORS & Edge Proxy Dependency**:
   - Finnish sports association websites (`tulospalvelu.palloliitto.fi`, `basket.fi`, `torneopal.fi`) do not include permissive browser CORS headers (`Access-Control-Allow-Origin: *`).
   - All client-side scraping/fetching of association HTML/APIs must route through the Cloudflare Worker streaming proxy (`/api/proxy/ics?url=...`) or a dedicated worker endpoint.
2. **Torneopal HTML/DOM Resilience**:
   - While Torneopal HTML has a consistent table structure (`table.otteluohjelma`, `table.sarjataulukko`, `table.pelaajat`), class names or table layouts can vary between Taso versions. A dual-parser architecture (JSON API if available, resilient DOM/Regex table parser as primary fallback) ensures high reliability.
3. **Data Freshness vs Offline Experience**:
   - When offline, the app must seamlessly serve cached `officialFixtures`, `leagueStandings`, and `teamRosters` from Dexie IndexedDB.
   - When online, cached official data should have a sensible TTL (e.g., 6 hours for standings/rosters, 1 hour on matchday for live fixtures).

---

## 4. Conclusion & State Assessment

| Module / Requirement | Current Status | What Exists | What Needs to be Built |
| :--- | :--- | :--- | :--- |
| **R1: Association URL Parser** | ❌ **Missing** | Basic .ics parser with mock stats generator | `associationUrlParser.ts`: URL parser for Palloliitto, Salibandy, Basket.fi, Torneopal with teamId extraction. |
| **R1: Association Fixture Scraper** | ❌ **Missing** | None | `associationExtractor.ts`: Scraper/Fetcher via Worker proxy to extract official fixtures, venues, standings, rosters. |
| **R1: Import UI Integration** | 🟡 **Partial** | `CalendarImportModal.tsx` accepts only `.ics` URL | Expand `CalendarImportModal.tsx` to support both `.ics` and Sports Association team page URLs with automatic preview. |
| **Dexie Storage Schema** | 🟡 **Partial** | 4 basic tables (`profiles`, `events`, `venuePins`, `syncState`) | Add Version 2 migration with `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`. |
| **R2: Finnish Calendar Permutations** | 🟡 **Partial** | Basic training vs match keyword check | Complex title/delimiter parsing, volunteer duty time-window extraction, multi-squad feed splitting. |
| **R2: Conservative Fuzzy Matcher** | ❌ **Missing** | None | Fuzzy matching engine to conservatively link calendar events with official league fixtures. |
| **R3: Visual Mismatch Diagnostics** | ❌ **Missing** | Single conflict warning string in briefing | UI badges and interactive resolution dialog for kickoff time differences, venue differences, and 1-tap sync. |
| **R4: Configurable Arrival Rules** | 🟡 **Partial** | Hardcoded 45m/15m warmup offsets | User-configurable per-team and per-calendar arrival offsets (home, away, training) and squad alias mapping. |

---

## 5. Verification Method

To independently verify the codebase and future implementations:

1. **Unit & Integration Test Suite**:
   ```powershell
   npm test
   ```
   *Expected*: All test suites pass (currently 7 passed, 22 tests).
2. **TypeScript Strict Typecheck**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected*: Zero type errors.
3. **Production Build & Asset Packaging**:
   ```powershell
   npm run build
   ```
   *Expected*: Successful Vite production bundle in `dist/`.
4. **URL Parser Verification Test Plan**:
   - `https://tulospalvelu.palloliitto.fi/team/3512345` ➔ `{ sport: 'football', association: 'palloliitto', teamId: '3512345' }`
   - `https://tulospalvelu.salibandy.fi/team/1289` ➔ `{ sport: 'floorball', association: 'salibandy', teamId: '1289' }`
   - `https://basket.fi/basket/sarjat/joukkue/?team_id=4521` ➔ `{ sport: 'basketball', association: 'basket', teamId: '4521' }`
   - `https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872` ➔ `{ sport: 'volleyball', association: 'torneopal', teamId: '8872' }`
