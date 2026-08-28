# Pelipäivä — Official User Journeys & Experience Specifications

## Document Overview
This document specifies the end-to-end user journeys for **Pelipäivä (Matchday Hub)**, the sovereign sports parent companion PWA. Every journey details the persona, trigger, user intent, step-by-step interaction flow, system state transitions, and acceptance verification criteria.

---

## Persona Archetypes

1. **Jari (Multi-Sport Parent):** Has two children playing in PPJ (football) and ErVi (floorball). Needs unified schedule clarity, conflict warnings, and departure timing.
2. **Tiina (Team Leader / Joukkueenjohtaja):** Receives raw tournament schedules in WhatsApp group chats and distributes logistical updates to parents.
3. **Mikko (Co-Parent / Partner):** Needs instant read access to the family calendar without creating accounts, passwords, or cloud logins.

---

## User Journey 01: First-Time Onboarding & Multi-Child Roster Setup
* **Primary Persona:** Jari
* **Trigger:** First launch of the PWA after receiving an invite or discovering the app.
* **Goal:** Set up profiles for children and connect official association feeds with zero friction.

### Flow & Interaction Steps:
1. **Entry:** App boots into `OnboardingWizard.tsx` with clean welcome card and input field.
2. **Player 1 Input:** User types *"Otso"* into the single input field and taps *"Jatka →"*.
3. **Team Association:** Screen transitions to preset selectors. User taps `+ Lisää` next to *"PPJ/Laru sin · P13 Kolmonen"*.
4. **Ingestion:** The app fetches and parses the Palloliitto calendar/fixture feed in the background, populating fixtures and venues in IndexedDB (`db.events`, `db.profiles`).
5. **Multi-Child Addition:** User taps *"+ Tallenna ja lisää seuraava pelaaja"*, enters *"Sofia"*, and adds *"Indians F-pojat"*.
6. **Completion:** User taps *"Valmis"*, persisting onboarding completion flag in `localStorage` (`pelipaiva_onboarding_done: true`) and transitioning to the main dashboard.

### Acceptance Criteria:
- Onboarding completes in under 60 seconds.
- Zero mandatory login/signup screens.
- Seamless multi-child support in a unified database.

---

## User Journey 02: Matchday Morning Mission Control & Departure HUD
* **Primary Persona:** Jari
* **Trigger:** Saturday morning matchday wake-up.
* **Goal:** Know exactly what time to leave, where the game is, and what gear to pack.

### Flow & Interaction Steps:
1. **Dashboard Overview:** User opens app. `HeroMatchCard.tsx` automatically highlights the upcoming match (*"PPJ vs Honka"*).
2. **Time to Leave (TTL) Gauge:** The Mission Control HUD calculates departure countdown based on current time, travel buffer, and team arrival rules (e.g. 45 min warmup).
3. **Surface & Footwear Advice:** Card displays pitch surface (*"Tekonurmi"*), recommended footwear (*"AG / FG -nappikset"*), and weather-adjusted kit guidance (*"Kerrasto alle (+8°C, tuulinen)"*).
4. **Equipment Checklist:** User checks off shin guards, water bottle, and primary jersey.

### Acceptance Criteria:
- Kickoff, warmup, and recommended departure times are mathematically consistent.
- Footwear recommendations match venue surface tags from LIPAS.fi database.

---

## User Journey 03: Live Weather Radar & Storm Proximity Check
* **Primary Persona:** Jari / Tiina
* **Trigger:** Approaching rain clouds or thunderstorm warnings near the outdoor pitch.
* **Goal:** Inspect live FMI radar imagery to decide on rain gear or assess lightning safety.

### Flow & Interaction Steps:
1. **Trigger:** User taps the weather badge or radar button on the Matchday Card.
2. **Modal Launch:** `LiveWeatherRadarModal.tsx` opens with focus trapped and animated slide-in.
3. **Radar Animation:** Displays a 5-frame looping FMI Doppler radar overlay centered on the match venue coordinates.
4. **Lightning Safety Monitor:** Evaluates real-time thunderstorm proximity ($< 10\text{km}$ warning trigger) with explicit Finnish safety protocols (*"Hakeudu sisätiloihin tai autoon"*).
5. **Dismissal:** User taps close button or presses `Escape` key to return to dashboard.

### Acceptance Criteria:
- Modal adheres to WCAG `role="dialog"` with Escape dismissal.
- Radar timestamps update on 60-second active poll interval while open.

---

## User Journey 04: Venue Navigation & Parking Risk Assessment
* **Primary Persona:** Jari
* **Trigger:** 30 minutes before departure while getting into the car.
* **Goal:** Navigate directly to the venue parking lot and avoid parking fines.

### Flow & Interaction Steps:
1. **Trigger:** User taps *"Pysäköinti & Reitti"* on the match card.
2. **Modal Inspection:** `ParkingDetailModal.tsx` presents:
   - **Ease Score:** Green/Yellow/Red badge indicating parking pressure (e.g. *85/100 Helppo*).
   - **Parking Rules:** Fee zone, parking disc requirement (*"Pysäköintikiekko 4h"*), and walking time from lot to pitch.
   - **Fine Risk:** High-risk parking enforcement traps and municipality warning notes.
3. **1-Tap Navigation:** User taps *"Google Maps"*, *"Apple Maps"*, or *"Waze"*.
4. **External Launch:** App triggers navigation in external maps app with `noopener,noreferrer` security headers.

### Acceptance Criteria:
- Exact coordinates passed to map intents.
- Fine prevention checklist clearly alerts to common pitfall zones.

---

## User Journey 05: Unstructured WhatsApp Schedule Import
* **Primary Persona:** Tiina
* **Trigger:** Coach posts next month's game schedule as unstructured text in the team WhatsApp group.
* **Goal:** Ingest all matches into the family calendar in 5 seconds without manual typing.

### Flow & Interaction Steps:
1. **Copy:** Tiina copies the coach's WhatsApp message to clipboard.
2. **Paste:** In Pelipäivä, taps *"Lisää joukkue tai turnaus"* $\rightarrow$ selects *"WhatsApp"* tab in `SmartImportModal.tsx`.
3. **AI / NLP Extraction:** `localAiEngine.ts` / `messageParserNLP.ts` executes offline regex & token analysis to extract dates, times, home/away opponents, field numbers, and volunteer duties.
4. **Preview & Confirm:** User reviews parsed match cards with green confidence indicators and taps *"Tallenna ottelut"*.
5. **Database Commit:** All parsed events are saved into IndexedDB and immediately reflected in dashboard timeline.

### Acceptance Criteria:
- 100% client-side deterministic parsing (zero PII leakage to third-party cloud APIs).
- Handles messy Finnish time notations (*"klo 14", "14:30", "14.30"*).

---

## User Journey 06: Zero-Auth Family Sync & Real-Time Pairing
* **Primary Persona:** Jari & Mikko (Co-parents)
* **Trigger:** Jari wants to share the full season schedule with Mikko.
* **Goal:** Synchronize family sports calendars securely across devices with zero logins.

### Flow & Interaction Steps:
1. **Code Generation:** Jari opens `FamilyShareModal.tsx` $\rightarrow$ app generates a 6-character cryptographic pairing code (e.g. `PELI-9X2`).
2. **WhatsApp Sharing:** Jari taps *"Jaa WhatsAppissa"*, generating an invite link containing the encrypted payload.
3. **Partner Pairing:** Mikko opens the link or enters the 6-character code in his app's onboarding screen.
4. **Cloud Sync:** Background worker syncs profile rosters and match schedules with sub-second latency.

### Acceptance Criteria:
- Family codes use CSPRNG (`crypto.getRandomValues()`).
- End-to-end state synchronization without requiring user emails, passwords, or phone authentication.

---

## User Journey 07: Talkoovahti & Volunteer Kiosk Shift Tracking
* **Primary Persona:** Jari
* **Trigger:** Match schedule contains assigned parent volunteer duties.
* **Goal:** Ensure parent never forgets assigned kiosk or scorekeeper duties.

### Flow & Interaction Steps:
1. **Duty Tagging:** Ingest engine detects keywords (*"Kahviovuoro"*, *"Toimitsijavuoro"*, *"Kirjuri"*, *"Kello"*) and tags event with `volunteerDuty`.
2. **Visual Highlighting:** Dashboard card renders an amber banner: `☕ Kahviovuoro klo 14:30–16:00`.
3. **WhatsApp Reminder:** User can tap 1-click share to post a reminder into the family chat.

### Acceptance Criteria:
- Volunteer duties highlighted distinctively from player kickoff times.

---

## User Journey 08: Multi-Match Tournament Weekend Expedition
* **Primary Persona:** Jari / Tiina
* **Trigger:** Helsinki Cup or weekend tournament with 4–6 matches in 48 hours.
* **Goal:** Manage dense tournament schedules, venue transitions, and rest intervals.

### Flow & Interaction Steps:
1. **Tournament View:** User opens `TournamentWeekendPanel.tsx`.
2. **Dense Schedule Grid:** Displays timeline with match gaps, venue transfers, and group standings.
3. **Conflict Detection:** Highlights overlapping games or tight travel windows between fields.

### Acceptance Criteria:
- Clear visual timeline of consecutive games with rest buffers.

---

## User Journey 09: Offline Matchday Resilience & PWA Caching
* **Primary Persona:** Jari
* **Trigger:** Arriving at a basement sports hall or remote forest pitch with no mobile reception.
* **Goal:** Access all schedules, opponent rosters, parking advice, and notes seamlessly offline.

### Flow & Interaction Steps:
1. **Offline Boot:** User opens PWA without internet connectivity.
2. **Service Worker:** Service worker serves app shell and assets from precache (28 entries).
3. **IndexedDB:** Dexie v2 loads all local events, profiles, and cached venues instantly.

### Acceptance Criteria:
- Zero blank screens or network error crash screens offline.
- Full read/write functionality with local IndexedDB persistence.
