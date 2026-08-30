# Agent-graph architecture (in-app, no LLM)

Pelipäivä runs a **deterministic specialist graph** in the browser. Same philosophy as Navikka on-device reasoners: if the phone is offline in a Lauttasaari car park, leave-by and kit still compute.

## Graph

```
                    ┌──────────── planner ────────────┐
                    │  runMissionControlGraph()       │
                    └───────────────┬─────────────────┘
          ┌─────────────┬───────────┼───────────┬──────────────┐
          ▼             ▼           ▼           ▼              ▼
     conflict      carpool        kit      volunteer      tournament
     Agent         Agent         Agent      Agent          Agent
          └─────────────┴───────────┴───────────┴──────────────┘
                                ▼
                   MissionControlSnapshot
                   HUD · Hero · Weekend · Ambient · WhatsApp
```

Calendar / weather / parking / stats stay as existing engines; the planner **consumes** their Dexie rows. It does not fetch.

## Contracts

| Agent | Input | Output | Side effects |
|---|---|---|---|
| `conflictAgent` | events + profiles | `FamilyConflict[]` | none |
| `carpoolAgent` | events + conflicts | `CarpoolLeg[]` | none |
| `kitAgent` | events + profiles + weather/surface | `SportKitPlan` per event | none |
| `volunteerAgent` | `volunteerDuty` strings | `TalkooBalance` | none |
| `tournamentAgent` | tournament / same-day clusters | `TournamentBlock[]` | none |
| `planner` | all of the above | `MissionControlSnapshot` | none |

Shared memory = Dexie. Constitution = Finnish domain rules in code (warmup 45/60/15, 30/30 lightning, Tieliikennelaki parking disc, non-marking indoors, kahvio +15 min).

## Parallel vs sequential

Specialists are **pure and parallel-safe**. Planner currently runs them sequentially because the payload is tiny (a weekend of events). Carpool reads conflict ids; that is the only ordering constraint.

Critic loop: `src/lib/agents/familyMission.test.ts` (overlap, indoor shoes, talkoo overload, tournament grouping, share text).

## Why not LangGraph / cloud LLM

- Core logic must work **offline**.
- A parent should be able to **audit** why the app said “kaksi kuskia”.
- Product constraint: no cloud LLM and no server-side inference. Copilot is deterministic keyword/NLP reasoning over Dexie (`queryFamilySchedule`); when Chrome exposes the on-device Prompt API (`LanguageModel`, formerly `window.ai`), `localAiEngine` upgrades answers locally — still zero network, zero product API keys. iPhone Safari has no Prompt API.

## Files

- `src/lib/agents/planner.ts` — graph entry
- `src/lib/agents/{conflict,carpool,kit,volunteer,tournament}Agent.ts`
- `src/lib/agents/time.ts` — Europe/Helsinki weekend window
- `src/lib/ai/deterministicReasoner.ts` — Nappisvahti + leave-by
- `src/lib/ai/localAiEngine.ts` — logistics WhatsApp wraps the graph
