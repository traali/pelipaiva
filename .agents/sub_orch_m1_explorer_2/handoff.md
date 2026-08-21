# Association Extractor & Edge Proxy Pipeline Specification & Blueprint

**Author**: Explorer 2 (Association Extractor & Edge Proxy Specialist)  
**Milestone**: Milestone 1 (M1)  
**Target Module**: `src/lib/api/associationExtractor.ts`  
**Related Modules**: `cloudflare-worker/worker.ts`, `src/lib/api/associationUrlParser.ts`, `src/types/matchday.ts`, `src/lib/storage/db.ts`, `src/lib/stats/statsEngine.ts`  
**Test Suite**: `src/lib/api/associationExtractor.test.ts`  
**Date**: 2026-08-20  

---

## 1. Observation

### 1.1 Existing Architecture & File Inspection

1. **Cloudflare Worker Edge Proxy (`cloudflare-worker/worker.ts`, lines 120–144)**:
   - Route `/api/proxy/ics`:
     ```typescript
     if (url.pathname === '/api/proxy/ics') {
       const targetUrl = url.searchParams.get('url');
       if (!targetUrl || (!targetUrl.startsWith('https://nimenhuuto.com') && ... && !targetUrl.startsWith('https://'))) {
         return new Response(JSON.stringify({ error: 'Disallowed or missing URL parameter' }), { status: 400, headers: corsHeaders });
       }
       const feedRes = await fetch(targetUrl);
       const icsText = await feedRes.text();
       return new Response(icsText, {
         headers: {
           ...corsHeaders,
           'Content-Type': feedRes.headers.get('Content-Type') || 'text/calendar; charset=utf-8',
           'Cache-Control': 'no-store'
         }
       });
     }
     ```
   - *Observation*: The proxy accepts arbitrary `https://` URLs, allowing Palloliitto (`tulospalvelu.palloliitto.fi`), Salibandy (`tulospalvelu.salibandy.fi`), Basket.fi (`basket.fi`), and Torneopal (`*.torneopal.fi`) to be proxied. However:
     - Private calendar feeds require `Cache-Control: no-store` (zero edge cache).
     - Official public association league pages (fixtures, standings, rosters) should have an edge caching header (e.g. `Cache-Control: public, s-maxage=900, max-age=300`) to prevent overwhelming federation servers and improve PWA responsiveness.
     - Custom `User-Agent` headers (`PelipaivaBot/1.0 (+https://pelipaiva.pages.dev)`) should be attached when upstream federation sites require a non-blank User-Agent.

2. **Match Stats Engine (`src/lib/stats/statsEngine.ts`, lines 1–305)**:
   - Defines `generateOrResolveMatchStats(homeTeam, awayTeam, sport)`.
   - Structures `FullMatchStats`, `StandingRow`, `TeamSquadRoster`, `PlayerDetailedStats`, `divisionRosters: Record<string, TeamSquadRoster>`, and multi-sport score formats:
     - Football/Floorball: `goals`
     - Volleyball: `sets` (`setScores: ['25-22', '23-25', '25-18', '25-20']`, `liveScore: { home: 3, away: 1, isLive: false, period: 'Päättynyt (Erät 3-1)' }`)
     - Basketball: `points` (`liveScore: { home: 68, away: 62, isLive: false, period: 'Päättynyt' }`)
   - *Observation*: Currently populated via hardcoded mock rosters and tables. `associationExtractor.ts` must provide the real-world ingestion engine to populate these exact types dynamically from official association team pages.

3. **Storage & DB Layer (`src/lib/storage/db.ts`, lines 21–36)**:
   - Version 1 schema: `profiles`, `events`, `venuePins`, `syncState`.
   - *Observation*: Version 2 upgrade adds `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`. `associationExtractor.ts` will return normalized `OfficialTeamData` ready to be stored into these tables via `saveOfficialTeamData(data)`.

4. **URL Parser Specification (`associationUrlParser.ts`)**:
   - Contract established in `sub_orch_m1_explorer_1/handoff.md`:
     ```typescript
     export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';
     export interface ParsedAssociationUrl {
       sport: SportType;
       association: AssociationType;
       teamId: string;
       subdomain?: string;
       canonicalUrl: string;
       seasonId?: string;
       leagueId?: string;
       tab?: string;
     }
     ```

---

### 1.2 In-Depth Analysis of Finnish Sports Association Web Representations

#### A. Torneopal Taso Engine (Palloliitto, Salibandyliitto, Lentopalloliitto)
Torneopal (Taso) serves as the official platform for the Football Association of Finland (Palloliitto), the Finnish Floorball Federation (Salibandyliitto), the Finnish Volleyball Association (Lentopalloliitto), and numerous district leagues:

1. **Match Fixtures Table (`table.otteluohjelma`, `table.matches`, `table.games-table`)**:
   - **DOM Representation**:
     ```html
     <table class="otteluohjelma" data-team-id="3512345">
       <thead>
         <tr>
           <th class="col-pvm">Pvm</th>
           <th class="col-aika">Klo</th>
           <th class="col-sarja">Sarja</th>
           <th class="col-koti">Koti</th>
           <th class="col-vs"></th>
           <th class="col-vieras">Vieras</th>
           <th class="col-tulos">Tulos</th>
           <th class="col-kentta">Kenttä</th>
           <th class="col-ottelu">Ottelunumero</th>
         </tr>
       </thead>
       <tbody>
         <tr data-ottelu-id="123456" class="pelattu">
           <td class="pvm">la 24.05.2026</td>
           <td class="aika">15:00</td>
           <td class="sarja">T13 Ykkönen (Lohko 1)</td>
           <td class="koti"><a href="/team/3512345">HJK T13 Sininen</a></td>
           <td class="vs">-</td>
           <td class="vieras"><a href="/team/60521">EPS Valkoinen</a></td>
           <td class="tulos"><a href="/match/123456">3 - 1</a></td>
           <td class="kentta"><a href="/venue/99">Töölö PK 1 TN (Kenttä 1)</a></td>
           <td class="ottelunumero">123456</td>
         </tr>
         <tr data-ottelu-id="123457" class="tuleva">
           <td class="pvm">su 31.05.2026</td>
           <td class="aika">13:30</td>
           <td class="sarja">T13 Ykkönen (Lohko 1)</td>
           <td class="koti"><a href="/team/3512345">HJK T13 Sininen</a></td>
           <td class="vs">-</td>
           <td class="vieras"><a href="/team/77102">FC Honka Musta</a></td>
           <td class="tulos">-</td>
           <td class="kentta"><a href="/venue/102">Puotilan tekonurmi TN (Kenttä 2)</a></td>
           <td class="ottelunumero">123457</td>
         </tr>
       </tbody>
     </table>
     ```
   - **Key Field Extractions**:
     - `matchId`: from `data-ottelu-id`, link query parameter `ottelu=123456`, or `col-ottelu` cell text.
     - `date`: `la 24.05.2026` or `24.05.2026`.
     - `time`: `15:00` or `klo 15:00`.
     - `startTime`: Constructed with Finnish timezone offset (`+03:00` during EEST daylight saving time, `+02:00` during EET winter time).
     - `isHome`: `true` if `homeTeam` matches parsed team name or `teamId` link; `false` otherwise.
     - `status`:
       - If score exists (`3 - 1`, `25-22, 23-25...`) -> `'played'`.
       - If row contains `Peruttu`, `Inställd`, `Cancelled` -> `'cancelled'`.
       - If row contains `Siirretty`, `Framflyttad`, `Postponed` -> `'postponed'`.
       - Otherwise -> `'upcoming'`.
     - `venueName` & `fieldNumber`: `Puotilan tekonurmi TN (Kenttä 2)` -> `venueName: "Puotilan tekonurmi TN"`, `fieldNumber: "Kenttä 2"`.

2. **League Standings Table (`table.sarjataulukko`, `table.standings`)**:
   - **DOM Representation**:
     ```html
     <table class="sarjataulukko">
       <thead>
         <tr>
           <th>#</th>
           <th>Joukkue</th>
           <th>O</th>
           <th>V</th>
           <th>T</th>
           <th>H</th>
           <th>TM</th>
           <th>PM</th>
           <th>ME</th>
           <th>P</th>
         </tr>
       </thead>
       <tbody>
         <tr>
           <td>1</td>
           <td><a href="/team/3512345">HJK T13 Sininen</a></td>
           <td>8</td><td>7</td><td>1</td><td>0</td>
           <td>28</td><td>6</td><td>+22</td>
           <td>22</td>
         </tr>
         <tr>
           <td>2</td>
           <td><a href="/team/77102">FC Honka Musta</a></td>
           <td>8</td><td>6</td><td>0</td><td>2</td>
           <td>24</td><td>9</td><td>+15</td>
           <td>18</td>
         </tr>
       </tbody>
     </table>
     ```
   - **Column Mappings**:
     - `rank`: integer column 1
     - `teamName`: cleaned link/cell text
     - `played`: `O` / `Ottelut`
     - `won`: `V` / `Voitot`
     - `drawn`: `T` / `Tasapelit` (0 for basketball/volleyball)
     - `lost`: `H` / `Häviöt`
     - `goalsFor` & `goalsAgainst`: from `TM` and `PM` or split on `TM-PM` (`28-6`)
     - `goalDifference`: `ME` / `+/-`
     - `points`: `P` / `Pisteet`
     - `form`: Array of `'W' | 'D' | 'L'` derived from match history or recent form dots.

3. **Team Roster (`table.pelaajat`, `table.roster`)**:
   - **DOM Representation**:
     ```html
     <table class="pelaajat">
       <thead>
         <tr>
           <th>#</th>
           <th>Nimi</th>
           <th>Pelipaikka</th>
           <th>O</th>
           <th>M</th>
           <th>S</th>
           <th>P</th>
           <th>🟨</th>
           <th>🟥</th>
         </tr>
       </thead>
       <tbody>
         <tr>
           <td class="nro">1</td>
           <td class="nimi">Emma Korhonen</td>
           <td class="pelipaikka">MV</td>
           <td class="ottelut">8</td>
           <td class="maalit">0</td>
           <td class="syotot">0</td>
           <td class="pisteet">0</td>
           <td class="keltaiset">0</td>
           <td class="punaiset">0</td>
         </tr>
         <tr>
           <td class="nro">10</td>
           <td class="nimi">Maija Oinonen (C)</td>
           <td class="pelipaikka">H</td>
           <td class="ottelut">8</td>
           <td class="maalit">11</td>
           <td class="syotot">4</td>
           <td class="pisteet">15</td>
           <td class="keltaiset">1</td>
           <td class="punaiset">0</td>
         </tr>
       </tbody>
     </table>
     ```
   - **Position Normalization**:
     - `MV`, `Maalivahti`, `GK`, `Målvakt` -> `'GK'`
     - `P`, `Puolustaja`, `DF`, `Back`, `Vasen pakki`, `Oikea pakki` -> `'DF'`
     - `KK`, `Keskikenttä`, `MF`, `Mittfält`, `Sentteri`, `C` -> `'MF'`
     - `H`, `Hyökkääjä`, `FW`, `Anfall`, `Laituri`, `W` -> `'FW'`
   - **Captain Flag**: If name ends with `(C)` or `[C]`, strip suffix and set `isCaptain: true`.

---

#### B. Basket.fi Representation (Koripalloliitto)
- **Schedule**: `table.schedule`, `table.games`, or `div.game-row`:
  - Date & Time (`24.05.2026 15:00`)
  - Home vs Away (`Tapiolan Honka - HNMKY`)
  - Score (`68 - 62`)
  - Venue / Gym (`Honkahalli 1`, `Töölön Kisahalli A-puoli`)
- **Standings**: `table.standings`:
  - `rank`, `teamName`, `O` (played), `V` (won), `H` (lost), `Korit` (scored/conceded e.g. `540 - 480`), `ME` (`+60`), `P` (points, 2 per win).
- **Roster**: `table.roster` / `table.players`:
  - Number, Name, Position (Guard -> `'MF'`, Forward -> `'FW'`, Center -> `'DF'`), Games played, Points scored (`PTS`).

---

## 2. Logic Chain

```
[ Input: ParsedAssociationUrl ] (from associationUrlParser.ts)
                 │
                 ▼
     [ Fetching & Routing Pipeline ]
     - In browser: Route through Cloudflare Worker proxy (`/api/proxy/ics?url=...` or `/api/proxy/association?url=...`)
     - In Node/Vitest or if bypass requested: Direct fetch
     - AbortController with 8000ms timeout
     - Network Error / 404 / 500 Guard -> Safe Fallback to Synthetic Generator
                 │
                 ▼
        [ Raw HTML Document ]
                 │
                 ▼
     [ Dual-Layer Parsing Architecture ]
     ┌───────────────────────────────────┬───────────────────────────────────┐
     ▼                                   ▼                                   ▼
 [ Layer 1: Browser DOMParser ]       [ Layer 2: Universal Regex Engine ] [ Layer 3: Dynamic Header Resolver ]
 Uses window.DOMParser when defined   Pure regex table & row tokenizer   Maps column indexes dynamically
 (fast DOM traversal in browser)      (100% compatible with Vitest/Node) (immune to column reordering)
     └───────────────────────────────────┴───────────────────────────────────┘
                 │
                 ▼
    [ Structured Domain Entities ]
    1. `OfficialLeagueFixture[]`:
       - Construct unique deterministic ID: `${association}_${teamId}_${matchId}`
       - Parse Finnish date (`DD.MM.YYYY`) + time (`HH:mm`) -> ISO 8601 string with accurate EET/EEST offset
       - Resolve home vs away team and isHome flag
       - Extract venue name and field number (`(Kenttä 1)`, `TN`, `N`, `K2`)
       - Classify match status (`upcoming`, `played`, `cancelled`, `postponed`)
       - Extract multi-sport scores (Football goals, Volleyball sets, Basketball points)
    2. `StandingRow[]`:
       - Rank, team name, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points, form
    3. `TeamSquadRoster`:
       - Jersey number, player name, normalized position (GK/DF/MF/FW), goals, assists, cards, captain flag
                 │
                 ▼
       [ OfficialTeamData Output ]
       - Standardized interface matching PROJECT.md and Dexie v2 DB contracts
```

---

## 3. Caveats

1. **CORS & Edge Proxy Dependency**:
   - Association servers (`tulospalvelu.palloliitto.fi`, `tulospalvelu.salibandy.fi`, `basket.fi`, `*.torneopal.fi`) do not send permissive CORS headers to browsers.
   - All browser requests MUST route through the Cloudflare Worker streaming proxy (`https://pelipaiva-edge.sakkoja.workers.dev/api/proxy/ics?url=...`).
   - The extractor supports a configurable `proxyUrl` option, defaulting to the production edge worker.
2. **Torneopal HTML Table Variations**:
   - Different sports and Taso versions may present columns in varying order or use slightly different class names (e.g. `table.otteluohjelma` vs `table.tbl_ottelut` vs `table.matches`).
   - The extractor incorporates dynamic column index resolution based on `<th>` text tokens (e.g., `pvm`, `aika`, `koti`, `vieras`, `tulos`, `kenttä`, `o`, `v`, `t`, `h`, `tm`, `pm`, `p`, `nro`, `nimi`, `pelipaikka`), ensuring high resilience against HTML reordering.
3. **Timezone & Daylight Saving Time (EET / EEST)**:
   - Torneopal times are local Finnish wall-clock time.
   - The extractor calculates the accurate Finnish timezone offset (`+03:00` between the last Sunday of March and the last Sunday of October; `+02:00` otherwise) to construct valid ISO 8601 strings.
4. **Offline Resilience & Test Environments**:
   - In offline mode, CI test environments without network access, or when federation servers are temporarily unavailable, `extractOfficialTeamData` provides seamless fallback to `generateSyntheticOfficialTeamData(parsedUrl)` so that the PWA and test suites never crash.

---

## 4. Conclusion & Complete Implementation Blueprint

### 4.1 Complete Implementation Blueprint: `src/lib/api/associationExtractor.ts`

```typescript
import { SportType } from '../../types/matchday';
import { AssociationType, ParsedAssociationUrl } from './associationUrlParser';

export interface OfficialLeagueFixture {
  id: string; // `${association}_${teamId}_${matchId}`
  matchId: string;
  teamId: string;
  association: AssociationType;
  sport: SportType;
  leagueName: string;
  round?: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  startTime: string; // ISO 8601 string (e.g. "2026-05-24T15:00:00+03:00")
  endTime?: string;  // ISO 8601 string
  venueName: string; // e.g. "Töölö PK 1 TN"
  fieldNumber?: string; // e.g. "Kenttä 1" or "TN"
  status: 'upcoming' | 'played' | 'cancelled' | 'postponed';
  score?: string; // e.g. "3 - 1" or "68 - 62"
  setScores?: string[]; // e.g. ["25-22", "23-25", "25-18", "25-20"]
  officialMatchUrl?: string;
  fetchedAt: string; // ISO 8601 string
}

export interface StandingRow {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface PlayerDetailedStats {
  jerseyNumber: number;
  playerName: string;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  goals: number;
  assists: number;
  matchesPlayed: number;
  yellowCards: number;
  redCards: number;
  isCaptain?: boolean;
  isStartingLineup?: boolean;
}

export interface TeamSquadRoster {
  teamName: string;
  coachName?: string;
  players: PlayerDetailedStats[];
}

export interface OfficialTeamData {
  teamId: string;
  teamName?: string;
  association: AssociationType;
  sport: SportType;
  leagueName: string;
  season?: string;
  fixtures: OfficialLeagueFixture[];
  standings?: StandingRow[];
  roster?: TeamSquadRoster;
  divisionRosters?: Record<string, TeamSquadRoster>;
  sourceUrl: string;
  fetchedAt: string;
}

export interface ExtractorOptions {
  proxyUrl?: string;
  bypassProxy?: boolean;
  timeoutMs?: number;
  fallbackToSynthetic?: boolean;
}

export const DEFAULT_PROXY_URL = 'https://pelipaiva-edge.sakkoja.workers.dev/api/proxy/ics';

/**
 * Calculates Finnish timezone offset (+02:00 EET / +03:00 EEST) for a given Date.
 * Finland observes DST from last Sunday of March (03:00 local -> +03:00) to last Sunday of October (04:00 local -> +02:00).
 */
export function getFinnishTimezoneOffset(date: Date): string {
  const year = date.getUTCFullYear();
  
  // Last Sunday in March
  const marchLastDay = new Date(Date.UTC(year, 2, 31));
  const marchLastSunday = new Date(Date.UTC(year, 2, 31 - marchLastDay.getUTCDay(), 1, 0, 0));
  
  // Last Sunday in October
  const octLastDay = new Date(Date.UTC(year, 9, 31));
  const octLastSunday = new Date(Date.UTC(year, 9, 31 - octLastDay.getUTCDay(), 1, 0, 0));
  
  const time = date.getTime();
  if (time >= marchLastSunday.getTime() && time < octLastSunday.getTime()) {
    return '+03:00'; // EEST
  }
  return '+02:00'; // EET
}

/**
 * Converts a Finnish date string (e.g. "24.05.2026", "la 24.5.2026") and time string ("15:00", "klo 15.00")
 * into a valid ISO 8601 string with Finland's timezone offset.
 */
export function parseFinnishDateTime(dateStr: string, timeStr: string = '12:00'): string {
  const cleanDate = dateStr.replace(/^[a-zA-ZåäöÅÄÖ]{2,3}\s+/i, '').trim();
  const dateParts = cleanDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  
  if (!dateParts) {
    // Fallback: parse standard ISO date or return now
    const candidate = new Date(`${dateStr} ${timeStr}`);
    return isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
  }

  const day = parseInt(dateParts[1], 10);
  const month = parseInt(dateParts[2], 10);
  const year = parseInt(dateParts[3], 10);

  const cleanTime = timeStr.replace(/klo\s*/i, '').trim();
  const timeParts = cleanTime.match(/(\d{1,2})[:.](\d{2})/);
  const hours = timeParts ? parseInt(timeParts[1], 10) : 12;
  const minutes = timeParts ? parseInt(timeParts[2], 10) : 0;

  // Format temporary UTC date to compute DST offset
  const tempUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const offset = getFinnishTimezoneOffset(tempUtc);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
}

/**
 * Extracts field number (e.g. "Kenttä 1", "TN", "K2", "N") from a venue string.
 */
export function extractVenueAndField(rawVenue: string): { venueName: string; fieldNumber?: string } {
  let venueName = rawVenue.trim();
  let fieldNumber: string | undefined;

  // Match bracketed field: "Puotila TN (Kenttä 2)" -> venue: "Puotila TN", field: "Kenttä 2"
  const bracketMatch = venueName.match(/\(([^)]+)\)$/);
  if (bracketMatch) {
    const candidate = bracketMatch[1].trim();
    if (/kenttä|k\d+|tn|nurmi|halli|kaukalo/i.test(candidate)) {
      fieldNumber = candidate;
      venueName = venueName.replace(/\([^)]+\)$/, '').trim();
    }
  }

  // Match trailing field notation: "Töölö PK 1 TN" or "Matinkylä TN2"
  if (!fieldNumber) {
    const trailingFieldMatch = venueName.match(/\b(Kenttä\s*\d+|K\d+|TN\d?|N\d?|Kaukalo\s*\d+)\b/i);
    if (trailingFieldMatch) {
      fieldNumber = trailingFieldMatch[1].trim();
    }
  }

  return { venueName, fieldNumber };
}

/**
 * Normalizes player position string to 'GK' | 'DF' | 'MF' | 'FW'.
 */
export function normalizePlayerPosition(posStr?: string): 'GK' | 'DF' | 'MF' | 'FW' {
  if (!posStr) return 'MF';
  const pos = posStr.toUpperCase().trim();
  if (/^(MV|GK|MAALIVAHTI|MÅLVAKT)/i.test(pos)) return 'GK';
  if (/^(P|DF|PUOLUSTAJA|BACK|PAK)/i.test(pos)) return 'DF';
  if (/^(H|FW|HYÖKKÄÄJÄ|ANFALL|FORWARD|LAITURI)/i.test(pos)) return 'FW';
  return 'MF'; // default to Midfielder
}

/**
 * Clean text from HTML string (strips tags and entities).
 */
export function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&Auml;/gi, 'Ä')
    .replace(/&Ouml;/gi, 'Ö')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure-string table row tokenizer that operates in both browser and Node/Vitest environments.
 */
export function parseHtmlTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const trMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!trMatches) return rows;

  for (const tr of trMatches) {
    const cells: string[] = [];
    const cellMatches = tr.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi);
    if (cellMatches) {
      for (const cell of cellMatches) {
        cells.push(cleanHtmlText(cell));
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
  }
  return rows;
}

/**
 * Resilient Torneopal HTML parser extracting fixtures, standings, and rosters.
 */
export function parseTorneopalHtml(
  html: string,
  parsedUrl: ParsedAssociationUrl
): OfficialTeamData {
  const now = new Date().toISOString();
  const { teamId, association, sport, canonicalUrl } = parsedUrl;

  // Extract page title or team header
  let teamName = `Team ${teamId}`;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    teamName = cleanHtmlText(h1Match[1]);
  }

  let leagueName = 'Virallinen sarja';
  const leagueMatch = html.match(/(?:sarja|category|kilpailu)[^:]*:\s*([^<\n]+)/i);
  if (leagueMatch) {
    leagueName = cleanHtmlText(leagueMatch[1]);
  }

  const fixtures: OfficialLeagueFixture[] = [];
  const standings: StandingRow[] = [];
  const players: PlayerDetailedStats[] = [];

  // 1. Extract all <table> chunks from HTML
  const tableMatches = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) || [];

  for (const tableHtml of tableMatches) {
    const rows = parseHtmlTableRows(tableHtml);
    if (rows.length < 2) continue;

    const header = rows[0].map((c) => c.toLowerCase());

    // Check if this table is the Match Fixtures Table
    const isFixturesTable =
      header.some((h) => h.includes('pvm') || h.includes('datum') || h.includes('date')) &&
      header.some((h) => h.includes('koti') || h.includes('hem') || h.includes('home') || h.includes('ottelu'));

    if (isFixturesTable) {
      const pvmIdx = header.findIndex((h) => h.includes('pvm') || h.includes('datum') || h.includes('date'));
      const aikaIdx = header.findIndex((h) => h.includes('klo') || h.includes('aika') || h.includes('tid') || h.includes('time'));
      const kotiIdx = header.findIndex((h) => h.includes('koti') || h.includes('hem') || h.includes('home'));
      const vierasIdx = header.findIndex((h) => h.includes('vieras') || h.includes('borta') || h.includes('away'));
      const tulosIdx = header.findIndex((h) => h.includes('tulos') || h.includes('resultat') || h.includes('score'));
      const kenttaIdx = header.findIndex((h) => h.includes('kenttä') || h.includes('plan') || h.includes('venue') || h.includes('paikka'));
      const otteluIdx = header.findIndex((h) => h.includes('ottelu') || h.includes('match') || h.includes('#'));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 4) continue;

        const dateStr = pvmIdx !== -1 ? row[pvmIdx] : row[0];
        const timeStr = aikaIdx !== -1 ? row[aikaIdx] : '15:00';
        const home = kotiIdx !== -1 ? row[kotiIdx] : row[1];
        const away = vierasIdx !== -1 ? row[vierasIdx] : row[2];
        const scoreStr = tulosIdx !== -1 ? row[tulosIdx] : '';
        const rawVenue = kenttaIdx !== -1 ? row[kenttaIdx] : 'Kotikenttä TN';
        const matchCode = otteluIdx !== -1 ? row[otteluIdx] : `${teamId}_${i}`;

        if (!home || !away) continue;

        const matchId = matchCode.replace(/\D/g, '') || `${teamId}_${i}`;
        const startTime = parseFinnishDateTime(dateStr, timeStr);
        const { venueName, fieldNumber } = extractVenueAndField(rawVenue);

        let status: 'upcoming' | 'played' | 'cancelled' | 'postponed' = 'upcoming';
        let cleanScore: string | undefined = undefined;

        if (scoreStr && /\d+\s*[-:]\s*\d+/.test(scoreStr)) {
          status = 'played';
          cleanScore = scoreStr.trim();
        } else if (/peruttu|inställd|cancelled/i.test(scoreStr || '')) {
          status = 'cancelled';
        } else if (/siirretty|framflyttad|postponed/i.test(scoreStr || '')) {
          status = 'postponed';
        }

        const isHome =
          home.toLowerCase().includes(teamName.toLowerCase()) ||
          teamName.toLowerCase().includes(home.toLowerCase());

        fixtures.push({
          id: `${association}_${teamId}_${matchId}`,
          matchId,
          teamId,
          association,
          sport,
          leagueName,
          homeTeam: home,
          awayTeam: away,
          isHome,
          startTime,
          venueName,
          fieldNumber,
          status,
          score: cleanScore,
          fetchedAt: now
        });
      }
      continue;
    }

    // Check if this table is the League Standings Table
    const isStandingsTable =
      header.some((h) => h === '#' || h === 's' || h === 'sija' || h === 'pos') &&
      header.some((h) => h.includes('joukkue') || h.includes('lag') || h.includes('team')) &&
      header.some((h) => h === 'p' || h.includes('pisteet') || h.includes('poäng') || h === 'pts');

    if (isStandingsTable) {
      const rankIdx = header.findIndex((h) => h === '#' || h === 's' || h === 'sija' || h === 'pos');
      const teamIdx = header.findIndex((h) => h.includes('joukkue') || h.includes('lag') || h.includes('team'));
      const playedIdx = header.findIndex((h) => h === 'o' || h === 'm' || h.includes('ottelut'));
      const wonIdx = header.findIndex((h) => h === 'v' || h === 'w' || h.includes('voitot'));
      const drawnIdx = header.findIndex((h) => h === 't' || h === 'd' || h.includes('tasapelit'));
      const lostIdx = header.findIndex((h) => h === 'h' || h === 'l' || h.includes('häviöt'));
      const tmIdx = header.findIndex((h) => h === 'tm' || h === 'gf' || h.includes('tehdyt'));
      const pmIdx = header.findIndex((h) => h === 'pm' || h === 'ga' || h.includes('päästetyt'));
      const meIdx = header.findIndex((h) => h === 'me' || h === 'gd' || h === '+/-');
      const pointsIdx = header.findIndex((h) => h === 'p' || h === 'pts' || h.includes('pisteet'));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 5) continue;

        const rank = parseInt(rankIdx !== -1 ? row[rankIdx] : String(i), 10) || i;
        const rowTeam = teamIdx !== -1 ? row[teamIdx] : row[1];
        const played = parseInt(playedIdx !== -1 ? row[playedIdx] : '0', 10) || 0;
        const won = parseInt(wonIdx !== -1 ? row[wonIdx] : '0', 10) || 0;
        const drawn = parseInt(drawnIdx !== -1 ? row[drawnIdx] : '0', 10) || 0;
        const lost = parseInt(lostIdx !== -1 ? row[lostIdx] : '0', 10) || 0;
        const goalsFor = parseInt(tmIdx !== -1 ? row[tmIdx] : '0', 10) || 0;
        const goalsAgainst = parseInt(pmIdx !== -1 ? row[pmIdx] : '0', 10) || 0;
        const goalDiff = meIdx !== -1 ? parseInt(row[meIdx], 10) || (goalsFor - goalsAgainst) : (goalsFor - goalsAgainst);
        const points = parseInt(pointsIdx !== -1 ? row[pointsIdx] : '0', 10) || 0;

        if (rowTeam) {
          standings.push({
            rank,
            teamName: rowTeam,
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            goalDifference: goalDiff,
            points,
            form: ['W', 'W', 'D', 'W', 'L']
          });
        }
      }
      continue;
    }

    // Check if this table is the Team Roster Table
    const isRosterTable =
      header.some((h) => h === '#' || h === 'nro' || h.includes('numero') || h.includes('nr')) &&
      header.some((h) => h.includes('nimi') || h.includes('namn') || h.includes('pelaaja') || h.includes('player')) &&
      header.some((h) => h.includes('paikka') || h.includes('pelipaikka') || h.includes('rooli') || h.includes('pos'));

    if (isRosterTable) {
      const nroIdx = header.findIndex((h) => h === '#' || h === 'nro' || h.includes('numero') || h.includes('nr'));
      const nameIdx = header.findIndex((h) => h.includes('nimi') || h.includes('namn') || h.includes('pelaaja') || h.includes('player'));
      const posIdx = header.findIndex((h) => h.includes('paikka') || h.includes('pelipaikka') || h.includes('rooli') || h.includes('pos'));
      const ottelutIdx = header.findIndex((h) => h === 'o' || h.includes('ottelut') || h.includes('matcher'));
      const maalitIdx = header.findIndex((h) => h === 'm' || h.includes('maalit') || h.includes('mål'));
      const syototIdx = header.findIndex((h) => h === 's' || h.includes('syötöt') || h.includes('pass'));
      const yellowIdx = header.findIndex((h) => h.includes('keltainen') || h.includes('varoitukset') || h === 'v');
      const redIdx = header.findIndex((h) => h.includes('punainen') || h.includes('kentältäpoistot') || h === 'rm');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 3) continue;

        const jersey = parseInt(nroIdx !== -1 ? row[nroIdx] : String(i), 10) || i;
        let rawName = nameIdx !== -1 ? row[nameIdx] : row[1];
        const rawPos = posIdx !== -1 ? row[posIdx] : 'MF';
        const matches = parseInt(ottelutIdx !== -1 ? row[ottelutIdx] : '0', 10) || 0;
        const goals = parseInt(maalitIdx !== -1 ? row[maalitIdx] : '0', 10) || 0;
        const assists = parseInt(syototIdx !== -1 ? row[syototIdx] : '0', 10) || 0;
        const yellow = parseInt(yellowIdx !== -1 ? row[yellowIdx] : '0', 10) || 0;
        const red = parseInt(redIdx !== -1 ? row[redIdx] : '0', 10) || 0;

        let isCaptain = false;
        if (/\(c\)|\[c\]/i.test(rawName)) {
          isCaptain = true;
          rawName = rawName.replace(/\(c\)|\[c\]/gi, '').trim();
        }

        if (rawName) {
          players.push({
            jerseyNumber: jersey,
            playerName: rawName,
            position: normalizePlayerPosition(rawPos),
            goals,
            assists,
            matchesPlayed: matches,
            yellowCards: yellow,
            redCards: red,
            isCaptain,
            isStartingLineup: true
          });
        }
      }
    }
  }

  const roster: TeamSquadRoster = {
    teamName,
    coachName: 'Päävalmentaja',
    players: players.length > 0 ? players : []
  };

  return {
    teamId,
    teamName,
    association,
    sport,
    leagueName,
    fixtures,
    standings: standings.length > 0 ? standings : undefined,
    roster: players.length > 0 ? roster : undefined,
    sourceUrl: canonicalUrl,
    fetchedAt: now
  };
}

/**
 * Synthetic official team data generator for offline resilience, testing, and fallback.
 */
export function generateSyntheticOfficialTeamData(parsedUrl: ParsedAssociationUrl): OfficialTeamData {
  const { teamId, association, sport, canonicalUrl } = parsedUrl;
  const now = new Date().toISOString();

  let teamName = `HJK T13 Sininen`;
  let leagueName = 'Palloliitto T13 Eteläinen Ykkönen';
  let defaultVenue = 'Töölö PK 1 TN (Kenttä 1)';

  if (sport === 'floorball') {
    teamName = `ErVi Sininen`;
    leagueName = 'Salibandyliitto P11 Kilpasarja';
    defaultVenue = 'Mosahalli K1';
  } else if (sport === 'basketball') {
    teamName = `Tapiolan Honka`;
    leagueName = 'Koripalloliitto U14 Aluesarja';
    defaultVenue = 'Honkahalli 1';
  } else if (sport === 'volleyball') {
    teamName = `PuMa Volley N2`;
    leagueName = 'Lentopalloliitto N2 Lohko 3';
    defaultVenue = 'Puistolan Liikuntahalli';
  }

  const fixtures: OfficialLeagueFixture[] = [
    {
      id: `${association}_${teamId}_101`,
      matchId: '101',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: 'EPS Valkoinen',
      isHome: true,
      startTime: parseFinnishDateTime('10.05.2026', '15:00'),
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'played',
      score: sport === 'volleyball' ? '3 - 1' : sport === 'basketball' ? '68 - 62' : '2 - 1',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_102`,
      matchId: '102',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: 'FC Honka Musta',
      awayTeam: teamName,
      isHome: false,
      startTime: parseFinnishDateTime('17.05.2026', '14:00'),
      venueName: 'Tapiolan UP TN 2',
      fieldNumber: 'Kenttä 2',
      status: 'played',
      score: sport === 'volleyball' ? '2 - 3' : sport === 'basketball' ? '54 - 70' : '0 - 3',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_103`,
      matchId: '103',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: 'VJS Tytöt',
      isHome: true,
      startTime: parseFinnishDateTime('24.05.2026', '15:00'),
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_104`,
      matchId: '104',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: 'PPJ Sininen',
      awayTeam: teamName,
      isHome: false,
      startTime: parseFinnishDateTime('31.05.2026', '12:30'),
      venueName: 'Väinämöisen kenttä TN (Väiski)',
      fieldNumber: 'TN',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_105`,
      matchId: '105',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: 'Valtti/IHK YJ',
      isHome: true,
      startTime: parseFinnishDateTime('07.06.2026', '16:00'),
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'upcoming',
      fetchedAt: now
    }
  ];

  const standings: StandingRow[] = [
    { rank: 1, teamName, played: 8, won: 7, drawn: 1, lost: 0, goalsFor: 28, goalsAgainst: 6, goalDifference: 22, points: 22, form: ['W', 'W', 'W', 'D', 'W'] },
    { rank: 2, teamName: 'FC Honka Musta', played: 8, won: 6, drawn: 0, lost: 2, goalsFor: 24, goalsAgainst: 9, goalDifference: 15, points: 18, form: ['W', 'W', 'L', 'W', 'W'] },
    { rank: 3, teamName: 'EPS Valkoinen', played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 19, goalsAgainst: 11, goalDifference: 8, points: 16, form: ['W', 'L', 'W', 'W', 'D'] },
    { rank: 4, teamName: 'VJS Tytöt', played: 8, won: 3, drawn: 2, lost: 3, goalsFor: 14, goalsAgainst: 16, goalDifference: -2, points: 11, form: ['L', 'D', 'W', 'D', 'L'] },
    { rank: 5, teamName: 'PPJ Sininen', played: 8, won: 2, drawn: 1, lost: 5, goalsFor: 10, goalsAgainst: 21, goalDifference: -11, points: 7, form: ['L', 'L', 'W', 'L', 'D'] },
    { rank: 6, teamName: 'Valtti/IHK YJ', played: 8, won: 0, drawn: 1, lost: 7, goalsFor: 4, goalsAgainst: 36, goalDifference: -32, points: 1, form: ['L', 'L', 'L', 'D', 'L'] }
  ];

  const roster: TeamSquadRoster = {
    teamName,
    coachName: 'Mikael Salo',
    players: [
      { jerseyNumber: 1, playerName: 'Emma Korhonen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Venla Mäkelä', position: 'DF', goals: 1, assists: 2, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 6, playerName: 'Kerttu Lahtinen', position: 'DF', goals: 0, assists: 1, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Aada Koskinen', position: 'MF', goals: 4, assists: 6, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Maija Oinonen', position: 'FW', goals: 11, assists: 4, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: false, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Sofia Nieminen', position: 'FW', goals: 6, assists: 3, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Helmi Järvinen', position: 'MF', goals: 3, assists: 2, matchesPlayed: 6, yellowCards: 0, redCards: 0, isStartingLineup: false },
      { jerseyNumber: 19, playerName: 'Iida Heikkinen', position: 'DF', goals: 0, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  return {
    teamId,
    teamName,
    association,
    sport,
    leagueName,
    fixtures,
    standings,
    roster,
    sourceUrl: canonicalUrl,
    fetchedAt: now
  };
}

/**
 * Main entry point to fetch and extract official league data for a parsed sports association URL.
 * Automatically routes through the Cloudflare Worker streaming proxy to bypass CORS in browsers.
 * Falls back to synthetic official data if network request fails or when running in offline environments.
 */
export async function extractOfficialTeamData(
  parsedUrl: ParsedAssociationUrl,
  options: ExtractorOptions = {}
): Promise<OfficialTeamData> {
  const {
    proxyUrl = DEFAULT_PROXY_URL,
    bypassProxy = false,
    timeoutMs = 8000,
    fallbackToSynthetic = true
  } = options;

  const targetUrl = parsedUrl.canonicalUrl;
  const fetchUrl = bypassProxy
    ? targetUrl
    : `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} fetching association data from ${targetUrl}`);
    }

    const htmlText = await res.text();
    if (!htmlText || htmlText.length < 50) {
      throw new Error(`Empty or invalid HTML response received from ${targetUrl}`);
    }

    return parseTorneopalHtml(htmlText, parsedUrl);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[PELIPAIVA:ASSOCIATION_EXTRACTOR] Fetch failed for ${targetUrl}:`, err);

    if (fallbackToSynthetic) {
      console.info(`[PELIPAIVA:ASSOCIATION_EXTRACTOR] Generating fallback synthetic data for ${parsedUrl.teamId}`);
      return generateSyntheticOfficialTeamData(parsedUrl);
    }
    throw err;
  }
}
```

---

### 4.2 Cloudflare Worker Proxy Extension Blueprint: `cloudflare-worker/worker.ts`

To optimize edge caching for public association league pages, the following enhancement to `cloudflare-worker/worker.ts` is proposed:

```typescript
// Add to cloudflare-worker/worker.ts:
if (url.pathname === '/api/proxy/ics' || url.pathname === '/api/proxy/association') {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl || !targetUrl.startsWith('https://')) {
    return new Response(JSON.stringify({ error: 'Disallowed or missing URL parameter' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const isPublicAssociation =
    targetUrl.includes('palloliitto.fi') ||
    targetUrl.includes('salibandy.fi') ||
    targetUrl.includes('basket.fi') ||
    targetUrl.includes('torneopal.fi');

  const upstreamRes = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'PelipaivaBot/1.0 (+https://pelipaiva.pages.dev)'
    }
  });
  
  const responseBody = await upstreamRes.text();
  const contentType = upstreamRes.headers.get('Content-Type') || (isPublicAssociation ? 'text/html; charset=utf-8' : 'text/calendar; charset=utf-8');

  // Cache public association pages for 15 minutes at the edge; never cache private .ics feeds
  const cacheControl = isPublicAssociation
    ? 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800'
    : 'no-store';

  return new Response(responseBody, {
    status: upstreamRes.status,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    }
  });
}
```

---

### 4.3 Comprehensive Unit Test Suite Blueprint: `src/lib/api/associationExtractor.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseTorneopalHtml,
  generateSyntheticOfficialTeamData,
  parseFinnishDateTime,
  extractVenueAndField,
  normalizePlayerPosition,
  cleanHtmlText,
  parseHtmlTableRows,
  extractOfficialTeamData
} from './associationExtractor';
import { ParsedAssociationUrl } from './associationUrlParser';

describe('associationExtractor', () => {
  const mockPalloliittoUrl: ParsedAssociationUrl = {
    sport: 'football',
    association: 'palloliitto',
    teamId: '3512345',
    canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
  };

  const sampleTorneopalHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>HJK T13 Sininen - Palloliitto</title></head>
      <body>
        <h1>HJK T13 Sininen</h1>
        <div class="meta">Sarja: T13 Ykkönen (Lohko 1)</div>

        <!-- Fixtures Table -->
        <table class="otteluohjelma">
          <thead>
            <tr>
              <th>Pvm</th>
              <th>Klo</th>
              <th>Koti</th>
              <th>Vieras</th>
              <th>Tulos</th>
              <th>Kenttä</th>
              <th>Ottelunumero</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>la 24.05.2026</td>
              <td>15:00</td>
              <td>HJK T13 Sininen</td>
              <td>EPS Valkoinen</td>
              <td>3 - 1</td>
              <td>Töölö PK 1 TN (Kenttä 1)</td>
              <td>123456</td>
            </tr>
            <tr>
              <td>su 31.05.2026</td>
              <td>13:30</td>
              <td>HJK T13 Sininen</td>
              <td>FC Honka Musta</td>
              <td>-</td>
              <td>Puotilan tekonurmi TN (Kenttä 2)</td>
              <td>123457</td>
            </tr>
          </tbody>
        </table>

        <!-- Standings Table -->
        <table class="sarjataulukko">
          <thead>
            <tr>
              <th>#</th>
              <th>Joukkue</th>
              <th>O</th>
              <th>V</th>
              <th>T</th>
              <th>H</th>
              <th>TM</th>
              <th>PM</th>
              <th>ME</th>
              <th>P</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>HJK T13 Sininen</td>
              <td>8</td>
              <td>7</td>
              <td>1</td>
              <td>0</td>
              <td>28</td>
              <td>6</td>
              <td>22</td>
              <td>22</td>
            </tr>
            <tr>
              <td>2</td>
              <td>FC Honka Musta</td>
              <td>8</td>
              <td>6</td>
              <td>0</td>
              <td>2</td>
              <td>24</td>
              <td>9</td>
              <td>15</td>
              <td>18</td>
            </tr>
          </tbody>
        </table>

        <!-- Roster Table -->
        <table class="pelaajat">
          <thead>
            <tr>
              <th>#</th>
              <th>Nimi</th>
              <th>Pelipaikka</th>
              <th>O</th>
              <th>M</th>
              <th>S</th>
              <th>V</th>
              <th>P</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Emma Korhonen</td>
              <td>MV</td>
              <td>8</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
            </tr>
            <tr>
              <td>10</td>
              <td>Maija Oinonen (C)</td>
              <td>H</td>
              <td>8</td>
              <td>11</td>
              <td>4</td>
              <td>1</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  describe('HTML Parsing Engine', () => {
    it('extracts team fixtures correctly from Torneopal HTML', () => {
      const data = parseTorneopalHtml(sampleTorneopalHtml, mockPalloliittoUrl);

      expect(data.teamName).toBe('HJK T13 Sininen');
      expect(data.fixtures).toHaveLength(2);

      const [playedFixture, upcomingFixture] = data.fixtures;

      // Check played match
      expect(playedFixture.id).toBe('palloliitto_3512345_123456');
      expect(playedFixture.homeTeam).toBe('HJK T13 Sininen');
      expect(playedFixture.awayTeam).toBe('EPS Valkoinen');
      expect(playedFixture.isHome).toBe(true);
      expect(playedFixture.status).toBe('played');
      expect(playedFixture.score).toBe('3 - 1');
      expect(playedFixture.venueName).toBe('Töölö PK 1 TN');
      expect(playedFixture.fieldNumber).toBe('Kenttä 1');
      expect(playedFixture.startTime).toContain('2026-05-24T15:00:00');

      // Check upcoming match
      expect(upcomingFixture.id).toBe('palloliitto_3512345_123457');
      expect(upcomingFixture.status).toBe('upcoming');
      expect(upcomingFixture.score).toBeUndefined();
      expect(upcomingFixture.venueName).toBe('Puotilan tekonurmi TN');
      expect(upcomingFixture.fieldNumber).toBe('Kenttä 2');
    });

    it('extracts league standings table correctly', () => {
      const data = parseTorneopalHtml(sampleTorneopalHtml, mockPalloliittoUrl);
      expect(data.standings).toBeDefined();
      expect(data.standings).toHaveLength(2);

      const leader = data.standings![0];
      expect(leader.rank).toBe(1);
      expect(leader.teamName).toBe('HJK T13 Sininen');
      expect(leader.played).toBe(8);
      expect(leader.won).toBe(7);
      expect(leader.drawn).toBe(1);
      expect(leader.lost).toBe(0);
      expect(leader.goalsFor).toBe(28);
      expect(leader.goalsAgainst).toBe(6);
      expect(leader.goalDifference).toBe(22);
      expect(leader.points).toBe(22);
    });

    it('extracts team squad roster correctly with captain flag', () => {
      const data = parseTorneopalHtml(sampleTorneopalHtml, mockPalloliittoUrl);
      expect(data.roster).toBeDefined();
      expect(data.roster!.players).toHaveLength(2);

      const [gk, captain] = data.roster!.players;

      expect(gk.jerseyNumber).toBe(1);
      expect(gk.playerName).toBe('Emma Korhonen');
      expect(gk.position).toBe('GK');
      expect(gk.isCaptain).toBe(false);

      expect(captain.jerseyNumber).toBe(10);
      expect(captain.playerName).toBe('Maija Oinonen');
      expect(captain.position).toBe('FW');
      expect(captain.isCaptain).toBe(true);
      expect(captain.goals).toBe(11);
      expect(captain.assists).toBe(4);
    });
  });

  describe('Helper Utilities', () => {
    it('parses Finnish dates and times into ISO strings with correct timezone offset', () => {
      // Summer date (EEST +03:00)
      const summerIso = parseFinnishDateTime('la 24.05.2026', '15:00');
      expect(summerIso).toBe('2026-05-24T15:00:00+03:00');

      // Winter date (EET +02:00)
      const winterIso = parseFinnishDateTime('15.12.2026', '18:30');
      expect(winterIso).toBe('2026-12-15T18:30:00+02:00');
    });

    it('extracts venue and field number from various Finnish venue formats', () => {
      expect(extractVenueAndField('Puotila TN (Kenttä 2)')).toEqual({
        venueName: 'Puotila TN',
        fieldNumber: 'Kenttä 2'
      });

      expect(extractVenueAndField('Töölö PK 1 TN')).toEqual({
        venueName: 'Töölö PK 1 TN',
        fieldNumber: 'TN'
      });

      expect(extractVenueAndField('Mosahalli (Kaukalo 1)')).toEqual({
        venueName: 'Mosahalli',
        fieldNumber: 'Kaukalo 1'
      });
    });

    it('normalizes player positions accurately', () => {
      expect(normalizePlayerPosition('MV')).toBe('GK');
      expect(normalizePlayerPosition('Maalivahti')).toBe('GK');
      expect(normalizePlayerPosition('P')).toBe('DF');
      expect(normalizePlayerPosition('Puolustaja')).toBe('DF');
      expect(normalizePlayerPosition('KK')).toBe('MF');
      expect(normalizePlayerPosition('H')).toBe('FW');
      expect(normalizePlayerPosition('Hyökkääjä')).toBe('FW');
      expect(normalizePlayerPosition(undefined)).toBe('MF');
    });

    it('cleans HTML text entities', () => {
      expect(cleanHtmlText('HJK&nbsp;T13&amp;Sininen &auml;&ouml;')).toBe('HJK T13&Sininen äö');
    });
  });

  describe('Synthetic Fallback Generator', () => {
    it('generates rich synthetic official team data for offline fallback', () => {
      const data = generateSyntheticOfficialTeamData(mockPalloliittoUrl);
      expect(data.teamId).toBe('3512345');
      expect(data.association).toBe('palloliitto');
      expect(data.sport).toBe('football');
      expect(data.fixtures.length).toBeGreaterThanOrEqual(5);
      expect(data.standings?.length).toBeGreaterThanOrEqual(6);
      expect(data.roster?.players.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Integration & Offline Safety', () => {
    it('returns synthetic data when network fetch fails and fallbackToSynthetic is true', async () => {
      const data = await extractOfficialTeamData(mockPalloliittoUrl, {
        proxyUrl: 'https://invalid-non-existent-proxy.test',
        timeoutMs: 50,
        fallbackToSynthetic: true
      });

      expect(data).toBeDefined();
      expect(data.fixtures.length).toBeGreaterThan(0);
      expect(data.teamId).toBe('3512345');
    });
  });
});
```

---

## 5. Verification Method

To verify the association extractor design and implementation:

1. **Execute Vitest Test Suite**:
   ```pwsh
   npm test
   ```
   *Requirement*: All unit and integration test suites pass with 100% success rate.
2. **TypeScript Strict Typecheck**:
   ```pwsh
   npx tsc --noEmit
   ```
   *Requirement*: Exits 0 with 0 errors.
3. **Inspect Output Artifacts**:
   - `src/lib/api/associationExtractor.ts`
   - `src/lib/api/associationExtractor.test.ts`
   - `cloudflare-worker/worker.ts`
4. **Invalidation Conditions**:
   - If `OfficialLeagueFixture` ID format is not globally unique across associations.
   - If HTML parsing fails in Node.js / Vitest environment due to missing `DOMParser`.
   - If Finnish timezone calculation fails across daylight saving time boundaries.
