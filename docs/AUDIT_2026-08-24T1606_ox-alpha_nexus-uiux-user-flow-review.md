# NEXUS competitive UI/UX + user-flow review — five-team adversarial audit

**Date:** 2026-08-24T16:06 · **Double-check pass:** 2026-08-24T17:00  
**Auditor:** ox-alpha (Master Orchestrator, NEXUS protocol)  
**Method:** Phase 0 flow reconstruction → 5 independent specialist teams (Red flows / Blue cognition / Green states / Black a11y / White visuals) → internal falsification → cross-team debate → orchestrator re-verification of every claim against source.  
**Primary target:** commit `bcedcb6` (last pre-merge coherent snapshot, reviewed via detached worktree).  
**Pass 2 (this revision):** every Critical/High/Medium/Low finding individually re-verified against current `main` @ `e1750f0`, **and** cross-checked against `docs/SPECIFICATIONS.md`, `docs/REVERSE_REQUIREMENTS_TRACEABILITY.md`, `docs/FAMILY_CODES_OPS.md`, `docs/FAMILY_SYNC_FINAL.md` for design-intent verdicts. Statuses below reflect current main after both passes.  
**Complements:** [canonical merge](./AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md) (engine/storage/API depth) — this audit adds the **flow-completeness / wiring-asymmetry / state-honesty** class that code-level audits structurally miss.

---

## Executive verdict

**WEAK at snapshot → MIXED on current main.** Post-snapshot commits resolved or softened 4 of the 5 Criticals, but the two most damaging survivors remain: the family-management white-screen (C2) and the reconciliation pipeline being unwired despite being a specified core requirement (C5, now spec-verified).

**High-confidence findings on current main:** **Critical 2 · High 7 · Medium 15 · Low 7** (was 5/10/14/8 at snapshot; 2 fixed, 3 reclassified/regraded after docs cross-check).

---

## Finding inventory (survivors after debate + pass-2 verification)

Status legend vs current `main` @ `e1750f0`: 🔴 still open · 🟡 partially addressed / regraded · 🟢 fixed post-snapshot · ⚪ reclassified as design intent (see §Design-intent verdicts).

### CRITICAL

| ID | Status | Finding | Pass-2 proof on main |
|---|---|---|---|
| C2 | 🔴 | **Opening “Perhe” white-screens the app** — hooks declared after early return → React invariant crash on open; sole entry is an always-visible chip (`MultiProfileHeader.tsx`); no ErrorBoundary to catch it. | `FamilyManageModal.tsx:51` return-null → `:53` useState → `:141` useEffect; ErrorBoundary grep → 0 |
| C5 | 🔴 **spec-verified** | **Reconciliation pipeline is dead code** — mismatch diagnostics + 1-tap resolution are specified requirements (TRACEABILITY REQ-10/REQ-11; SPECIFICATIONS §5.3–5.4), yet have zero non-test callers; ingest hardcodes `auto_matched`; banner unreachable; `unlink` branch unimplemented. | `grep mismatchFlags:` → only `undefined` writes; `ingestOfficial.ts:123` |

*Fixed post-snapshot:* C1 merge/build (resolved by `494c902`; solution-config blind spot noted below still worth closing in CI). C3 offline weather fabrication (`fmiWeatherEngine.ts` catch now `return null`). C4 frozen schedules (`handleRefreshAll` now re-ingests each profile; residual: per-team failures still console-only).

### HIGH

| ID | Status | Finding | Pass-2 proof on main |
|---|---|---|---|
| H1 | 🟡 **ops-spec-verified** | **`?perhe=` join failure renders nothing.** FAMILY_CODES_OPS §7 *requires* client messages (“Virheellinen koodin muoto” / “Koodi ei ole voimassa”) — deep-link path shows none of them. Retry preserved since success-gated `replaceState`. | App.tsx perhe block: success branch only, no else-feedback |
| H2 | 🔴 | **Ambient mode traps the user** — “Poistu”/Escape call `onExit?.()` which App never passes; `/ambient` entry re-traps on reload; receives filtered events (kid-stranded display). | `AmbientView.tsx:12–121` vs App render without `onExit` |
| H4 | 🟡 reframed | **`?share=` airgap flow specified but has no producer.** FAMILY_SYNC_FINAL Phase 0 explicitly plans “`?share=` / file import → ingest” — receive side fully implemented, producer never written. Manual-profile id collision (`p:{name}:''`) also violates the stable-id spec (FINAL §4.2). | `generateSharePayload`: definition + unpack consumer only |
| H6 | 🔴 | **Club quick-search silently rewrites the form** — typing ≥2 chars writes top hit’s name/**URL**/color into fields; catalog maps multiple clubs to the same live team page (185085 = PPJ/Laru sin) → wrong-team imports. | `SmartImportModal.tsx:513–521`; `popularClubsCatalog.ts:25,58` |
| H7 | 🔴 | **Zero-result WhatsApp/Table/OCR parses render blank** — `usable.length === 0 → return`; result blocks render only under `.length > 0`; live region announces silence. Violates “zero silent failures” bar. | `SmartImportModal.tsx:200` (+ result blocks) |
| H8 | 🔴 | **All 8 modals: zero focus management** — hand-rolled overlays (Radix is an unused dep): no trap/initial focus/restore; 5/8 lack role="dialog"/Escape; 4 unnamed close buttons; `aria-modal="true"` lies while Tab leaks into background. | pattern verified across all modal components on main |
| H9 | 🔴 | **No ErrorBoundary** — any render throw (incl. C2) = permanent white screen. | grep `componentDidCatch\|getDerivedStateFromError` → 0 |

*Fixed post-snapshot:* H10 wizard trash — `OnboardingWizard.tsx:195` now calls `onRemoveTeam?.()` → `App.tsx:561 handleRemoveImportedTeam` (real delete + tombstones). 

*Reclassified:* H3 backup-drops-events → see Design-intent verdicts #2 (downgraded to Medium pair D-I/D-II). Old-H5 demo auto-heal → auto-reseed effect removed on main; residual unconfirmed-wipe demoted to M15.

### MEDIUM (all re-verified on main)

M1 🔴 Daylight theme fails WCAG on glare-critical accents (`--nv-floodlight:#8a8000` day / `#faff69` night tokens unchanged; floodlight-on-tint 3.26–3.60, whistle chips ~3.1–3.35). · M2 🔴 `dark:` utilities key to OS prefers-color-scheme, not app toggle — 0 `@custom-variant` lines, 5 `dark:` usages (inverted map risk in radar/parking modals). · M3 🔴 Sticky-stack occlusion: day headers `top-12` under ~122px mobile filter bar (`TimelineCalendarView:140` vs `App:612`, HUD `top-0 z-30 :53`). · M4 🔴 Countdown never counts — no dashboard timer exists (only ambient/radar intervals). · M5 🔴 Hero ages out >2h post-event (`planner.ts:179 lookbackMs = 2×3600×1000`) — dashboard loses its answer between games. · M6 🔴 Three views, three click contracts: Tiivis rows pointer-only (no tabIndex/role/onKeyDown), training taps gated off (`App:903`), WeekendStrip still gets no `onSelectEvent` (only TimelineCalendarView does, `App:828`). · M7 🔴 Offline badge `hidden … sm:inline` (`MissionControlHUD:84`) — invisible on phones; truth is `navigator.onLine` only. · M8 🔴 Clipboard copy false success (`FamilyShareModal:121–124`, write not awaited/caught). · M9 🔴 Venue correction can’t move the pin (`VenueCorrectionModal:40 venuePins.put`, no `db.events` write; surface vocabulary mismatch). · M10 🔴 Sub-44px targets on highest-stakes micro-actions (mismatch-resolve `px-2.5 py-1 text-[11px]` ≈27px `MatchdayCard:187,194`; steppers `w-7 h-7` `MatchStatsModal:373–406`). · M11 🔴 Invented standings persisted as event stats on card tap (`MatchdayCard:98–102` writes generated stats to db). · M12 🔴 Family-join id remap leaves ghost duplicate tabs — violates stable-id intent (FINAL §4.2/§7: one roster visible everywhere); legacy rows keep events, remapped rows stay empty. · M13 🟡 Background sync failure surfacing unspecified by design (offline queue + `pendingUpload` are spec’d, FINAL §8) — but a permanently failing device still never learns its edits aren’t propagating; keep as Low-priority UX gap unless spec grows an error contract. · M14 🔴 Geocoder final fallback returns hardcoded Töölö coords (`sportsGeocoder:411`) → wrong-city navigation+weather, confidently rendered. · M15 🆕 (demoted from old-H5) Manual demo load still runs unconditional `db.profiles.clear()+events.clear()` (`App:193–194`) with no confirm when real data exists; auto-reseed loop itself was removed on main.

### LOW (re-verified)

“Tulitus” non-word label (`ThemeToggle:35,39`) · 🏀 fallback swallows volleyball/hockey/futsal (`TimelineCalendarView:396`) · count-noun drift peli/tapahtumaa/ottelu (same file :336,:352) · QuickDropInBar code-join failure renders nothing (`if (res.success)` no else) · AskCopilot context window narrow (slices of 3/5/8 events, `localAiEngine:155,254,280` — one path widened since snapshot) · ambient staleness/burn-in/pointer-only wake · SR announcement gaps + emoji-polluted names · Kortit empty-state lacks reset action · CI gate blind spot: root `tsc --noEmit` exits 0 while checking nothing (project refs not run) — the exact hole that let C1 linger.

---

## Design-intent verdicts (pass-2 docs cross-check)

1. **Operator-issued family codes** (`FAMILY_CODES_OPS.md`): “Client cannot mint”, fail-closed Worker, 10 slots — **BY DESIGN. ⚪** Removed from defect inventory. The Share modal’s honest copy (“sovellus ei luo uusia”) already reflects this.
2. **Backup = roster-only airgap** (`FAMILY_SYNC_FINAL.md` §0/§3: “Matches are not copied. Each phone loads them”; privacy constitution bars events in KV): event exclusion from the *bus* is **BY DESIGN. ⚪** Two genuine residues remain (Medium): **D-I** modal copy “Tallenna **kaikki** joukkueesi” oversells what export contains — reword to “Roster ja asetukset (ottelut haetaan uudelleen puhelimeen)”; **D-II** FINAL Phase 0 specifies file-import → ingest hydration, which `importFamilyBackup` doesn’t trigger — restored phone stays empty until user re-adds URLs.
3. **Deep-link join error messages are required**, not optional (FAMILY_CODES_OPS §7 support script) → H1 upgraded from UX nit to **documented-behavior violation**.
4. **Mismatch diagnostics + 1-tap resolution are specified** (TRACEABILITY REQ-10/11, SPECIFICATIONS §5.3–5.4 incl. −45 min warmup recalc on adopt) → C5 confirmed as the single largest spec-vs-build gap in the product.
5. **Stable roster ids** (FINAL §4.2) → M12 ghost tabs are a build deviation, not taste.
6. **Offline queue semantics** (FINAL §8) → M13 partially by-design; downgraded.
7. **Project’s own anti-synthetic constitution** (“never write `Basket.fi / ToPo (…)`”, `fallbackToSynthetic:false`, README “no invented cards”) → independently validates Blue’s M11 finding: persisting deterministic-fiction standings contradicts the repo’s stated data-honesty rule.

## Contested (both sides kept)

- **Persisted AI stats (M11):** engagement-labeled preview vs trust violation + contradiction with the repo’s own anti-synthetic rule (#7 above). Resolution stands: keep preview ephemeral; persist on explicit save only.
- **Hero 2h aging-out (M5):** possibly deliberate “game finished” state; counter: compact feed keeps rendering, so only prominence dies — inconsistent either way.
- **Geocoder fallback frequency (M14):** alias dictionary catches most venues; severity (driving directions) justifies Medium despite lower frequency.

## Negative space (protect)

ICS permutation parser · conservative reconciliation scorer · Torneopal client (4s abort, dual-endpoint failover) · Worker contract (faithful statuses, If-Match 409 concurrency, allowlist, rate limits) · Dexie v2 schema · progressive disclosure discipline (parking math, kit, weekend overview collapsed) · token architecture (~95% coverage) · global reduced-motion kill-switch · consistent focus-visible ring · honest privacy footer · two-step destructive confirms where present · cascade-delete + tombstone engine (FINAL §9) — correct shape, currently unreachable behind C2.

---

## Master fix plan (updated after pass 2)

### A. Must-fix first (open Critical & High)
1. **C2** Move all hooks above the early return in FamilyManageModal. *(S)*
2. **H9** Root ErrorBoundary with recovery actions (also converts any future crash into a recoverable screen). *(S)*
3. **C5** Wire reconcile into ingest for federation-linked events (populate `mismatchFlags`, honor ±3h/>0.85 rules from SPEC §5.1) + implement `unlink` incl. −45min warmup recalc per SPEC §5.4; else hide banner until wired. *(M)*
4. **H1** Surface the OPS-doc-mandated join errors on the deep-link path (reuse FamilyShareModal’s per-error strings). *(S)*
5. **H8** Shared modal baseline (Radix Dialog already a dependency): trap, initial focus, restore, Escape, named closes ×8. *(M)*
6. **H6** Search becomes explicit results-list selection; dedupe catalog teamIds. *(S/M)*
7. **H7 + H2** Visible zero-result panels in WhatsApp/Table/OCR tabs; pass `onExit` to AmbientView (+ strip param on exit). *(S)*
8. **H4** Implement `?share=` producer per FINAL Phase 0 (or formally cut it from the spec) + fix manual-profile stable ids. *(S/M)*
9. **D-II** Wire hydrate-after-backup-import (spec’d); **D-I** fix backup copy text. *(S)*
10. **C4 residue** Refresh summary: show per-team success/fail (failures are console-only today). *(S)*
11. **M15** Confirm-before-clear when non-demo data exists in wizard re-entry. *(S)*

### B. High-leverage (Medium)
B1 60s ticker + “Päivitetty klo HH.MM” staleness stamps · B2 persistent “next: la 29.8.” card between games · B3 unified click model (keyboard-operable Tiivis rows; training taps either work or lose affordance; wire WeekendStrip selection) · B4 daylight contrast token pass ≥4.5 · B5 `@custom-variant dark` class strategy + replace hardcoded colors · B6 measured sticky offsets (`--header-h`) · B7 offline badge on mobile + proxy-aware degraded state · B8 venue correction writes event+pins keyed canonically · B9 join remap migrates events to stable ids (FINAL §4.2) · B10 ≥44px targets (`--nv-touch`) · B11 stop persisting generated stats until save (aligns with anti-synthetic constitution) · B12 geocoder fallback → explicit “Tuntematon kenttä” + name-based Maps search instead of Töölö coords.

### C. Polish & resilience
Live-region announcements + icon-button labels + emoji-free accessible names · scroll-affordance fades · ambient staleness/burn-in/wake fixes · vocabulary + sport-icon unification (fix 🏀 fallback, peli/tapahtumaa/ottelu drift, “Tulitus”) · empty-state parity · orphan cleanup on failed import · sync-failure surfacing contract (post-M13) · CI: eslint react-hooks + jsx-a11y; run `tsc -p tsconfig.app.json` (close the exit-0 blind spot); wire or delete Lighthouse assertion.

### D. Sequence
1) A1+A2 (crash class) → 2) A3–A5 (spec honesty: reconcile, join feedback) → 3) A6–A9 flow completion → 4) A10–A11 residuals → 5) B-layer temporal+visual honesty → 6) polish + CI gates.

### E. Definition of done
`tsc -p tsconfig.app.json --noEmit` clean **in CI** (not blind root config) · every advertised journey completable end-to-end (add → refresh → fix kickoff ≤1 tap per REQ-11 → remove kid → second parent joins via issued code and sees identical roster per FINAL §13 acceptance) · zero `catch`-returns-fiction paths (grep-auditable rule) · all 8 modals axe-clean · daylight critical pairs ≥4.5:1 · countdown ticks · hooks+a11y lint blocking merge · FINAL §13 “Saturday acceptance” scripted as Playwright flow.

---

*Generated by ox-alpha, 2026-08-24T16:06; pass-2 re-verification + docs cross-check 2026-08-24T17:00 against `main` @ `e1750f0`. Team reports available on request (Red flows, Blue cognition, Green states, Black a11y, White visuals).*
