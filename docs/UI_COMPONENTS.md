# Pelipäivä UI components

Status: **component catalog 2026-09-26**. Every file under `src/components/`. Screen contract stays in [FAMDAY_UI_SPEC.md](./FAMDAY_UI_SPEC.md). If a row and the file disagree, the file wins.

`Mounted` means some other file imports it. **Unmounted** means it is dead. Do not mount a second attendance or weather control beside the one that is already on the card.

## App shell

| File | Mounted by | What it shows | Why |
|---|---|---|---|
| `MissionControlHUD.tsx` | `App.tsx` | PELIPÄIVÄ, next Lähde, Demo, Offline, theme, overflow menu | One leave time and the actions that are not a card |
| `ThemeToggle.tsx` | HUD | Daylight / Floodlight | Theme only. No data |
| `DemoBanner.tsx` | `App.tsx` | Kokeilutila, Tuo oma joukkue, Poista demo | Sample family must not look like yours |
| `MultiProfileHeader.tsx` | `App.tsx` | Kaikki lapset, child and team chips, Lisää | Filter the day. Lisää opens add-team |
| `DifficultDayAlert.tsx` | `App.tsx` | Aikatauluhuomio, Kuskijako | Two halls, not enough gap |
| `WeekendStrip.tsx` | `App.tsx` | Nearby days, Tänään, child, time, venue | Scan. Not a second clock |
| `TournamentWeekendPanel.tsx` | `App.tsx` | Turnaukset & otteluohjelma | Tournament blocks from the mission snapshot |
| `TalkooBoard.tsx` | `App.tsx` | Talkoovahti | Who has kahvio. Duty also adds 15 min to leave |
| `QuickDropInBar.tsx` | `App.tsx` | Paste, photo, sport, player, Tallenna | Make an event without the import modal |
| `LiveMatchToast.tsx` | `App.tsx` | Live game, Avaa tilastokeskus | Overlay when a followed game flips live |
| `NotificationToastContainer.tsx` | `App.tsx` | Toasts, including Käytetään välimuistia | Offline and sync, not a card |
| `ErrorBoundary.tsx` | `main.tsx` | Crash fallback | A render error must not blank the PWA |
| `SportGlyph.tsx` | Hero, Ambient, WeekendStrip | Sport icon | One glyph, three surfaces |
| `modals/GlobalModalHost.tsx` | `App.tsx` | Hosts the modals below | One place opens share, import, home, settings, stats |

## Cards

| File | Mounted by | What it shows | Why |
|---|---|---|---|
| `HeroMatchCard.tsx` | `App.tsx` | Next event. See FAMDAY spec section 5 | The featured card |
| `MatchdayCard.tsx` | `App.tsx` | Every other event. See FAMDAY spec section 6 | The list card. `compact` hides weather and the long gear paragraph |
| `KitChecklist.tsx` | Hero | Sport bag, Sää line | Closed until Kassi is opened |
| `NappisvahtiPill.tsx` | Matchday extras | Nappisvahti, shoe, reason | Only when smart gear is on and a briefing exists |
| `ParkingEaseBadge.tsx` | both cards | Parkki | Opens `ParkingDetailModal`. Walk minutes feed Lähde |
| `MatchdayCardWeatherBadge.tsx` | Matchday, not compact | Weather, Tutka | Opens `WeatherSatelliteDrawer`. Indoor games skip it |
| `MismatchResolveBanner.tsx` | both cards | Calendar vs federation time or venue | Decisions: `use_official`, `keep_calendar`, `unlink`, `dismiss` |
| `EventInlineDropIn.tsx` | both cards | Liitä, Päivitä peliin | Paste a WhatsApp line onto this event |
| `EventChatModal.tsx` | both cards | Free-text update | Same job as drop-in, in a modal |
| `EventMergeModal.tsx` | both cards, and chat | Hallitse: in/out, merge, Erota lähteet, Piilota, Poista | In/out here calls `recordAttendanceOverride` (phone + Cloudflare when a family code exists) |
| `VenueCorrectionModal.tsx` | both cards | Korjaa kentän tiedot, surface list | Pin stays on this device |
| `matchday/TalkooDutyTag.tsx` | Matchday | Duty label | Shown when `volunteerDuty` is set |

## Calendars

| File | Mounted by | What it shows | Why |
|---|---|---|---|
| `TimelineCalendarView.tsx` | `App.tsx` Tiivis | Day chips, events, Reitti | Same stitched events, less logistics |
| `FamilyVisualCalendar.tsx` | Timeline, and Kalenteri view | Month/week grid | Same events again. Do not give it its own leave formula |
| `AmbientView.tsx` | route `/ambient` | Lähde kotoa, Sää, or Ei seuraavaa peliä | Kitchen screen. OUT events are hidden |

## Modals

| File | Opened from | What it is for |
|---|---|---|
| `OnboardingWizard.tsx` | first run | This phone only, create a family code, or join `XXXXX-X` |
| `SettingsModal.tsx` | HUD | Home address, family share, import, warning toggles |
| `HomeLocationModal.tsx` | settings, transit chip | Address search, car / walk / bike, distance limits |
| `FamilyShareModal.tsx` | HUD Perhe-koodi | Code, link, Nest, file, WhatsApp. Optional. No code means this phone only |
| `FamilyManageModal.tsx` | Lisää | Add a team, hide Nimenhuuto/MyClub categories, join a code. Holds `OnDeviceLlmSettings` and `TeamColorPicker` |
| `OnDeviceLlmSettings.tsx` | family manage | On-device schedule model. Off by default in spirit: deterministic clocks do not need it |
| `TeamColorPicker.tsx` | manage, URL import | Child colour. The card bar uses `colorHex` |
| `FamilyCalendarModal.tsx` | share / calendar | Subscribe an Apple calendar. Kyydit and Wilma are explained here |
| `FamilyLogisticsModal.tsx` | conflict strip, Kyytiapuri | Carpool. Lähtöpaikka, overlap, WhatsApp |
| `SmartImportModal.tsx` | Tuo joukkue | Tabs: Laji, Liitto, Viesti, Excel, Kuva |
| `import/tabs/ClassicUrlImportTab.tsx` | import | One-tap tournaments, club search, iCal URL, team name, colour |
| `import/tabs/MessageNlpImportTab.tsx` | import, and the other tabs' preview | Parse a message into events |
| `import/tabs/SpreadsheetImportTab.tsx` | import | Excel / CSV |
| `import/tabs/CameraOcrImportTab.tsx` | import | Photo of a list. PNG, JPG, WebP |
| `MatchStatsModal.tsx` | card stats | Federation stats plus a parent log. Save stays on the device |
| `ParkingDetailModal.tsx` | parking badge | Map, signs, fine risk, walk, disc-parking clock |
| `SatelliteEmbedDrawer.tsx` | parking and stats | Cross-repo embed. Offline Safe if the neighbor is down |
| `LiveWeatherRadarModal.tsx` | rain curve only | Live radar legend. The curve itself is unmounted, so this modal does not open from the card |
| `WeatherSatelliteDrawer.tsx` | Matchday radar | FMI radar, 30/30 lightning, temperature, grip, wind, rain |
| `AskCopilotModal.tsx` | HUD, only if copilot is on | Ask the local schedule. Not a product LLM |
| `ui/ToggleSlider.tsx` | settings, family manage | Boolean settings |

## Unmounted — do not wire a second one

| File | Why it exists in the tree | Do this instead |
|---|---|---|
| `ConflictWarningBadge.tsx` | Small clash chip | Cards and `DifficultDayAlert` already show the conflict |
| `RainRadarCurve.tsx` | Sparkline plus Katso tutka | `MatchdayCardWeatherBadge` and `WeatherSatelliteDrawer` |
| `matchday/AttendancePill.tsx` | In/Out pill | Card button and the **⋯** menu |
| `matchday/SurfaceBadge.tsx` | Pitch surface chip | Venue line and venue modal |
| `ui/DialogModal.tsx` | Generic dialog shell | Each modal has its own shell |

Barrels `matchday/index.ts`, `import/tabs/index.ts`, and `modals/index.ts` only re-export. They are not screens.
