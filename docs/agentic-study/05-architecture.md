# 05 — Architecture

## What we know

Dexie `PelipaivaDB` v2 is device SoT. `runMissionControlGraph` and specialists are I/O-pure (planner.ts). Side effects live in `ingestOfficial.ts` and `familyCloud.ts`. Domain types concentrate in `types/matchday.ts`.

**Hotspot:** `statsEngine.ts` (~1784 lines) — URL parse, HTML extract, TZ, synthetic factories. `App.tsx` (~1029) orchestrates too much. `agents/time.ts` imports TZ from statsEngine (layer inversion). `syncState` bag holds family code and home JSON.

**Dead:** `generateOrResolveMatchStats`, `generateFamilyCode`, `seedWeekendExtras.ts`. **Live leftover:** `exampleTournaments.officialFromExampleCup` on ingest catch-null.

**Neural:** default off; cycle `onDeviceLlm` ↔ dynamic `chromeBuiltinAi`. native/ios stub.

Rewrite first: split statsEngine (ARC). Second: shrink App.tsx. Do not rewrite the agent graph.

## Infer
Folder layout is convention; no package firewall. Fast feature delivery optimized over modularity.

## Do not know
Whether production bundle tree-shakes `generateOrResolveMatchStats` (grep of live index.js earlier: **absent** — function may be unused export dropped). Factory still exists in source and tests.
