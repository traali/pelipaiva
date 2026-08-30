# 11 — Findings catalog

Sorted S0→S4. SHA `20bad06`. No S0.

## S1

None that meet “blocker in prod today.” Closest: ingest catch + cup seed can persist catalog fixtures (**F-API-003 / F-ARC-005**, scored **S2** — honesty bug, not outage).

## S2

### F-DOC-001 — Root README is not the product
- **confidence:** high
- **evidence:** README.md L1–9 vs index.html title FamDay
- **blast:** new hires / other agents
- **action:** Replace with run/test/deploy + link docs/agentic-study + docs/agency

### F-DOC-002 — PROJECT.md milestones IN_PROGRESS
- **evidence:** PROJECT.md L45–51 vs pages.dev 200
- **action:** Mark shipped; point at this pack

### F-DOC-003 — COMPETITIVE_AI P0 register stale
- **evidence:** COMPETITIVE_AI L21–50 vs ErrorBoundary, worker CORS L200, familyCloud L51, ci.yml tsc
- **action:** Banner “historical; see 04-docs-vs-reality”

### F-ARC-001 — statsEngine god module
- **evidence:** statsEngine.ts ~1784 lines; time.ts imports TZ from it
- **action:** Split parseAssociationUrl / extract HTML / synthetics

### F-ARC-002 — generateOrResolveMatchStats in src
- **evidence:** statsEngine.ts:1485; no UI importer; tests still call
- **action:** Delete or move under tests/

### F-API-001 — CORS missing localhost:3000
- **evidence:** worker.ts L200–206 vs vite.config.ts server.port 3000
- **blast:** local family join from `npm run dev`
- **action:** Add `http://localhost:3000` and 127.0.0.1:3000

### F-API-003 / F-ARC-005 — cup catalog written on failed live fetch
- **evidence:** ingestOfficial.ts L65 catch null, L70–72 officialFromExampleCup
- **action:** Empty state “ei julkaistu”; do not PUT canned HJK/KäPa

### F-SEC-001 — xlsx@0.18.5
- **evidence:** package.json L34; tableAndExcelParser.ts L182–191 2MB cap
- **action:** Prefer TSV paste; isolate parser

### F-REL-001 — Playwright not in CI
- **evidence:** ci.yml vs package.json test:e2e
- **action:** Optional Chromium job; do not block on WebKit linux

### F-QA-001 — tests/e2e/tier* are unit tests
- **evidence:** vitest.config.ts include tests/**/*.test.ts node env
- **action:** Rename folder or README in tests/e2e

### F-QA-002 — tests keep synthetic factory alive
- **evidence:** statsEngine.test.ts imports generateOrResolveMatchStats
- **related:** F-ARC-002

## S3

F-DOC-004 agency SHA drift · F-ARC-003 generateFamilyCode · F-ARC-004 App.tsx shell · F-ARC-007 arrivalRules ignored by planner · F-ARC-009 layer inversion · F-ARC-012 syncState bag · F-API-002 `*.torneopal.com` · F-DATA-001 KV 7d TTL · F-DATA-003 tombstones localStorage · F-SEC-002 OCR CDN fallback · F-SEC-003 unpinned GHA · F-UIX-001 Safari radios · F-UIX-002 PERHE-2 copy · F-REL-002 eslint not CI · F-REL-003 no staging/obs · F-QA-003 no WebKit e2e · F-ARC-006 circular onDeviceLlm/chromeBuiltinAi (dynamic)

Details: `board/traces/*.md` and ARC trace F-ARC-001–013.

## S4 / PASS / BY-DESIGN

F-API-004 DKJVB-H 403 · F-DATA-002 first names in KV (constitution last names) · F-SEC-004 fail-closed FAMILY_CODES · F-ARC-008 native stub · F-UIX-003 ErrorBoundary styles · F-C-001 doc vs code adjudicated in contradictions.md

## Scores (gauntlet 0–100)

| Axis | Score | Rubric note |
|---|---|---|
| Architecture integrity | 74 | Clear SoT + pure graph; god statsEngine/App |
| Operability | 68 | CD works; no staging/logs |
| Security posture | 77 | Fail-closed bus + allowlist; xlsx + unpinned GHA |
| UX coherence | 76 | Finnish HUD; Safari radios; PERHE-2 |
| Data discipline | 84 | Thin KV; Dexie events; TTL 7d |
| Test truthfulness | 71 | Strong vitest; “e2e” misnamed; Playwright ungated |

Mean **75**. Not a toy; not a hardened multi-tenant platform.
