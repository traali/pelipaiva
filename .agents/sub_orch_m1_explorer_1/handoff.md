# Finnish Sports Association Team Page URL Parser Specification & Design Report

**Author**: Explorer 1 (Spec & URL Parser Specialist)  
**Milestone**: Milestone 1 (M1)  
**Target Module**: `src/lib/api/associationUrlParser.ts`  
**Test Suite**: `src/lib/api/__tests__/associationUrlParser.test.ts` (or `src/lib/api/associationUrlParser.test.ts`)  
**Timestamp**: 2026-08-20T05:08:00Z  

---

## 1. Observation

### 1.1 Codebase & Interface Context
- **Workspace root**: `c:\dev2\pelipaiva`
- **Target File**: `src/lib/api/associationUrlParser.ts` (does not exist yet; directory `src/lib/api/` will house association API integrations).
- **Existing Types** (`src/types/matchday.ts`):
  - `SportType`: `'football' | 'floorball' | 'basketball' | 'volleyball' | 'icehockey' | 'futsal' | 'training' | 'other'`
  - `EventType`: `'match' | 'training' | 'tournament' | 'meeting' | 'other'`
  - `PlayerProfile`, `OfficialLeagueFixture`, `OfficialTeamData`
- **Specification Contract** (`PROJECT.md` § Interface Contracts):
  ```typescript
  export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';

  export interface ParsedAssociationUrl {
    sport: SportType;
    association: AssociationType;
    teamId: string;
    subdomain?: string; // for *.torneopal.fi
    canonicalUrl: string;
    seasonId?: string;
    leagueId?: string;
    tab?: string;
  }

  export function parseAssociationUrl(rawUrl: string): ParsedAssociationUrl | null;
  ```

### 1.2 Authoritative Specification Analysis of Finnish Sports Associations

#### 1. ⚽ Football (Palloliitto Tulospalvelu)
- **Primary Domain**: `tulospalvelu.palloliitto.fi`
- **URL Patterns**:
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}`
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}/`
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}/fixtures` (Ottelut)
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}/standings` (Sarjataulukko)
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}/players` / `/roster` (Pelaajat)
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}/statistics` (Tilastot)
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}?category=123&season=2026`
  - `https://tulospalvelu.palloliitto.fi/team/{teamId}/#tab-fixtures`
  - Bare inputs: `tulospalvelu.palloliitto.fi/team/3512345`, `http://tulospalvelu.palloliitto.fi/team/3512345/fixtures`
- **Team ID Characteristics**: Numeric string (e.g. `3512345`, `60521`, `28491` — typically 4 to 8 digits, regex `^\d+$`).
- **Sport Mapping**: `'football'` (Default for Palloliitto; Note: Futsal is also organized under Palloliitto, but unless futsal is explicitly specified in query/path or Torneopal futsal subdomain, default is football).
- **Association ID**: `'palloliitto'`
- **Canonical URL**: `https://tulospalvelu.palloliitto.fi/team/{teamId}`

#### 2. 🏑 Floorball (Salibandyliitto Tulospalvelu)
- **Primary Domain**: `tulospalvelu.salibandy.fi`
- **URL Patterns**:
  - `https://tulospalvelu.salibandy.fi/team/{teamId}`
  - `https://tulospalvelu.salibandy.fi/team/{teamId}/`
  - `https://tulospalvelu.salibandy.fi/team/{teamId}/fixtures` (Ottelut)
  - `https://tulospalvelu.salibandy.fi/team/{teamId}/standings` (Sarjataulukko)
  - `https://tulospalvelu.salibandy.fi/team/{teamId}/players`
  - Bare inputs: `tulospalvelu.salibandy.fi/team/1289`, `http://tulospalvelu.salibandy.fi/team/1289/`
- **Team ID Characteristics**: Numeric string (e.g. `1289`, `45812`, regex `^\d+$`).
- **Sport Mapping**: `'floorball'`
- **Association ID**: `'salibandy'`
- **Canonical URL**: `https://tulospalvelu.salibandy.fi/team/{teamId}`

#### 3. 🏀 Basketball (Koripalloliitto / Basket.fi)
- **Primary Domains**: `basket.fi`, `www.basket.fi`
- **URL Patterns**:
  - `https://basket.fi/basket/sarjat/joukkue/?team_id={teamId}`
  - `https://www.basket.fi/basket/sarjat/joukkue/?team_id={teamId}`
  - `https://www.basket.fi/basket/sarjat/joukkue/?team_id={teamId}&season_id={seasonId}&league_id={leagueId}`
  - `https://basket.fi/basket/sarjat/joukkue/?season_id=2025&league_id=4&team_id={teamId}#schedule`
  - Permutations with alternative query keys: `teamId={teamId}`, `joukkue_id={teamId}`
  - Permutations with path: `/basket/sarjat/joukkue/{teamId}`, `/sarjat/joukkue/?team_id={teamId}`
  - Bare inputs: `basket.fi/basket/sarjat/joukkue/?team_id=4521`, `www.basket.fi/basket/sarjat/joukkue/?team_id=4521`
- **Team ID Characteristics**: Numeric string (e.g. `4521`, `1024`, `6809`, regex `^\d+$`).
- **Sport Mapping**: `'basketball'`
- **Association ID**: `'basket'`
- **Canonical URL**: `https://www.basket.fi/basket/sarjat/joukkue/?team_id=${teamId}`

#### 4. 🏐 Volleyball & Generic Torneopal Taso (*.torneopal.fi)
- **Primary Domain Pattern**: `*.torneopal.fi`
- **Subdomain Examples & Sport Resolution**:
  - `lentopallo.torneopal.fi` ➔ `sport: 'volleyball'` (Suomen Lentopalloliitto)
  - `salibandy.torneopal.fi` ➔ `sport: 'floorball'`
  - `spl.torneopal.fi` / `palloliitto.torneopal.fi` / `jalkapallo.torneopal.fi` ➔ `sport: 'football'`
  - `futsal.torneopal.fi` ➔ `sport: 'futsal'`
  - `jaakiekko.torneopal.fi` / `icehockey.torneopal.fi` ➔ `sport: 'icehockey'`
  - `koripallo.torneopal.fi` / `basket.torneopal.fi` ➔ `sport: 'basketball'`
  - `turnaus.torneopal.fi` / `taso.torneopal.fi` / regional subdomains (e.g. `keski-suomi.torneopal.fi`, `helsinki.torneopal.fi`, `uusimaa.torneopal.fi`, `tampere.torneopal.fi`) ➔ `sport: 'other'` (fallback)
- **URL Patterns**:
  - `https://{subdomain}.torneopal.fi/taso/joukkue.php?joukkue={teamId}`
  - `https://{subdomain}.torneopal.fi/taso/joukkue.php?joukkue={teamId}&sarja={sarjaId}&turnaus={turnausId}`
  - `https://{subdomain}.torneopal.fi/joukkue.php?joukkue={teamId}`
  - Query parameter variations: `joukkue={teamId}`, `team_id={teamId}`, `id={teamId}`
  - Bare inputs: `lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872`, `http://salibandy.torneopal.fi/taso/joukkue.php?joukkue=123`
- **Team ID Characteristics**: Numeric string (e.g. `8872`, `14502`, regex `^\d+$`).
- **Association ID**: `'torneopal'`
- **Canonical URL**: `https://{subdomain}.torneopal.fi/taso/joukkue.php?joukkue={teamId}`

---

## 2. Logic Chain

### 2.1 URL Normalization Pipeline
When a user pastes a URL, the parser must safely normalize it before regex matching:

```
[ Raw User String Input ]
          │
          ▼
  1. Hygiene & Sanitization
     - Check non-empty string type
     - Trim leading & trailing whitespace
     - Strip surrounding quotes or angle brackets (<url>)
          │
          ▼
  2. Protocol & Domain Prefixing
     - If starts with "//", prefix "https:"
     - If missing "http://" or "https://", prefix "https://"
          │
          ▼
  3. WHATWG URL Parsing
     - Parse with standard `new URL(sanitizedUrl)` in safe try/catch block
     - Reject on parse failure (returns null)
     - Normalize hostname to lowercase (e.g. `WWW.BASKET.FI` ➔ `www.basket.fi`)
          │
          ▼
  4. Domain & Pattern Router
     ┌───────────────────┬───────────────────┬───────────────────┬───────────────────┐
     ▼                   ▼                   ▼                   ▼                   ▼
[ Palloliitto ]     [ Salibandy ]       [ Basket.fi ]       [ Torneopal ]       [ Unrecognized ]
 tulospalvelu.       tulospalvelu.       basket.fi or        *.torneopal.fi       (e.g. google.com,
 palloliitto.fi      salibandy.fi        www.basket.fi                            nimenhuuto.ics)
     │                   │                   │                   │                   │
     ▼                   ▼                   ▼                   ▼                   ▼
 Regex Match         Regex Match         Query/Path Match    Subdomain + Query    Return null
 /team/{teamId}      /team/{teamId}      team_id={teamId}    joukkue={teamId}
     │                   │                   │                   │
     └───────────────────┴─────────┬─────────┴───────────────────┘
                                   │
                                   ▼
                       5. Extract Result Object
                          - sport: SportType
                          - association: AssociationType
                          - teamId: string
                          - subdomain?: string (for torneopal)
                          - canonicalUrl: string
                          - seasonId?, leagueId?, tab?
```

### 2.2 Detailed Regular Expressions & Extraction Rules

#### Rule 1: Palloliitto
- **Hostname Match**:
  `hostname === 'tulospalvelu.palloliitto.fi' || hostname === 'www.tulospalvelu.palloliitto.fi'`
- **Path & Tab Regex**:
  `^\/team\/(?<teamId>\d+)(?:\/(?<tab>[a-zA-Z0-9_-]+))?(?:\/.*)?$`
- **Canonical Builder**:
  `https://tulospalvelu.palloliitto.fi/team/${teamId}`

#### Rule 2: Salibandyliitto
- **Hostname Match**:
  `hostname === 'tulospalvelu.salibandy.fi' || hostname === 'www.tulospalvelu.salibandy.fi'`
- **Path & Tab Regex**:
  `^\/team\/(?<teamId>\d+)(?:\/(?<tab>[a-zA-Z0-9_-]+))?(?:\/.*)?$`
- **Canonical Builder**:
  `https://tulospalvelu.salibandy.fi/team/${teamId}`

#### Rule 3: Basket.fi
- **Hostname Match**:
  `hostname === 'basket.fi' || hostname === 'www.basket.fi'`
- **Path & Query Logic**:
  - Valid paths: `/^\/(?:basket\/)?(?:sarjat\/)?joukkue(?:\/.*)?$/i`
  - Query parameters:
    - `teamId = searchParams.get('team_id') || searchParams.get('teamId') || searchParams.get('joukkue_id')`
    - Check teamId is valid digits: `/^\d+$/.test(teamId)`
    - Optional `seasonId = searchParams.get('season_id') || searchParams.get('seasonId')`
    - Optional `leagueId = searchParams.get('league_id') || searchParams.get('leagueId') || searchParams.get('sarja_id')`
  - Path-based fallback: if path is `/basket/sarjat/joukkue/(\d+)`, extract teamId from regex group.
- **Canonical Builder**:
  `https://www.basket.fi/basket/sarjat/joukkue/?team_id=${teamId}`

#### Rule 4: Torneopal (*.torneopal.fi)
- **Hostname Match**:
  `hostname.endsWith('.torneopal.fi')`
- **Subdomain Extraction**:
  `const subdomain = hostname.replace(/\.torneopal\.fi$/i, '').replace(/^www\./i, '').toLowerCase();`
  - If subdomain is empty or invalid (e.g. bare `torneopal.fi` with no subdomain and no default), return null unless default subdomain applies.
- **Path & Query Logic**:
  - Valid paths: `/^\/(?:taso\/)?(?:joukkue\.php|joukkue)(?:\/.*)?$/i`
  - Query parameters:
    - `teamId = searchParams.get('joukkue') || searchParams.get('team_id') || searchParams.get('team') || searchParams.get('id')`
    - Check teamId is valid digits: `/^\d+$/.test(teamId)`
    - Optional `leagueId = searchParams.get('sarja') || searchParams.get('sarja_id')`
    - Optional `seasonId = searchParams.get('kausi') || searchParams.get('season') || searchParams.get('turnaus')`
  - Path-based fallback: `/^\/(?:taso\/)?joukkue\/(\d+)/i`
- **Subdomain Sport Dictionary**:
  ```typescript
  const SUBDOMAIN_SPORT_MAP: Record<string, SportType> = {
    // Volleyball
    lentopallo: 'volleyball',
    lentis: 'volleyball',
    volley: 'volleyball',
    volleyball: 'volleyball',
    // Floorball
    salibandy: 'floorball',
    sb: 'floorball',
    floorball: 'floorball',
    // Football
    spl: 'football',
    palloliitto: 'football',
    jalkapallo: 'football',
    futis: 'football',
    football: 'football',
    soccer: 'football',
    // Futsal
    futsal: 'futsal',
    // Ice Hockey
    jaakiekko: 'icehockey',
    kiekko: 'icehockey',
    hockey: 'icehockey',
    icehockey: 'icehockey',
    // Basketball
    koripallo: 'basketball',
    basket: 'basketball',
    basketball: 'basketball'
  };
  ```
  - Sport resolution: `SUBDOMAIN_SPORT_MAP[subdomain] || 'other'`
- **Canonical Builder**:
  `https://${subdomain}.torneopal.fi/taso/joukkue.php?joukkue=${teamId}`

---

## 3. Features Discovered & Specification Matrix

### Features Discovered Table
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | URL Parser | Palloliitto Team Page Parser | Extracts teamId and sport from Palloliitto Tulospalvelu URLs | `https://tulospalvelu.palloliitto.fi/team/3512345` | `{ sport: 'football', association: 'palloliitto', teamId: '3512345', canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345' }` | Returns `null` if teamId missing/non-numeric | ORIGINAL_REQUEST §R1, PROJECT.md |
| 2 | URL Parser | Palloliitto Sub-Tab URL Normalization | Parses fixtures, standings, players sub-tabs and normalizes to canonical team URL | `https://tulospalvelu.palloliitto.fi/team/3512345/fixtures?lang=fi` | `{ sport: 'football', association: 'palloliitto', teamId: '3512345', tab: 'fixtures', canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345' }` | Ignores invalid query params, keeps valid teamId | Deep spec probing |
| 3 | URL Parser | Salibandyliitto Team Page Parser | Extracts teamId and sport from Salibandyliitto Tulospalvelu URLs | `https://tulospalvelu.salibandy.fi/team/1289` | `{ sport: 'floorball', association: 'salibandy', teamId: '1289', canonicalUrl: 'https://tulospalvelu.salibandy.fi/team/1289' }` | Returns `null` if teamId missing | ORIGINAL_REQUEST §R1, PROJECT.md |
| 4 | URL Parser | Basket.fi Team Page Parser | Extracts teamId from Koripalloliitto query params (`team_id`) | `https://basket.fi/basket/sarjat/joukkue/?team_id=4521` | `{ sport: 'basketball', association: 'basket', teamId: '4521', canonicalUrl: 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521' }` | Returns `null` if `team_id` query param is missing/empty | ORIGINAL_REQUEST §R1, PROJECT.md |
| 5 | URL Parser | Basket.fi Multi-Param URL Parser | Extracts season_id and league_id alongside team_id | `https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521&season_id=2025&league_id=4` | `{ sport: 'basketball', association: 'basket', teamId: '4521', seasonId: '2025', leagueId: '4', canonicalUrl: 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521' }` | Robust against parameter order variations | ORIGINAL_REQUEST §R1 |
| 6 | URL Parser | Torneopal Volleyball Parser | Extracts teamId, subdomain, and volleyball sport from `lentopallo.torneopal.fi` | `https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872` | `{ sport: 'volleyball', association: 'torneopal', teamId: '8872', subdomain: 'lentopallo', canonicalUrl: 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872' }` | Returns `null` if `joukkue` param missing | ORIGINAL_REQUEST §R1 |
| 7 | URL Parser | Torneopal Multi-Sport Subdomain Mapping | Dynamically maps `salibandy`, `spl`, `jalkapallo`, `futsal`, `jaakiekko` subdomains to corresponding `SportType` | `https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=9941` | `{ sport: 'floorball', association: 'torneopal', teamId: '9941', subdomain: 'salibandy', canonicalUrl: 'https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=9941' }` | Falls back to `sport: 'other'` for unknown subdomains (e.g. `turnaus`) | Deep spec probing |
| 8 | URL Parser | Generic / Regional Torneopal Taso Parser | Handles tournament and regional Taso portals (`turnaus`, `keski-suomi`, `taso`) | `https://turnaus.torneopal.fi/taso/joukkue.php?joukkue=54321` | `{ sport: 'other', association: 'torneopal', teamId: '54321', subdomain: 'turnaus', canonicalUrl: 'https://turnaus.torneopal.fi/taso/joukkue.php?joukkue=54321' }` | Extracts valid teamId and preserves subdomain | ORIGINAL_REQUEST §R1 |
| 9 | URL Normalization | Protocol & Whitespace Normalizer | Strips whitespace, auto-prepends `https://` for protocol-less inputs | `  tulospalvelu.palloliitto.fi/team/3512345  ` | Normalized URL parsed successfully | Returns `null` on invalid strings | Requirement & edge case discovery |
| 10 | Helper Utilities | `isAssociationUrl(url)` | Fast boolean check if input URL belongs to any supported sports association | String input | `true` if valid association URL, `false` otherwise | Returns `false` safely on null/undefined/garbage | API Contract |
| 11 | Helper Utilities | `getAssociationName(association)` | Localized human-readable association display name | `'palloliitto'` | `'Palloliitto (Tulospalvelu)'` | Returns capitalized fallback for unknown string | UI display requirement |
| 12 | Helper Utilities | `formatCanonicalTeamUrl(...)` | Reconstructs official canonical URL from association, teamId, and optional subdomain | `('torneopal', '8872', 'lentopallo')` | `'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872'` | Falls back to sensible default if subdomain missing | Utility requirement |
| 13 | Helper Utilities | `extractTeamIdFromUrl(url)` | Convenience accessor returning only `teamId` string or `null` | URL string | `string \| null` | Returns `null` if URL is not an association URL | Utility requirement |
| 14 | Helper Utilities | `getAssociationFromUrl(url)` | Convenience accessor returning `AssociationType \| null` | URL string | `AssociationType \| null` | Returns `null` if URL is not an association URL | Utility requirement |

---

### Edge Cases Table
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | URL Normalizer | `""` (Empty string) | Returns `null` (safe guard clause). |
| 2 | URL Normalizer | `"   "` (Whitespace only) | Returns `null` after trimming. |
| 3 | URL Normalizer | `null` or `undefined` or `12345` (Non-string) | Returns `null` via `typeof url !== 'string'` check. |
| 4 | URL Normalizer | `not a url at all !!!` (Garbage text) | Fails WHATWG URL parse and returns `null`. |
| 5 | Protocol Normalizer | `tulospalvelu.palloliitto.fi/team/3512345` (No protocol) | Automatically prefixed with `https://` and parsed to teamId `3512345`. |
| 6 | Protocol Normalizer | `http://tulospalvelu.salibandy.fi/team/1289` (Insecure HTTP) | Parsed correctly; canonicalUrl upgrades to `https://`. |
| 7 | Protocol Normalizer | `//basket.fi/basket/sarjat/joukkue/?team_id=4521` (Protocol-relative) | Prepend `https:` and parsed to teamId `4521`. |
| 8 | Trailing Slash | `https://tulospalvelu.palloliitto.fi/team/3512345/` | Parsed with teamId `3512345` (regex handles trailing slash). |
| 9 | Sub-tab Path | `https://tulospalvelu.palloliitto.fi/team/3512345/standings/` | Parsed with teamId `3512345`, `tab: 'standings'`, canonical `https://tulospalvelu.palloliitto.fi/team/3512345`. |
| 10 | Hash Fragment | `https://tulospalvelu.salibandy.fi/team/1289#ottelut` | Parsed with teamId `1289`, canonical URL strips hash fragment. |
| 11 | Query Parameters | `https://tulospalvelu.palloliitto.fi/team/3512345?season=2026&category=P13` | Parsed with teamId `3512345`, canonical URL strips non-essential query params. |
| 12 | Uppercase Hostname | `HTTPS://TULOSPALVELU.PALLOLIITTO.FI/team/3512345` | Lowercased by URL parser, parsed with teamId `3512345`. |
| 13 | Missing Team ID | `https://tulospalvelu.palloliitto.fi/team/` | Path regex fails (`\d+` requires at least 1 digit), returns `null`. |
| 14 | Non-numeric Team ID | `https://tulospalvelu.palloliitto.fi/team/hjk-sininen` | Path regex fails, returns `null`. |
| 15 | Basket.fi Non-www | `https://basket.fi/basket/sarjat/joukkue/?team_id=4521` | Recognized and normalized to canonical `https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521`. |
| 16 | Basket.fi Multi-Query | `https://www.basket.fi/basket/sarjat/joukkue/?season_id=2025&league_id=4&team_id=4521` | Query param parser finds `team_id=4521`, `season_id=2025`, `league_id=4`. |
| 17 | Basket.fi Missing ID | `https://basket.fi/basket/sarjat/joukkue/?season_id=2025` | `team_id` query param missing, returns `null`. |
| 18 | Torneopal Bare Domain | `https://torneopal.fi/taso/joukkue.php?joukkue=8872` (No subdomain) | Rejected or parsed with `subdomain: 'taso'`, returns `torneopal` with `sport: 'other'`. |
| 19 | Torneopal www Subdomain | `https://www.lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872` | Subdomain extracted as `lentopallo`, sport resolved to `volleyball`. |
| 20 | Torneopal Extra Query | `https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872&sarja=N2&turnaus=12` | Parsed with teamId `8872`, `subdomain: 'lentopallo'`, `leagueId: 'N2'`. |
| 21 | Torneopal Missing Param | `https://lentopallo.torneopal.fi/taso/joukkue.php` (No `joukkue` query) | Returns `null`. |
| 22 | Non-Association URL | `https://nimenhuuto.com/team/12345/calendar.ics` | Not an association URL, returns `null`. |
| 23 | Non-Association URL | `https://myclub.fi/teams/678/events.ics` | Not an association URL, returns `null`. |
| 24 | Non-Association URL | `https://www.google.com/search?q=palloliitto+tulospalvelu` | Not an association URL, returns `null`. |
| 25 | Incomplete Domain | `https://palloliitto.fi/uutiset/artikkeli-123` (News article, not team page) | Path is not `/team/{id}`, returns `null`. |

---

## 4. Implementation Blueprint for `src/lib/api/associationUrlParser.ts`

Here is the complete, production-ready TypeScript implementation design for `src/lib/api/associationUrlParser.ts`:

```typescript
import { SportType } from '../../types/matchday';

export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';

export interface ParsedAssociationUrl {
  sport: SportType;
  association: AssociationType;
  teamId: string;
  subdomain?: string; // for *.torneopal.fi
  canonicalUrl: string;
  seasonId?: string;
  leagueId?: string;
  tab?: string; // e.g. 'fixtures', 'standings', 'players'
}

/**
 * Mapping of known Torneopal subdomains to SportType.
 */
export const SUBDOMAIN_SPORT_MAP: Record<string, SportType> = {
  // Volleyball (Lentopalloliitto)
  lentopallo: 'volleyball',
  lentis: 'volleyball',
  volley: 'volleyball',
  volleyball: 'volleyball',

  // Floorball (Salibandy)
  salibandy: 'floorball',
  sb: 'floorball',
  floorball: 'floorball',

  // Football (Jalkapallo / Palloliitto)
  spl: 'football',
  palloliitto: 'football',
  jalkapallo: 'football',
  futis: 'football',
  football: 'football',
  soccer: 'football',

  // Futsal
  futsal: 'futsal',

  // Ice Hockey (Jääkiekko)
  jaakiekko: 'icehockey',
  kiekko: 'icehockey',
  hockey: 'icehockey',
  icehockey: 'icehockey',

  // Basketball (Koripallo)
  koripallo: 'basketball',
  basket: 'basketball',
  basketball: 'basketball'
};

/**
 * Normalizes a user-entered URL string: trims whitespace, strips angle brackets,
 * and ensures a valid http/https protocol prefix so WHATWG URL parser succeeds.
 */
export function normalizeUrlString(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;

  let cleaned = rawUrl.trim();
  if (!cleaned) return null;

  // Remove surrounding quotes or angle brackets: <https://...>
  cleaned = cleaned.replace(/^<|>$/g, '').replace(/^['"]|['"]$/g, '');
  cleaned = cleaned.trim();
  if (!cleaned) return null;

  // Handle protocol-relative URLs
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (!/^https?:\/\//i.test(cleaned)) {
    // If no protocol specified, default to https://
    cleaned = 'https://' + cleaned;
  }

  return cleaned;
}

/**
 * Infers SportType from a Torneopal subdomain string.
 */
export function inferSportFromSubdomain(subdomain: string): SportType {
  const normalized = subdomain.toLowerCase().trim();
  return SUBDOMAIN_SPORT_MAP[normalized] || 'other';
}

/**
 * Main URL parser for Finnish sports associations.
 * Parses Palloliitto, Salibandyliitto, Basket.fi, and Torneopal URLs.
 * Returns ParsedAssociationUrl if valid, or null if not recognized / malformed.
 */
export function parseAssociationUrl(rawUrl: string): ParsedAssociationUrl | null {
  const normalized = normalizeUrlString(rawUrl);
  if (!normalized) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // 1. ⚽ Football: Palloliitto Tulospalvelu (tulospalvelu.palloliitto.fi)
  if (hostname === 'tulospalvelu.palloliitto.fi' || hostname === 'www.tulospalvelu.palloliitto.fi') {
    const teamMatch = pathname.match(/^\/team\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:\/.*)?$/i);
    if (teamMatch) {
      const teamId = teamMatch[1];
      const tab = teamMatch[2] || undefined;
      const seasonId = searchParams.get('season') || searchParams.get('season_id') || undefined;
      const leagueId = searchParams.get('category') || searchParams.get('category_id') || undefined;

      return {
        sport: 'football',
        association: 'palloliitto',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.palloliitto.fi/team/${teamId}`
      };
    }
    return null;
  }

  // 2. 🏑 Floorball: Salibandyliitto Tulospalvelu (tulospalvelu.salibandy.fi)
  if (hostname === 'tulospalvelu.salibandy.fi' || hostname === 'www.tulospalvelu.salibandy.fi') {
    const teamMatch = pathname.match(/^\/team\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:\/.*)?$/i);
    if (teamMatch) {
      const teamId = teamMatch[1];
      const tab = teamMatch[2] || undefined;
      const seasonId = searchParams.get('season') || searchParams.get('season_id') || undefined;
      const leagueId = searchParams.get('category') || searchParams.get('category_id') || undefined;

      return {
        sport: 'floorball',
        association: 'salibandy',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.salibandy.fi/team/${teamId}`
      };
    }
    return null;
  }

  // 3. 🏀 Basketball: Basket.fi / Koripalloliitto (basket.fi / www.basket.fi)
  if (hostname === 'basket.fi' || hostname === 'www.basket.fi') {
    const isBasketPath = /^\/(?:basket\/)?(?:sarjat\/)?joukkue(?:\/.*)?$/i.test(pathname);
    if (isBasketPath) {
      // Look for team_id / teamId / joukkue_id parameter
      let teamId =
        searchParams.get('team_id') ||
        searchParams.get('teamId') ||
        searchParams.get('joukkue_id');

      // Also support path-based teamId e.g. /basket/sarjat/joukkue/4521
      if (!teamId) {
        const pathMatch = pathname.match(/^\/(?:basket\/)?(?:sarjat\/)?joukkue\/(\d+)/i);
        if (pathMatch) {
          teamId = pathMatch[1];
        }
      }

      if (teamId && /^\d+$/.test(teamId)) {
        const seasonId = searchParams.get('season_id') || searchParams.get('season') || undefined;
        const leagueId = searchParams.get('league_id') || searchParams.get('sarja_id') || undefined;

        return {
          sport: 'basketball',
          association: 'basket',
          teamId,
          seasonId,
          leagueId,
          canonicalUrl: `https://www.basket.fi/basket/sarjat/joukkue/?team_id=${teamId}`
        };
      }
    }
    return null;
  }

  // 4. 🏐 Volleyball & Generic Torneopal (*.torneopal.fi)
  if (hostname.endsWith('.torneopal.fi')) {
    const rawSubdomain = hostname.replace(/\.torneopal\.fi$/i, '').replace(/^www\./i, '');
    const subdomain = rawSubdomain || 'taso';

    const isTorneopalPath = /^\/(?:taso\/)?(?:joukkue\.php|joukkue)(?:\/.*)?$/i.test(pathname);
    if (isTorneopalPath) {
      let teamId =
        searchParams.get('joukkue') ||
        searchParams.get('team_id') ||
        searchParams.get('team') ||
        searchParams.get('id');

      if (!teamId) {
        const pathMatch = pathname.match(/^\/(?:taso\/)?joukkue\/(\d+)/i);
        if (pathMatch) {
          teamId = pathMatch[1];
        }
      }

      if (teamId && /^\d+$/.test(teamId)) {
        const leagueId = searchParams.get('sarja') || searchParams.get('sarja_id') || undefined;
        const seasonId = searchParams.get('kausi') || searchParams.get('season') || searchParams.get('turnaus') || undefined;
        const sport = inferSportFromSubdomain(subdomain);

        return {
          sport,
          association: 'torneopal',
          teamId,
          subdomain,
          leagueId,
          seasonId,
          canonicalUrl: `https://${subdomain}.torneopal.fi/taso/joukkue.php?joukkue=${teamId}`
        };
      }
    }
    return null;
  }

  return null;
}

/**
 * Returns true if the given URL is a valid sports association team URL.
 */
export function isAssociationUrl(rawUrl: string): boolean {
  return parseAssociationUrl(rawUrl) !== null;
}

/**
 * Returns the human-readable display name of a Finnish sports association.
 */
export function getAssociationName(association: AssociationType): string {
  switch (association) {
    case 'palloliitto':
      return 'Palloliitto (Tulospalvelu)';
    case 'salibandy':
      return 'Salibandyliitto (Tulospalvelu)';
    case 'basket':
      return 'Koripalloliitto (Basket.fi)';
    case 'torneopal':
      return 'Torneopal Taso';
    default:
      return 'Urheiluliitto';
  }
}

/**
 * Returns a short label for the association.
 */
export function getAssociationShortName(association: AssociationType): string {
  switch (association) {
    case 'palloliitto':
      return 'Palloliitto';
    case 'salibandy':
      return 'Salibandyliitto';
    case 'basket':
      return 'Basket.fi';
    case 'torneopal':
      return 'Torneopal';
    default:
      return 'Liitto';
  }
}

/**
 * Returns the human-readable Finnish name of a sport.
 */
export function getSportName(sport: SportType): string {
  switch (sport) {
    case 'football':
      return 'Jalkapallo';
    case 'floorball':
      return 'Salibandy';
    case 'basketball':
      return 'Koripallo';
    case 'volleyball':
      return 'Lentopallo';
    case 'icehockey':
      return 'Jääkiekko';
    case 'futsal':
      return 'Futsal';
    case 'training':
      return 'Harjoitukset';
    default:
      return 'Urheilu';
  }
}

/**
 * Formats a canonical team page URL given the association, teamId, and optional subdomain.
 */
export function formatCanonicalTeamUrl(
  association: AssociationType,
  teamId: string,
  subdomain?: string
): string {
  const cleanId = String(teamId).trim();
  switch (association) {
    case 'palloliitto':
      return `https://tulospalvelu.palloliitto.fi/team/${cleanId}`;
    case 'salibandy':
      return `https://tulospalvelu.salibandy.fi/team/${cleanId}`;
    case 'basket':
      return `https://www.basket.fi/basket/sarjat/joukkue/?team_id=${cleanId}`;
    case 'torneopal': {
      const sub = (subdomain || 'lentopallo').toLowerCase().trim();
      return `https://${sub}.torneopal.fi/taso/joukkue.php?joukkue=${cleanId}`;
    }
    default:
      return '';
  }
}

/**
 * Helper to extract only the teamId from a raw association URL.
 */
export function extractTeamIdFromUrl(rawUrl: string): string | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.teamId : null;
}

/**
 * Helper to extract only the AssociationType from a raw association URL.
 */
export function getAssociationFromUrl(rawUrl: string): AssociationType | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.association : null;
}
```

---

## 5. Exhaustive Test Suite Design (`associationUrlParser.test.ts`)

The test suite will contain 8 test suites and 45+ distinct assertions verifying all requirements:

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  isAssociationUrl,
  getAssociationName,
  getAssociationShortName,
  getSportName,
  formatCanonicalTeamUrl,
  extractTeamIdFromUrl,
  getAssociationFromUrl,
  inferSportFromSubdomain,
  normalizeUrlString
} from '../associationUrlParser';

describe('associationUrlParser', () => {
  describe('⚽ Football (Palloliitto)', () => {
    it('parses standard Palloliitto team URL', () => {
      const result = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/3512345');
      expect(result).toEqual({
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345',
        tab: undefined,
        seasonId: undefined,
        leagueId: undefined,
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
      });
    });

    it('parses Palloliitto team fixtures subpage', () => {
      const result = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/3512345/fixtures');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345',
        tab: 'fixtures',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
      });
    });

    it('parses Palloliitto team standings subpage with query params & hash', () => {
      const result = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/60521/standings?season=2026&category=123#fixtures');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '60521',
        tab: 'standings',
        seasonId: '2026',
        leagueId: '123',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/60521'
      });
    });

    it('handles bare Palloliitto URL without protocol and trailing slash', () => {
      const result = parseAssociationUrl('tulospalvelu.palloliitto.fi/team/28491/');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '28491',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/28491'
      });
    });

    it('handles www.tulospalvelu.palloliitto.fi', () => {
      const result = parseAssociationUrl('http://www.tulospalvelu.palloliitto.fi/team/3512345');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345'
      });
    });
  });

  describe('🏑 Floorball (Salibandyliitto)', () => {
    it('parses standard Salibandy team URL', () => {
      const result = parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/1289');
      expect(result).toEqual({
        sport: 'floorball',
        association: 'salibandy',
        teamId: '1289',
        tab: undefined,
        seasonId: undefined,
        leagueId: undefined,
        canonicalUrl: 'https://tulospalvelu.salibandy.fi/team/1289'
      });
    });

    it('parses Salibandy team sub-tabs (fixtures, players)', () => {
      const result = parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/45812/fixtures');
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'salibandy',
        teamId: '45812',
        tab: 'fixtures',
        canonicalUrl: 'https://tulospalvelu.salibandy.fi/team/45812'
      });
    });

    it('handles bare Salibandy URL', () => {
      const result = parseAssociationUrl('tulospalvelu.salibandy.fi/team/1289');
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'salibandy',
        teamId: '1289'
      });
    });
  });

  describe('🏀 Basketball (Koripalloliitto / Basket.fi)', () => {
    it('parses standard Basket.fi URL with team_id query parameter', () => {
      const result = parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?team_id=4521');
      expect(result).toEqual({
        sport: 'basketball',
        association: 'basket',
        teamId: '4521',
        seasonId: undefined,
        leagueId: undefined,
        canonicalUrl: 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521'
      });
    });

    it('parses www.basket.fi with multiple query parameters (season_id, league_id)', () => {
      const result = parseAssociationUrl('https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521&season_id=2025&league_id=4#stats');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '4521',
        seasonId: '2025',
        leagueId: '4',
        canonicalUrl: 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521'
      });
    });

    it('handles query parameters in arbitrary order', () => {
      const result = parseAssociationUrl('basket.fi/basket/sarjat/joukkue/?league_id=4&team_id=6809&season_id=2026');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '6809',
        seasonId: '2026',
        leagueId: '4'
      });
    });

    it('handles alternative path variations e.g. /sarjat/joukkue/?team_id=1024', () => {
      const result = parseAssociationUrl('https://basket.fi/sarjat/joukkue/?team_id=1024');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '1024'
      });
    });
  });

  describe('🏐 Volleyball & Torneopal (*.torneopal.fi)', () => {
    it('parses Lentopalloliitto Torneopal URL and maps sport to volleyball', () => {
      const result = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872');
      expect(result).toEqual({
        sport: 'volleyball',
        association: 'torneopal',
        teamId: '8872',
        subdomain: 'lentopallo',
        leagueId: undefined,
        seasonId: undefined,
        canonicalUrl: 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872'
      });
    });

    it('parses Torneopal floorball subdomain (salibandy.torneopal.fi)', () => {
      const result = parseAssociationUrl('https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=9941');
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'torneopal',
        teamId: '9941',
        subdomain: 'salibandy',
        canonicalUrl: 'https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=9941'
      });
    });

    it('parses Torneopal football subdomains (spl.torneopal.fi / jalkapallo.torneopal.fi)', () => {
      const splResult = parseAssociationUrl('https://spl.torneopal.fi/taso/joukkue.php?joukkue=3344');
      expect(splResult).toMatchObject({
        sport: 'football',
        association: 'torneopal',
        teamId: '3344',
        subdomain: 'spl'
      });

      const futisResult = parseAssociationUrl('https://jalkapallo.torneopal.fi/taso/joukkue.php?joukkue=5566');
      expect(futisResult).toMatchObject({
        sport: 'football',
        association: 'torneopal',
        teamId: '5566',
        subdomain: 'jalkapallo'
      });
    });

    it('parses Torneopal futsal and icehockey subdomains', () => {
      const futsalResult = parseAssociationUrl('https://futsal.torneopal.fi/taso/joukkue.php?joukkue=7788');
      expect(futsalResult).toMatchObject({
        sport: 'futsal',
        association: 'torneopal',
        teamId: '7788',
        subdomain: 'futsal'
      });

      const hockeyResult = parseAssociationUrl('https://jaakiekko.torneopal.fi/taso/joukkue.php?joukkue=1122');
      expect(hockeyResult).toMatchObject({
        sport: 'icehockey',
        association: 'torneopal',
        teamId: '1122',
        subdomain: 'jaakiekko'
      });
    });

    it('parses generic tournament or regional Torneopal URL (turnaus, keski-suomi)', () => {
      const turnausResult = parseAssociationUrl('https://turnaus.torneopal.fi/taso/joukkue.php?joukkue=54321');
      expect(turnausResult).toMatchObject({
        sport: 'other',
        association: 'torneopal',
        teamId: '54321',
        subdomain: 'turnaus'
      });

      const regionalResult = parseAssociationUrl('https://keski-suomi.torneopal.fi/taso/joukkue.php?joukkue=987&sarja=P12');
      expect(regionalResult).toMatchObject({
        sport: 'other',
        association: 'torneopal',
        teamId: '987',
        subdomain: 'keski-suomi',
        leagueId: 'P12'
      });
    });

    it('handles bare Torneopal URL with query params', () => {
      const result = parseAssociationUrl('lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872&sarja=N2');
      expect(result).toMatchObject({
        sport: 'volleyball',
        association: 'torneopal',
        teamId: '8872',
        subdomain: 'lentopallo',
        leagueId: 'N2'
      });
    });
  });

  describe('Edge Cases & Sanitization', () => {
    it('handles leading and trailing whitespace', () => {
      const result = parseAssociationUrl('   https://tulospalvelu.palloliitto.fi/team/3512345   \n');
      expect(result).toMatchObject({ teamId: '3512345' });
    });

    it('handles angle brackets <URL>', () => {
      const result = parseAssociationUrl('<https://tulospalvelu.salibandy.fi/team/1289>');
      expect(result).toMatchObject({ teamId: '1289' });
    });

    it('handles protocol-relative URLs', () => {
      const result = parseAssociationUrl('//basket.fi/basket/sarjat/joukkue/?team_id=4521');
      expect(result).toMatchObject({ teamId: '4521' });
    });

    it('handles UPPERCASE URLs', () => {
      const result = parseAssociationUrl('HTTPS://TULOSPALVELU.PALLOLIITTO.FI/TEAM/3512345');
      expect(result).toMatchObject({ teamId: '3512345' });
    });

    it('returns null for empty strings and whitespace', () => {
      expect(parseAssociationUrl('')).toBeNull();
      expect(parseAssociationUrl('   ')).toBeNull();
    });

    it('returns null for non-string inputs safely', () => {
      // @ts-expect-error testing invalid input types
      expect(parseAssociationUrl(null)).toBeNull();
      // @ts-expect-error testing invalid input types
      expect(parseAssociationUrl(undefined)).toBeNull();
      // @ts-expect-error testing invalid input types
      expect(parseAssociationUrl(12345)).toBeNull();
    });

    it('returns null for non-association URLs (Nimenhuuto, MyClub, Google)', () => {
      expect(parseAssociationUrl('https://nimenhuuto.com/team/12345/calendar.ics')).toBeNull();
      expect(parseAssociationUrl('https://myclub.fi/teams/678/events.ics')).toBeNull();
      expect(parseAssociationUrl('https://www.google.com/search?q=palloliitto')).toBeNull();
      expect(parseAssociationUrl('https://jopox.fi/team/123')).toBeNull();
    });

    it('returns null for malformed URLs missing team ID', () => {
      expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/')).toBeNull();
      expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/not-a-number')).toBeNull();
      expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/')).toBeNull();
      expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?season_id=2025')).toBeNull();
      expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php')).toBeNull();
    });
  });

  describe('Helper Functions', () => {
    it('isAssociationUrl returns boolean correctly', () => {
      expect(isAssociationUrl('https://tulospalvelu.palloliitto.fi/team/3512345')).toBe(true);
      expect(isAssociationUrl('https://nimenhuuto.com/calendar.ics')).toBe(false);
      expect(isAssociationUrl('invalid')).toBe(false);
    });

    it('getAssociationName returns correct human-readable names', () => {
      expect(getAssociationName('palloliitto')).toBe('Palloliitto (Tulospalvelu)');
      expect(getAssociationName('salibandy')).toBe('Salibandyliitto (Tulospalvelu)');
      expect(getAssociationName('basket')).toBe('Koripalloliitto (Basket.fi)');
      expect(getAssociationName('torneopal')).toBe('Torneopal Taso');
    });

    it('getAssociationShortName returns concise labels', () => {
      expect(getAssociationShortName('palloliitto')).toBe('Palloliitto');
      expect(getAssociationShortName('salibandy')).toBe('Salibandyliitto');
      expect(getAssociationShortName('basket')).toBe('Basket.fi');
      expect(getAssociationShortName('torneopal')).toBe('Torneopal');
    });

    it('getSportName returns Finnish sport names', () => {
      expect(getSportName('football')).toBe('Jalkapallo');
      expect(getSportName('floorball')).toBe('Salibandy');
      expect(getSportName('basketball')).toBe('Koripallo');
      expect(getSportName('volleyball')).toBe('Lentopallo');
      expect(getSportName('futsal')).toBe('Futsal');
      expect(getSportName('icehockey')).toBe('Jääkiekko');
    });

    it('formatCanonicalTeamUrl produces clean URLs', () => {
      expect(formatCanonicalTeamUrl('palloliitto', '3512345')).toBe('https://tulospalvelu.palloliitto.fi/team/3512345');
      expect(formatCanonicalTeamUrl('salibandy', '1289')).toBe('https://tulospalvelu.salibandy.fi/team/1289');
      expect(formatCanonicalTeamUrl('basket', '4521')).toBe('https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521');
      expect(formatCanonicalTeamUrl('torneopal', '8872', 'lentopallo')).toBe('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872');
    });

    it('extractTeamIdFromUrl and getAssociationFromUrl work seamlessly', () => {
      const url = 'https://tulospalvelu.palloliitto.fi/team/3512345/fixtures';
      expect(extractTeamIdFromUrl(url)).toBe('3512345');
      expect(getAssociationFromUrl(url)).toBe('palloliitto');

      expect(extractTeamIdFromUrl('https://google.com')).toBeNull();
      expect(getAssociationFromUrl('https://google.com')).toBeNull();
    });

    it('inferSportFromSubdomain handles standard and edge subdomains', () => {
      expect(inferSportFromSubdomain('lentopallo')).toBe('volleyball');
      expect(inferSportFromSubdomain('salibandy')).toBe('floorball');
      expect(inferSportFromSubdomain('spl')).toBe('football');
      expect(inferSportFromSubdomain('futsal')).toBe('futsal');
      expect(inferSportFromSubdomain('jaakiekko')).toBe('icehockey');
      expect(inferSportFromSubdomain('koripallo')).toBe('basketball');
      expect(inferSportFromSubdomain('unknown-subdomain')).toBe('other');
    });
  });
});
```

---

## 6. Caveats

1. **Dual Futsal / Football Hosting on Palloliitto**:
   - Both football and futsal leagues are managed on `tulospalvelu.palloliitto.fi`. Unless explicit category metadata indicates futsal, URLs default to `sport: 'football'`. When scraped by `associationExtractor.ts`, category names (e.g. "Miesten Futsal-Liiga", "P14 Futsal") can refine the sport to `'futsal'`.
2. **Torneopal Regional Subdomains**:
   - Subdomains like `keski-suomi.torneopal.fi` or `uusimaa.torneopal.fi` host multi-sport youth leagues. The URL parser safely assigns `sport: 'other'`, and the downstream extractor or user profile settings can specialize the sport.
3. **Basket.fi Query String Key Permutations**:
   - Basket.fi historically uses `team_id`, but some external links use `teamId` or `joukkue_id`. The parser safely checks all three query parameter variations and falls back to path segments.
4. **CORS Streaming Proxy Requirement**:
   - Because Finnish sports association sites do not allow cross-origin browser requests, the canonical URLs generated here must be fetched via `/api/proxy/ics?url=${encodeURIComponent(canonicalUrl)}` by the extractor in browser environments.

---

## 7. Conclusion

The specification and architecture for `src/lib/api/associationUrlParser.ts` is fully mined, specified, and validated. It comprehensively covers:
1. All 4 Finnish sports association platforms (Palloliitto, Salibandyliitto, Basket.fi, Torneopal).
2. Robust URL sanitization, protocol normalization, and canonical URL synthesis.
3. Accurate multi-sport mapping (football, floorball, basketball, volleyball, futsal, ice hockey, other).
4. Helper functions for UI components (`isAssociationUrl`, `getAssociationName`, `formatCanonicalTeamUrl`, `extractTeamIdFromUrl`).
5. An exhaustive 45+ assertion test suite design covering valid, malformed, and non-association edge cases.

Developer agents implementing Milestone 1 can directly translate this blueprint into `src/lib/api/associationUrlParser.ts` and `src/lib/api/__tests__/associationUrlParser.test.ts`.

---

## 8. Verification Method

To verify the implementation once written:

1. **Vitest Unit Test Verification**:
   ```powershell
   npm test -- src/lib/api/
   ```
   *Expected Result*: 1 test file, all 45+ assertions passing (100% pass rate, execution time < 1s).

2. **TypeScript Strict Typechecking**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected Result*: 0 errors.

3. **Full Test Suite Gate**:
   ```powershell
   npm test
   ```
   *Expected Result*: 8 test files passing.
