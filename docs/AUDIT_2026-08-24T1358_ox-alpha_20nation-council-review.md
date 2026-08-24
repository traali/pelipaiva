# AUDIT — 20-Nation Council Review

| | |
|---|---|
| **File** | `AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md` |
| **Date** | 2026-08-24T13:58 (+0200) |
| **Model / Reviewer** | `ox-alpha` (stealth/ox-alpha via opencode) |
| **Method** | Simulated 20-persona engineering-culture council (DE, US, JP, CH, UK, FR, NL, IT, SE, IN, CN, KR, BR, NO, SG, ES, AU, CA, FI, MX). Each persona performed UI/UX + user-journey review, architecture review, and code review. Claims were then cross-challenged in a debate round and ruled TRUE / FALSE / OVERBLOWN against verified evidence. Session I ran against a dirty working tree; Session II re-ran all verdicts against clean `main` (`494c902`). |
| **Verification commands** | `npm run build` (exit 0), `npm test` (45 files / 401 tests passed), targeted `grep`, manual file reads |
| **Scope** | `src/` (React 19 + Vite PWA), `cloudflare-worker/worker.ts`, tests, docs, CI/CD config |

---

## Executive Summary

Main is **green**: production build exits 0, all 45 test files pass with 401 tests. The crisis observed in Session I (26 TypeScript build errors, one silently-empty test file) was caused by an unwashed working tree mid-refactor and was resolved by merge `494c902`. What remains are structural hardening items — no blockers. Highest-value next steps: add a React ErrorBoundary, correct documentation drift, and make CI a true merge gate rather than a post-hoc check.

---

# Findings (priority order)

## P1 — F1: No React ErrorBoundary anywhere

- **What:** A render-time exception in any component crashes the entire app to a white screen with no recovery path. For an offline PWA used at sports pitches, this is the highest-severity remaining UX risk.
- **Cause:** Error boundaries were never introduced; component tree grew around modals (`MatchStatsModal.tsx` 895 ln, `SmartImportModal.tsx` 833 ln) where third-party parsing (OCR/Excel/ICS) increases throw probability.
- **Proof:** `grep -rl "ErrorBoundary\|componentDidCatch" src/` → **0 hits** (verified twice: pre- and post-merge).
- **Fix:** Add a top-level `<ErrorBoundary>` in `src/App.tsx` wrapping the router/app shell, plus per-modal boundaries around `SmartImportModal`, `MatchStatsModal`, `AskCopilotModal`. Fallback UI must work offline: plain inline HTML, offer "reload" and "your data is safe in IndexedDB" messaging. ~1 hour of work; zero dependency needed (class component with `componentDidCatch`).

## P1 — F2: README documentation drift

- **What:** README understates the test suite by ~30x, eroding trust in all other documented claims.
- **Cause:** Docs written at project baseline ("13 tests in ~250ms"); suite grew to tiered e2e/adversarial structure without doc updates.
- **Proof:** `README.md:99` → `# Run Vitest test suites (13 tests in ~250ms)` vs. measured reality: **45 files, 401 tests, ~9s**. Playwright e2e suites (`tests/e2e/**`, 30+ spec files) are not mentioned at all.
- **Fix:** Update `README.md` §Testing & Verification: state current counts, document `npm run test:e2e`, `pwa:audit`, and `db:inspect` scripts. Consider generating counts dynamically or writing "400+ tests" to slow future drift.

## P1 — F3: CI exists but cannot prevent broken commits landing on main

- **What:** A working tree with 26 TypeScript errors existed on local main during Session I. CI would have caught it — after the push, not before.
- **Cause:** `.github/workflows/ci.yml` runs `tsc --noEmit` + `vitest run` + `build` on push/PR to main, but direct-to-main commits only get feedback post-hoc; nothing blocks a red commit from being the tip of main. No evidence of branch protection or pre-commit hooks.
- **Proof:** Session I measurements on tree later merged as `494c902`: 26 × `error TS` including duplicate exports in `localAiEngine.ts:313/322`, duplicate identifiers `matchday.ts:257-261`, import/local collisions `App.tsx:10-14`; `tests/unit/local_ai_parser.test.ts` collected **0 tests** while suite reported green elsewhere.
- **Fix (three layers):**
  1. Enable GitHub branch protection on `main`: require the `verify` check to pass + require PRs (even solo — it makes CI a gate, not a report).
  2. Add local pre-commit hook (`lint-staged` or plain script): `tsc --noEmit && vitest run --bail=1` for instant feedback.
  3. Add fail-on-empty-test-file guard so a transform failure can never masquerade as a green suite again.

---

## P2 — F4: xlsx@^0.18.5 carries known advisories, parses untrusted input

- **What:** SheetJS Community Edition 0.18.x has public advisories (prototype pollution, ReDoS). Pelipäivá feeds user-supplied Excel/spreadsheet files directly into it — exactly the untrusted-input exposure path.
- **Cause:** Dependency pinned at vulnerable major line; no sandboxing between file input and parser.
- **Proof:** `package.json:34` → `"xlsx": "^0.18.5"`; consumed by `src/lib/ai/tableAndExcelParser.ts` via `localAiEngine.ts`.
- **Fix:** Preferred: upgrade to current SheetJS CE release from the vendor's distribution channel (npm registry version is stale). Alternative: parse inside a Web Worker with structured-clone boundaries and size caps. Severity capped because data stays local (no exfil surface), hence P2 not P1.

## P2 — F5: Family-sync rate limiter is not atomic

- **What:** Concurrent requests can exceed configured rate limits (burst overshoot across Cloudflare PoPs).
- **Cause:** Counter implemented via `caches.default` get/put pair, which has no read-modify-write atomicity.
- **Proof:** `cloudflare-worker/worker.ts:54-75` — `cache.match` → parse count → `cache.put(count+1)`; window bucketing at `:40-54`.
- **Fix:** Accept as known limitation for current threat model (family sync, not payments): annotate code with TODO + rationale comment. If abuse ever appears, migrate counter to Durable Objects or KV with serialized writes. Do **not** rebuild now (council consensus: over-engineering for five-user families).

## P2 — F6: `App.tsx` monolith (942 lines)

- **What:** App shell concentrates routing state, modal orchestration, and profile management in one file — the direct cause of Session I's import/local-declaration collisions.
- **Cause:** Incremental feature accretion; every new modal wired into the same component.
- **Proof:** `wc -l src/App.tsx` → 942 lines; Session I build errors `App.tsx:10-14` (import conflicts) and missing symbol `setIsImportModalOpen` at `App.tsx:449` originated here.
- **Fix:** Extract route-level containers (Hub / Ambient already separate) and a modal-coordinator hook owning open/close state (`useModalCoordinator`). Target <300 lines. Do incrementally; no rewrite.

## P2/WATCH — F7: PWA precache weight (1439 KiB) vs. unenforced Lighthouse budget

- **What:** Service-worker precache is ~1.4 MB / 30 entries. Lighthouse assertions exist but nothing runs them automatically.
- **Cause:** Heavy assets accumulate silently (icons, fonts, JS chunks); `lighthouserc.json` thresholds (perf ≥ 0.95, a11y/best-practices/PWA = 1.0) are strict but only enforced when someone remembers to run them.
- **Proof:** Build output: `precache 30 entries (1439.19 KiB)`; `lighthouserc.json` present with error-level assertions; no workflow invokes it.
- **Fix:** Add Lighthouse job to CI (or scheduled weekly): `npx lhci autorun`. Track precache size trend; lazy-load below-the-fold chunks if the number grows past ~1.6 MB.

## P3 — F8: PowerShell-only deploy path on a macOS-first repo

- **What:** Sole deploy automation is `deploy.ps1`; primary dev environment is macOS/zsh.
- **Cause:** Historical tooling choice.
- **Proof:** `deploy.ps1` at repo root; referenced in README Quick Start.
- **Fix:** Wrap as npm script calling pwsh explicitly, or add a zsh/bash twin sharing the same steps (test → build → Pages deploy → Worker deploy → live HTTP 200 verification per Golden Rule).

---

## Resolved during audit window (verified fixed on main)

| Prior finding | Status | Proof of resolution |
|---|---|---|
| 26 TypeScript build errors (duplicate exports `localAiEngine.ts`, duplicate identifiers `matchday.ts:257-261`, import conflicts `App.tsx:10-14`) | ✅ RESOLVED | `npm run build` exit 0; grep for `error TS` → 0 hits |
| `tests/unit/local_ai_parser.test.ts` collected 0 tests silently | ✅ RESOLVED | Suite: **45/45 files, 401/401 tests passed** |
| tesseract.js statically imported, defeating lazy-load intent | ✅ RESOLVED | `ocrImageParser` now referenced via type-only imports + dynamic `await import()` at `localAiEngine.ts:325` |

## Non-findings (challenged and rejected)

- **Missing i18n is a defect** — REJECTED. Deliberate single-market product (FMI, LIPAS, Tieliikennelaki §40, Nimenhuuto/MyClub/Torneopal ecosystems). Revisit only on Nordic expansion.
- **Microservices / backend rewrite needed** — REJECTED. Local-first + edge proxy shape is correct for the domain.
- **Rate limiter must be rebuilt now** — DOWNGRADED to P2 annotation (see F5).

---

## Consensus

Unanimous 20/20: *"Pelipäivä is a genuinely well-conceived local-first family product with disciplined foundations (schema migrations, adversarial test tiers, privacy-by-architecture). Main is green, tested, and shippable. Fix P1 items before the Finnish junior season kicks off."*

— Signed: 🇩🇪 🇺🇸 🇯🇵 🇨🇭 🇬🇧 🇫🇷 🇳🇱 🇮🇹 🇸🇪 🇮🇳 🇨🇳 🇰🇷 🇧🇷 🇳🇴 🇸🇬 🇪🇸 🇦🇺 🇨🇦 🇫🇮 🇲🇽
