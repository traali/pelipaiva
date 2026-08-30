# 04 — Docs vs reality

## What we know

| Doc claim | Code/prod | Drift |
|---|---|---|
| README “Audit Summary System” | FamDay PWA | **X-008** F-DOC-001 |
| PROJECT.md milestones IN_PROGRESS | pages.dev shipped | F-DOC-002 |
| COMPETITIVE M-02 no ErrorBoundary | ErrorBoundary + main.tsx | **X-001** |
| COMPETITIVE M-12 Worker CORS `*` | allowlist worker.ts:200 | **X-002** |
| COMPETITIVE M-14 no AbortSignal | familyCloud 10s | **X-003** |
| COMPETITIVE M-20 tsc empty | ci.yml tsc app | **X-004** |
| FAMILY_SYNC_FINAL fallbackToSynthetic false | ingestOfficial.ts:64 | Match |
| ARCHITECTURE no product LLM | opt-in on-device default off | Match **X-007** |
| agency audit 2e45f97 | HEAD 20bad06 | F-DOC-004 |
| USER_JOURNEYS UJ-18 flea market etc. | not in src | Visionary, not product |
| CI “lint” job name | ci.yml does **not** run eslint | F-REL-002 |
| tests/e2e folder | mostly vitest node | F-QA-001 |
| native/ios README TestFlight | no xcodeproj | F-ARC-005 |

Checks listed: README, PROJECT.md, COMPETITIVE_AI, FAMILY_SYNC_FINAL, ARCHITECTURE, agency pack, ci.yml, ingestOfficial, worker CORS, main.tsx.

## Infer
Treat `docs/agency/` + this pack as current planning; treat COMPETITIVE_AI and PROJECT.md as historical.

## Do not know
Whether llms.txt is consumed by any tool in prod.
