# Visitation: venue-mismatch-reconciliation — 2026-08-31
Visitor: Outside Auditor (Antigravity) · Implementer: Subagent/Contributor · Base: main

## Verdict
PASS

## Findings
None. All previous findings resolved.

## Checked and Clean
- **Touch Target Accessibility (§6):** Mismatch resolution buttons (`Päivitä liiton tietoon` and `Säilytä oma merkintä`) in both `MatchdayCard.tsx` (lines 342–356) and `HeroMatchCard.tsx` (lines 398–414) strictly include `touch-target min-h-[44px]`.
- **Venue-Only Mismatch Resolution in App.tsx (§2):** `handleResolveMismatch` in `App.tsx` (lines 884–928) cleanly supports both `use_official` and `keep_calendar` decisions for venue-only mismatches:
  - `use_official`: Safely checks `if (!officialIso && !officialVenue)` before falling back to `keep_calendar`. If `officialVenue` is present, it updates `venue.name`, preserves `startTime`, clears `mismatchFlags`, records `userOverride.action = 'adopt_official'`, and persists the change to IndexedDB (`db.events.put`).
  - `keep_calendar`: Reads `ev.mismatchFlags?.calendarVenueName`, restores `venue.name` to the calendar venue, clears `mismatchFlags`, records `userOverride.action = 'keep_calendar'`, and persists to IndexedDB (`db.events.put`).
- **HeroMatchCard Delegation Parity (§2, §3):** `HeroMatchCard.tsx` now receives `onResolveMismatch` via props (matching `MatchdayCard.tsx`) and delegates button clicks directly to `onResolveMismatch(event.id, 'use_official')` and `onResolveMismatch(event.id, 'keep_calendar')`. In `App.tsx` (line 1373 and line 1398), both `HeroMatchCard` and `MatchdayCard` wire directly into `handleResolveMismatch`.
- **UI Banner Display (§6):** Both cards consistently guard and format the warning banner (`!isOut && event.mismatchFlags && (event.mismatchFlags.timeMismatch || event.mismatchFlags.venueMismatch)`), accurately showing `Kenttämuutos: Kalenteri ... ➔ Liitto ...` or `Aikataulumuutos: ...`.
- **Deterministic Test Suite (§4):** All 504 unit/integration/boundary tests pass green across 57 test files (`tests/e2e/tier1_features/f14_fuzzy_reconciliation.test.ts`, `tests/e2e/tier2_boundary/boundary_reconciliation_mismatches.test.ts`, etc.).
- **Static Quality (§7):** `npm run lint` passes with 0 errors.

## Not Checked
- Uncommitted working tree state outside the venue mismatch reconciliation scope.
