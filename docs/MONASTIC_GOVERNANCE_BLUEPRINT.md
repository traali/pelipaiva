# The Monastic Governance Model for AI Coding Agents
**A Battle-Tested Blueprint for High-Discipline, Zero-Regression Agentic Software Development**

---

## 1. Executive Summary: Why Agent Swarms Fail and How the Monastery Fixes It

When AI coding agents (Claude, Cursor, Antigravity, Copilot) work on long-lived codebases, they typically degrade over time due to three fundamental traps:
1. **Context & Prompt Rot:** Massive system prompts and sprawling rule files that agents ignore or hallucinate over.
2. **Self-Confirmation Bias:** When the agent that wrote the code audits its own code, it invents justifications and overlooks bugs.
3. **Unaccountable Swarms:** Complex multi-agent swarms that produce noise, pass blame, and introduce hidden regressions.

**The Monastic Model** replaces chaotic agent swarms with **Cistercian order**:
* **A Single Supreme Rule (`AGENTS.md`):** Concise (< 1,500 words), strict, tool-agnostic.
* **Separation of Duties (Clean-Room Visitation):** The author never audits their own code. An isolated Visitor subagent with a fresh context performs an adversarial audit.
* **Accountable Offices & Model Tiers:** Tasks are divided across specialized domains (Edge, Parsers, State, UI, Tests) with model sizes matched to task complexity (`flash` for lookups, `pro` for architecture).
* **Deterministic Gates:** Code cannot be merged without 100% green tests, 0 lints, and an independent audit report.

---

## 2. The 4 Pillar Files of a Monastic Repository

Every Monastic repository has a clean, standard file structure:

```
├── AGENTS.md                  # The supreme canonical rule (< 1500 words)
├── ROLL.md                    # Append-only chronicle of decisions & dispensations
├── .agent/
│   ├── workflows/
│   │   ├── chapter.md         # Session opening rite & office delegation matrix
│   │   ├── visitation.md      # Clean-room adversarial audit protocol
│   │   └── rebuttal.md        # Procedure for author to appeal audit findings
│   └── visitations/           # Audit reports from every feature/release
└── scripts/
    └── monastery-visitor.mjs  # Pre-visitation CI gate script
```

---

## 3. Pillar 1: The Supreme Rule (`AGENTS.md`)

Create `AGENTS.md` in the root of your project. Keep it under **1,500 words**. Any platform config (`CLAUDE.md`, `.cursorrules`, `SYSTEM_PROMPT`) must simply point to this file.

```markdown
# AGENTS.md — The Rule of [Project Name]

The canonical, tool-agnostic rule for all AI agents and contributors in this repository.

## §0 Precedence
1. `AGENTS.md` is supreme.
2. Native tool configs (.cursorrules, CLAUDE.md) are thin pointers to this file.
3. In conflicts between code comments and `AGENTS.md`, `AGENTS.md` wins.

## §1 Identity & Architecture
- [1-2 sentences on what the system does]
- [Core architectural principles: Offline-first, Event-driven, etc.]

## §2 Stack & Prohibitions
| Use | Never |
|---|---|
| TypeScript (strict mode) | `any` types, un-typed dynamic casting |
| Tailwind CSS v4 + Accessible Primitives | Unstyled raw components, ad-hoc inline styles |
| Vitest / Jest for unit tests | Untested regular expressions or date logic |
| Zero-Secret Commitment | Hardcoded API keys, tokens, or private endpoints |

## §3 Testing & Quality Gates
- 100% deterministic test fixtures (zero dynamic/relative date math in mocks).
- Definition of Done: 0 lint errors, 100% green tests, clean production build.

## §4 Visitation (Adversarial Audit)
- Separation of Duties: The author who wrote a change NEVER performs its final audit.
- An independent Visitor with a fresh context audits the diff against this file.
- Verdicts: PASS · PASS WITH FINDINGS · BLOCK.
```

---

## 4. Pillar 2: The 6 Accountable Offices & Model Matrix

Instead of random prompts, divide your development work across **Accountable Offices** and assign the right model size to maximize speed and cost-efficiency:

| Office | Domain & Jurisdiction | Recommended AI Model Tier | Core Accountability |
|---|---|---|---|
| **Cellarer** | Infrastructure, API proxies, serverless workers, environment configs | `pro` (crypto/auth) or `flash` (configs) | Zero secrets, security headers, rate limits, payload guards |
| **Scriptorium** | Data parsers, external feeds, NLP extractors, file ingestion | `pro` (complex parsing) or `flash` (regex) | Deterministic parsing, zero hallucinated dates/venues |
| **Prior** | Core domain state, databases (IndexedDB/Postgres), business logic | `pro` / `inherit` | Concurrency, schema indexing, state machines |
| **Master of Works** | UI components, design tokens, styling, accessibility | `inherit` / `pro` (layout) or `flash` (styling) | 44px touch targets, responsive design, 60fps animations |
| **Sacrist** | Unit tests, mock fixtures, E2E specs | `flash` (fast execution) or `pro` (adversarial suites)| 100% green test suite, zero flaky timeouts |
| **Visitor** | Clean-room adversarial audit against `AGENTS.md` | `pro` / `inherit` (strict reasoning) | Independent audit report, zero compliments, rule citations |

---

## 5. Pillar 3: Separation of Duties & The Clean-Room Visitor

When an agent completes a task, it **must not** declare the task finished on its own. It launches an **isolated Visitor subagent** with no conversation history.

### The Visitor Prompt:
```
You are the outside Visitor conducting an independent audit of this branch against AGENTS.md.
You did not write this code.

Your context is: AGENTS.md, the git diff against main, and the test results.
Nothing else — no author reasoning, no conversation history.

Instructions:
1. Read AGENTS.md in full before inspecting the diff.
2. For every finding, cite the exact rule section (§N) and file:line that violates it.
3. Classify each finding as `blocking` (security/data loss) or `advisory`.
4. Assign fault: `house` (code issue) or `RULE` (rule is wrong).
5. Zero findings is a valid and expected outcome. Do not invent findings.
   Do not summarize what went well. Do not compliment the author.
6. Write your report to .agent/visitations/<branch>-<date>.md and report verdict: PASS | PASS WITH FINDINGS | BLOCK.
```

### The Report Format:
```markdown
# Visitation: <feature-name> — <date>
Visitor: Outside-Visitor · Implementer: Unknown · Base: <base-sha>

## Verdict
PASS | PASS WITH FINDINGS | BLOCK

## Findings
| # | Class | Fault | Rule § | Location | Claim |
|---|---|---|---|---|---|
| F1 | blocking | house | §2 | src/api.ts:42 | Missing input sanitization on freeform input |

## Areas Checked
- List of files and criteria inspected.
```

---

## 6. Pillar 4: The Automated Pre-Visitation Gate

Save this script at `scripts/monastery-visitor.mjs` and add `"visit": "node scripts/monastery-visitor.mjs"` to `package.json`:

```javascript
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

console.log('🏛️  [MONASTERY] Initiating Pre-Visitation Protocol...\n');

// 1. Check Rule Length
if (existsSync('AGENTS.md')) {
  const content = readFileSync('AGENTS.md', 'utf8');
  const wordCount = content.trim().split(/\s+/).length;
  console.log(`📜 The Rule: AGENTS.md (${wordCount} words / 1500 cap)`);
  if (wordCount > 1500) {
    console.error('❌ AGENTS.md exceeds 1500 words! Prune volatile facts.');
    process.exit(1);
  }
}

// 2. Static Lint Check
console.log('🔍 Running static lint check...');
execSync('npm run lint', { stdio: 'inherit' });

// 3. Test Suite Check
console.log('🧪 Running test suite...');
execSync('npm run test', { stdio: 'inherit' });

console.log('\n✨ [MONASTERY] Pre-conditions met! Ready for Clean-Room Visitor.\n');
```

---

## 7. 5-Minute Setup Guide for New Repositories

1. **Step 1:** Copy `AGENTS.md` template to the project root and fill in your tech stack.
2. **Step 2:** Create `.agent/workflows/chapter.md` and `.agent/workflows/visitation.md`.
3. **Step 3:** Add `scripts/monastery-visitor.mjs` and wire it in `package.json` under `"visit"`.
4. **Step 4:** Add a Git pre-commit hook (e.g. via `lefthook` or `husky`) to run `npm run visit` before every commit.
5. **Step 5:** Instruct your AI assistant: *"We follow the Monastic Governance Model. Read AGENTS.md and chapter.md before starting any work."*
