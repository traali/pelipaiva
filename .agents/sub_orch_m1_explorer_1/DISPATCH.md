## 2026-08-20T05:07:22Z
You are Explorer 1 (Spec & URL Parser Specialist) for Milestone 1 (M1).
Working directory: c:\dev2\pelipaiva\.agents\sub_orch_m1_explorer_1
Project root: c:\dev2\pelipaiva

MANDATORY FIRST STEP: Read:
1. c:\dev2\pelipaiva\ORIGINAL_REQUEST.md
2. c:\dev2\pelipaiva\PROJECT.md
3. c:\dev2\pelipaiva\.agents\sub_orch_m1\SCOPE.md
4. c:\dev2\pelipaiva\.agents\survey_explorer_1\handoff.md

YOUR TASK:
Investigate and design `src/lib/api/associationUrlParser.ts` for parsing Finnish sports association team page URLs:
1. ⚽ Football (Palloliitto): `tulospalvelu.palloliitto.fi/team/{teamId}`, `tulospalvelu.palloliitto.fi/team/{teamId}/fixtures`, `tulospalvelu.palloliitto.fi/team/{teamId}/standings`
2. 🏑 Floorball (Salibandyliitto): `tulospalvelu.salibandy.fi/team/{teamId}`
3. 🏀 Basketball (Koripalloliitto / Basket.fi): `basket.fi/basket/sarjat/joukkue/?team_id={teamId}`, `www.basket.fi/basket/sarjat/joukkue/?team_id={teamId}&season_id={seasonId}&league_id={leagueId}`
4. 🏐 Volleyball & Generic Torneopal: `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}` (e.g. `lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872`, `salibandy.torneopal.fi/...`, `turnaus.torneopal.fi/...`)

Detail:
- Complete regular expressions & URL normalization (handling `http://`, `https://`, missing protocol, trailing slashes, query params, hash fragments).
- Extraction of `sport` (`football` | `floorball` | `basketball` | `volleyball` | `other`), `association` (`palloliitto` | `salibandy` | `basket` | `torneopal`), `teamId`, `subdomain`, `canonicalUrl`.
- Helper functions (e.g. `isAssociationUrl(url)`, `getAssociationName(association)`, `formatCanonicalTeamUrl(...)`).
- Exhaustive test cases covering valid, malformed, and non-association URLs.

Write your comprehensive findings and implementation proposal to:
`c:\dev2\pelipaiva\.agents\sub_orch_m1_explorer_1\handoff.md`.
Use `send_message` to notify the parent when complete.
