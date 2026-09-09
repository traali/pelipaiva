# Original User Request

## Initial Request — 2026-08-20T05:03:37Z

Smart Torneopal Team URL scraper, multi-sport API extractor, and conservative fuzzy calendar-to-match reconciliation engine that handles all Finnish amateur sports permutations (Nimenhuuto, MyClub, Jopox, Torneopal), detects schedule/venue mismatches, and allows custom arrival rules.

Working directory: c:\dev2\pelipaiva
Integrity mode: development

## Requirements

### R1. Sports Association & Torneopal Team Page URL Parser
Extract teamId, clubId, and sport from Finnish sports association team URLs:
- ⚽ Football: tulospalvelu.palloliitto.fi/team/{teamId}
- 🏑 Floorball: tulospalvelu.salibandy.fi/team/{teamId}
- 🏀 Basketball: basket.fi/basket/sarjat/joukkue/?team_id={teamId}
- 🏐 Volleyball: *.torneopal.fi/taso/joukkue.php?joukkue={teamId}
Fetch official league match fixtures, opponent details, official venues, standings, and division rosters.

### R2. Comprehensive Finnish Calendar Permutation Handling & Fuzzy Join
Handle all Finnish amateur sports calendar permutations and join them with official Torneopal fixtures:
1. Title Permutations: HJK T13 Sininen vs EPS, HJK-EPS peli, Peli @ Bubu vs Honka, Ottelu: VJS - PPJ (Kierros 4), Seriematch: IFK - GrIFK, Friendly: KäPa vs Ilves, Turnaus / Pelitapahtuma.
2. Event Type Permutations: Distinct handling for matches (vs), training (Harjoitukset / Treenit / Fysiikka / Lajivuoro / Aamujää), and meetings (Palaveri / Vanhempainilta).
3. Timezone & Arrival Permutations: Disentangle calendar events starting at warmup time (e.g. 14:15 in Nimenhuuto) vs kickoff time (15:00 in Torneopal), and handle EET/EEST daylight saving transitions.
4. Multi-Squad Permutations: Split calendar feeds covering multiple squads (e.g. Sininen, Valkoinen, Musta, Kilpa, Haaste, T1, T2) into distinct team profiles.
5. Volunteer Duty Permutations: Detect and surface parent duties (☕ Kahviovuoro, ⏱️ Toimitsijavuoro / Kirjuri / Kello, 🦺 Järkkäri / Liivimies).
6. Venue Slang Permutations: Resolve 100+ Finnish pitch nicknames (Bubu, Väiski, Sahara, Bollis, Kupla, Kisis, Mosahalli, Kauppi, Kupittaa).
7. Conservative Matching: Only automatically merge when date, time window (±3h), and opponent tokens match with high confidence. Keep unconfirmed or partial matches as distinct events to avoid false merges.

### R3. Visual Mismatch & Conflict Diagnostics
Detect and display explicit visual warnings when a linked calendar event and official league fixture disagree on kickoff time (e.g. 15:00 vs 15:30), match date, venue location, or opponent. Provide 1-tap options for the user to sync with official league data or retain custom calendar notes.

### R4. Configurable Match & Training Arrival Rules
Allow users to configure per-calendar and per-team arrival rules: default sport, team aliases (e.g., separating Sininen and Valkoinen), custom warmup arrival offsets (e.g. 45 min for home matches, 60 min for away matches, 15 min for training), and volunteer duty tagging.

## Acceptance Criteria

### Team URL Extraction & API Ingestion
- [ ] Correctly parses teamId and sport from Palloliitto (tulospalvelu.palloliitto.fi), Salibandyliitto (tulospalvelu.salibandy.fi), Basket.fi (basket.fi), and Lentopalloliitto (*.torneopal.fi) URLs.
- [ ] Fetches and persists upcoming official fixtures, standings, and team rosters into local Dexie storage with offline resilience.

### Calendar Ingestion & Real-World Feeds (Nimenhuuto & MyClub)
- [ ] Imports real-world .ics feeds from Nimenhuuto, MyClub, and Jopox without parsing errors.
- [ ] Correctly categorizes matches vs training sessions across all 6 sports.
- [ ] Extracts volunteer duties (kahvio, kirjuri, kello) with exact duty time windows.

### Fuzzy Match & Conservative Reconciliation
- [ ] Automatically links high-confidence matches between calendar feeds and official league fixtures.
- [ ] Does not merge low-confidence or conflicting fixtures; displays them as separate entries with suggested match actions.
- [ ] Resolves multi-language team naming variations (Finnish, Swedish, English) and informal abbreviations.

### Mismatch Detection & Resolution UI
- [ ] Flags time differences with explicit before/after timestamps (e.g., Nimenhuuto: 15:00 ➔ Torneopal: 15:30).
- [ ] Flags venue differences when official pitch differs from calendar location.
- [ ] Provides 1-tap user action to adopt official time/venue or keep private calendar notes.

### Arrival & Schedule Configuration
- [ ] Calculates warmup and departure countdowns dynamically based on user-configured arrival offsets (e.g., 30/45/60 min).
- [ ] Allows configuring multiple squad groups (e.g. Sininen/Valkoinen) from a single shared calendar feed.

### Quality & Verification
- [ ] 100% pass rate on all automated unit and integration tests (npm test).
- [ ] 0 errors on TypeScript strict verification (npx tsc --noEmit).
- [ ] Production build succeeds and deploys to Cloudflare Pages (HTTP 200 OK).

## Follow-up — 2026-09-09T18:02:37Z

Exhaustively verify, audit, and benchmark cross-source event reconciliation, stitching, and deduplication across real Finnish family fixtures (Torneopal official league games, MyClub team feeds, and Nimenhuuto multi-squad calendars), ensuring zero duplicate cards, strict kickoff vs. warmup synchronization, and clean Google Calendar / Nest export.

Working directory: c:\compdev\pelipaiva
Integrity mode: development

## Requirements

### R1. Authentic Multi-Source Event Ingestion & Normalization
Feed real-world calendar payloads from all three primary Finnish youth sports systems:
- Official association fixtures from **Torneopal** (Palloliitto SPL football, Salibandyliitto SSBL floorball)
- Team calendar feeds from **MyClub** (e.g. EräViikingit, PPJ, Westend Indians with warmup offsets, attendance tags `X-MYCLUB-STATUS`, talkoo duties)
- Multi-squad calendar feeds from **Nimenhuuto** (e.g. HJK T13 Sininen & Valkoinen with `CATEGORIES` tags and shared team practices)

### R2. Complete Reconciliation & Stitching Invariant Verification
Execute `stitchCalendarEventsWithFixtures()` across all imported fixtures and assert non-negotiable invariants:
1. **Deduplication Cardinality**: For every real match present in both Torneopal and MyClub/Nimenhuuto, exactly ONE unified event card is returned. Bare fixtures are suppressed.
2. **Kickoff vs. Warmup Timing**: The match card strictly sets the official kickoff time (e.g. 10:00) as `startTime`, while preserving the coach gathering/warmup time (e.g. 09:15) as `warmupTime`.
3. **Metadata Enriched**: Preserves MyClub attendance status (`in`/`out`), talkoovahti volunteer duties, and jersey color guidance.
4. **Authoritative Venue**: Adopts Torneopal official venue while recording non-breaking mismatch diagnostics if the private calendar used a colloquial nickname.

### R3. Google Calendar & Google Nest Feed Export Verification
Run `generateIcsCalendarFeed()` on the stitched results and verify that the exported RFC 5545 feed:
- Formats `DTSTART` strictly to the match kickoff time for voice assistant query accuracy.
- Embeds gathering time, kit advice, departure time, and venue clearly in `DESCRIPTION`.
- Formats `SUMMARY` with player name and fixture (e.g. `Tuomas: Westend Indians vs Oilers`).

## Acceptance Criteria

### Stitching & Deduplication
- [ ] 100% of paired Torneopal and MyClub/Nimenhuuto events merge into exactly 1 event card with zero orphaned duplicates.
- [ ] Kickoff time is strictly sourced from Torneopal, and warmup time is strictly preserved from MyClub/Nimenhuuto.
- [ ] Multi-squad separation correctly prevents cross-squad false merges (e.g. Sininen fixture never merges with Valkoinen calendar event).
- [ ] All 61 existing test suites (518+ tests) in `pelipaiva` continue to pass with zero regressions.

