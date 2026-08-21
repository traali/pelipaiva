# Scope: Milestone 1 — Sports Association URL Parser, Extractor & Dexie Persistence

## Architecture
- **URL Parser** (`src/lib/api/associationUrlParser.ts`):
  - Parses team page URLs across Palloliitto (`tulospalvelu.palloliitto.fi`), Salibandyliitto (`tulospalvelu.salibandy.fi`), Basket.fi (`basket.fi`), and Torneopal Taso (`*.torneopal.fi`).
  - Extracts `sport`, `association`, `teamId`, `subdomain`, and normalizes canonical URLs.
  - Robust handling of protocol prefixes (`http://`, `https://`, bare domains), path variations, query params, trailing slashes.
- **Extractor & API Ingestion** (`src/lib/api/associationExtractor.ts`):
  - Fetches and extracts official league fixtures, standings, and division squad rosters.
  - Supports Torneopal HTML/DOM structure and fallback JSON schemas.
  - Normalizes fixtures into `OfficialLeagueFixture` records with ISO timestamps, venue names, field numbers, home/away status.
  - Handles network failures gracefully with structured error logging and offline fallback.
- **Dexie Database Version 2 Migration** (`src/lib/storage/db.ts` & `src/types/matchday.ts`):
  - Upgrades `PelipaivaDB` from Version 1 to Version 2.
  - Adds tables: `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`.
  - Updates `profiles` and `events` tables with association URL and reconciliation tracking fields.
  - Implements CRUD helpers: `saveOfficialTeamData`, `getOfficialFixtures`, `getOfficialStandings`, `getTeamRoster`, `saveArrivalRules`, `getArrivalRules`.
  - Ensures local-first offline resilience via IndexedDB caching.
- **Tests**:
  - `src/lib/api/associationUrlParser.test.ts`
  - `src/lib/api/associationExtractor.test.ts`
  - `src/lib/storage/db.test.ts`

## Feature Inventory
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 1 | Palloliitto Team URL Parser | `tulospalvelu.palloliitto.fi/team/{teamId}` | M1 | IN_PROGRESS |
| 2 | Salibandyliitto Team URL Parser | `tulospalvelu.salibandy.fi/team/{teamId}` | M1 | IN_PROGRESS |
| 3 | Basket.fi Team URL Parser | `basket.fi/basket/sarjat/joukkue/?team_id={teamId}` | M1 | IN_PROGRESS |
| 4 | Torneopal Team URL Parser | `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}` | M1 | IN_PROGRESS |
| 5 | Official Fixtures & Standings Ingestion | HTML/JSON extractor for fixtures, standings, rosters | M1 | IN_PROGRESS |
| 6 | Dexie Schema Version 2 Persistence | Database migration, tables, CRUD helpers, offline caching | M1 | IN_PROGRESS |

## Interface Contracts
Defined in `PROJECT.md § Interface Contracts`:
- `parseAssociationUrl(rawUrl: string): ParsedAssociationUrl | null`
- `fetchOfficialTeamData(parsedUrl: ParsedAssociationUrl): Promise<OfficialTeamData>`
- `saveOfficialTeamData(teamData: OfficialTeamData): Promise<void>`
- `getOfficialFixtures(teamId: string): Promise<OfficialLeagueFixture[]>`
