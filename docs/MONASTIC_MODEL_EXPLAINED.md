# The Monastic AI Governance & Multi-Abbey Federation Model: Canonical Master Specification

> **"Code that audits itself will always fool itself. The builder who raised the wall must never inspect the mortar."**  
> *Version:* 1.0.0 (Canonical)  
> *Target Systems:* Claude Code, Cursor Composer, ChatGPT / Codex, GitHub Copilot Workspace, Windsurf, Roo Code, and Antigravity Agents.

---

## Table of Contents
1. [The Reasoning (Why Monastic Governance?)](#1-the-reasoning-why-monastic-governance)
2. [What It Is (The Architecture & Core Lexicon)](#2-what-it-is-the-architecture--core-lexicon)
3. [The Mechanism: How It Works Step-by-Step](#3-the-mechanism-how-it-works-step-by-step)
4. [Just-In-Time Specialization (Dynamic JIT Monks)](#4-just-in-time-specialization-dynamic-jit-monks)
5. [The Multi-Abbey Federation (Scaling Across Multiple Repositories)](#5-the-multi-abbey-federation-scaling-across-multiple-repositories)
6. [Universal 5-Minute Implementation Kit (Copy-Paste Blueprints)](#6-universal-5-minute-implementation-kit-copy-paste-blueprints)
7. [Universal System Prompts for External AI Assistants](#7-universal-system-prompts-for-external-ai-assistants)

---

## 1. The Reasoning (Why Monastic Governance?)

Modern AI-assisted software development suffers from three structural pathologies:

### 1.1 The Pathology of Rule Bloat & Context Rot
As repositories evolve, teams accumulate sprawling prompt files (`.cursorrules`, `CLAUDE.md`, system prompts) reaching 5,000–20,000 words.
- **Attention Degradation:** LLMs suffer from "lost-in-the-middle" attention drop-off. Long rules lead to hallucinated conventions, forgotten constraints, and erratic adherence.
- **Configuration Drift:** Different AI tools read disparate configuration formats, pulling the same codebase in conflicting architectural directions.

### 1.2 The Pathology of Sycophantic Self-Review Blindness
When the same LLM agent that authored a feature reviews its own code, it inevitably rubber-stamps the pull request:
- It confirms its own logic traps and cognitive shortcuts.
- It overlooks subtle regressions (broken 44px mobile touch targets, unindexed database queries, or unhandled edge cases).
- It generates sycophantic praise (*"Everything looks clean and well-architected!"*) rather than uncovering defects.

### 1.3 The Pathology of Monolithic Sprawl
As projects expand, single repositories become too large for any LLM context window. Monoliths lead to token exhaustion, slow test suites, and high risk of unintended cross-file side-effects.

---

### The Historical Solution: The Cistercian Monastic Order (1100s)
In medieval Europe, the Cistercian monastic reform solved the exact same organizational challenges across hundreds of autonomous abbeys:
1. **The Rule (*Regula*):** One single, invariant, highly bounded rulebook that every monk knew by heart.
2. **Strict Size Cap:** No monastery was permitted to grow into an unmanageable megacity. When an abbey reached its limit, it founded an autonomous *Daughter Abbey*.
3. **The Outside Visitor (*Visitatio*):** Monasteries were never audited internally. An outside Abbot visited annually to inspect adherence to the Rule with zero emotional bias.
4. **The Chronicle (*Rotulus*):** Completed decisions and lessons were recorded in an append-only roll.

---

## 2. What It Is (The Architecture & Core Lexicon)

```
                                  ┌───────────────────────────────┐
                                  │       THE CANONICAL RULE      │
                                  │   `AGENTS.md` (≤ 1500 words)  │
                                  └───────────────┬───────────────┘
                                                  │ (Constrains all behavior)
                                                  ▼
     ┌────────────────────────────────────────────────────────────────────────────────────────┐
     │ 1. THE ABBEY (The Git Repository)                                                      │
     │    - The bounded physical grounds of the project.                                      │
     │    - Owns its own dependencies, schema, test suite, and build scripts.                 │
     └────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │
                                                  ▼
     ┌────────────────────────────────────────────────────────────────────────────────────────┐
     │ 2. DYNAMIC JUST-IN-TIME SPECIALIZATION (JIT Monks)                                     │
     │    - No rigid static roles. For each task, synthesize exact ephemeral specialists:     │
     │      e.g. Engine/Algorithm Monk, UI/Design Token Monk, Schema Migration Monk.          │
     │    - Specialists agree on typed contracts before implementing.                         │
     └────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │
                                                  ▼
     ┌────────────────────────────────────────────────────────────────────────────────────────┐
     │ 3. PRE-FLIGHT GATEKEEPER (`npm run visit`)                                             │
     │    - Automated script (`scripts/monastery-visitor.mjs`):                               │
     │      1. Checks `AGENTS.md` word count strictly ≤ 1,500 words.                          │
     │      2. Runs static linting (`npm run lint` -> 0 errors).                              │
     │      3. Runs full test suite (`npm run test` -> 100% green).                          │
     │    - NEVER waste visitor tokens or inspection time on a broken tree.                   │
     └────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │
                                                  ▼
     ┌────────────────────────────────────────────────────────────────────────────────────────┐
     │ 4. THE ADVERSARIAL VISITOR (Stateless Auditor)                                         │
     │    - Spawned in an isolated, clean subagent context (Did NOT write the code).          │
     │    - Forbidden from praising the author.                                               │
     │    - Compares Git Diff against `AGENTS.md` (§0–§12).                                   │
     │    - Fault Attribution: 'house' (fix code) vs 'RULE' (amend rule at Chapter).          │
     │    - Verdict: PASS | PASS WITH FINDINGS | BLOCK.                                       │
     └────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │ (On PASS)
                                                  ▼
     ┌────────────────────────────────────────────────────────────────────────────────────────┐
     │ 5. THE CHRONICLE (`ROLL.md`)                                                           │
     │    - Immutable, append-only single-line decision log.                                  │
     │    - Next agent reads ONLY the last ~15 lines at Chapter start.                        │
     │    - Ephemeral role contexts and temporary handoff files dissolve.                     │
     └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Mechanism: How It Works Step-by-Step

### Phase 1: Chapter (Session Inception)
1. The AI reads `AGENTS.md` first (the supreme law of the repository).
2. The AI reads the **last ~15 lines of `ROLL.md`** to understand recent architectural context without wasting tokens on obsolete history.

### Phase 2: Just-In-Time Role Synthesis & Contract Agreement
1. The incoming user request is analyzed.
2. If complex, the AI decomposes the objective into 2–3 ephemeral roles with clear typed interfaces (e.g., `TransitEngine` provides `TransitPlan` $\rightarrow$ `MatchdayCard` consumes `TransitPlan`).

### Phase 3: Implementation & Deterministic Testing
1. Code is written following strict stack rules (§3: strict TypeScript, no `any`, Radix primitives, Tailwind design tokens).
2. Deterministic unit and integration tests are written alongside the code (§4).

### Phase 4: Pre-Flight Gate (`npm run visit`)
1. The AI runs `npm run visit`.
2. The gatekeeper verifies:
   - Word count of `AGENTS.md` is strictly $\le 1,500$ words.
   - ESLint reports 0 errors.
   - Vitest test suite is 100% green.

### Phase 5: Adversarial Visitation Audit
1. A clean, independent subagent or fresh session is invoked as the **Visitor**.
2. Visitor prompt:
   > *"You are the Visitor conducting an adversarial audit of git diff against AGENTS.md. You did not write this code. Be adversarial. Do NOT summarize what went well or compliment the implementer. Output report to `.agent/visitations/<branch>-<date>.md`."*
3. If findings exist:
   - **`Fault: house`**: The code violated the Rule $\rightarrow$ Builder must fix code before merge.
   - **`Fault: RULE`**: The Rule is contradictory or outdated $\rightarrow$ Propose amendment to `AGENTS.md`.

### Phase 6: Chronicle & Ephemeral Cleanup
1. Upon `Verdict: PASS`, a single-line summary is appended to `ROLL.md`.
2. Ephemeral audit files in `.agent/visitations/` are purged upon merging to `main`.

---

## 4. Just-In-Time Specialization (Dynamic JIT Monks)

**Rule:** *Never hardcode static, rigid agent roles into the codebase.*

Instead, every task dynamically synthesizes the exact specialized guild required:

| Task Domain | Dynamic JIT Roles Synthesized | Interface Contract |
|---|---|---|
| **Real-Time Weather Radar** | 1. FMI WMS Tile Fetcher Monk<br>2. Canvas 60fps Animation Monk<br>3. Memory Leak & Mock Tester | `RadarFrameCache { fetch(bbox): Promise<ImageBitmap[]> }` |
| **Active Transit & Parking** | 1. Transit & Weather Graph Monk<br>2. Compact Responsive UI Monk<br>3. Dual-Child Conflict Resolver | `TransitPlan { mode: 'walk'|'bicycle'|'car', travelMinutes: number }` |
| **Receipt & Calendar OCR** | 1. Browser Image Binarizer Monk<br>2. NLP Fixture Extractor Monk<br>3. Dexie IndexedDB Ingest Monk | `ExtractedSportsEvent[]` |

---

## 5. The Multi-Abbey Federation (Scaling Across Multiple Repositories)

When a system grows, **never allow a single repository to balloon into an unmaintainable monolith**.

Split the architecture into an **Abbey Network (Multi-Repo Federation)**:

```
                          ┌────────────────────────────────────────┐
                          │         FEDERATION CHARTER             │
                          │   Shared Architecture & Protocols      │
                          └───────────────────┬────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
         ▼                                    ▼                                    ▼
┌──────────────────┐                 ┌──────────────────┐                 ┌──────────────────┐
│   CLIENT ABBEY   │  Typed Contract │    EDGE ABBEY    │  Typed Contract │  SCRAPER ABBEY   │
│   (`pelipaiva`)  │◄───────────────►│(`pelipaiva-edge`)│◄───────────────►│ (`pelipaiva-api`)│
│                  │ (OpenAPI/Schema)│                  │  (JSON Schema)  │                  │
│ • own AGENTS.md  │                 │ • own AGENTS.md  │                 │ • own AGENTS.md  │
│ • own ROLL.md    │                 │ • own ROLL.md    │                 │ • own ROLL.md    │
│ • own 'visit'    │                 │ • own 'visit'    │                 │ • own 'visit'    │
└──────────────────┘                 └──────────────────┘                 └──────────────────┘
```

### The 4 Golden Rules of the Federation:
1. **Strict Territorial Autonomy:** Each repo has its own `AGENTS.md` ($\le 1500$ words), its own tests, and its own `ROLL.md`. An AI working in Repo A never mutates Repo B's internal files directly.
2. **Typed Inter-Abbey Contracts:** All cross-repo interaction occurs strictly via typed contracts (OpenAPI specs, JSON Schemas, published TypeScript SDKs, or A2A messages).
3. **Cross-Abbey Visitation:** When Repo B updates its API, a Visitor from Repo A audits client compatibility against the contract.
4. **General Chapter (Cross-Repo RFCs):** System-wide architectural shifts (e.g. new encryption formats or sport types) are approved as shared RFCs before any abbey begins implementation.

---

## 6. Universal 5-Minute Implementation Kit (Copy-Paste Blueprints)

Copy these 5 files into any Git project:

### File 1: `AGENTS.md` (Project Root — Strictly $\le 1,500$ words)
```markdown
# AGENTS.md — The Rule of [Project Name]

The canonical, tool-agnostic rule for all AI agents and human contributors.

---

## §0 Precedence
1. `AGENTS.md` (this file) is the supreme project rule.
2. Tool configs (`CLAUDE.md`, `.cursorrules`, etc.) are thin pointers to this file and contain no independent rules.
3. In conflicts between code comments and `AGENTS.md`, `AGENTS.md` wins.

---

## §1 Identity & Stack
[Define project purpose and core stack]

| Use | Never |
|---|---|
| [Framework + TypeScript strict mode] | [Class components, any types] |
| [Design System / UI Tokens] | [Ad-hoc inline styles, raw unstyled primitives] |
| [Database / Persistence Layer] | [Unindexed queries, unsafe storage] |
| [Vitest / Jest / Playwright] | [Untested domain logic or date manipulation] |

---

## §2 Verification & Testing
- Unit & Integration: Run via `npm run test`. All domain algorithms must have deterministic test fixtures.
- Static Typecheck & Lint: Run via `npm run lint` and `npm run build`.

---

## §3 Design & Accessibility
- WCAG 2.2 AA compliant. Minimum touch target size 44px (`touch-target min-h-[44px]`).
- Fluid typography and responsive clamp scaling.

---

## §4 Visitation & Audit
- The author who writes code never performs the final audit.
- Clean-room Visitor audits the git diff against `AGENTS.md` before merge.
- Fault attribution:
  - `house`: Code violates Rule -> Fix code.
  - `RULE`: Rule is contradictory or outdated -> Amend AGENTS.md.

---

## §5 Commands
```bash
npm run build
npm run lint
npm run test
npm run visit
```
```

---

### File 2: `CLAUDE.md` / `.cursorrules` / `.windsurfrules` (Thin Pointers)
```markdown
# Pointers to Supreme Rule
All instructions, architectural invariants, and testing standards are governed by `AGENTS.md`.
Read `AGENTS.md` and the last 15 lines of `ROLL.md` before taking action.
```

---

### File 3: `ROLL.md` (The Chronicle)
```markdown
# ROLL.md — The Chronicle of [Project Name]

Append-only decision log. One line per architectural call or lesson learned.
Read the last ~15 lines at session start. Never rewrite history; only append.

---

2026-08-31 | [project] | Adopted Monastic AI Governance (AGENTS.md Rule + Adversarial Visitation).
```

---

### File 4: `scripts/monastery-visitor.mjs` (Pre-Flight Gatekeeper)
```javascript
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const AGENTS_MD_PATH = path.join(ROOT, 'AGENTS.md');
const VISITATIONS_DIR = path.join(ROOT, '.agent', 'visitations');

console.log('🏛️  [MONASTERY] Initiating Pre-Visitation Protocol...\n');

// 1. Check AGENTS.md word count cap (1500 words)
if (!fs.existsSync(AGENTS_MD_PATH)) {
  console.error('❌ [FATAL] AGENTS.md not found at project root.');
  process.exit(1);
}
const ruleText = fs.readFileSync(AGENTS_MD_PATH, 'utf-8');
const wordCount = ruleText.trim().split(/\s+/).length;
console.log(`📜 The Rule: AGENTS.md (${wordCount} words / 1500 cap)`);
if (wordCount > 1500) {
  console.error(`❌ [RULE VIOLATION] AGENTS.md exceeds 1,500 word cap (${wordCount} words). Prune before audit.`);
  process.exit(1);
}

// 2. Check Lint
try {
  console.log('🔍 Running static lint check...');
  execSync('npm run lint', { stdio: 'inherit', cwd: ROOT });
  console.log('✅ Lint check passed (0 errors).\n');
} catch {
  console.error('❌ [BLOCKER] Lint failed. Fix lint errors before requesting visitation.');
  process.exit(1);
}

// 3. Check Tests
try {
  console.log('🧪 Running test suite...');
  execSync('npm run test', { stdio: 'inherit', cwd: ROOT });
  console.log('✅ Test suite passed (100% green).\n');
} catch {
  console.error('❌ [BLOCKER] Tests failed. Fix failing tests before requesting visitation.');
  process.exit(1);
}

if (!fs.existsSync(VISITATIONS_DIR)) {
  fs.mkdirSync(VISITATIONS_DIR, { recursive: true });
}
console.log('================================================================');
console.log('✨ [MONASTERY] Pre-conditions met! Ready for Clean-Room Visitor.');
console.log('================================================================');
```

Add script to `package.json`:
```json
"scripts": {
  "visit": "node scripts/monastery-visitor.mjs"
}
```

---

### File 5: `.agent/workflows/visitation.md` (Audit Workflow)
```markdown
# Workflow: Visitation (Adversarial Audit)

## Preconditions
1. Working tree clean / committed.
2. `npm run visit` passed (0 lint errors, 100% green tests, word count ≤ 1500).

## Visitor Prompt
```
You are the outside Visitor conducting an adversarial audit of git diff against AGENTS.md.
You did not write this code. Read AGENTS.md FIRST.
Be adversarial. Do not summarize what went well or compliment the implementer.
Check stack rules (§1), testing determinism (§2), accessibility/touch targets (§3).
Output report to .agent/visitations/<branch>-<date>.md.
Verdict: PASS | PASS WITH FINDINGS | BLOCK.
```
```

---

## 7. Universal System Prompts for External AI Assistants

Paste this prompt when initiating work with **Claude Code, Cursor Composer, ChatGPT / Codex, GitHub Copilot Workspace, Roo Code, Windsurf, or Antigravity**:

```text
You are an engineer working in a codebase governed by Monastic AI Governance.

Follow the Monastic Operating Procedure:
1. CHAPTER: Read `AGENTS.md` and the last 15 lines of `ROLL.md` at project root.
2. JIT ROLES: Dynamically scope the task into specialized concerns with clear typed contracts.
3. BUILD: Implement the feature following strict stack rules. Add deterministic unit/integration tests.
4. PRE-FLIGHT: Run `npm run visit` (verifies word count cap ≤ 1500, 0 lint errors, 100% green tests).
5. VISITATION: Conduct an adversarial audit of your git diff against `AGENTS.md` in a clean subagent/session. Fix any 'house' findings immediately.
6. CHRONICLE: On PASS, append a single-line summary of the architectural decision to `ROLL.md`.
```


