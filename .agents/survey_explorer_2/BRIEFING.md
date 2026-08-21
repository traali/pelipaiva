# BRIEFING — 2026-08-20T05:06:00Z

## Mission
Investigate the Pelipäivä codebase for R2 (Comprehensive Finnish Calendar Permutation Handling) and R4 (Configurable Match & Training Arrival Rules) to produce a structured analysis and handoff report.

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork preview explorer
- Working directory: c:\dev2\pelipaiva\.agents\survey_explorer_2
- Original parent: 57b7a5e7-45c0-4f7e-ba35-a6183ed07009
- Milestone: codebase survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect src/, parsers, services, utils, components
- Detail concrete file paths, functions, regexes, dictionaries, and recommendations

## Current Parent
- Conversation ID: 57b7a5e7-45c0-4f7e-ba35-a6183ed07009
- Updated: 2026-08-20T05:06:00Z

## Investigation State
- **Explored paths**: `src/types/matchday.ts`, `src/lib/storage/db.ts`, `src/lib/calendar/icsParser.ts`, `src/lib/geo/sportsGeocoder.ts`, `src/lib/ai/deterministicReasoner.ts`, `src/lib/stats/statsEngine.ts`, `src/components/*`, `cloudflare-worker/*`
- **Key findings**:
  1. Title permutation handling currently misses hyphenated matches (`HJK-EPS peli`), `@ venue` in title, Swedish/English prefixes, and bracketed round identifiers. Concrete regex parsing pipeline designed.
  2. Event classification missing meetings (`vanhempainilta`, `palaveri`) and sport-specific training types.
  3. Timezone & dual-timestamp disentanglement: Nimenhuuto/MyClub warmup vs kickoff collision resolved via dual-timestamp extraction regex.
  4. Multi-squad splitting: single feed containing Sininen/Valkoinen/Musta/Kilpa/Haaste needs feed scanning and squad tagging.
  5. Volunteer duty: extracted time windows and expanded to 9 roles.
  6. Pitch nicknames: expanded from 27 to 100+ national pitch dictionary across Finland.
  7. R4 arrival rules: defined `ArrivalRules` model in `PlayerProfile` with custom home/away/training offsets and squad filters.
- **Unexplored areas**: None within R2/R4 scope.

## Key Decisions Made
- Fully documented 5-component handoff report at `c:\dev2\pelipaiva\.agents\survey_explorer_2\handoff.md`.

## Artifact Index
- c:\dev2\pelipaiva\.agents\survey_explorer_2\handoff.md — Full 5-component report
- c:\dev2\pelipaiva\.agents\survey_explorer_2\progress.md — Liveness heartbeat
- c:\dev2\pelipaiva\.agents\survey_explorer_2\DISPATCH.md — Initial dispatch log
