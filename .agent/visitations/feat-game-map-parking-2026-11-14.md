# Visitation: feat/game-map-parking — 2026-11-14
Visitor: GitHub Copilot code review (separate context: AGENTS.md + diff only) · Implementer: Grok Bot (Chief of Staff) · Base: ccbf66a

Honest limit (§11): no blind second agent session was available, so Copilot's PR review served as the
fresh-context Visitor. It cited AGENTS.md sections and file:line for every finding. Four rounds were run.

## Verdict
PASS WITH FINDINGS. All findings were advisory and all were fixed before merge. Nothing goes to DEBT.md.

## Findings (all advisory, house, fixed)

| # | Rule § | Location | Claim | Fix |
|---|---|---|---|---|
| F1 | §2 | src/App.tsx:256 | heal pass kept stale approximation flags | quality fields taken from new result (15d2dfc) |
| F2 | §6 | src/components/TimelineCalendarView.tsx:344 | Enter on nested map/Parkkis links opened the row | row handler ignores nested targets (15d2dfc) |
| F3 | §6 | src/components/VenueMapCard.tsx:217 | "Merkitse sijainti" could not actually set a pin | action removed, honest text (15d2dfc) |
| F4 | §2 | src/lib/geo/sportsGeocoder.ts:486,538 | LIPAS / hel.fi ignored city, hel.fi hardcoded Helsinki | city filter + real municipality (15d2dfc) |
| F5 | §2 | src/lib/geo/sportsGeocoder.ts:714 | failed lookups cached for the session | only hits cached, failed LIPAS lists evicted (15d2dfc) |
| F6 | §10 | src/lib/parking/parkkisNearby.ts:182 | cached staleness never re-evaluated | 10 min TTL, staleness computed at render (15d2dfc) |
| F7 | §10 | src/lib/parking/parkkisNearby.ts:191 | failed tile produced partial 300 m counts | any tile failure = no numbers, retried (15d2dfc) |
| F8 | §2 | src/App.tsx:686 | quality upgrade at same coordinates discarded | isBetterLocation alone decides (d4c5c62) |
| F9 | §6 | src/components/MatchdayCard.tsx:1044 | card-local game detail had no map | venue passed (d4c5c62) |
| F10 | §1/§6 | src/components/TimelineCalendarView.tsx:188,191 | non-match could take inline map; map stuck on ended game | match-only filter + minute clock (d4c5c62) |
| F11 | §6 | src/components/VenueMapCard.tsx:48 | 3x3 tiles left gaps on wide cards | tiles cover measured width (d4c5c62) |
| F12 | §1 | src/lib/geo/sportsGeocoder.ts:728,741 | sport missing from cache key; court text lost | sport in key; schedule text kept (d4c5c62) |
| F13 | §1/§2 | src/lib/ai/localAiEngine.ts:256 | AI parking answer hid estimated location | labelled "sijainti arvioitu" (d4c5c62) |
| F14 | §5 | src/lib/geo/sportsGeocoder.ts:502 | generic names ("Liikuntahalli", "Kenttä E") matched a named hall | generic-word guard + city from venue text (fc4c6da) |

The last round (fc4c6da) reported 4 resolved and 2 open; the 2 open threads were F9 and F13, already fixed in d4c5c62
(their anchor lines did not change, so they were not marked outdated). Copilot's summary also mentioned "unpublished"
findings it did not post; they could not be read or acted on.

## Test results
- npm run visit: pass (lint 0, typecheck, 872 vitest, neighbors 27 ok).
- Playwright: venue_map_parking.spec 9/9. Full suite: 24 passed, 18 failed. The 18 failures are the same 18
  (android_chrome, smoke_all_ui, smoke_ui, user_flows Flow 5, visual_audit × 3 projects) that fail on origin/main ccbf66a.

## Areas Checked
- Venue classification, geocoder fallbacks, map card, quick links, parking counts, timeline/hero/detail wiring.

## Areas Not Checked
- Pre-existing e2e failures listed above (out of scope, ground 2).
