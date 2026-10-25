# Visitation Report: Conflict UX Fixes

**Date:** 2026-08-31
**Role:** Visitor

## Audit Objectives

1. Read `AGENTS.md` to verify project rules.
2. Inspect `git diff` across `MatchdayCard.tsx`, `HeroMatchCard.tsx`, and `conflictDismissal.ts`.
3. Verify interactive buttons have the `touch-target min-h-[44px]` class for mobile accessibility.
4. Verify conflict arrays are properly memoized with `useMemo`.

## Findings

- **AGENTS.md Compliance:** The changes adhere to the "Mobile-First" design principles (§6) requiring appropriately sized touch targets for mobile viewports, as well as offline-first and performance requirements.
- **Button Touch Targets:**
  - `MatchdayCard.tsx` and `HeroMatchCard.tsx` correctly apply `touch-target min-h-[44px]` (and in some cases `min-w-[44px]`) to the following interactive elements:
    - 1-Tap Attendance In/Out toggle buttons.
    - Card collapsed/expanded toggle buttons (`setIsOutExpanded`).
    - "Palauta huomio" restore buttons.
    - "Kuittaa kaikki hoidetuksi" / "Kuittaa hoidetuksi" dismiss buttons.
    - "Piilota/Näytä kuitatut huomiot" toggle button.
- **Memoization:**
  - `activeConflicts`, `dismissedConflicts`, and `consolidatedConflictGroups` are properly wrapped in `useMemo` hooks in both `MatchdayCard.tsx` and `HeroMatchCard.tsx`, ensuring the conflict consolidation and filtering logic only runs when dependencies change.
- **conflictDismissal.ts:**
  - Logic is extracted cleanly into `groupActiveConflicts` returning structured `ConsolidatedConflictGroup` arrays.

## Verdict

PASS
