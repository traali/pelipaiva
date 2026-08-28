# Pelipäivä — Complete Visionary User Journeys & Product Experience Blueprint

## Executive Vision
This document defines the **ideal, gold-standard user experience** for what a next-generation sports family logistics application **could and should have**. It is not constrained by current prototype implementations; it serves as the definitive product and experience blueprint for the entire youth sports family ecosystem.

---

## 1. The Extended Sports Family Ecosystem & Personas

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │             THE SPORTS FAMILY ECOSYSTEM                 │
                                  └────────────────────────────┬────────────────────────────┘
                                                               │
        ┌──────────────────────────────┬───────────────────────┴───────────────────────┬──────────────────────────────┐
        │                              │                                               │                              │
[Caregivers & Drivers]        [Youth Athletes]                                [Siblings & Hobbies]           [Extended & Team Network]
• Lead Driver (Jari, 41)      • Self-Sufficient Teen (Otso, 14)               • Tag-Along Sibling (Emma, 6)  • Remote Cheerleader (Mummi, 68)
• Sync Co-Parent (Mikko, 39)  • Beginner Junior (Eeli, 8)                     • Multi-Hobby Child (Sofia, 11)• Team Manager / Jojo (Tiina, 44)
• Blended Parent (Laura, 43)                                                  • Evening School / Tutor       • Carpool Partner (Antti, 42)
```

### Deep Persona Profiles

| Persona & Archetype | Relationship & Role | Mental Model & Daily Reality | Core Desires & Feature Expectations |
|---|---|---|---|
| **1. The Lead Logistics Anchor (Jari, 41)** | Primary Caregiver / Minivan Driver | Overwhelmed by 15 weekly sports touchpoints across 2 kids. Constantly mentally calculating departure times, traffic, kit cleanliness, and volunteer shifts. | 1-tap automated schedule ingestion, predictive departure countdowns, parking disc alerts, kit packing intelligence. |
| **2. The Sync Co-Parent (Mikko, 39)** | Secondary Caregiver / Co-Driver | Wants to help but gets frustrated by having to ask *"What time is the game?"* or navigating complex federation apps. | Zero-friction read access on phone/smartwatch, clear *"You drive / I drive"* task delegation, zero login hurdles. |
| **3. The Shared Custody Parent (Laura, 43)** | Blended Family / Alternating Weeks | Coordinates kids across two separate homes. Needs clean schedule parity without sharing personal emails, passwords, or cloud accounts. | Independent zero-auth device pairing, decentralized sync, private notes per household. |
| **4. The Self-Sufficient Teen Athlete (Otso, 14)** | Active Player (Football / U15) | Has their own smartphone. Wants independence: checks own kickoff time, jersey color (*koti vs. vieras*), starting lineup, and personal stats. | Clean athlete mode, jersey color clash alert, peer chat, match stats & highlight reel. |
| **5. The Beginner Junior (Eeli, 8)** | Young Athlete (F-juniors) | Needs visual guidance. Cannot read complex tables; understands visual icons, colors, and countdown timers. | Gamified gear checklist (*"Did you pack your shin guards?"*), big countdown clock, high-fives celebration. |
| **6. The Tag-Along Younger Sibling (Emma, 6)** | Passive Attendee / Spectator | Gets cold, hungry, and bored pitch-side during 2-hour tournaments. | Spectator comfort advice (blankets, snacks), venue playground/kiosk finder, match duration estimates. |
| **7. The Multi-Hobby Sibling (Sofia, 11)** | Multi-Discipline (Floorball + Violin) | Juggles competitive sports with music school and art classes. Frequent Friday evening calendar clashes. | Cross-discipline clash resolution, travel buffer routing between music school and sports hall. |
| **8. The Extended Cheerleader (Mummi & Ukki, 68)** | Grandparents / Extended Family | Love watching games on weekends or following live scores from home when unable to travel. | 1-tap WhatsApp match share with Google Maps navigation link, live score ticker with goal notifications. |
| **9. The Team Manager / Jojo (Tiina, 44)** | Team Volunteer Coordinator | Drowning in WhatsApp group chats, emergency field changes, sickness cancellations, and kiosk shift disputes. | Raw WhatsApp schedule parser, automated volunteer shift balancer (*Talkoovahti*), 1-click emergency pitch relocation broadcast. |
| **10. The Carpool Partner Parent (Antti, 42)** | Neighborhood Sports Parent | Shares rides to regional away games. Needs to know seat capacity, pickup points, and return ETA. | Integrated carpool organizer (*Kyytirinki*), real-time ETA sharing, gas cost splitting. |

---

## 2. Complete Visionary User Journeys (UJ-01 through UJ-20)

---

### 🟢 Phase 1: Onboarding, Setup & Family Ecosystem

#### **UJ-01: Frictionless Zero-Login Family Setup**
* **Actors:** Jari (Lead Parent), Mikko (Co-Parent), Laura (Blended Parent)
* **What the Experience Should Be:**
  - On first boot, the app immediately asks: *"Who in your family plays sports?"*
  - User adds child names and selects their clubs with 1 tap (PPJ, HJK, Oilers, ErVi, Classic, etc.).
  - The app automatically discovers and links official federation feeds (Palloliitto, Salibandyliitto, Basket.fi, Torneopal) and team calendar feeds (MyClub, Nimenhuuto, Jopox).
  - Co-parents pair in 2 seconds via a 6-character cryptographic code or WhatsApp invite link — zero passwords, zero accounts, zero privacy tracking.

#### **UJ-02: Universal Schedule Ingestion & Multi-Source Reconciliation**
* **Actors:** Jari & Tiina (Jojo)
* **What the Experience Should Be:**
  - Seamless ingestion from any source: official league URLs, raw `.ics` calendar links, pasted WhatsApp group messages, photographed printed tournament handouts (OCR), or uploaded Excel spreadsheets.
  - An intelligent local AI engine reconciles overlapping sources (e.g. MyClub practice time vs. Palloliitto official referee kickoff time) and merges them into a single deterministic event.

#### **UJ-03: Multi-Hobby & Non-Sports Life Integration**
* **Actors:** Sofia (Multi-Hobby Child) & Jari
* **What the Experience Should Be:**
  - Parents can link external non-sports schedules (music school, scout meetings, dentist appointments, family dinners).
  - The app displays an integrated family timeline and flags non-sports conflicts (e.g. *"Violin lesson in Kallio ends at 17:30 $\rightarrow$ Football warmup in Töölö starts at 17:45 — 5 min deficit"*).

---

### 🟢 Phase 2: Daily Operations & Matchday Mission Control

#### **UJ-04: The Matchday Morning "Mission Control HUD"**
* **Actors:** Jari (Driver) & Otso (Player)
* **What the Experience Should Be:**
  - When the parent wakes up, the app presents a proactive **Mission Control Dashboard**:
    - **Live Countdown:** *"Leave in 42 minutes to arrive 45 min before kickoff"*.
    - **Surface & Stud Intelligence:** Direct query to LIPAS.fi identifies pitch surface (*"Dry artificial turf (3G)"*) and mandates footwear (*"AG / FG studs — no metal blades"*).
    - **Dynamic Weather Kit:** Combines temperature, wind chill, and rain probability (*"+6°C, feels like +2°C. Pack base layer thermal pants and windbreaker"*).
    - **Interactive Pack Checklist:** Child checks off shin guards, jersey, water bottle, and snack bar on their own device.

#### **UJ-05: Uniform & Kit Clash Early Warning**
* **Actors:** Otso (Player) & Jari
* **What the Experience Should Be:**
  - App cross-references home and away team primary shirt colors across the league.
  - If both teams play in navy blue, the app alerts 24 hours in advance: `⚠️ Kit Clash Alert: Both teams wear Blue!`.
  - Recommends: *"Pack the yellow alternate kit or bibs in your sports bag"*.

#### **UJ-06: Pitch-Side Live Doppler Weather & Lightning Safety**
* **Actors:** Jari & Emma (Sibling)
* **What the Experience Should Be:**
  - 1-tap access to live 5-minute Doppler radar animation centered on the field.
  - Clear natural language verdict: *"90% dry during the game; light drizzle starts at 16:15"*.
  - Automated safety monitor checks lightning strikes within a 10 km radius: alerts with the Nordic 30/30 rule (*"Lightning strike detected 7 km away — seek shelter immediately"*).
  - Prompts sibling comfort gear: *"Rain poncho and warm seat pad recommended for Emma"*.

---

### 🟢 Phase 3: Travel, Navigation & Parking

#### **UJ-07: Precision Gate Navigation & Parking Risk Assessment**
* **Actors:** Jari (Driver) & Antti (Carpool Partner)
* **What the Experience Should Be:**
  - Navigates not to the geographic centroid of the sports park (which routes drivers into dead-end pedestrian gates), but directly to the **designated public parking lot entrance**.
  - Displays a **Parking Ease Score (0–100)** based on time of day and concurrent matches.
  - Automatically calculates Finnish parking disc arrival time (*Tieliikennelaki*: arrived at 08:35 $\rightarrow$ set disc to 09:00).
  - Outlines municipality fine traps: highlights high-risk zones, tow-away areas, and EasyPark/ParkMan zone codes.
  - 1-tap handoff to Google Maps, Apple Maps, or Waze.

#### **UJ-08: Sibling Schedule Collision & Cross-City Carpool Routing ("Kyytirinki")**
* **Actors:** Jari (Parent A), Mikko (Parent B), Antti (Carpool Partner)
* **What the Experience Should Be:**
  - Simultaneous matches in opposite directions (e.g. Otso in East Helsinki at 11:00, Sofia in West Espoo at 11:15).
  - The app suggests an automated logistical split:
    - *"Jari drives Otso to Vuosaari (leaves 09:45)"*
    - *"Mikko drives Sofia to Kauniainen (leaves 10:15)"*
  - If one parent is unavailable, the app triggers a 1-tap **Carpool Request** to other team parents on the same route with pre-filled seat request details.

---

### 🟢 Phase 4: Match Operations, Volunteerism & Community

#### **UJ-09: Talkoovahti — Volunteer Kiosk & Shift Balancer**
* **Actors:** Jari (Parent) & Tiina (Jojo)
* **What the Experience Should Be:**
  - Automatically detects and highlights parent volunteer duties (*kahviovuoro, kirjuri, kello, järjestyksenvalvoja*).
  - Verifies that the volunteer shift does not collide with the parent's own child's match on the field.
  - Displays a season-long family volunteer workload equalizer.
  - If sick or traveling, provides a 1-tap **"Request Shift Swap"** button generating a pre-filled, polite WhatsApp message for the team group.

#### **UJ-10: 1-Tap Attendance & Game Day Check-In (IN / OUT)**
* **Actors:** Jari (Parent), Otso (Player) & Tiina (Coach)
* **What the Experience Should Be:**
  - Simple 1-tap status toggle: `🟢 IN (Pelaa)` / `🔴 OUT (Poissa)`.
  - If a child wakes up with a fever on matchday morning, 1 tap marks OUT and automatically drafts an SMS/WhatsApp notice to the coach explaining the absence.

#### **UJ-11: Sudden Pitch Relocation & Emergency Rerouting**
* **Actors:** Tiina (Jojo) & Jari (Driver)
* **What the Experience Should Be:**
  - Waterlogged grass pitch causes the referee to move the game 45 minutes before kickoff (*Bollis 1 $\rightarrow$ Bollis 6 artificial turf*).
  - The parent simply pastes the coach's alert or taps "Relocate Field".
  - The app instantly updates the GPS route, switches footwear advice from wet grass (SG) to artificial turf (AG), and alerts co-parents.

#### **UJ-12: Extended Family Live Match Ticker & Grandparent Broadcast**
* **Actors:** Jari (at the pitch) & Mummi (at home)
* **What the Experience Should Be:**
  - During the game, the parent at the pitch taps `+ Maali (Otso)` or `Tulos 2-1`.
  - Grandparents receive live score push updates or can follow a privacy-safe live web ticker link with zero app installation.

---

### 🟢 Phase 5: Tournament Expeditions & Travel Camps

#### **UJ-13: Multi-Day Tournament Expedition Commander**
* **Actors:** Jari (Parent), Otso (Player), Emma (Sibling)
* **What the Experience Should Be:**
  - Massive 3-day tournaments (Helsinki Cup, Pori Cup, Wasa Football Cup) with 6+ matches.
  - The app formats the schedule as a multi-stage expedition:
    - **Rest & Recovery Intervals:** Calculates exact gaps between games (e.g. *"2h 15min gap $\rightarrow$ Eat lunch by 12:30"*).
    - **Nutrition & Hydration Alerts:** Reminds to drink electrolytes and rehydrate.
    - **Dynamic Knockout Brackets:** As the team advances from group stage to playoffs, match times update with 1 tap.
    - **Multi-Game Packing Pack:** Prompts 2 jerseys, 3 pairs of socks, snack packs, and fold-up chairs.

#### **UJ-14: Away Tournament Travel Logistics (Hotels & Bus Transfers)**
* **Actors:** Tiina (Jojo) & Jari
* **What the Experience Should Be:**
  - Integrated hotel check-in times, team bus departure schedules, group meal reservations, and tournament badge pickup locations.

---

### 🟢 Phase 6: Privacy, Offline Sovereignty & Post-Match

#### **UJ-15: 100% Offline Matchday in Concrete Bomb-Shelter Sports Halls**
* **Actors:** Jari & Otso
* **What the Experience Should Be:**
  - Arriving at an underground sports shelter (*väestönsuoja / luolahalli*) with zero cellular bars.
  - The PWA opens instantly with full access to schedules, opponent rosters, parking advice, and notes.
  - Local score updates and kit notes are saved in IndexedDB and silently sync when cellular connectivity is re-established.

#### **UJ-16: Privacy-Preserving Child Data Sovereignty**
* **Actors:** Jari & Laura (Parents)
* **What the Experience Should Be:**
  - Complete zero-cloud privacy by default: child names, jersey numbers, and locations are stored locally.
  - No behavioral tracking, no data brokering to ad networks, and no public indexing of minor athletes' personal information.

#### **UJ-17: Consent-Safe Team Photo & Memory Vault**
* **Actors:** Jari (Parent) & Tiina (Jojo)
* **What the Experience Should Be:**
  - Post-match celebratory photo upload with automatic verification of team photo permissions (checking GDPR photo consent status per child).
  - Private peer-to-peer sharing among verified family members.

#### **UJ-18: Equipment Recycling & Team Flea Market ("Varustekirppis")**
* **Actors:** Jari (Parent of Otso, size 40 boots) & Parent of Eeli (needs size 40 boots)
* **What the Experience Should Be:**
  - As children outgrow expensive cleats, shin guards, and club jackets every 6 months, parents can list outgrown gear in a 1-tap internal team gear exchange.
  - Promotes circular economy and lowers the financial barrier to youth sports.

#### **UJ-19: Season Budget & Team Fee Transparency**
* **Actors:** Jari & Tiina (Jojo)
* **What the Experience Should Be:**
  - Clear overview of monthly club fees, tournament registration fees, referee payments, and equipment costs.
  - Automated reminders for upcoming seasonal dues without awkward debt-collecting messages in chat.

#### **UJ-20: Athlete Development, Mood & Recovery Tracker**
* **Actors:** Otso (Athlete) & Jari (Parent)
* **What the Experience Should Be:**
  - Post-match emotional reflection: athlete taps a simple mood score (😊 Great / 😐 Neutral / 😞 Frustrated) and notes highlights (*"Great assist in the 2nd half"*).
  - Helps parents foster positive psychological support and track overtraining/burnout across busy multi-sport seasons.

---

## 3. The 360° Visionary Journey Map

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 360° SPORTS FAMILY YEAR                                          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  SEASON PREPARATION        MATCHDAY COUNTDOWN         ON THE PITCH              EXPEDITIONS & TRAVEL   │
│  • UJ-01: Zero-Login Setup • UJ-04: Morning Mission   • UJ-06: Doppler Weather  • UJ-13: Tournament    │
│  • UJ-02: Universal Ingest • UJ-05: Kit Clash Check   • UJ-09: Talkoovahti Kiosk• UJ-14: Away Trips    │
│  • UJ-03: Multi-Hobby Sync • UJ-07: Parking & Gates   • UJ-10: 1-Tap Attendance • UJ-18: Flea Market  │
│                            • UJ-08: Sibling Carpools  • UJ-11: Pitch Rerouting  • UJ-19: Team Fees     │
│                                                       • UJ-12: Live Grandparent • UJ-20: Mood & Growth │
│                                                                Ticker                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Product Design Principles for the Ideal Sports Family Companion

1. **Zero-Friction Sovereignty:** Never force a stressed parent to create an account, verify an email, or remember a password at 07:30 AM on Saturday morning.
2. **Predictive Clarity over Raw Data:** Don't just show a raw calendar list — compute *when to leave, what studs to screw in, and which jersey to wear*.
3. **Inclusive Multi-Role Architecture:** Every family member (drivers, co-parents, teens, younger siblings, grandparents) gets an interface tailored to their exact cognitive needs.
4. **Resilience Deep Underground:** Must function flawlessly offline in subterranean concrete sports halls with zero mobile data.
5. **Absolute Minor Privacy:** Children's athletic data, locations, and schedules belong exclusively to the family — never monetized or exposed.
