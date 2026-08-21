## 2026-08-20T05:07:22Z
You are Explorer 2 (Association Extractor & Edge Proxy Specialist) for Milestone 1 (M1).
Working directory: c:\dev2\pelipaiva\.agents\sub_orch_m1_explorer_2
Project root: c:\dev2\pelipaiva

MANDATORY FIRST STEP: Read:
1. c:\dev2\pelipaiva\ORIGINAL_REQUEST.md
2. c:\dev2\pelipaiva\PROJECT.md
3. c:\dev2\pelipaiva\.agents\sub_orch_m1\SCOPE.md
4. c:\dev2\pelipaiva\cloudflare-worker\worker.ts
5. c:\dev2\pelipaiva\src\lib\stats\statsEngine.ts

YOUR TASK:
Investigate and design `src/lib/api/associationExtractor.ts` for extracting official league fixtures, standings, and division rosters:
1. Inspect how Torneopal (Palloliitto, Salibandyliitto, Lentopalloliitto) and Basket.fi represent team data:
   - Torneopal HTML tables (e.g. `table.otteluohjelma`, `table.sarjataulukko`, `table.pelaajat` or equivalent DOM/JSON structures).
   - Match fixtures: match id, date, kickoff time, home team, away team, score (if played), status (upcoming, played, postponed, cancelled), venue/hall name, field number (e.g. "Kenttä 1", "TN", "N"), league/series name.
   - League standings: rank, team name, matches played, wins, draws, losses, goals for/against, goal difference, points.
   - Team rosters: player number, name, position, stats.
2. Design the fetching pipeline:
   - How requests route through Cloudflare Worker streaming proxy (`/api/proxy/ics?url=...` or `/api/proxy/...`).
   - Resilient HTML parsing (regex/DOM parser compatible with browser and Node/Vitest environments).
   - Fallback synthetic generator for development/offline test scenarios when live network is unavailable.
   - Complete type definitions for `OfficialLeagueFixture`, `StandingRow`, `TeamSquadRoster`, `OfficialTeamData`.

Write your comprehensive findings and implementation proposal to:
`c:\dev2\pelipaiva\.agents\sub_orch_m1_explorer_2\handoff.md`.
Use `send_message` to notify the parent when complete.
