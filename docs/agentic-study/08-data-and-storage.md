# 08 — Data and storage

## What we know

| Store | What | Tenancy | Lifecycle |
|---|---|---|---|
| Dexie v2 | profiles, events, fixtures, standings, rosters, arrivalRules, pins, aliases, syncState | this browser profile | `clearAllDatabaseData`; no cloud backup of events |
| localStorage | theme, onboarding, home, LLM prefs, tombstones, kit packed | this origin | user clears site data |
| KV `family:{CODE}` | roster rows + tombstones, rev, updatedAt | issued code | TTL 604800 slide on PUT |
| Worker cache | family rate-limit counters | IP | 900s |

PUT fields: id, playerName, teamName, sport, colorHex, calendarUrl, associationUrl, associationType, teamId. No events/weather/parking/photos.

Home location: Dexie syncState + localStorage, **not** KV.

No SQL, no backups/PITR in repo. GDPR erase = clear site data / handleClearData confirm.

## Infer
Idle family (no PUT 7 days) loses the bus; phones still have Dexie.

## Do not know
CF KV backup; whether operators snapshot codes.
