# Famday UI spec

Status: **signed off 2026-09-26** for other models. Code-reviewed against `src/` on main. Live deploy of this contract: `d8fd9f2` and later. Pages and edge both HTTP 200 at sign-off.
Audience: the next model. Do not rediscover the product from screenshots. Read this, then the cited files.
If this doc and the code disagree, the code wins. Update this file in the same commit.

Live app: https://pelipaiva.pages.dev
Job of the screen: one parent, one phone, a car park. Which day, which court, when to leave, when to be there, when the first game starts, who is out, and where the time came from.

## 0. Sign-off for other AIs

Grok sign-off, 2026-09-26. This is the famday contract. Do not reopen it unless a parent screenshot contradicts a row in section 8.

**Signed.** The famday screen (HUD, filters, weekend strip, hero card, list card) has every mounted element listed below, with why it exists. Leave time, Helsinki day, and Torneopal court are one function each. Hero and the list card share those functions. Tests in section 9 lock them. Production is that code.

**Do not change these because they look odd:**

- Lähde uses a written kokoontuminen, not kickoff minus 60. 10:29 after a 10:00 gathering is the bug.
- A Sunday Nimenhuuto row moves to the TASO day inside ±1 Helsinki day.
- `kenttä N` stays on each game row. Do not pretty-name it away.
- Invented 45 min (match) and 15 min (training) are not announced as Kokoontuminen. The label is Alkulämpö.
- The stepper and the court are not behind Lisätiedot.
- Do not add a second attendance control. `AttendancePill` is unused on purpose.

**Not signed, so do not pretend it was:**

- Inner buttons of chat, venue, stats, and merge modals. They are entry points only.
- A phone that has not been killed and reopened. Stitch runs when Dexie reloads. Old Sunday cards can sit until then.
- Ambient, onboarding, and import screens. Out of this spec.

Attendance cloud path: card button and the **⋯** menu both call `recordAttendanceOverride` → KV `fam_events:{code}` → `attendanceOverrides`. 30-day TTL. Other phones apply it on sync, same `eventId` only. No family code means the phone only. A failed push is a console warning, not a retry.

## 1. Screen, top to bottom

Mounted from [src/App.tsx](../src/App.tsx) when `viewMode === 'cards'` (default).

| Order | Component | Why it exists |
|---|---|---|
| 1 | `MissionControlHUD` | Sticky identity + the one leave time that matters right now + overflow menu |
| 2 | `DemoBanner` | Only if demo data is loaded. Tells the parent the cards are not their family |
| 3 | View tabs | `Kortit` / `Tiivis` / `Kalenteri`. Cards are the famday. Timeline and calendar are the same events, less logistics |
| 4 | `MultiProfileHeader` | Filter to one child, one team, or everyone. A child with two teams gets a group chip plus one chip per team |
| 5 | Filter ribbon | Attendance and type. Hidden chips stay hidden when the count is 0 so an empty family does not see dead filters |
| 6 | Conflict strip | Only if settings `showConflictWarnings` and a conflict is not dismissed. Opens kuskijako |
| 7 | `DifficultDayAlert` | Day-level "two halls, not enough gap". Same logistics modal |
| 8 | `WeekendStrip` | Scan of nearby days. Tap scrolls/selects the event. Not a second source of truth |
| 9 | `TournamentWeekendPanel` | Tournament blocks from the mission snapshot. Summary, not the card |
| 10 | Day sections | Helsinki day label + count. Inside: one `HeroMatchCard` for `snapshot.nextEvent`, `MatchdayCard` for every other event |
| 11 | `LiveMatchToast` | Overlay when a followed game flips live. Not part of the card |

`Tiivis` is `TimelineCalendarView`. `Kalenteri` is `FamilyVisualCalendar`. They must not invent times. They read the same stitched `MatchdayEvent`.

## 2. Which card

| Card | When | File |
|---|---|---|
| `HeroMatchCard` | The next event the mission snapshot picked | [src/components/HeroMatchCard.tsx](../src/components/HeroMatchCard.tsx) |
| `MatchdayCard` | Every other visible event. App passes `compact` | [src/components/MatchdayCard.tsx](../src/components/MatchdayCard.tsx) |

Both cards must obey section 3. Do not give Hero a different leave formula or a different meaning for "kokoontuminen".

`MatchdayCard` with `compact` (the list) hides the weather badge, the long gear paragraph, and starts with extras closed. The clock, the game list, the court, and the 3-phase stepper stay visible. Those are the famday, not extras.

## 3. Clock contract

One function for the number, one pair of functions for the words.

### 3.1 Leave time

`calculateDepartureCountdown` in [src/lib/ai/deterministicReasoner.ts](../src/lib/ai/deterministicReasoner.ts).

```
travelAndSlack = transitMinutes + departureBuffer + parkingWalk + dutyBuffer

if event is match or tournament
   AND warmupTime exists
   AND warmup is not invented
   AND warmup is at least 5 min before kickoff:
     Lähde = warmupTime - travelAndSlack
else:
     Lähde = kickoff - (warmupOffset + travelAndSlack)
```

Defaults when the family has not set arrival rules:

| Kind | warmupOffset | departureBuffer |
|---|---|---|
| Home match | 45 min | 10 min (2 if walk/bike) |
| Away match | 60 min | 10 min |
| Tournament | 30 min | 10 min |
| Training | 15 min (8 if walk/bike) | 10 min |
| School / other | 5 min | 10 min |

`parkingWalk` is 0 unless mode is `car` (default 3 min from `event.parking`, else the formula uses 3). `dutyBuffer` is 15 min only when `event.volunteerDuty` is set.

Helsinki clock: `toLocaleTimeString('fi-FI', { timeZone: 'Europe/Helsinki' })`.

Why the explicit-warmup branch exists: Honka 26.9.2026, kokoontuminen 10:00, kickoff 11:00, ~14 min drive. Anchoring on kickoff minus a 60 min warm-up printed **Lähde 10:29**, which is after the parent must already be in the hall. Leave is anchored on the written gathering time.

### 3.2 Invented vs written gathering

`isInventedWarmup` / `shouldShowKokoontuminen` in [src/lib/events/eventClock.ts](../src/lib/events/eventClock.ts).

A warmup is **invented** (parser default, not a sentence from Nimenhuuto/MyClub) when:

- there is no `warmupTime`, or it is not before kickoff, or
- it is a training and the gap is 15 min ± 2, or
- it is not linked to an official fixture and the gap is 45 min ± 2.

If `officialFixtureId` is set, a non-45-looking gap is **not** invented. A linked fixture's own 45 min warmup is also not invented (`officialFixtureId` short-circuits the 45 min check). Treat that as trusted federation/calendar time, not a default.

`shouldShowKokoontuminen` is false for invented times. The headline must not say "Kokoontuminen klo …" for a number the app made up.

### 3.3 Words on the card

`clockHeadline(kind, kickoff)`:

| kind | Headline |
|---|---|
| training | `Treeni klo {kickoff}` |
| school | `Koulu klo {kickoff}` |
| other | `Alkaa klo {kickoff}` |
| tournament, or multi-game | `1. peli klo {kickoff}` |
| tournament and warmup equals kickoff | `Kokoontuminen klo {kickoff}` |
| match | `Ottelu klo {kickoff}` |

`arrivalPhaseLabel(event)` is the middle column of the stepper, on **both** cards:

| Situation | Label |
|---|---|
| school / other / meeting | Saapuminen |
| training | Kokoontuminen |
| written gathering (not invented) | Kokoontuminen |
| invented match warm-up | Alkulämpö |

The right column foot is `Treeni` or `1. peli` on `MatchdayCard`. Hero uses `Harjoitus` / `Ottelu` / `Koulu` / `Meno` for the same slot. The number is `event.startTime` either way.

The stepper is hidden on `MatchdayCard` when the player is OUT, or the event is school/other. Hero still shows it on an expanded OUT card so a parent driving a sibling can see the clock. Collapsed OUT cards show only the struck title, kickoff, venue, and **Osallistuu silti**.

Countdown under Lähde: minutes until leave, else `Käynnissä` if `start <= now <= end`, else `Menty`.

## 4. Day and court contract

Stitch: `stitchCalendarEventsWithFixtures` in [src/lib/reconciliation/reconciliationEngine.ts](../src/lib/reconciliation/reconciliationEngine.ts).

Rules another model must not undo:

1. Official TASO/Torneopal/Basket kickoff wins the **calendar day** when a Nimenhuuto row is on the neighbour day and the same-day pool is empty. Window is ±1 Helsinki day. Clocks move with `rebaseHelsinkiClock` so 09:00 stays 09:00.
2. Every same-day official game for that team folds onto one card. `officialGameTimes[]` is the list.
3. Each row is `{ startTime, title, officialFixtureId, score?, venueName? }`. `venueName` is the federation `venue_name`, court included.
4. The list renders only when there are **two or more** games. A single game uses the card venue line.
5. Geocoder aliases must not drop `kenttä N`. [src/lib/geo/sportsGeocoder.ts](../src/lib/geo/sportsGeocoder.ts) appends the court when the alias name has none.

Why: Westend Indians Yellow, Nimenhuuto said Sunday 27.9, Torneopal `getMatches` for team `25301` said Saturday 26.9. Games `949672` (10:00, Hawks, live) and `949675` (13:45, ÅIF Blå). Both `venue_name` = **AC Myllypuro kenttä 4**, venue id `999944456-4`. The other two group games that day (11:00 and 12:45) are the same court. The parent needs the court on each row, not one hall line.

Badge when both sources exist: `🔗 Yhdistetty: Salibandyliitto + Nimenhuuto` from [src/lib/events/eventSourceResolver.ts](../src/lib/events/eventSourceResolver.ts). Basketball uses `Basket.fi`. Football uses `Palloliitto`.

Refresh limit: stitch runs in memory when events load from Dexie. A phone that already stored Sunday will not move until the PWA is killed and reopened, and only if the bare TASO fixture rows are still in the database. If they were absorbed, re-sync the Salibandy feed.

## 5. Hero card elements

File: [src/components/HeroMatchCard.tsx](../src/components/HeroMatchCard.tsx).

| Element | Visible when | Reads | Why | Action |
|---|---|---|---|---|
| Colour bar | always | `profile.colorHex` | Which child, from the edge, in a stack | none |
| OUT chip + struck title | `attendanceStatus === 'out'` and collapsed | attendance, title, kickoff, venue | Parent marked them out. Do not shout logistics | **Osallistuu silti** sets `in`. Chevron expands |
| OUT banner | out and expanded | player name | Same fact, card still readable | **Osallistuu silti**, **Pienennä** |
| Player chip | profile set | `playerName`, `colorHex` | Whose card in the all-kids list | none |
| Sport + date | always | `sportLabelFi`, Helsinki date | Sport is not in the title for trainings | none |
| Transit chip | transit plan exists | `transitPlan.transitLabel` | Walk/bike/car changes the leave buffer | Unknown location opens venue edit. Else opens home address |
| Source badge | always | `resolveEventSourceInfo` | Parent must see federation vs club calendar | tooltip only |
| Attendance pill | always | `attendanceStatus` | One tap, no modal. Hover swaps the label to the opposite action | toggles in/out via `recordAttendanceOverride` |
| Käynnissä | now inside `[start, end]` | start/end | Live games must not look like a future leave problem | none |
| Overflow `…` | always | — | Merge, hide, delete without cluttering the card | `EventMergeModal` |
| Title | always | home/away, else `title` | Matchup is the scan line. School and training keep their own title | none |
| Tournament / stage / # / score | any of those fields | event | Cup context without opening extras | none |
| Clock chip | always | section 3.3 | The one big time | none |
| Kokoontuminen chip | `shouldShowKokoontuminen` and warmup ≠ kickoff | `warmupTime` | Only a written gathering | none |
| Venue line | always | `venue.name`, indoor flag | Where to drive. `(sijainti tuntematon)` if geocoder failed | pencil opens `VenueCorrectionModal` |
| Game list | `officialGameTimes.length > 1` | section 4 | Per-game kickoff, score, Torneopal court | none |
| Mismatch banner | time or venue flag, or a briefing conflict not already in the group list | `mismatchFlags` | Calendar and federation disagree. Parent picks | `use_official` / `keep_calendar` / `unlink` / dismiss |
| Stepper Lähde / {phase} / start | always on the full card | section 3 | Three decisions in one glance | none |
| Weather strip | temp known, or wet/cold | FMI or deterministic outdoor fallback | Indoor still says Sisähalli so nobody packs rain gear for a hall | none |
| Conflict groups | warnings enabled, not out | consolidated conflicts | Two kids, one car | dismiss stores an acknowledgement |
| Standings block | stats object and not training | `event.stats` | Form and H2H without leaving the card | `onOpenStats` |
| Jersey pill | kit or profile colour | kit plan | Bag glance | none |
| Shoes pill | `showSmartGearAdvice` | briefing footwear | Nappisvahti, outdoor football only in spirit. Hidden when the setting is off | none |
| Parking badge | `event.parking` | parking engine | Which lot, walk minutes feed the leave formula | opens parking detail from the badge component |
| Notes | `event.notes` | notes | Carpool, school, volunteer text already applied | none |
| Drop-in | always on full card | `EventInlineDropIn` | Paste a WhatsApp line onto this event | parses into the event |
| Navigoi | not the collapsed out state | transit mode | Primary act: leave | Google Maps, walk/bike mode when that is the plan |
| Kassi | toggle | `KitChecklist` | Sport bag. Closed by default | expands checklist |

## 6. Matchday card elements

File: [src/components/MatchdayCard.tsx](../src/components/MatchdayCard.tsx).

Same clock, same game list, same attendance, same source badge, same mismatch banner, same conflict groups as Hero. Differences that are intentional:

| Element | Difference from Hero | Why |
|---|---|---|
| Type badge | `Harjoitus · 🏑 Salibandy` etc. | The list has many sports. The badge is the scan key |
| Clock | `clockHeadline`, pitch-green chip | Same words as Hero after 2026-09-26 |
| Stepper | hidden for OUT, school, other | Those cards are not a car departure |
| Stepper right foot | `1. peli` on tournaments, `Treeni` on training | Multi-game day: the card kickoff is the first game, not "the tournament starts" |
| Tournament meta | only inside **Lisätiedot** | Keeps the collapsed row short |
| Weather | `MatchdayCardWeatherBadge`, not compact, opens radar drawer | Hall games skip the outdoor radar |
| Lightning banner | `event.lightning` or weather safety | 30/30 rule. Outdoor only in practice because indoor weather is suppressed |
| Talkoo tag | `TalkooDutyTag` when `volunteerDuty` | Kahvio/buffet duty also adds 15 min to leave |
| Player log | extras open and `playerLog` | Basketball shows points/assists. Others show goals/assists/saves |
| Stats strip | extras, not training/school/other | Opens `MatchStatsModal`. Past games say "Kirjaa omat tilastot" |
| Nappisvahti | extras, smart gear on, briefing exists | Reason string is the point. Do not show a shoe with no reason |
| Gear paragraph | extras, not compact | Spectator + clothing. Too long for the list |
| Viestillä button | extras | `EventChatModal` |
| **Lisätiedot / Vähemmän** | footer | Extras default closed in the list |
| WhatsApp share | footer | Sends `briefing.postMatchWhatsAppTemplate` only. If that field is empty the click does nothing. Do not invent a message |
| Navigoi / Kävele / Pyöräile | future events | Same maps URL as Hero. Past events swap this for the result button |
| Empty tournament hint | extras, tournament, no official games and no fixture id | `Otteluajat tulospalvelusta (Torneopal) kun joukkue on yhdistetty.` Do not fake kickoffs |

## 7. Shell elements

### HUD — [src/components/MissionControlHUD.tsx](../src/components/MissionControlHUD.tsx)

| Element | Why |
|---|---|
| PELIPÄIVÄ | Product name. Not a nav logo to a marketing page |
| Demo | Sample family is loaded |
| `Lähde klo {leaveBy}` | The snapshot's next leave, with child name and transit label. This is the same formula as the hero stepper. If they differ, the card is right and the snapshot is stale |
| Fallback summary | No next leave (empty day, or everyone is out) |
| Conflict count | Opens logistics. Hidden when warnings are off |
| Offline | Network down. Local Dexie still shows cards |
| Theme | Daylight / Floodlight. No data effect |
| Menu | Päivitä sää, Kyytiapuri, Kotiosoite & Kulkuvälineet, Perhe-koodi, Keittiönäyttö, Tuo joukkue, Kysy aikataulusta (only if copilot on), Asetukset, Varoitukset toggle, Tyhjennä tiedot (two-step), version + git |

### Profile chips — [src/components/MultiProfileHeader.tsx](../src/components/MultiProfileHeader.tsx)

`Kaikki lapset` is `activeProfileId === 'all'`. A child with several teams gets `player:{Name}` plus one chip per team (`colorHex` dot + team). **Lisää** opens add-team for the active child. 44 px targets.

### Filters — `App.tsx` ribbon

`Kaikki ottelut`, `Osallistuu`, `Pois (n)` only if some are out, then type chips with counts: Turnaukset, Sarjapelit, Treenit, Muut. A chip toggles back to `all` on a second tap. Counts come from the already stitched, profile-filtered list.

### Weekend strip — [src/components/WeekendStrip.tsx](../src/components/WeekendStrip.tsx)

Title is `Viikonloppu` only for a Fri–Sun strip. Otherwise `Lähipäivät & Treenit`. Today gets a Tänään pill. Rows: colour, time, child, Treenit/Talkoo badges, `title · venue`, sport glyph. Venue here is the card venue, not the per-game court. The court lives on the card list.

### Not mounted

`AttendancePill` and `SurfaceBadge` in `src/components/matchday/` are not used by App. Cards draw their own attendance button. Do not wire a second attendance control.

## 8. Worked examples (do not regress)

### Basketball, Honka vs TOPOLA, 26.9.2026

- Kickoff 11:00, written kokoontuminen 10:00 (60 min, so not the invented 45).
- Middle label: **Kokoontuminen**.
- Lähde = 10:00 minus drive, buffer, and parking walk. It must be **before** 10:00. 10:29 was the bug.

### Floorball, Westend Indians Yellow, Torneopal 26.9.2026

- Card day is **Saturday 26.9**, not Sunday 27.9, once stitch sees fixtures `949672` and `949675`.
- Headline: `1. peli klo 10.00`. Gathering chip if Nimenhuuto had a real 09:00.
- Rows: `10.00` Westend Indians Yellow vs Hawks, `13.45` ÅIF Blå vs Westend Indians Yellow. Both venues **AC Myllypuro kenttä 4**.
- Stepper is on the card even when it is not the hero, including in compact list mode.
- Source badge includes Salibandyliitto.

## 9. Tests that lock this

| File | What it guards |
|---|---|
| [src/lib/events/eventClock.test.ts](../src/lib/events/eventClock.test.ts) | Invented 15 min hidden. Real gathering shown. Tournament headline. `arrivalPhaseLabel` |
| [src/lib/ai/deterministicReasoner.test.ts](../src/lib/ai/deterministicReasoner.test.ts) | Leave anchors on explicit warmup, not kickoff |
| [src/lib/reconciliation/stitching.test.ts](../src/lib/reconciliation/stitching.test.ts) | Sunday Nimenhuuto + Saturday TASO moves to Saturday. `venueName` on each game |
| [src/lib/geo/sportsGeocoder.test.ts](../src/lib/geo/sportsGeocoder.test.ts) | Alias still resolves. Court suffix is extra, not a replacement |

## 10. What not to "improve"

- Do not show a kokoontuminen chip for the invented 45 or 15 min.
- Do not compute Lähde from kickoff when a written gathering exists.
- Do not let a club-calendar weekday beat a TASO date inside ±1 day.
- Do not drop `kenttä N` when pretty-naming a hall.
- Do not put fake scores or fake kickoffs on a tournament that has no federation rows. Show the empty hint.
- Do not hide the stepper or the court behind **Lisätiedot**.
- Do not add a second leave formula in the HUD. It must call the same function.
