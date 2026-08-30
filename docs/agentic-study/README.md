# Agentic repository study — Pelipäivä / FamDay

**Date:** 2026-08-30  
**Ref SHA:** `20bad06e559d77310bd8cc1971c2e1f1ff988f95`  
**Prod:** https://pelipaiva.pages.dev  
**Depth:** deep-gauntlet (see `01-strategy.md`)

## How this was run

1. Phase 0 recon → `00-recon.md`, `01-strategy.md`, `prompts/INTERNAL_EXECUTION_PROMPT.md` **before** findings.
2. Hub-and-spoke. Four explore subagents (DOC/ARC/API/DATA) **completed** and wrote `board/traces/{doc,arc,api,data}.md`. UIX/SEC/REL/QA traces authored by ORCH. SYN merged; overlapping finding IDs mapped in [board/id-map.md](./board/id-map.md). Catalog IDs in `11-findings-catalog.md` are law.
3. Comms: `board/index.md`, `questions.md`, `contradictions.md`, `board/traces/`.
4. Cross-cutting C1–C6 in 03, 04, 09, 10, 02.
5. No application source was modified.

**Internal prompt (law):** [prompts/INTERNAL_EXECUTION_PROMPT.md](./prompts/INTERNAL_EXECUTION_PROMPT.md) v1 — not amended mid-flight.

## Roster actually used

| ID | Who | Output |
|---|---|---|
| ORCH | Grok Build | plan, C1–C6, adjudication |
| DOC | ORCH-as-DOC | traces/doc.md |
| ARC | explore subagent + ORCH | traces/arc.md (subagent wins) |
| API/DATA/UIX/SEC/REL/QA | ORCH-as-specialist | traces/* |
| SYN | ORCH | this pack |

## Index

| File | Use |
|---|---|
| [00-recon.md](./00-recon.md) | Map |
| [01-strategy.md](./01-strategy.md) | Depth + team |
| [02-executive-brief.md](./02-executive-brief.md) | One pager |
| [03-system-map.md](./03-system-map.md) | Mermaid |
| [04-docs-vs-reality.md](./04-docs-vs-reality.md) | Drift |
| [05-architecture.md](./05-architecture.md) | Seams |
| [06-ui-ux.md](./06-ui-ux.md) | Surfaces |
| [07-apis-and-vendors.md](./07-apis-and-vendors.md) | Inventory |
| [08-data-and-storage.md](./08-data-and-storage.md) | Dexie/KV |
| [09-security.md](./09-security.md) | Threats |
| [10-delivery-and-quality.md](./10-delivery-and-quality.md) | CI/tests |
| [11-findings-catalog.md](./11-findings-catalog.md) | IDs |
| [12-recommendations-roadmap.md](./12-recommendations-roadmap.md) | Now/next |
| [13-open-questions.md](./13-open-questions.md) | Humans |
| [board/](./board/) | Audit trail |
| [prompts/](./prompts/) | Internal law |

## How to re-run

Checkout SHA. Read INTERNAL_EXECUTION_PROMPT. Re-probe GET pages + calendar 403. Re-grep leftover hunters. Do not trust COMPETITIVE_AI counts. Prefer code.

## How the team worked

- Evidence rule killed stale P0s (X-001–X-004).
- Debate: constitution “no last names” vs PUT `playerName` → BY-DESIGN if given names (F-DATA-002).
- Debate: ingest catch-null — ARC S1 candidate; SYN scored **S2** (data honesty, not outage).
- Prompt v1 unchanged.
- Stop. No product fixes in this study.

## Quality gate

- [x] 00-recon + 01-strategy predate catalog
- [x] Repo-specific internal prompt
- [x] Mermaid
- [x] Integration inventory
- [x] Data inventory
- [x] ≥1 contradiction (eight)
- [x] Findings with IDs + paths
- [x] Exec brief standalone
- [x] How the team worked
