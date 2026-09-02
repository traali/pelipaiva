# The Monastic Governance Model for AI Coding Agents
**The Definitive, All-in-One Specification & Implementation Blueprint**
*Zero-Regression, Clean-Room Audited Agentic Software Development*

---

## Table of Contents
1. [Why Agent Swarms Fail & The Monastic Solution](#1-why-agent-swarms-fail--the-monastic-solution)
2. [The 4 Core Principles](#2-the-4-core-principles)
3. [The Complete Monastic Architecture](#3-the-complete-monastic-architecture)
4. [The 6 Accountable Offices & Model Specialization Matrix](#4-the-6-accountable-offices--model-specialization-matrix)
5. [File 1: `AGENTS.md` (The Supreme Rule Template)](#5-file-1-agentsmd-the-supreme-rule-template)
6. [File 2: `ROLL.md` (The Append-Only Chronicle Template)](#6-file-2-rollmd-the-append-only-chronicle-template)
7. [File 3: `.agent/workflows/chapter.md` (Session Start & Delegation)](#7-file-3-agentworkllowschaptermd-session-start--delegation)
8. [File 4: `.agent/workflows/visitation.md` (Clean-Room Audit Protocol)](#8-file-4-agentworkflowsvisitationmd-clean-room-audit-protocol)
9. [File 5: `.agent/workflows/rebuttal.md` (Right of Appeal Protocol)](#9-file-5-agentworkflowsrebuttalmd-right-of-appeal-protocol)
10. [File 6: `scripts/monastery-visitor.mjs` (Automated Gate Script)](#10-file-6-scriptsmonastery-visitormjs-automated-gate-script)
11. [File 7: `lefthook.yml` (Git Pre-Commit & Pre-Push Hook)](#11-file-7-lefthookyml-git-pre-commit--pre-push-hook)
12. [5-Minute Quickstart: How to Initialize Any Repository](#12-5-minute-quickstart-how-to-initialize-any-repository)
13. [How to Prompt Your AI Agent to Follow This Model](#13-how-to-prompt-your-ai-agent-to-follow-this-model)

---

## 1. Why Agent Swarms Fail & The Monastic Solution

When AI coding assistants (Claude, Cursor, Antigravity, Copilot, Codex) work on long-lived software projects, they inevitably degrade through three failure modes:

| Failure Mode | Why It Happens | How the Monastery Solves It |
|---|---|---|
| **Context / Prompt Rot** | Prompts grow uncontrollably. Agents ignore rules buried in 50KB files. | **The Rule is hard-capped (< 1,500 words)**. All volatile facts (versions, routes) live in single-source files. |
| **Self-Confirmation Bias** | The agent that wrote the code verifies its own code, inventing excuses for bugs. | **Separation of Duties (§11)**: The author agent NEVER audits its own code. An isolated Visitor subagent audits the diff with zero author bias. |
| **Swarm Noise & Diff Drift** | Autonomous agents without strict domain boundaries touch unrelated files. | **6 Accountable Offices**: Every file and test is owned by a dedicated Office running on a matched model tier. |

---

## 2. The 4 Core Principles

1. **Precedence:** `AGENTS.md` is the supreme project law. Native IDE tool rules (`.cursorrules`, `CLAUDE.md`) are thin one-line pointers to `AGENTS.md`.
2. **Separation of Duties:** Writing code and auditing code are strictly decoupled across different agent contexts.
3. **Deterministic Verification:** 100% green unit tests, 0 lint errors, and zero dynamic/fabricated date mocks are required before any merge.
4. **Adversarial Auditing:** Zero findings is a valid outcome. The Auditor never compliments the author, never summarizes what went well, and cites exact `rule:line` for every finding.

---

## 3. The Complete Monastic Architecture

```
├── AGENTS.md                  # 1. The Supreme Rule (< 1500 words)
├── ROLL.md                    # 2. Append-only history of decisions & dispensations
├── package.json               # 3. Standard scripts: lint, test, build, visit
├── lefthook.yml               # 4. Pre-commit/pre-push enforcement hooks
├── scripts/
│   └── monastery-visitor.mjs  # 5. Pre-visitation automated gate runner
└── .agent/
    ├── workflows/
    │   ├── chapter.md         # 6. Session start & office delegation
    │   ├── visitation.md      # 7. Clean-room audit specification
    │   └── rebuttal.md        # 8. Ground-based appeal procedure
    └── visitations/           # 9. Permanent audit records (<branch>-<date>.md)
```

---

## 4. The 6 Accountable Offices & Model Specialization Matrix

Divide all development tasks across these 6 specialized offices, allocating model tiers based on complexity:

| Office | Accountable Domain & Files | Recommended AI Model Tier | Core Responsibility |
|---|---|---|---|
| **Cellarer** | Edge routes, Workers, serverless, KV sync, package configs, CI | `pro` (crypto/auth) or `flash` (configs) | Zero hardcoded secrets, 64KB payload limits, optimistic locking (`If-Match`), CORS |
| **Scriptorium** | Parsers (ICS, JSON, XML, OCR), NLP message extractors, external APIs | `pro` (complex parsers) or `flash` (regex) | Deterministic parsing, zero date/venue fabrication, fail closed on broken inputs |
| **Prior** | Core domain state, IndexedDB/Postgres, conflict reasoning, transit math | `pro` / `inherit` | Concurrency safety, table indexing, eliminating false alarms/overlaps |
| **Master of Works** | UI components, design tokens, styling, responsiveness, accessibility | `inherit` / `pro` (layout) or `flash` (CSS) | 44px touch targets (`touch-target`), 60fps scrolling, fluid typography, no text clipping |
| **Sacrist** | Unit test suites, mock fixtures, E2E browser tests | `flash` (fast runs) or `pro` (adversarial suites) | 100% test green gate, deterministic mock fixtures, test speed (< 5s) |
| **Visitor** | Clean-room adversarial audit against `AGENTS.md` (never writes code) | `pro` / `inherit` (strict reasoning) | Independent audit report, zero compliments, exact rule & line citations |

---

## 5. File 1: `AGENTS.md` (The Supreme Rule Template)

Save this file as `AGENTS.md` in your repository root. Keep the word count **under 1,500 words**.

```markdown
# AGENTS.md — The Rule of [Your Project Name]

The canonical, tool-agnostic rule for all AI agents and contributors working in this repository.

---

## §0 Precedence
1. `AGENTS.md` (this file) is the supreme project rule.
2. Native tool configs (`CLAUDE.md`, `.cursorrules`, etc.) are thin pointers to this file and must contain no independent rules.
3. In conflicts between code comments and `AGENTS.md`, `AGENTS.md` wins.

---

## §1 Identity & Architecture
- [Briefly state what your app does].
- **Core Architecture:** [e.g. Offline-first IndexedDB, Client-Side Compute, Edge API Proxy, Zero-Auth Sync].

---

## §2 Stack & Invariants
| Use | Never |
|---|---|
| Strict TypeScript (no `any` types) | Ad-hoc `any` casting, untyped dynamic objects |
| Accessible UI primitives + Design Tokens | Unstyled raw primitives, ad-hoc inline styles |
| Indexed database persistence for domain data | Direct un-indexed localStorage for core state |
| Vitest / Jest for automated tests | Untested parser regex or date manipulation |
| Zero-Secret Commitment | Hardcoded API keys, tokens, or environment secrets |

---

## §3 Testing & Quality Gates
- **Unit & Integration:** All parsers, date calculations, and business logic must have deterministic test fixtures.
- **Pre-visitation Gate:** Run `npm run visit` before any commit.
- **Definition of Done:**
  1. `npm run lint` reports 0 errors.
  2. `npm run test` passes with 100% green tests.
  3. `npm run build` compiles production bundle without warnings.

---

## §4 Security & Hardening
- **Zero Secrets:** Never commit credentials, private keys, or API tokens.
- **Input Sanitization:** All external feeds, freeform user inputs, and uploaded files must be sanitized defensively.
- **Payload Limits:** Strict size bounds on all incoming network requests.

---

## §5 Design & Usability
- **Mobile-First:** Target 360px–430px viewports first; adapt cleanly to desktop.
- **Touch Targets:** All interactive buttons and triggers must have minimum 44px height (`min-h-[44px]` / `touch-target`).
- **Fluid Typography:** Responsive text scaling without manual breakpoint jumps.

---

## §6 Visitation (Separation of Duties)
- The agent or author who wrote a change does NOT perform its final audit.
- An independent **Visitor subagent** receives only: `AGENTS.md`, the git diff, and the test results (no conversation history).
- **Verdicts:** `PASS` · `PASS WITH FINDINGS` · `BLOCK`
- **Finding Classes:**
  - `blocking`: Security vulnerability, data loss, contract breach. Must fix before merge.
  - `advisory`: Rule violation without data loss. Must fix or log in `DEBT.md`.
- **Fault Attribution:**
  - `house`: Code violates the Rule. Fix code.
  - `RULE`: The Rule is impractical or obsolete. Propose an amendment in `ROLL.md`.

---

## §7 Volatile Facts (Not in this file)
Do NOT put volatile facts in `AGENTS.md`. Single sources of truth:
- Library versions: `package.json`
- Recent history: `CHANGELOG.md` and git log
- Architecture decisions: `docs/` and `ROLL.md`
```

---

## 6. File 2: `ROLL.md` (The Append-Only Chronicle Template)

Save this file as `ROLL.md` in the repository root:

```markdown
# ROLL.md — The Chronicle of the Monastery

Append-only record of architectural decisions, dispensations, rule amendments, and visitation verdicts.

---

## 2026-09-02 — Initial Monastic Foundation
- **Actor:** Archon
- **Action:** Established AGENTS.md, .agent/workflows, and automated pre-visitation gate.
- **Rationale:** Eliminate prompt rot and enforce clean-room adversarial auditing.

---

## Format for New Entries:
```markdown
## YYYY-MM-DD — <Title of Change>
- **Office / Author:** <Office Name>
- **Base / Commit:** <sha>
- **Verdict:** PASS | PASS WITH FINDINGS | BLOCK
- **Summary:** <1-2 sentences on what was decided or changed>
```
```

---

## 7. File 3: `.agent/workflows/chapter.md` (Session Start & Delegation)

Save this file as `.agent/workflows/chapter.md`:

```markdown
# Workflow: Chapter (Session Opening Rite)

The opening rite for any agent session. Takes ~10 seconds.

## Steps
1. **Read `AGENTS.md`**: Verify non-negotiables, stack rules, and testing requirements.
2. **Read the tail of `ROLL.md`**: Review the last ~10 entries to understand recent decisions and dead ends.
3. **Read the Task**: Understand the user request or feature spec.
4. **Select Accountable Office & Model Tier**:
   - `cellarer_office`: Edge routes, KV sync, package configs (`pro`/`flash`)
   - `scriptorium_office`: Parsers, external feeds, NLP extractors (`pro`/`flash`)
   - `prior_office`: Core domain state, databases, conflict engine (`pro`)
   - `works_office`: UI components, styling, responsiveness (`inherit`/`flash`)
   - `sacrist_office`: Test suites, mock fixtures (`flash`)
   - `visitor_office`: Clean-room adversarial audit (`pro`/`inherit`)
5. **Plan Before Execution**: Formulate a concise plan. For major changes, write an implementation plan.
```

---

## 8. File 4: `.agent/workflows/visitation.md` (Clean-Room Audit Protocol)

Save this file as `.agent/workflows/visitation.md`:

```markdown
# Workflow: Visitation (Independent Clean-Room Audit)

The outside inspection mechanism. Executed in an isolated subagent context with NO conversation history from the author.

## Preconditions
- [ ] Working tree committed or ready for audit.
- [ ] `npm run visit` passes: 0 lint errors, 100% green tests.

## Prompt to the Visitor Subagent
```
You are the outside Visitor conducting an independent audit of branch <branch> against AGENTS.md.
You did not write this code.

Your context is: AGENTS.md, the git diff against base <base-sha>, and the test results.
Nothing else — no author reasoning, no conversation history.

Instructions:
1. Read AGENTS.md in full before inspecting the diff.
2. For every finding, cite the exact rule section (§N) and file:line that violates it.
3. Classify each finding as `blocking` or `advisory`.
4. Assign fault: `house` (code issue) or `RULE` (rule is wrong).
5. Zero findings is a valid and expected outcome. Do not invent findings.
   Do not summarize what went well. Do not compliment the author.
6. Write your report to .agent/visitations/<branch>-<date>.md and report verdict: PASS | PASS WITH FINDINGS | BLOCK.
```

## Report Template (`.agent/visitations/<branch>-<date>.md`)
```markdown
# Visitation: <feature> — <date>
Visitor: Outside-Visitor · Implementer: Unknown · Base: <base-sha>

## Verdict
PASS | PASS WITH FINDINGS | BLOCK

## Findings
| # | Class | Fault | Rule § | Location | Claim |
|---|---|---|---|---|---|
| F1 | blocking | house | §2 | src/api.ts:42 | Missing input sanitization on freeform input |

*(If no findings, write "No findings.")*

## Areas Checked
- List of criteria and files inspected.
```
```

---

## 9. File 5: `.agent/workflows/rebuttal.md` (Right of Appeal Protocol)

Save this file as `.agent/workflows/rebuttal.md`:

```markdown
# Workflow: Rebuttal (Right of Appeal)

The author may rebut any finding from a Visitation. This prevents false positives and improves rules over time.

## 4 Valid Grounds for Rebuttal:
1. **Ground 1 (Misread):** Visitor's factual claim about the code is incorrect. (Visitor re-reads cited lines).
2. **Ground 2 (Out of Scope):** Pre-existing bug, not introduced by this diff. (Add to `DEBT.md` and proceed).
3. **Ground 4 (Rule Wrong):** Code is valid, but the rule in `AGENTS.md` is outdated or contradictory. (Author amends `AGENTS.md`, logs in `ROLL.md`, finding falls).
4. **Ground 5 (Deferred):** Valid advisory finding, deferred to `DEBT.md` with owner and deadline.
```

---

## 10. File 6: `scripts/monastery-visitor.mjs` (Automated Gate Script)

Save this script as `scripts/monastery-visitor.mjs`:

```javascript
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

console.log('🏛️  [MONASTERY] Initiating Pre-Visitation Protocol...\n');

// 1. Check Rule Word Count Cap (< 1500 words)
if (existsSync('AGENTS.md')) {
  const content = readFileSync('AGENTS.md', 'utf8');
  const wordCount = content.trim().split(/\s+/).length;
  console.log(`📜 The Rule: AGENTS.md (${wordCount} words / 1500 cap)`);
  if (wordCount > 1500) {
    console.error(`❌ AGENTS.md exceeds 1500 words (${wordCount} words)! Prune volatile facts.`);
    process.exit(1);
  }
} else {
  console.error('❌ AGENTS.md not found in root!');
  process.exit(1);
}

// 2. Static Lint Check
console.log('🔍 Running static lint check (eslint)...');
try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ Lint check passed (0 errors).\n');
} catch (e) {
  console.error('❌ Lint check failed.');
  process.exit(1);
}

// 3. Automated Test Suite Check
console.log('🧪 Running Vitest unit & integration test suite...');
try {
  execSync('npm run test', { stdio: 'inherit' });
  console.log('✅ Test suite passed (100% green).\n');
} catch (e) {
  console.error('❌ Test suite failed.');
  process.exit(1);
}

console.log('================================================================');
console.log('✨ [MONASTERY] Pre-conditions met! Ready for Clean-Room Visitor.');
console.log('================================================================\n');
```

Add this script to your `package.json`:
```json
{
  "scripts": {
    "visit": "node scripts/monastery-visitor.mjs"
  }
}
```

---

## 11. File 7: `lefthook.yml` (Git Pre-Commit & Pre-Push Hook)

Save this file as `lefthook.yml` in your project root to enforce rules at the Git level:

```yaml
pre-commit:
  parallel: false
  commands:
    eslint:
      glob: "*.{js,ts,jsx,tsx}"
      run: npx eslint {staged_files}
    oxlint:
      glob: "*.{js,ts,jsx,tsx}"
      run: npx oxlint {staged_files}

pre-push:
  parallel: false
  commands:
    monastery-visit:
      run: npm run visit
```

---

## 12. 5-Minute Quickstart: How to Initialize Any Repository

1. **Copy `AGENTS.md`** to your repository root and update §1 (Identity) and §2 (Stack).
2. **Create the directories**:
   ```bash
   mkdir -p .agent/workflows .agent/visitations scripts
   ```
3. **Copy the workflow files** (`chapter.md`, `visitation.md`, `rebuttal.md`) into `.agent/workflows/`.
4. **Copy `monastery-visitor.mjs`** into `scripts/` and add `"visit": "node scripts/monastery-visitor.mjs"` to `package.json`.
5. **Install Lefthook** (or Husky) to run `npm run visit` on `pre-push`:
   ```bash
   npx lefthook install
   ```

---

## 13. How to Prompt Your AI Agent to Follow This Model

When starting a conversation with any AI agent (Claude, Cursor, Antigravity, Copilot), paste this instruction prompt:

> **"This repository follows the Monastic Governance Model. Before writing any code, open and read `AGENTS.md` and `.agent/workflows/chapter.md`. Divide your work across the 6 accountable offices, run `npm run visit` before finishing, and spawn an isolated Clean-Room Visitor subagent to audit your diff against `AGENTS.md` before declaring completion."**
