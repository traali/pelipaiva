# 01 — Strategy

**SHA:** `20bad06`  
**DEPTH:** **deep-gauntlet** (single-app PWA + one Worker; high constitution/privacy surface, not a 40-package monorepo).

## Why this depth

Recon shows one bounded product with **dense domain rules** (Finnish sports ingest, fail-closed family bus, no fake scores) and **severe doc-code drift**. Shallow README review would lie. Full Snowflake/identity-graph staffing would waste budget. Deep-gauntlet: reconstruct 1–2 production paths UI→Worker→KV/vendor; S0/S1 incident stories; score rubric; convergence pass.

## Agents we instantiate

| ID | Mission | Input set | Output | Tools |
|---|---|---|---|---|
| ORCH | Plan, de-dupe, C1–C6, adjudicate | all traces | 03-system-map, contradictions, how-we-worked | read, grep, curl |
| DOC | README/docs/agency vs code | docs/, README, PROJECT, FAMILY_* | traces/doc.md + findings | read, grep |
| ARC | Modules, Dexie SoT, agent graph, dead code | src/lib, App.tsx, native/ | traces/arc.md | read, grep |
| API | Worker + federation + proxy + FMI/LIPAS | worker.ts, torneopal, ingestOfficial, proxy | traces/api.md + vendor table | read, grep, GET-safe curl |
| DATA | Dexie schema, KV roster, localStorage, TTL | db.ts, familyCloud, worker PUT | traces/data.md | read, grep |
| UIX | Surfaces, onboarding, a11y, mobile | src/components, tokens.css | traces/uix.md | read, grep |
| SEC | FAMILY_CODES, CORS, SSRF, xlsx, PII egress | worker, familyCloud, xlsx, ocr | traces/sec.md | read, grep |
| REL | CI/CD gates, observability, rollback | ci.yml, cd.yml, _headers | traces/rel.md | read, gh if present |
| QA | Vitest vs Playwright vs hunters | tests/, ci.yml | traces/qa.md | read, grep |
| SYN | Catalog, exec brief, roadmap | board + traces | 02, 11, 12, README | write reports only |

## Agents we will NOT instantiate

| Skipped | Why |
|---|---|
| Flutter/Wasm mobile | Not a Flutter repo; PWA only + Swift stub |
| Warehouse/dbt/Snowflake | No OLAP |
| K8s/Terraform | Cloudflare Pages+Worker only |
| Payments/billing | None |
| Auth-IdP specialist | Zero-auth is the model; SEC covers it |

Adversarial pair: SEC attacks family bus + proxy after API/DATA traces, without copying ARC conclusions first.

## Comms

Blackboard: `docs/agentic-study/board/`  
Finding IDs: `F-ARC-001` …  
Questions addressed to a role.  
ORCH records contradictions; no silent overwrite.  
UIX and SEC form impressions from surfaces/threats before ARC narrative (recon + component/worker reads).

## Order

1. Phase 0 files (this + recon + internal prompt) — **done before deep findings**.
2. Parallel: DOC, ARC, DATA, API.
3. Then UIX (surfaces known), SEC (reads API/DATA traces), REL, QA.
4. ORCH C1–C6.
5. SYN report pack.
6. DOC convergence: exec brief vs traces.

Stop when: all report files exist; every S0/S1 has path evidence; mermaid drawn; ≥1 contradiction or documented match; exec brief standalone.

Quality bar: rumor without path is deleted or UNKNOWN.

## Internal execution prompt

Full text: [prompts/INTERNAL_EXECUTION_PROMPT.md](./prompts/INTERNAL_EXECUTION_PROMPT.md) (v1, 2026-08-30, SHA `20bad06`).
