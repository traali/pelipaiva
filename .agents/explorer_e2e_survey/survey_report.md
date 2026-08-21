# Pelipäivä E2E Testing Survey Report

**Author:** `explorer_e2e_survey` (Teamwork Explorer)  
**Target Project:** `c:\dev2\pelipaiva` (Pelipäivä)  
**Date:** 2026-08-20  
**Scope:** Architecture, test runner configuration, public module contracts, runtime/mock dependencies, and 4-tier E2E testing blueprint.

---

## 1. Executive Summary

Pelipäivä is a local-first Finnish amateur sports matchday hub built with Vite 6, React 19, TypeScript (strict), TailwindCSS v4, Dexie.js v4 (IndexedDB), and Motion spring physics.

### Current Test Suite Status
- **Test Runner:** Vitest v4.1.11 (`npm test` ➔ `vitest run`).
- **Execution Result:** **7 test files, 22 tests passing** (100% pass rate in ~500ms).
- **TypeScript Typecheck:** `npx tsc --noEmit` exits **0 errors**.
- **Production Build:** `npm run build` succeeds cleanly.

### Key Survey Findings for E2E Test Suite
1. **Vitest Configuration Gap:** `vitest.config.ts` currently specifies `include: ['src/**/*.test.ts']`. Tests placed in `tests/e2e/` will not be executed unless the pattern is expanded to include `tests/**/*.test.ts` or `**/*.test.ts`.
2. **IndexedDB / Dexie in Node Environment:** `vitest.config.ts` runs in `environment: 'node'`. Dexie requires `indexedDB`. In existing unit tests, `sportsGeocoder.ts` catches database errors with `try/catch`. To test Feature 6 (Dexie Schema v2 Persistence), Tier 2, and Tier 4 scenarios, `fake-indexeddb` should be installed (`npm i -D fake-indexeddb`) or initialized in a global test setup harness.
3. **Module Contracts Status:**
   - Existing implemented modules: `src/lib/calendar/icsParser.ts`, `src/lib/geo/sportsGeocoder.ts`, `src/lib/ai/deterministicReasoner.ts`, `src/lib/parking/parkingEaseEngine.ts`, `src/lib/stats/statsEngine.ts`, `src/lib/weather/fmiWeatherEngine.ts`, `src/lib/storage/db.ts`.
   - Planned modules in Milestones 1–3: `src/lib/api/associationUrlParser.ts`, `src/lib/api/associationExtractor.ts`, `src/lib/reconciliation/teamNameMatcher.ts`, `src/lib/reconciliation/reconciliationEngine.ts`.
   - The test suite must be designed with strict opaque-box interface compliance matching the contracts in `PROJECT.md`.

---

## 2. Current Test Setup & Execution Analysis

### 2.1 Package Scripts & Installed Dependencies
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "preview": "vite preview"
  }
}
```

- **Runtime Dependencies:** `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@turf/distance`, `clsx`, `dexie` (^4.4.5), `dexie-react-hooks`, `fast-xml-parser`, `ical.js`, `lucide-react`, `motion`, `react` (19.0.0), `react-dom` (19.0.0), `tailwind-merge`.
- **Dev Dependencies:** `@tailwindcss/vite`, `@types/node` (^22.13.0), `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@vitest/coverage-v8`, `eslint`, `tailwindcss`, `typescript` (~5.7.3), `vite` (^6.1.0), `vite-plugin-pwa`, `vitest` (^4.1.11).
- **Missing Test Dependencies:** `fake-indexeddb` (needed for Node-based IndexedDB simulation).

### 2.2 Existing Unit Tests Inventory
| # | Test File | Test Cases | Areas Tested |
|---|-----------|------------|--------------|
| 1 | `src/lib/ai/deterministicReasoner.test.ts` | 4 | Cold sand-turf TF advice, 3G AG advice, indoor non-marking, sibling schedule conflict |
| 2 | `src/lib/calendar/icsParser.test.ts` | 2 | Training keyword classification, basic ICS parsing & team extraction |
| 3 | `src/lib/geo/sportsGeocoder.test.ts` | 2 | Finnish pitch nicknames (Bubu, Väiski, Mosahalli, Kauppi), alias dictionary size |
| 4 | `src/lib/parking/parkingEaseEngine.test.ts` | 3 | Tieliikennelaki 2020 parking disc rounding, ease scores |
| 5 | `src/lib/stats/statsEngine.test.ts` | 3 | Multi-sport score types (goals, sets, points), division rosters, floorball league names |
| 6 | `src/lib/weather/lightningSafety.test.ts` | 3 | 30/30 rule lightning safety machine, strike countdown |
| 7 | `src/lib/weather/radarSatelliteEngine.test.ts` | 5 | FMI radar URLs, EUMETSAT URLs, 5-min animation loop, layer metadata |
| **Total** | **7 files** | **22 tests** | **All Passing** (505ms) |

---

## 3. Public Module Contracts & Interface Specifications

All tests in Tiers 1–4 will interact with modules via the following public contracts.

### 3.1 `src/types/matchday.ts` (Core Data Models)
```typescript
export type SportType = 'football' | 'floorball' | 'basketball' | 'volleyball' | 'icehockey' | 'futsal' | 'training' | 'other';
export type EventType = 'match' | 'training' | 'tournament' | 'meeting' | 'other';
export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';

export interface ParsedAssociationUrl {
  sport: SportType;
  association: AssociationType;
  teamId: string;
  subdomain?: string;
  canonicalUrl: string;
}

export interface OfficialLeagueFixture {
  id: string; // `${association}_${teamId}_${matchId}`
  teamId: string;
  association: AssociationType;
  sport: SportType;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  startTime: string; // ISO 8601
  venueName: string;
  fieldNumber?: string;
  status: 'upcoming' | 'played' | 'cancelled' | 'postponed';
  score?: string;
  officialMatchUrl?: string;
  fetchedAt: string;
}

export interface OfficialTeamData {
  fixtures: OfficialLeagueFixture[];
  standings?: StandingRow[];
  roster?: TeamSquadRoster;
}

export interface ArrivalRules {
  profileId?: string;
  warmupOffsetHomeMinutes: number; // default: 45
  warmupOffsetAwayMinutes: number; // default: 60
  warmupOffsetTrainingMinutes: number; // default: 15
  warmupOffsetTournamentMinutes: number; // default: 30
  volunteerDutyArrivalBufferMinutes: number; // default: 15
  defaultDrivingEstimateMinutes: number; // default: 20
  defaultDepartureBufferMinutes: number; // default: 10
  squadFilters?: string[]; // e.g. ['Sininen']
}

export interface VolunteerDutyResult {
  dutyTag: string; // e.g. "☕ Kahviovuoro (klo 14:30 - 16:00)"
  role: 'kahvio' | 'toimitsija' | 'kello_kirjuri' | 'jarjestysmies' | 'kioski' | 'kyyti' | 'makkara' | 'striimaus' | 'ensiapu';
  timeWindow?: string;
}

export interface ParsedTitleResult {
  eventType: EventType;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  embeddedVenueHint?: string;
  roundInfo?: string;
  isFriendly?: boolean;
}

export interface MismatchDiagnostics {
  hasKickoffMismatch: boolean;
  calendarStartTime: string;
  officialStartTime?: string;
  timeDiffMinutes?: number;
  hasVenueMismatch: boolean;
  calendarVenueName?: string;
  officialVenueName?: string;
  hasOpponentMismatch: boolean;
  calendarOpponent?: string;
  officialOpponent?: string;
}

export interface ReconciliationResult {
  status: 'auto_matched' | 'candidate_match' | 'unlinked';
  confidenceScore: number; // 0.0 - 1.0
  officialFixture?: OfficialLeagueFixture;
  mismatches?: MismatchDiagnostics;
}
```

### 3.2 `src/lib/api/associationUrlParser.ts` (Features 1–4)
```typescript
export function parseAssociationUrl(rawUrl: string): ParsedAssociationUrl | null;
export function normalizeAssociationUrl(rawUrl: string): string | null;
export function detectAssociationType(rawUrl: string): AssociationType | null;
```
- **Supported URL Formats**:
  1. Palloliitto: `https://tulospalvelu.palloliitto.fi/team/{teamId}`
  2. Salibandyliitto: `https://tulospalvelu.salibandy.fi/team/{teamId}`
  3. Basket.fi: `https://basket.fi/basket/sarjat/joukkue/?team_id={teamId}`
  4. Torneopal: `https://{subdomain}.torneopal.fi/taso/joukkue.php?joukkue={teamId}`

### 3.3 `src/lib/api/associationExtractor.ts` (Feature 5)
```typescript
export async function fetchOfficialTeamData(parsedUrl: ParsedAssociationUrl, customFetch?: typeof fetch): Promise<OfficialTeamData>;
export function extractFixturesFromHtml(html: string, parsedUrl: ParsedAssociationUrl): OfficialLeagueFixture[];
export function extractStandingsFromHtml(html: string): StandingRow[];
export function extractRosterFromHtml(html: string): TeamSquadRoster | undefined;
```

### 3.4 `src/lib/calendar/icsParser.ts` (Features 7–11)
```typescript
export async function parseICSFeed(icsContent: string, profileId: string, sport?: SportType): Promise<MatchdayEvent[]>;
export function isTrainingEvent(title: string, description?: string): boolean;
export function parseMatchTitle(rawTitle: string, defaultTeamName?: string): ParsedTitleResult;
export function classifyCalendarEvent(title: string, description?: string): EventType;
export function resolveEventTimes(
  dtStart: Date,
  dtEnd: Date,
  title: string,
  description: string,
  isTraining: boolean,
  defaultWarmupOffsetMins?: number
): { kickoffTime: Date; warmupTime: Date; endTime: Date };
export function extractVolunteerDuty(summary: string, description: string): VolunteerDutyResult | undefined;
export function detectSquadGroups(icsContent: string): { squadName: string; eventCount: number }[];
export function splitICSBySquad(icsContent: string, squadName: string): string;
```

### 3.5 `src/lib/geo/sportsGeocoder.ts` (Feature 12)
```typescript
export const NATIONAL_FIELD_ALIASES: Record<string, {
  name: string;
  lat: number;
  lng: number;
  isIndoor: boolean;
  surface: PitchSurface;
  hasFloodlights: boolean;
}>;
export async function resolveSportsVenue(rawVenueString: string): Promise<VenueInfo>;
export const geocodeSportsVenue = resolveSportsVenue;
```

### 3.6 `src/lib/reconciliation/teamNameMatcher.ts` (Feature 15)
```typescript
export function normalizeTeamName(rawName: string): {
  club: string;
  squad: string;
  ageGroup: string;
  color: string;
  normalized: string;
};
export function calculateTeamSimilarity(nameA: string, nameB: string): number; // 0.0 to 1.0
export const CLUB_ALIASES: Record<string, string[]>;
export const MULTILINGUAL_COLORS: Record<string, string>; // fi/sv/en -> canonical
```

### 3.7 `src/lib/reconciliation/reconciliationEngine.ts` (Features 14, 16, 17, 18)
```typescript
export function reconcileCalendarWithOfficial(
  calendarEvents: MatchdayEvent[],
  officialFixtures: OfficialLeagueFixture[]
): Map<string, ReconciliationResult>;

export function computeMismatchDiagnostics(
  calendarEvent: MatchdayEvent,
  officialFixture: OfficialLeagueFixture
): MismatchDiagnostics;

export function applyResolutionDecision(
  event: MatchdayEvent,
  officialFixture: OfficialLeagueFixture,
  decision: 'use_official' | 'keep_calendar' | 'unlink'
): MatchdayEvent;
```

### 3.8 `src/lib/storage/db.ts` (Feature 6)
```typescript
export class PelipaivaDB extends Dexie {
  profiles!: Table<PlayerProfile, string>;
  events!: Table<MatchdayEvent, string>;
  officialFixtures!: Table<OfficialLeagueFixture, string>;
  leagueStandings!: Table<StandingRow, string>;
  teamRosters!: Table<TeamSquadRoster, string>;
  arrivalRules!: Table<ArrivalRules, string>;
  venuePins!: Table<CustomVenuePin, string>;
  syncState!: Table<SyncStateRecord, string>;
}
export const db: PelipaivaDB;
export async function saveOfficialTeamData(teamData: OfficialTeamData): Promise<void>;
export async function getOfficialFixtures(teamId: string): Promise<OfficialLeagueFixture[]>;
export async function getOfficialStandings(teamId: string): Promise<StandingRow[] | undefined>;
export async function getTeamRoster(teamId: string): Promise<TeamSquadRoster | undefined>;
export async function saveArrivalRules(rules: ArrivalRules): Promise<void>;
export async function getArrivalRules(profileId: string): Promise<ArrivalRules | undefined>;
```

### 3.9 `src/lib/ai/deterministicReasoner.ts` (Feature 13)
```typescript
export function determineFootwear(
  surface: PitchSurface,
  tempC: number,
  precipMmh: number,
  isIndoor: boolean
): { footwear: FootwearRecommendation; reason: string };

export function generateMatchdayBriefing(
  event: MatchdayEvent,
  allDayEvents?: MatchdayEvent[],
  arrivalRules?: ArrivalRules
): MatchdayBriefing;

export function calculateDepartureCountdown(
  event: MatchdayEvent,
  arrivalRules?: ArrivalRules,
  userCoordinates?: Coordinates
): { departureTime: string; countdownMinutes: number };
```

---

## 4. Test Harness & Mock Architecture

To ensure fast, deterministic, 100% offline E2E test execution:

```
┌─────────────────────────────────────────────────────────────┐
│                       Vitest Runner                         │
│   (environment: node, include: ['tests/**/*.test.ts', ...]) │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌─────────────────┐
│ Global IDB   │       │ Fetch Mocks  │       │ Timer / Clock   │
│ fake-indexeddb│      │ HTML / JSON  │       │ vi.useFakeTimers│
│ in-memory DB │       │ Association  │       │ DST & Countdowns│
└──────────────┘       └──────────────┘       └─────────────────┘
```

### 4.1 Dexie Test Harness (`tests/helpers/setupDexie.ts`)
```typescript
import 'fake-indexeddb/auto';
import { PelipaivaDB } from '../../src/lib/storage/db';

export function createTestDb(): PelipaivaDB {
  const dbName = `test_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return new PelipaivaDB(dbName);
}
```

### 4.2 Network & Fixtures Directory (`tests/fixtures/`)
- `tests/fixtures/ics/`:
  - `nimenhuuto_hjk_multisquad.ics`
  - `myclub_ervi_talkoovahti.ics`
  - `jopox_honka_warmup_kickoff.ics`
  - `torneopal_puma_volleyball.ics`
  - `dst_fall_spring_transitions.ics`
- `tests/fixtures/html/`:
  - `palloliitto_team_page.html`
  - `salibandy_team_page.html`
  - `basket_fi_team_page.html`
  - `torneopal_taso_team_page.html`
- `tests/fixtures/json/`:
  - `lipas_venues_sample.json`
  - `fmi_weather_sample.json`

---

## 5. Concrete Test Suite Structure & Mapping

The 4-tier E2E testing architecture maps directly to the 19 features and requirements:

```
tests/
├── e2e/
│   ├── tier1_features/          (19 files, >=95 tests)
│   │   ├── f01_palloliitto_url.test.ts
│   │   ├── f02_salibandy_url.test.ts
│   │   ├── f03_basket_url.test.ts
│   │   ├── f04_torneopal_url.test.ts
│   │   ├── f05_official_fixtures_ingestion.test.ts
│   │   ├── f06_dexie_schema_v2.test.ts
│   │   ├── f07_title_permutations.test.ts
│   │   ├── f08_event_type_classification.test.ts
│   │   ├── f09_dual_timestamp_dst.test.ts
│   │   ├── f10_multi_squad_separation.test.ts
│   │   ├── f11_talkoovahti_duties.test.ts
│   │   ├── f12_pitch_nicknames.test.ts
│   │   ├── f13_arrival_rules.test.ts
│   │   ├── f14_fuzzy_reconciliation.test.ts
│   │   ├── f15_multilingual_tokens.test.ts
│   │   ├── f16_timestamp_diagnostics.test.ts
│   │   ├── f17_venue_diagnostics.test.ts
│   │   ├── f18_conflict_resolution.test.ts
│   │   └── f19_onboarding_import_flow.test.ts
│   ├── tier2_boundary/          (4 files, >=95 tests)
│   │   ├── boundary_urls_and_api.test.ts
│   │   ├── boundary_calendar_permutations.test.ts
│   │   ├── boundary_reconciliation_mismatches.test.ts
│   │   └── boundary_arrival_rules.test.ts
│   ├── tier3_combinations/      (2 files, >=19 tests)
│   │   ├── combinations_url_calendar_reconciliation.test.ts
│   │   └── combinations_dst_arrival_volunteer.test.ts
│   └── tier4_realworld/         (5 files, >=10 scenarios)
│       ├── scenario_hjk_multi_squad.test.ts
│       ├── scenario_ervip12_floorball_talkoovahti.test.ts
│       ├── scenario_basket_honka_offsets.test.ts
│       ├── scenario_volleyball_kuortane_sets.test.ts
│       └── scenario_multisport_weekend_tournament.test.ts
├── fixtures/
│   ├── ics/
│   ├── html/
│   └── json/
└── helpers/
    ├── setupDexie.ts
    ├── fixtureLoader.ts
    └── mockFetch.ts
```

### Total Test Suite Scale
- **Tier 1 (Feature Coverage):** 19 test files × 5+ tests = **>=95 tests**
- **Tier 2 (Boundary & Corner Cases):** 4 test files × 24+ tests = **>=95 tests**
- **Tier 3 (Pairwise Combinations):** 2 test files × 10+ tests = **>=19 tests**
- **Tier 4 (Real-World Scenarios):** 5 test files × 2+ scenarios = **>=10 scenarios**
- **Grand Total:** **30 test files, >=219 test cases**

---

## 6. Recommendations for Implementation

1. **Update `vitest.config.ts`**:
   Expand `include` from `['src/**/*.test.ts']` to `['src/**/*.test.ts', 'tests/**/*.test.ts']`.
2. **Install `fake-indexeddb` as Dev Dependency**:
   Run `npm i -D fake-indexeddb` so Dexie v4 tests run smoothly in Node.js environment without crashing.
3. **Pure Function Contracts**:
   Keep URL parsers, title cleaners, event classifiers, token normalizers, and reconciliation scoring pure and deterministic (taking data in, returning immutable results) for lightning-fast testing.
4. **Offline Fixtures**:
   Store all sample HTML and ICS files in `tests/fixtures/` rather than depending on live HTTP network requests during test runs.
