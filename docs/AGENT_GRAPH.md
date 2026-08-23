# Agent-team graph (build-time + runtime)

Two graphs, one constitution.

## Runtime (in the app)

See [ARCHITECTURE.md](./ARCHITECTURE.md). `runMissionControlGraph` is the only entry the UI should call.

## Build-time (how this expansion was executed)

```
Planner (this session)
 ├─ FinnishSportsDomain  kits, halls, slang, associations
 ├─ WeatherSafety        FMI + Nappisvahti + lightning (existing engines)
 ├─ LogisticsReasoner    leave-by, parking, carpool, conflict
 ├─ FamilyHub            profiles, share, weekend strip
 ├─ UINightCaptain       OLED + Floodlight tokens, HUD, Ambient
 ├─ DexieLocalFirst      no new PII tables
 ├─ TestGauntlet         familyMission.test.ts
 └─ LiveVerification     typecheck + build + browser smoke
```

Collaboration: specialists are **pure functions** with typed snapshots. Critic = tests + visual smoke. Shared constitution = local-first, Finnish, no product LLM.

## Backlog the graph can pick up next

1. Injury notes in Dexie v3 (`status: healthy|recovering|out`) — local only.
2. Per-sport arrival defaults (aamujää +20 min, salibandy indoor 30).
3. Jääkiekkoliitto / Spläjä parser if an official HTML path stabilizes.
4. Worker `/api/nest/brief` Finnish voice line from `snapshot.ambientLine`.
5. Carpool using live traffic only when online; keep haversine fallback.
