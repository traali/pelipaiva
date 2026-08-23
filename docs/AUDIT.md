# Pelipäivä audit — family sports command center

**Date:** 2026-08-22  
**Scope:** local `/workspace` port of [traali/pelipaiva](https://github.com/traali/pelipaiva) plus this expansion.

## What the product really is

Pelipäivä is **not a calendar**. It is the Finnish parent’s match-morning cockpit: who plays, when to leave, which shoes, where to park, who has kahvio, and which two kids collide at 10:30. Local-first (Dexie), zero-auth, GDPR-native. Open data only (Palloliitto / Salibandy / Basket.fi / Torneopal, FMI, Helsinki parking, LIPAS slang).

## API inventory

| Call | Path | Stored | UI / reasoner |
|---|---|---|---|
| Association HTML | `/api/proxy/ics?url=` (Palloliitto, tulospalvelu.fi, salibandy.fi, basket.fi, `*.torneopal.fi`) | `officialFixtures`, `leagueStandings`, `teamRosters` | Match cards, stats modal, reconciliation |
| ICS feed | same proxy, allowlisted nimenhuuto / myclub / jopox | `events` | Hub, briefing |
| FMI weather | proxy → `opendata.fmi.fi` | `events.weather` | Nappisvahti, kit extras, rain curve |
| Helsinki parking | city WFS / signs (client via proxy where needed) | `events.parking` + `intel.engineVersion` | ParkkiSakko, Kiekkokello |
| LIPAS geocode | fallback after 100+ slang aliases | `venuePins` if user corrects | Venue, indoor/surface |
| Family share | Worker `/api/sync` PUT KV 7d (live Pages) / QR payload in this port | `profiles` | FamilyShareModal |
| Nest Hub brief | `/api/nest/brief` on live Worker | — | Ambient |

**This sandbox:** ICS/association fetch goes through `src/routes/api/proxy/ics.ts` + `proxiedUrl()`. No backend DB, no auth, no product LLM.

## Data flow (calendar → briefing)

```
ICS / association URL
  → parser (icsParser | associationUrlParser + extractor)
  → sportsGeocoder (slang → LIPAS)
  → FMI + parking (parallel)
  → Dexie events
  → generateMatchdayBriefing (footwear, leave-by, kit)
  → runMissionControlGraph (conflict, carpool, talkoo, tournament, kit)
  → HUD / hero / weekend strip / Ambient
```

Reconciliation: ±3h fuzzy join calendar ↔ official fixture; mismatch banner with adopt-official / keep-calendar.

## Dexie v2 (unchanged schema this pass)

`profiles`, `events`, `officialFixtures`, `leagueStandings`, `teamRosters`, `arrivalRules`, `venuePins`, `customAliases`, `syncState`.

Injury notes stay in UI/local state on purpose — no cloud, no new PII table.

## Gaps found vs original + family weekend (pre-expansion)

| Severity | Gap | Disposition |
|---|---|---|
| P0 | Hub chrome before kickoff (5 icon buttons + chips + paste bar) | HUD + overflow menu |
| P0 | Leave-by buried in Ambient | Hero + HUD floodlight time |
| P0 | `colorHex` never painted | Stripe + chips |
| P0 | `--color-surface` missing | Token added |
| P0 | Multi-child conflict was a sentence | `conflictAgent` + radar |
| P1 | Kit was football-only paragraph | Per-sport checklist |
| P1 | Talkoo not load-balanced | `volunteerAgent` |
| P1 | No tournament day | `tournamentAgent` |
| P1 | Ambient zinc/emoji/English Kickoff | 10-foot OLED rebuild |
| P1 | Indoor halls thin for SB/koris/lentis/kiekko | Geocoder aliases |
| P2 | Daylight washed out | Floodlight paper canvas, no glass |
| P2 | 32px header targets | 44px `--nv-touch` |

## Multi-sport coverage

| Sport | Parser | Surface / shoes | Kit | Hall slang |
|---|---|---|---|---|
| Football | Palloliitto + ICS | AG/FG/SG/TF | Nappikset, säärystimet | Broad |
| Floorball | salibandy.fi + ICS | Non-marking | Maila, lasit | Mosahalli, Unihalli, Energia |
| Basketball | basket.fi + ICS | Indoor | Koripallokengät | Kisahalli, Urhea, Haaga |
| Volleyball | Torneopal subdomain | Indoor + polvisuojat | Pelipaita | Urhea, palloiluhallit |
| Ice hockey | ICS + kiekkoslang | Aamujää varustus | Luistimet, kypärä | Nordis, Paradice, Pirkkola |
| Futsal | ICS / Palloliitto futsal | TF indoor | Säärystimet | Hallit |

## UI vs Night Captain

Pre-expansion: true-black canvas, then a tools drawer. Post-expansion: HUD with BMW-style tricolor (cyan / floodlight yellow / pitch), leave-by in `#faff69`, kit colors on every child, Floodlight (day) is paper `#f4f1e8` without glass.
