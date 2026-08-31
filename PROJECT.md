# Project: Pelipäivä

## Architecture
- **Frontend Stack**: Vite 6, React 19, TypeScript (strict), TailwindCSS v4, Radix UI primitives, Motion spring physics.
- **Data & Storage Layer**: Pure local-first Dexie.js v4 IndexedDB with Version 2 schema migration (`profiles`, `events`, `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`, `venuePins`, `syncState`).
- **Edge Infrastructure**: Cloudflare Worker streaming CORS proxy (`/api/proxy/ics`) for fetching Finnish sports association pages and remote .ics feeds without browser CORS blocking.
- **Parsing & NLP Engine**:
  - `associationUrlParser.ts`: Multi-sport team URL parser for Palloliitto, Salibandyliitto, Basket.fi, and Torneopal (*.torneopal.fi).
  - `associationExtractor.ts`: Official league fixture, standings, and division roster extractor.
  - `icsParser.ts`: Finnish calendar permutation parser (titles, match/training/meeting/tournament classification, dual-timestamp warmup/kickoff disentanglement, multi-squad separation, Talkoovahti volunteer duty time-window extractor).
  - `sportsGeocoder.ts`: National sports facility geocoder with 100+ curated Finnish pitch slang nicknames + LIPAS open API.
- **Reconciliation & Diagnostics**:
  - `teamNameMatcher.ts`: Multilingual token normalizer (FI/SV/EN colors, age groups, Finnish club abbreviations).
  - `reconciliationEngine.ts`: Conservative fuzzy join engine with ±3h time window tolerance and high confidence auto-link vs isolated candidate matches.
  - Visual Mismatch UI: Before/after timestamp diffs, venue divergence warnings, and 1-tap resolution actions in `MatchdayCard.tsx`.
- **Arrival & Departure Rules Engine**:
  - Dynamic warmup arrival offsets (home/away/training/tournament), departure buffer calculations, and squad filters in `deterministicReasoner.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Palloliitto Team URL Parser | Extract teamId/sport from `tulospalvelu.palloliitto.fi/team/{teamId}` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Salibandyliitto Team URL Parser | Extract teamId/sport from `tulospalvelu.salibandy.fi/team/{teamId}` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Basket.fi Team URL Parser | Extract teamId/sport from `basket.fi/basket/sarjat/joukkue/?team_id={teamId}` | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Torneopal Team URL Parser | Extract teamId/sport from `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}` | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Official Fixtures & Standings Ingestion | Fetch league fixtures, standings, opponent details, official venues, and rosters | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Dexie Schema Version 2 Persistence | Store official fixtures, standings, rosters, arrival rules, and reconciliation state | M1 | ORIGINAL_REQUEST §R1, Acceptance Criteria |
| 7 | Complex Title Permutations | Parse `HJK T13 Sininen vs EPS`, `HJK-EPS peli`, `Peli @ Bubu vs Honka`, `Ottelu: VJS - PPJ (Kierros 4)`, `Seriematch: IFK - GrIFK`, `Friendly: KäPa vs Ilves` | M2 | ORIGINAL_REQUEST §R2.1 |
| 8 | Event Type Classification | Classify matches (vs), training (harjoitukset/treenit/fysiikka/lajivuoro/aamujää/träning), meetings (vanhempainilta/palaveri), tournaments | M2 | ORIGINAL_REQUEST §R2.2 |
| 9 | Dual-Timestamp & DST Disentanglement | Disentangle arrival/warmup DTSTART (14:15) vs kickoff (15:00) with EET/EEST normalization | M2 | ORIGINAL_REQUEST §R2.3 |
| 10 | Multi-Squad Feed Separation | Detect and split shared feeds (Sininen, Valkoinen, Musta, Kilpa, Haaste, T1, T2) | M2 | ORIGINAL_REQUEST §R2.4 |
| 11 | Talkoovahti Volunteer Duty Windows | Extract volunteer duties (kahvio, kirjuri, kello, järkkäri, kioski, etc.) with exact time windows (`klo 14:30 - 16:00`) | M2 | ORIGINAL_REQUEST §R2.5 |
| 12 | 100+ National Pitch Slang Nicknames | Resolve 100+ Finnish sports pitch nicknames (Bubu, Väiski, Sahara, Bollis, Kupla, Kisis, Mosahalli, Kauppi, Kupittaa, etc.) | M2 | ORIGINAL_REQUEST §R2.6 |
| 13 | Configurable Match & Training Arrival Rules | User-configured warmup arrival offsets (home/away/training), departure buffers, squad filters | M2 | ORIGINAL_REQUEST §R4 |
| 14 | Conservative Fuzzy Match & Reconciliation | Auto-link fixtures when date, time (±3h), and opponent tokens match (>=0.85); keep unlinked when conflicting/low-confidence | M3 | ORIGINAL_REQUEST §R2.7 |
| 15 | Multilingual & Alias Token Normalizer | Normalize FI/SV/EN colors, age tags (T13/P11), and club abbreviations (HJK, KäPa, GrIFK, etc.) | M3 | ORIGINAL_REQUEST §R2.7 |
| 16 | Visual Timestamp Mismatch Diagnostics | Display before/after timestamp diff (e.g. `Nimenhuuto: 15:00 ➔ Torneopal: 15:30`) | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Visual Venue & Opponent Diagnostics | Display venue discrepancy badge when official pitch differs from calendar location | M3 | ORIGINAL_REQUEST §R3 |
| 18 | 1-Tap Conflict Resolution Actions | Provide 1-tap buttons: Adopt official time/venue, Keep calendar notes, or Unlink | M3 | ORIGINAL_REQUEST §R3 |
| 19 | UI Integration & Onboarding/Import Flow | Support importing both .ics and association URLs with live preview, arrival settings, and squad selection | M3 | ORIGINAL_REQUEST §R1, §R3, §R4 |
| 20 | Dual Track E2E Test Suite (Tiers 1-4) | Comprehensive opaque-box test suite covering all 19 features | E2E Track / M4 | ORIGINAL_REQUEST Acceptance Criteria |
| 21 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing and edge-case hardening | M4 | Project Pattern Phase 2 |

## Milestones (Living Roadmap: [FORWARD_PLAN.md](docs/agency/FORWARD_PLAN.md))
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite | Comprehensive 4-Tier test suite & TEST_READY.md | none | SHIPPED |
| 1 | Sports Association URL Parser, Extractor & Dexie Persistence | Features 1, 2, 3, 4, 5, 6 | none | SHIPPED |
| 2 | Calendar Permutations, 100+ Venue Geocoder & Arrival Rules | Features 7, 8, 9, 10, 11, 12, 13 | M1 (types) | SHIPPED |
| 3 | Conservative Fuzzy Join & Visual Mismatch UI | Features 14, 15, 16, 17, 18, 19 | M1, M2 | SHIPPED |
| 4 | Final Milestone: 100% E2E Pass & Tier 5 Hardening | Features 20, 21 | E2E, M1, M2, M3 | SHIPPED |

## Interface Contracts

### `src/lib/api/associationUrlParser.ts` ↔ `src/lib/api/associationExtractor.ts`
```typescript
export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';

export interface ParsedAssociationUrl {
  sport: SportType;
  association: AssociationType;
  teamId: string;
  subdomain?: string; // for *.torneopal.fi
  canonicalUrl: string;
}

export function parseAssociationUrl(rawUrl: string): ParsedAssociationUrl | null;
```

### `src/lib/api/associationExtractor.ts` ↔ `src/lib/storage/db.ts`
```typescript
export interface OfficialLeagueFixture {
  id: string; // `${association}_${teamId}_${matchId}`
  teamId: string;
  association: AssociationType;
  sport: SportType;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  startTime: string; // ISO string
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
```

### `src/lib/calendar/icsParser.ts` ↔ `src/types/matchday.ts`
```typescript
export interface ParsedTitleResult {
  eventType: EventType;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  embeddedVenueHint?: string;
  roundInfo?: string;
  isFriendly?: boolean;
}

export interface VolunteerDutyResult {
  dutyTag: string; // e.g. "☕ Kahviovuoro (klo 14:30 - 16:00)"
  role: 'kahvio' | 'toimitsija' | 'kello_kirjuri' | 'jarjestysmies' | 'kioski' | 'kyyti' | 'makkara' | 'striimaus' | 'ensiapu';
  timeWindow?: string;
}
```

### `src/lib/reconciliation/reconciliationEngine.ts` ↔ `src/components/MatchdayCard.tsx`
```typescript
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

## Code Layout
- `src/types/matchday.ts`: Core data contracts, `ArrivalRules`, `OfficialLeagueFixture`, `ReconciliationResult`.
- `src/lib/api/associationUrlParser.ts`: URL parser for all Finnish sports associations.
- `src/lib/api/associationExtractor.ts`: Extractor for official fixtures, standings, and rosters.
- `src/lib/calendar/icsParser.ts`: Permutation engine, event classification, dual timestamp, volunteer duties.
- `src/lib/geo/sportsGeocoder.ts`: 100+ national pitch nickname dictionary & LIPAS integration.
- `src/lib/reconciliation/teamNameMatcher.ts`: Multilingual token normalizer and similarity scorer.
- `src/lib/reconciliation/reconciliationEngine.ts`: Conservative fuzzy join engine.
- `src/lib/storage/db.ts`: Dexie database Version 2 schema & storage persistence.
- `src/lib/ai/deterministicReasoner.ts`: Configurable arrival & departure countdown engine.
- `src/components/MatchdayCard.tsx`: Mismatch badges, before/after timestamp diffs, 1-tap action bar.
- `src/components/CalendarImportModal.tsx`: Dual .ics & URL importer, multi-squad selector, arrival rules config.
