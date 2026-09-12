# 🏛️ The Monastic Governance Model for AI Coding Agents

[![Template Repository](https://img.shields.io/badge/GitHub-Template_Repository-blue?logo=github)](https://github.com/traali/monastic-governance/generate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-20%2B-brightgreen?logo=node.js)](https://nodejs.org/)
[![Model Tier Routing](https://img.shields.io/badge/Model_Routing-Flash_%7C_Pro-purple)](https://github.com/traali/monastic-governance)
[![Audited by Visitor](https://img.shields.io/badge/Audit-Clean--Room_Visitor-success)](https://github.com/traali/monastic-governance)

> **A battle-tested, zero-regression governance framework for software engineered by autonomous AI coding assistants (Claude Code, Antigravity, Cursor, GitHub Copilot, Codex).**

---

## ⚡ Quick Start: Adopt in 60 Seconds

Click the **["Use this template"](https://github.com/traali/monastic-governance/generate)** button above, or clone this repository into your project:

```bash
# 1. Copy the core monastic structure to your codebase
cp AGENTS.template.md /path/to/your-repo/AGENTS.md
cp ROLL.template.md /path/to/your-repo/ROLL.md
cp -r .agent /path/to/your-repo/
cp -r scripts /path/to/your-repo/
cp lefthook.yml /path/to/your-repo/

# 2. Add the automated visit script to your package.json
# "scripts": { "visit": "node scripts/monastery-visitor.mjs" }

# 3. Verify the pre-visitation gate
npm run visit
```

Then prompt your AI assistant:
> *"This repository follows the Monastic Governance Model. Before writing any code, read `AGENTS.md` and `.agent/workflows/chapter.md`. Divide work across the accountable offices, run `npm run visit` before completion, and spawn an isolated Clean-Room Visitor subagent to audit your diff against `AGENTS.md`."*

---

## 📖 Table of Contents
- [1. Why Agent Swarms Fail (and How the Monastery Solves It)](#1-why-agent-swarms-fail-and-how-the-monastery-solves-it)
- [2. The 5 Pillars of Monastic Governance](#2-the-5-pillars-of-monastic-governance)
- [3. What's New: Recent Additions to the Model](#3-whats-new-recent-additions-to-the-model)
- [4. The 6 Accountable Offices & Model Matrix](#4-the-6-accountable-offices--model-matrix)
- [5. Separation of Duties: The Clean-Room Visitor Protocol](#5-separation-of-duties-the-clean-room-visitor-protocol)
- [6. The Multi-Repo Federation ("The General Chapter")](#6-the-multi-repo-federation-the-general-chapter)
- [7. Complete File Reference & Templates](#7-complete-file-reference--templates)
- [8. Real-World Case Study](#8-real-world-case-study)

---

## 1. Why Agent Swarms Fail (and How the Monastery Solves It)

When modern AI coding agents work on long-lived projects, they inevitably suffer from three fundamental decay loops:

```
❌ The Traditional Agent Failure Loop:
Sprawling 50KB Prompts ──> Context / Prompt Rot ──> Hallucinations & Diff Drift
          ▲                                                   │
          └────────── Self-Confirmation Bias ─────────────────┘
                      (Author audits own code, excuses bugs)
```

| Failure Mode | Why It Happens | How Monastic Governance Solves It |
|---|---|---|
| **Context & Prompt Rot** | Prompts grow uncontrollably. LLMs skip rules buried in 50KB documentation. | **Hard-Capped Supreme Rule (`AGENTS.md` < 1,500 words)**. Volatile facts (versions, routes) are strictly banned and offloaded to single sources of truth. |
| **Self-Confirmation Bias** | The agent that wrote the implementation verifies its own pull request, inventing excuses for broken edges. | **Separation of Duties (§11)**: The author agent NEVER audits its own code. An isolated **Visitor subagent** audits the diff with zero prior reasoning or author context. |
| **Swarm Noise & Diff Drift** | Free-roaming multi-agent swarms touch unrelated files, duplicate code, and pass blame. | **6 Accountable Offices**: Every file and test is owned by a dedicated Office with a matched AI model tier. |

---

## 2. The 5 Pillars of Monastic Governance

```
                    ┌─────────────────────────┐
                    │        AGENTS.md        │
                    │   The Supreme Rule      │
                    │    (< 1,500 words)      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│Accountable Offices│   │Pre-Visitation Gate│   │Clean-Room Visitor │
│  Domain Ownership │   │npm run visit (CI) │   │ Adversarial Audit │
│ Model Tier Routing│   │0 Lint, 100% Green │   │PASS / WITH / BLOCK│
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

1. **Constitutional Precedence:** `AGENTS.md` is the supreme law. Tool configs (`.cursorrules`, `CLAUDE.md`, IDE instructions) are thin pointers to `AGENTS.md`.
2. **Separation of Duties:** The author who wrote a change never audits it. Verification is performed by a fresh, clean-room Visitor subagent.
3. **Accountable Offices:** Tasks are cleanly divided across dedicated domains (Edge, Parsers, State, UI, Tests, Audit).
4. **Deterministic Pre-Conditions:** The Visitor only inspects a clean tree (`npm run visit` passing: 0 lint errors, 100% green tests, strict typecheck).
5. **Continuous Chronicle:** All decisions, dispensations, and audit verdicts are permanently recorded in an append-only `ROLL.md`.

---

## 3. What's New: Recent Additions to the Model

The Monastic Model has evolved with state-of-the-art agentic engineering:

### 🌟 1. Multi-Repo Federation ("The General Chapter")
When a system expands beyond a single repository, the architecture scales into a **Federation of Monasteries**:
- **Sovereign Monasteries:** Individual repos with their own internal Rule (`AGENTS.md`), local offices, and tests.
- **The General Chapter Repository:** A central governance repo containing:
  - **The Canons (`contracts/index.ts`):** Shared domain types and contract boundaries.
  - **The Global Roll (`GLOBAL_ROLL.md`):** Cross-monastery architectural decisions.
  - **Supreme Golden Test Suite:** Outside-in, black-box integration tests verifying user journeys across repositories without blowing up local LLM context limits (< 1,500 words per repo).

### 🌟 2. CI-Enforced Visitation Gate (`.github/workflows/monastic-visit.yml`)
Automated enforcement runs in cloud CI on every Pull Request:
- **Word Count Enforcement:** Automatically fails CI if `AGENTS.md` exceeds 1,500 words.
- **Static Linter & Typecheck Gate:** Zero errors required.
- **Deterministic Test Suite:** 100% green tests required before human or Visitor review.

### 🌟 3. Model Tier Routing Matrix
Different offices require different reasoning capabilities. Matching model tiers prevents budget waste while maintaining elite reasoning quality:
- **`flash` / `flash_lite`:** Fast regex checks, mock fixtures, formatting, test runs.
- **`pro` / `inherit`:** Architectural state machines, concurrency handling, and clean-room adversarial audits.

### 🌟 4. Formalized Fault Attribution (`house` vs `RULE`)
Every audit finding is classified into one of two faults:
- `house`: Code violated the Rule. The author fixes the code.
- `RULE`: Code is valid, but the Rule is obsolete, contradictory, or impractical. The author files a **Ground-4 Rebuttal**, amends `AGENTS.md`, and logs a dispensation in `ROLL.md`.

### 🌟 5. Dynamic Office Chartering
When a new technical domain arises (e.g. Weather Radar, Local on-device LLMs, WhatsApp bots), the Archon dynamically charters a specialized Office via `define_subagent` rather than bloating existing agents.

---

## 4. The 6 Accountable Offices & Model Matrix

| Office | Subagent Name | Accountable Domain | Recommended Model Tier | Key Responsibilities |
|---|---|---|---|---|
| **Cellarer** | `cellarer_office` | Edge proxy, Cloudflare Workers, serverless, KV sync, package configs | `pro` (crypto/auth) or `flash` (configs) | Zero hardcoded secrets, 64KB payload limits, optimistic locking (`If-Match`), CORS headers |
| **Scriptorium** | `scriptorium_office` | Parsers (ICS, JSON, XML, OCR), NLP message extractors, external APIs | `pro` (complex parsers) or `flash` (regex) | Deterministic parsing, zero date/venue fabrication, fail closed on broken inputs |
| **Prior** | `prior_office` | Core domain state, IndexedDB/Postgres, conflict reasoning, transit math | `pro` / `inherit` | Concurrency safety, table indexing, eliminating false alarms/overlaps |
| **Master of Works** | `works_office` | UI components, design tokens, styling, responsiveness, accessibility | `inherit` / `pro` (layout) or `flash` (CSS) | 44px touch targets (`touch-target`), 60fps scrolling, fluid typography, no text clipping |
| **Sacrist** | `sacrist_office` | Unit test suites, mock fixtures, E2E browser tests | `flash` (fast runs) or `pro` (adversarial suites) | 100% test green gate, deterministic mock fixtures, test speed (< 5s) |
| **Visitor** | `visitor_office` | Clean-room adversarial audit against `AGENTS.md` (never writes code) | `pro` / `inherit` (strict reasoning) | Independent audit report, zero compliments, exact rule & line citations |

---

## 5. Separation of Duties: The Clean-Room Visitor Protocol

When an author agent finishes implementing code, it **MUST NOT** approve its own work. Instead, it spawns an isolated Visitor subagent with:
1. `AGENTS.md` (The Rule)
2. The `git diff` against base branch
3. The test results
4. **Zero conversation history or author reasoning.**

### The Adversarial Audit Directive:
> *"Be adversarial. Zero findings is a valid and expected outcome. Do NOT invent findings to appear thorough. Do NOT summarize what went well. Do NOT compliment the author. Cite exact rule section (§N) and file:line for every finding."*

### Verdicts:
- **`PASS`**: 0 blocking findings, 0 advisory findings. Merge ready.
- **`PASS WITH FINDINGS`**: 0 blocking findings, advisory findings logged in `DEBT.md` with owner and deadline.
- **`BLOCK`**: 1+ blocking findings (security vulnerability, data loss, contract breach). Cannot merge.

---

## 6. The Multi-Repo Federation ("The General Chapter")

For large-scale architectures spanning multiple microservices, applications, or edge workers:

```
                      ┌─────────────────────────────────┐
                      │    CENTRAL GOVERNANCE REPO      │
                      │  traali/sports-federation       │
                      │                                 │
                      │  • The Canons (contracts/index) │
                      │  • The Global Roll (GLOBAL_ROLL)│
                      │  • Supreme Golden Test Suite    │
                      └────────────────┬────────────────┘
                                       │ Enforces Contract Invariants
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   MONASTERY 1    │          │   MONASTERY 2    │          │   MONASTERY 3    │
│    pelipaiva     │          │  football-stats  │          │     Parkkis      │
│                  │          │                  │          │                  │
│ • Local AGENTS.md│          │ • Local AGENTS.md│          │ • Local AGENTS.md│
│ • Local Offices  │          │ • Local Offices  │          │ • Local Offices  │
│ • Context <1.5k  │          │ • Context <1.5k  │          │ • Context <1.5k  │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

Each sovereign monastery keeps its LLM context tight and focused (< 1,500 words), while the central Federation repository guarantees system-wide contract integrity.

---

## 7. Complete File Reference & Templates

All ready-to-use templates are included in this repository:

| File | Purpose | Location |
|---|---|---|
| **The Rule Template** | Canonical project rule (< 1,500 words) | [`templates/AGENTS.template.md`](templates/AGENTS.template.md) |
| **Chronicle Template** | Append-only decision log | [`templates/ROLL.template.md`](templates/ROLL.template.md) |
| **Chapter Rite** | Session start & delegation workflow | [`.agent/workflows/chapter.md`](.agent/workflows/chapter.md) |
| **Visitation Workflow** | Clean-room adversarial audit instructions | [`.agent/workflows/visitation.md`](.agent/workflows/visitation.md) |
| **Rebuttal Workflow** | Right of appeal & 4 grounds | [`.agent/workflows/rebuttal.md`](.agent/workflows/rebuttal.md) |
| **Pre-Visitation Gate** | Automated Node.js verification script | [`scripts/monastery-visitor.mjs`](scripts/monastery-visitor.mjs) |
| **CI Gate Workflow** | GitHub Actions cloud workflow | [`.github/workflows/monastic-visit.yml`](.github/workflows/monastic-visit.yml) |
| **Git Hook Config** | Lefthook pre-commit/pre-push hooks | [`lefthook.yml`](lefthook.yml) |

---

## 8. Real-World Case Study

The Monastic Governance Model was developed and battle-tested in **[Pelipäivä](https://github.com/traali/pelipaiva)**, a production offline-first junior sports PWA serving Finnish families:
- **57 test files, 509/509 deterministic tests passing (100% green)**
- **Zero ESLint errors & 0 TS errors**
- **Clean-room visitation audits** caught subtle issues (untested CSV parsers, DST timezone edge cases, missing touch targets) before code reached production.
- Scaled smoothly across a **6-monastery multi-repo federation** (`pelipaiva`, `football-stats`, `Parkkis`, `volleyball-stats`, `basketball-stats`, `weather-stats`) governed by `sports-federation`.

---

## 🤝 Contributing & License

Contributions, amendments, and case studies are welcome!
- License: [MIT](LICENSE)
- Creator: **[Arto Oinonen](https://github.com/traali)**
