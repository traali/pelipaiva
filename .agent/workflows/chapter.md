# Workflow: Chapter (Session Start)

The opening rite for any agent session in `pelipaiva`. Takes ~10 seconds.

---

## Steps

1. **Read `AGENTS.md`**
   Verify the non-negotiables, stack rules, and testing requirements.
2. **Read the tail of `ROLL.md`**
   Read the last ~15 entries to understand recent decisions and dead ends.
3. **Read the Task**
   Read the user prompt, issue, or `.agent/handoffs/<branch>.md`.
4. **Plan Before Execution**
   Formulate a concise plan. For major architectural changes, write an implementation plan.

---

## Monastic Offices & Accountable Domains

Work must be divided and delegated to specialized subagents according to domain accountability and model tier:

| Office | Subagent Name | Accountable Domain | Recommended Model Tier |
|---|---|---|---|
| **Cellarer** | `cellarer_office` | Edge proxy, Cloudflare Workers, KV sync, Webcal RFC 5545 feed | `inherit` / `pro` (security/crypto) or `flash` (lookups) |
| **Scriptorium** | `scriptorium_office` | Parsers (ICS, WhatsApp NLP, Excel/table, OCR) & Sports Federation APIs | `pro` / `inherit` (complex extraction) or `flash` (regex) |
| **Prior** | `prior_office` | Core domain state, Dexie schemas, conflict reasoning, transit & arrival rules | `pro` / `inherit` (graph traversal & concurrency) |
| **Master of Works** | `works_office` | UI components, Radix primitives, Tailwind 4 tokens, Nova Design Protocol | `inherit` / `pro` (component architecture) or `flash` (styling) |
| **Sacrist** | `sacrist_office` | Vitest suites, deterministic mock fixtures, Playwright E2E specs | `flash` (fast test runs) or `pro` (adversarial suites) |
| **Visitor** | `visitor_office` | Clean-room adversarial audit against `AGENTS.md` (independent, no author bias) | `pro` / `inherit` (strict non-biased verification) |

---

## Dynamic Office Creation & Expansion Protocol

1. **New Specialized Domains:** If a task introduces a new specialized domain (e.g. FMI Weather Radar & Geo routing, On-device Local LLM / WebLLM, WhatsApp bot integrations, or telemetry diagnostics), the agent MUST dynamically create a new dedicated Office via `define_subagent` and assign the appropriate model tier (`flash`, `pro`, or `inherit`).
2. **Charter Expansion:** When a task is tightly coupled across sub-domains, the lead Office may expand its scope for that specific mission while maintaining clear accountability.
3. **Accountability Principle:** Every file change and test MUST be owned by an accountable Office. No anonymous or untracked changes are permitted.


