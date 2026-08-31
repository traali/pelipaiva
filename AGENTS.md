# AGENTS.md — The Rule of Pelipäivä

The canonical, tool-agnostic rule for all AI agents and contributors working in `pelipaiva`.

---

## §0 Precedence
1. `AGENTS.md` (this file) is the supreme project rule.
2. Native tool configs (`CLAUDE.md`, `.cursorrules`, etc.) are thin pointers to this file and must contain no independent rules.
3. In conflicts between code comments and `AGENTS.md`, `AGENTS.md` wins.

---

## §1 Identity
Pelipäivä is an offline-first Finnish junior sports match and practice calendar Progressive Web App (PWA). It unifies calendars (Nimenhuuto, MyClub, Jopox, Torneopal) for football, floorball, basketball, and volleyball with arrival buffers, weather radar, and zero-auth family sharing.

---

## §2 Architecture
- **Offline-First:** All core operations read and write locally to IndexedDB via Dexie 4.x. Network is an enhancement, never a hard blocker for core viewing.
- **Client-Side Compute:** ICS calendar parsing, NLP time/venue extraction, and schedule reconciliation execute on-device in the browser/worker.
- **Edge Layer:** Cloudflare Worker (`pelipaiva-edge`) handles CORS proxying and live radar caching. Cloudflare Pages serves the static PWA.
- **Zero-Auth Family Sync:** Family shares use client-side encrypted payloads transferred via URL fragments or peer codes without user accounts.

---

## §3 Stack

| Use | Never |
|---|---|
| React 19 + TypeScript (strict mode) | Class components, `any` types |
| Tailwind CSS v4 + Radix UI primitives | Raw unstyled UI primitives, ad-hoc inline styles |
| Dexie 4.x (`src/lib/db.ts`) for persistence | Direct un-indexed `localStorage` for primary domain data |
| Vitest for unit/integration tests | Untested parser regex or date manipulation |
| Playwright for E2E user flows | Heavy runtime multi-agent swarms during routine tasks |
| Cloudflare Pages & Workers | Storing unencrypted user credentials or telemetry |

---

## §4 Testing
- **Unit & Integration:** Run via `npm run test` (Vitest). All parsers (ICS, NLP time extraction, arrival rules) must have deterministic test fixtures.
- **E2E:** Run via `npm run test:e2e` (Playwright). Critical paths: calendar import, profile switching, offline cached viewing.
- **Smoke Tests:** Any modification to database schemas or migration logic must run Dexie smoke tests before committing.

---

## §5 Security
- **Zero-Secret Commitment:** Never hardcode API keys, tokens, or environment secrets in client bundles.
- **Input Sanitization:** All external ICS feeds, tournament URLs, and NLP freeform text inputs must be sanitized and parsed defensively to prevent injection or DOM crashing.
- **Safe Payloads:** Family sync payloads are validated with strict schema decoders before being ingested into IndexedDB.

---

## §6 Design
- Follow the **Nova Design Protocol**: Accessible headless primitives (Radix UI) combined with Tailwind CSS v4 design tokens.
- **Mobile-First:** Target 360px–430px mobile viewports first; adapt smoothly to tablet/desktop.
- **Fluid Typography:** Use responsive clamp scaling for calendar headers, match cards, and event chips.

---

## §7 Git & Release
- **Commit Style:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- **Branching:** Work on short-lived feature branches (`feat/`, `fix/`).
- **Definition of Done:** 
  1. `npm run lint` reports zero errors.
  2. `npm run test` passes with all tests green.
  3. `npm run build` generates production bundle without warnings.
  4. Changes verified live on Cloudflare Pages (`https://pelipaiva.pages.dev`) and Worker health probe where applicable.

---

## §8 Commands

Copy-pasteable. Always verify these exist in `package.json`:

```bash
# Start local dev server
npm run dev

# Run static typecheck and production build
npm run build

# Run ESLint check
npm run lint

# Run Vitest test suite
npm run test

# Run Vitest with coverage report
npm run test:coverage

# Run Playwright E2E tests
npm run test:e2e

# Run pre-visitation audit check
npm run visit
```

---

## §9 Structure

```
src/
  components/       # UI components (Radix + Tailwind 4)
  lib/              # Business logic (calendar, sync, geo, weather, ai)
  styles/           # Design system tokens and global CSS
  types/            # TypeScript domain interfaces
tests/              # Vitest & Playwright test suites
functions/          # Cloudflare Pages Functions
cloudflare-worker/  # Cloudflare Worker edge proxy
scripts/            # Diagnostic and PWA audit scripts
.agent/             # Monastic workflows, visitations, handoffs
```

---

## §10 Performance
- **Indexed Queries:** All Dexie tables must index fields used in date-range filters (`startDate`, `teamId`).
- **Smooth 60fps Scrolling:** Virtualize or paginate long season calendar lists.
- **PWA Asset Caching:** Service worker caches critical app shell; radar images and external feeds obey strict stale-while-revalidate TTLs.

---

## §11 Visitation

**Separation of Duties:** The agent or author who wrote a change does not perform its final audit. Enforcement in this solo-maintainer project is by discipline (fresh context, no conversation history), not mechanical CI. That is the honest limit — do not pretend otherwise.

**Visitor Framing:** The Visitor receives: this file, the diff, and the test results. Nothing else — no author reasoning, no prior conversation. It cites rule section and file:line for every finding. **Zero findings is a valid and expected outcome.** Do not summarize what went well and do not compliment the author. Do not invent findings to appear thorough.

**Verdicts:** `PASS` · `PASS WITH FINDINGS` · `BLOCK`

**Finding Classes:**
- `blocking` — security, data loss, contract breach, licence violation. Not deferrable.
- `advisory` — rule violation without those consequences. May be fixed or deferred to `DEBT.md`.

**Fault Attribution:**
- `house`: Code violates the Rule. Fix the code.
- `RULE`: The Rule is contradictory, obsolete, or impractical. The author proposes an amendment; the current Rule stands until amended.

**Right of Appeal:** The author may rebut any finding with one written response declaring exactly one ground. See `.agent/workflows/rebuttal.md`.

| Ground | Claim | Decided by |
|---|---|---|
| 1. Misread | Visitor's factual claim about the code is wrong | Original Visitor, re-reading cited lines |
| 2. Out of scope | Pre-existing, not introduced by this diff | Check the diff — if confirmed, withdrawn; add to `DEBT.md` |
| 4. Rule wrong | Valid code, but the rule should change | Author amends `AGENTS.md` and logs in `ROLL.md`; finding falls |
| 5. Deferred | Valid finding, out of scope for this change | Advisory only — merge with `DEBT.md` entry (owner + deadline) |

*(Ground 3 — rule silent, blind second Visitor — is omitted at this stage. Add at Stage 2 when concurrent authors exist.)*

**Dispensation:** Any rule in this file may be excepted for a single change. Must be declared before the audit (or requested in a ground-4 rebuttal), state the rule section, explain why it cannot be met, and be logged in `ROLL.md` tagged `DISPENSATION`. Never dispensable: the audit itself. Three dispensations from the same section → propose a rule amendment.

**Deferred Findings:** Advisory findings not fixed before merge go to `DEBT.md` with an owner and a deadline. No `DEBT.md` entry = no merge.

---

## §12 Not in this file

Volatile and transient facts must NOT be stored in `AGENTS.md`. Consult their single source of truth:

| Question | Source of Truth |
|---|---|
| What library versions are installed? | `package.json` and `package-lock.json` |
| What changed recently? | `CHANGELOG.md` and Git commit history |
| What are the active tasks or sprint goals? | Task list / issue tracker / `.agent/handoffs/` |
| What is the Cloudflare edge route configuration? | `wrangler.toml` and `functions/` |
