# Pelipäivä — Competitive UI/UX Audit (Agent Graph)

**Date:** 2026-08-28
**Performed by:** opencode Competitive UI/UX Agent Graph — *Chief of Staff* (orchestrator/arbiter) + **Team Red "BREAK"** (adversarial) + **Team Blue "OPTIMIZE"** (ergonomic). Executed by opencode (model `hy3-free`) on the working tree at `/Users/isokaariqwe/code/pelipaiva`.
**Method:** Static read of source (`src/**/*.tsx`, `src/index.css`, `src/styles/tokens.css`, `index.html`), grep-grounded evidence, no runtime. Every finding is line-cited; duplicate/already-tracked items are cross-referenced to `MASTER_FINDINGS_REGISTER.md`.

## Scoreboard

| Team | Points | Sev-2 | Sev-3 | Sev-4 |
|---|---|---|---|---|
| **Team Red (BREAK)** | **110** | 2 | 6 | 2 |
| Team Blue (OPTIMIZE) | 70 | 0 | 6 | 2 |

**Winner: Team Red.** Defect matrix — Total **16** | Sev-1: 0 | Sev-2: 2 | Sev-3: 10 | Sev-4: 4.

## Evidence data (grep-grounded)

- `grep role="dialog"` across `src/components` → only **3** files implement it: `SmartImportModal.tsx`, `AskCopilotModal.tsx`, `FamilyManageModal.tsx`. The other ~8 dialogs (`MatchStatsModal`, `EventChatModal`, `EventMergeModal`, `VenueCorrectionModal`, `FamilyLogisticsModal`, `ParkingDetailModal`, `TournamentWeekendPanel`, `TalkooBoard`) do **not**.
- `grep 'Escape'` on `src/components` → only **4** files handle Escape: `SmartImportModal.tsx:104`, `AskCopilotModal.tsx:29`, `FamilyManageModal.tsx:160`, `AmbientView.tsx:101`.
- `grep 'window.open('` → **14** matches, **none** include `rel="noopener noreferrer"`.
- `grep '@radix-ui/react-dialog|FocusTrap|focusTrap'` → **0** matches; all modals are custom `div` overlays.

## Critical defects (Sev-2)

| ID | Element / Flow | Credit | Issue | Root cause | Remediation |
|---|---|---|---|---|---|
| U-01 | All non-Radix modals | Red | No focus trap; Escape/`role="dialog"`/`aria-modal` only on 3 of ~8 dialogs → Tab escapes modal to background | Custom `role="dialog"` divs, no focus-lock (corroborates register **M-33**, still OPEN) | Wrap in `@radix-ui/react-dialog` or `react-focus-lock`; move focus to first control on open; restore focus on close |
| U-02 | HUD + view-switcher header | Red | Two `sticky top-0 z-30` bars collide on scroll — view switcher slides over HUD | `MissionControlHUD` (`App.tsx:640`) and view-switcher (`App.tsx:662`) both `top-0` + `z-30` (corroborates **M-40** "sticky offsets" residue) | Give view switcher `top-[57px]` (HUD height) or HUD `z-40` + switcher `top-14` |

## Design-system & component state

- **States:** Save/submit buttons correctly `disabled` during `isSaving` (good rage-click guard, `SmartImportModal.tsx:646`). **Gap:** `Navigoi paikalle` (`MatchdayCard.tsx:600`) and all map links fire `window.open` with no disabled/guard → rapid clicks spawn multiple tabs (**U-07**, Sev-3). Loading (`isSeeding`), syncing spinner, and error states are well covered.
- **Grid/spacing:** Mostly 4/8-pt, but `p-2.5`/`py-2.5`/`px-2.5` = 10px recur off-grid (**U-06**, Sev-3). Fluid `clamp()` type scale is well done.
- **Tokens:** Strong — contrast-disciplined (`tokens.css:33` floodlight darkened for WCAG). `theme-color` meta hardcoded `#000000` even in light mode (**U-12**, Sev-4).

## Usability, flow & cognitive load

- **Friction:** Native `window.alert()` for `?perhe` deep-link join failures (`App.tsx:156`) breaks the in-app error convention (**U-10**, Sev-3). Demo/onboarding requires a live tulospalvelu fetch → zero TTFV offline (**U**, Sev-3).
- **Affordance:** MatchStats strip is one button meaning "open standings" *or* "log result" by `isPast` (`MatchdayCard.tsx:438`) — ambiguous (**U-09**, Sev-3). One card opens 4 nested modals → overload (**U**, Sev-3).
- **Microcopy:** Finnish copy clear; errors surface (M-09 honored). `AmbientView` has no persistent visible exit, only Escape (`AmbientView.tsx:101`) (**U-08**, Sev-3). Duplicate "show past events" controls (`App.tsx:888` vs `921`) (**U**, Sev-4).

## Accessibility & edge

- **Focus/SR:** 14 `window.open` lack `rel="noopener noreferrer"` → reverse-tabnabbing (**U-03**, Sev-3). Select/inputs missing programmatic `<label>` (`QuickDropInBar.tsx:359`, `SmartImportModal.tsx:406` uses `<span>` not `<label>`) (**U-04**, Sev-3). Modals don't restore focus on close.
- **Contrast/touch:** Tokens meet AA. QuickDropInBar player pills + "Muu nimi" input `<44px` (**U-05**, Sev-3). Emoji glyphs (🏐🚗⚠️) as icons without `aria-hidden` → SR noise (**U-11**, Sev-4). `prefers-reduced-motion` honored globally (good).

## Prioritized backlog

1. **[Immediate/High ROI]** Shared focus-trapped `Modal` primitive (Radix Dialog) for all 8 dialogs + uniform `Escape`/`role="dialog"`/`aria-modal` — closes **U-01** and most a11y Sev-3s. (`src/components/*Modal.tsx`)
2. **[Structural Polish]** Fix sticky stacking (`App.tsx:640,662`); add `rel="noopener noreferrer"` to all `window.open` (14 sites); associate `<label>`s; bump sub-44px controls; replace `window.alert` family-join errors with in-app toast.

## Attribution & correlation

- **Team Red "BREAK"** (adversarial): U-01, U-02, U-03, U-04, U-05, U-06, U-07, U-11, U-12.
- **Team Blue "OPTIMIZE"** (ergonomic): U-08, U-09, U-10, plus the two Sev-4 flow items.
- **Corroborates existing register:** U-01 → **M-33** (focus traps ×8, OPEN); U-02 → **M-40** (sticky offsets, PARTIAL residue); U-05/U-11 → **M-34** (touch-target/SR passes remain, OPEN).
- Logged into `MASTER_FINDINGS_REGISTER.md` as **U-01…U-13** (all OPEN) for tracking.
