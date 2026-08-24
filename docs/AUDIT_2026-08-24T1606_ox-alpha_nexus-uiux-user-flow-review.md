# NEXUS competitive UI/UX + user-flow review — five-team adversarial audit

**Date:** 2026-08-24T16:06  
**Auditor:** ox-alpha (Master Orchestrator, NEXUS protocol)  
**Method:** Phase 0 flow reconstruction → 5 independent specialist teams (Red flows / Blue cognition / Green states / Black a11y / White visuals) → internal falsification → cross-team debate → orchestrator re-verification of every Critical/High claim against source.  
**Primary target:** commit `bcedcb6` (last pre-merge coherent snapshot, reviewed via detached worktree).  
**Re-verified:** every Critical/High finding re-checked against current `main` @ `e1750f0`. Status column below reflects **current main**, not the snapshot.  
**Complements:** [canonical merge](./AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md) (engine/storage/API depth) — this audit adds the **flow-completeness / wiring-asymmetry / state-honesty** class that code-level audits structurally miss.

---

## Executive verdict

**WEAK** (strong engines, betrayed shell). The parsing/reconciliation/storage layer is genuinely good and tested; almost none of that quality reaches the parent. The three core promises were unverifiable or broken at snapshot time: *resolve a wrong kickoff* (pipeline unwired), *manage family* (crash), *hand setup to another parent* (backup drops events).

**High-confidence findings:** 5 Critical · 10 High · 14 Medium · 8 Low (at snapshot). Post-snapshot fix commits (`147c5b8`, `caa04a2`, weather null-catch, refresh re-ingest) already resolve 2 of 5 Criticals and soften 2 Highs — see status.

---

## Finding inventory (survivors after debate)

Status legend vs current `main` @ `e1750f0`: 🔴 still open · 🟡 partially addressed · 🟢 fixed post-snapshot.

### CRITICAL

| ID | Status | Finding | Proof |
|---|---|---|---|
| C1 | 🟢 | **Repo mid-merge, did not compile** — conflict markers in 10 files; solution-config `tsc --noEmit` exited 0 while checking nothing (gate blind spot). | resolved by merge `494c902`; `grep '<<<<<<<' src` → 0 today |
| C2 | 🔴 | **Opening “Perhe” white-screens the app** — hooks declared after early return → React invariant crash on open; sole entry is an always-visible chip; no ErrorBoundary to catch it. | `FamilyManageModal.tsx:51` return-null, `:53` useState, `:141` useEffect (order unchanged on main); zero ErrorBoundary repo-wide |
| C3 | 🟢 | **Offline “Päivitä sää” overwrote real forecasts with fabricated defaults** (`temperatureC:14, turfCondition:'dry'`, no degraded flag), persisted to every event, silent. | `fmiWeatherEngine.ts` catch now returns `null` (“omitting weather”) on main |
| C4 | 🟢 | **Schedules frozen at import — refresh never re-fetched fixtures/.ics**, making reconciliation meaningless in practice. | `handleRefreshAll` now loops `ingestSourceForProfile` per profile on main (per-team failure still console-only) |
| C5 | 🔴 | **Reconciliation pipeline is dead code** — `reconcileCalendarWithOfficial`/mismatch diagnostics have zero non-test callers; ingest hardcodes `auto_matched`; banner unreachable; `unlink` decision unimplemented in handler. | `grep mismatchFlags:` → only `undefined` writes; `ingestOfficial.ts:123`; `App.tsx handleResolveMismatch` |

### HIGH

| ID | Status | Finding | Proof |
|---|---|---|---|
| H1 | 🟡 | **`?perhe=` join black hole** — result dropped, URL scrubbed so retry impossible. Main now keeps the URL until success (retry restored) but failure still renders nothing. | `App.tsx` perhe block: success branch only, no else-feedback |
| H2 | 🔴 | **Ambient mode traps the user** — “Poistu”/Escape call `onExit?.()` which App never passes; entered via `/ambient`, reload re-traps; also receives filtered events (kid-stranded display). | `AmbientView.tsx:12–121` vs App render `<AmbientView events profiles />` |
| H3 | 🔴 | **Backup export drops every event** while copy promises “Tallenna kaikki”; import doesn’t hydrate. Hand-over-to-another-parent broken via all three mechanisms (this + dead share links + operator-gated codes). | `familyShare.ts` export serializes profiles/rules/aliases/pins only |
| H4 | 🔴 | **`?share=` links have no producer** — receive-only legacy path fully implemented, never triggered; manual-profile ids collide (`p:{name}:''`). | `generateSharePayload`: definition + unpack consumer only |
| H5 | 🟡 | **Demo self-heal nukes DB; demo loaders wipe real data unconfirmed** — sentinel-miss triggers full `clear()+reseed`; latent detonator behind C2. Commit `147c5b8` claims “demo fails closed” — `clear()` paths remain at `App.tsx:193–194,268–269,279–280`; verify the auto-reseed effect specifically. | snapshot proof: `needsDemoRefresh` effect → `handleStartDemo()` |
| H6 | 🔴 | **Club quick-search silently rewrites the form** — typing ≥2 chars writes top hit’s name/**URL**/color into fields; catalog maps two clubs to the same live team page (185085 = PPJ/Laru sin) → wrong-team imports. | `SmartImportModal.tsx:513–521` unchanged on main; `popularClubsCatalog.ts:25,58` |
| H7 | 🔴 | **Zero-result WhatsApp/Table/OCR parses render blank** — result blocks render only under `.length > 0`; live region announces silence; `usable.length === 0 → return`. | `SmartImportModal.tsx:200,633,709,783` (snapshot line refs) |
| H8 | 🔴 | **All 8 modals: zero focus management** — hand-rolled overlays (Radix is an unused dep): no trap/initial focus/restore; 5/8 lack role="dialog"/Escape; 4 unnamed close buttons; `aria-modal="true"` lies while Tab leaks into background. | pattern verified across all modal components |
| H9 | 🔴 | **No ErrorBoundary** — any render throw (incl. C2) = permanent white screen. | grep `componentDidCatch|getDerivedStateFromError` → 0 |
| H10 | 🔴 | **Wizard trash deletes nothing persistent** — removes local list state; Dexie profile+events persist; finish-count contradicts DB. | `OnboardingWizard.tsx handleRemoveSource` |

### MEDIUM (condensed)

M1 🔴 Daylight theme fails WCAG on glare-critical accents (floodlight-on-tint 3.26–3.60, whistle chips 3.14–3.35) — the outdoor theme is the low-contrast one. · M2 🔴 `dark:` utilities key to OS prefers-color-scheme, not app toggle (no `@custom-variant dark`) → invisible chips/blinding inverted maps when OS ≠ toggle. · M3 🔴 Sticky-stack occlusion: day headers pin under ~122px mobile filter bar; HUD departure line scrolls beneath it. · M4 🔴 Countdown never counts (computed once per render, no timer). · M5 🔴 Hero ages out >2h post-event — dashboard loses its answer exactly between games. · M6 🔴 Three views, three click contracts: Tiivis rows pointer-only (no keyboard path), training taps animate-then-nothing, Kalenteri inert, WeekendStrip buttons no-op (`onSelectEvent` never passed). · M7 🔴 Offline badge `hidden sm:inline` — invisible on phones; truth is `navigator.onLine` only. · M8 🔴 Clipboard copy false success (write not awaited/caught). · M9 🔴 Venue correction can’t move the pin (pins keyed by old name/coords; event row untouched; surface vocabulary mismatch). · M10 🔴 Sub-44px targets on highest-stakes micro-actions (mismatch-resolve ≈27px, steppers 28px). · M11 🟡 Invented standings persisted as event stats (“Pelipäivä AI” labeled only after tap). · M12 🔴 Family-join id remap leaves ghost duplicate tabs (legacy rows keep events, new `p:` tabs empty). · M13 🔴 Background family sync structurally unable to surface failure. · M14 🔴 Geocoder final fallback returns hardcoded Töölö/Helsinki coords → wrong-city navigation+weather, confidently rendered.

### LOW (grouped)

Badge soup (~14 simultaneous pill styles; mobile time wraps 3 lines) · vocabulary drift (ottelu/tapahtumaa/peliä; 🏀 fallback swallows volleyball/hockey; mixed time formats) · horizontal-scroll affordances missing (one import method hidden on mobile) · ambient staleness/burn-in/pointer-only wake · decorative tablists without arrow-key pattern · SR announcement gaps (conflict HUD announces “2”; sync results silent) · Kortit empty-state lacks reset action · orphan profile on failed import · label nits (“Tulitus”, Pelipäivä AI/Äly drift, “IndexedDB” in user copy).

---

## Contested (both sides kept)

- **Persisted AI stats (M11):** trust violation vs engagement-labeled preview. Resolution: keep preview ephemeral; persist only on explicit save.
- **Hero 2h aging-out (M5):** possibly deliberate “game finished” design; counter: compact feed still renders, so only prominence dies — inconsistent either way.
- **Geocoder fallback frequency (M14):** alias dictionary catches most venues, but consequence severity (driving directions) justifies Medium.
- **Demo self-heal latency (H5):** unreachable until deletion UIs work — but wizard demo-load arms it today; fix-now item.

## Negative space (protect)

ICS permutation parser · conservative reconciliation scorer · Torneopal client (4s abort, dual-endpoint failover) · Worker contract (faithful statuses, If-Match 409 concurrency, allowlist) · Dexie v2 schema · mismatch banner copy design (when reachable) · progressive disclosure discipline (parking math, kit, weekend overview collapsed) · token architecture (~95% coverage) · global reduced-motion kill-switch · consistent focus-visible ring · honest privacy footer · two-step destructive confirms where present.

---

## Master fix plan (updated for current main)

### A. Must-fix first (Critical & High still open)
1. **C2** Move all hooks above the early return in FamilyManageModal. *(S)*
2. **C5** Wire reconcile into ingest for federation-linked events (populate mismatchFlags) + implement `unlink`; else hide banner path. *(M)*
3. **H8** Shared modal baseline (Radix Dialog already a dependency): trap, initial focus, restore, Escape, named closes ×8. *(M)*
4. **H9** Root ErrorBoundary with recovery actions. *(S)*
5. **H2** Pass `onExit`; strip ambient param on exit. *(S)*
6. **H3** Include events in backup export/import + hydrate; align copy. *(S/M)*
7. **H6** Search → explicit results-list selection; dedupe catalog teamIds. *(S/M)*
8. **H7 + H1** Visible zero-result panels in import tabs; visible failure feedback for `?perhe=` join. *(S)*
9. **H10** Wizard trash routes through the real profile-delete+tombstone path. *(S)*
10. **C4 residue** Refresh shows per-team success/fail summary (failures are console-only today). *(S)*
11. **H4** Delete or implement `?share=` producer; fix manual-profile id collision. *(S)*
12. **H5** Confirm demo fails closed end-to-end; require explicit consent before any `clear()` touching non-demo data. *(S)*

### B. High-leverage (Medium)
B1 60s ticker + “Päivitetty klo HH.MM” staleness stamps · B2 persistent “next: la 29.8.” card between games · B3 unified click model (keyboard-operable rows; training taps either work or lose affordance; wire WeekendStrip selection) · B4 daylight contrast token pass ≥4.5 · B5 `@custom-variant dark` class strategy + replace hardcoded colors · B6 measured sticky offsets (`--header-h`) · B7 offline badge on mobile + proxy-aware degraded state · B8 venue correction writes event+pins keyed canonically · B9 join remap migrates events · B10 ≥44px targets (`--nv-touch`) · B11 stop persisting generated stats until save.

### C. Polish & resilience
Live-region announcements + icon-button labels + emoji-free accessible names · scroll-affordance fades · ambient staleness/burn-in/wake fixes · vocabulary + sport-icon unification · empty-state parity · orphan cleanup on failed import · CI: eslint react-hooks + jsx-a11y; wire or delete Lighthouse assertion (the gate that would have caught C2).

### D. Sequence
1) A1–A4 (crash, honesty, boundary) → 2) A5–A9 flow completion → 3) C5 wiring + refresh summary (core promise) → 4) modal/a11y baseline → 5) B-layer temporal+visual honesty → 6) polish + CI gates.

### E. Definition of done
`tsc -p tsconfig.app.json` clean in CI (project refs, not blind solution run) · every advertised journey completable end-to-end (add → refresh → fix kickoff ≤1 tap → remove kid → second parent joins and sees identical data → ambient exits in one tap) · no `catch` returns synthetic data (grep-auditable rule) · all 8 modals axe-clean · daylight critical pairs ≥4.5:1 · countdown ticks · hooks+a11y lint blocking merge.

---

*Generated by ox-alpha, 2026-08-24T16:06. Snapshot audit of `bcedcb6`; statuses re-verified against `main` @ `e1750f0` same day. Team reports available on request (Red flows, Blue cognition, Green states, Black a11y, White visuals).*
