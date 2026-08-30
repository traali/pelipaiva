# 12 — Recommendations roadmap

## Now (S, this week)

| Item | Findings | Effort | Risk if ignored |
|---|---|---|---|
| Product README | F-DOC-001 | S | Agents/humans onboard on the wrong system |
| Delete leftover factories + generateFamilyCode + seedWeekendExtras | F-ARC-002, F-ARC-003, F-QA-002 | S | Next agent wires fake stats into UI |
| CORS localhost:3000 | F-API-001 | S | Local family sync “broken” |
| No cup seed on empty live | F-API-003 | S | Fake weekend on a real team |
| Banner COMPETITIVE_AI historical | F-DOC-003 | S | Re-opens fixed P0s |
| Hide Apple/Qwen on ios-safari; PERHE-2 copy | F-UIX-001, F-UIX-002 | S | Parents think AI is broken / join fails |

## Next (M)

| Item | Findings | Effort | Risk |
|---|---|---|---|
| Pin GHA SHAs | F-SEC-003 | S | supply chain |
| Drop or isolate xlsx | F-SEC-001 | M | prototype pollution on spreadsheet |
| Playwright Chromium on CI | F-REL-001 | M | HUD regressions |
| Split statsEngine | F-ARC-001 | L | coupling |
| OCR: fail closed if self-host wasm missing | F-SEC-002 | S | CDN at runtime |

## Later

| Item | Findings | Effort |
|---|---|---|
| Mac WebKit job / TestFlight wrapper | F-ARC-008, F-QA-003 | L |
| Staging Pages project | F-REL-003 | M |
| arrivalRules into planner | F-ARC-007 | M |
| KV TTL UX (“family bus expires in N days”) | F-DATA-001 | S |
| Rename tests/e2e/tier | F-QA-001 | S |

Maps to agency FORWARD_PLAN F-1…F-5 plus this study’s F-API-001 (new).
