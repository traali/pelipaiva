# Pelipäivä — Complete Family Persona Framework & User Journeys Specification

## Document Purpose & Scope
This specification defines the complete **Family Persona Ecosystem** and **End-to-End User Journeys** for **Pelipäivä (Matchday Hub)**. 

Youth sports logistics in the Nordics is a collaborative family effort spanning active drivers, passive supporters, junior athletes, tag-along siblings, extended grandparents, blended households, and non-sports hobby overlaps (music school, scouts, evening classes).

---

## 1. The Family Persona Ecosystem Matrix

```
                      ┌──────────────────────────────────────────────┐
                      │            FAMILY LOGISTICS HUB              │
                      └──────────────────────┬───────────────────────┘
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
   [Active Caregivers]              [Athletes & Siblings]           [Extended Network]
   • The Logistics Anchor (Jari)    • Self-Reliant Junior (Otso)    • Extended Cheerleader (Mummi)
   • The Calendar Consumer (Mikko)  • Tag-Along Sibling (Emma)      • Team Manager / Jojo (Tiina)
   • Blended Co-Parent (Laura)      • Multi-Hobby Child (Sofia)     • Carpool Parent (Antti)
```

### Detailed Persona Profiles

| Persona Archetype | Activity Level | Core Motivation & Behavioral Triggers | Critical UX Needs |
|---|:---:|---|---|
| **1. The Logistics Anchor (Jari, 41)** | **Very High (Daily)** | Manages primary schedules, drives the minivan, checks pitch weather, packs kits, fulfills kiosk duties (*talkoot*). | Automated Time-to-Leave (TTL) countdowns, footwear/surface mapping, parking disc reminders, 1-tap WhatsApp schedule import. |
| **2. The Calendar Consumer / Co-Parent (Mikko, 39)** | **Moderate (Matchdays)** | Wants to know who drives which child, address of the pitch, and game times without downloading heavy apps or remembering passwords. | Zero-auth 6-character Family Code sync, WhatsApp deep-link invites, mobile-optimized read-only timeline. |
| **3. The Blended / Shared Custody Parent (Laura, 43)** | **Alternating Weeks** | Coordinates schedules across two households; needs seamless updates without administrative friction or invasive account sharing. | Independent device pairing, local IndexedDB persistence, non-destructive schedule sync. |
| **4. The Self-Reliant Junior Athlete (Otso, 13)** | **High (Matchdays)** | Checks own kickoff time, jersey color (*sininen vai oranssi?*), field number (*TN2 vs TN4*), and personal goal statistics. | Large readable match card, kit color indicator, starting lineup status, zero confusing parent admin settings. |
| **5. The Tag-Along Younger Sibling (Emma, 6)** | **Passive / Dependent** | Travels along to older brother's matches; gets cold and bored pitch-side. | Spectator gear advice (warm blanket, rain cover), playground / kiosk availability tag at venue, game duration visibility. |
| **6. The Multi-Hobby Overlap Child (Sofia, 11)** | **Active (Multi-Discipline)** | Plays floorball in ErVi and attends music institute (violin) on Friday evenings. | Non-sports event clash detection, travel buffer calculations between music school and sports hall. |
| **7. The Extended Family Cheerleader (Mummi & Ukki, 68)** | **Low (Occasional)** | Wants to come watch grandchildren play on Saturday mornings and track live scores from home. | Pre-formatted 1-tap WhatsApp match share with Google Maps navigation link and live score updates. |
| **8. The Team Manager / Volunteer Jojo (Tiina, 44)** | **Very High (Seasonal)** | Receives tournament schedules in raw WhatsApp chats, assigns kiosk shifts, manages last-minute field relocations. | Zero-cloud client-side WhatsApp schedule parser, automated volunteer shift tagging (*Talkoovahti*), emergency pitch change broadcaster. |
| **9. The Carpool Partner Parent (Antti, 42)** | **Moderate (Rotational)** | Shares driving duties for away games in neighboring municipalities (e.g. Helsinki $\rightarrow$ Lahti). | 1-tap departure time sharing, seat capacity coordination, exact parking navigation pin. |

---

## 2. End-to-End User Journeys (UJ-01 through UJ-14)

---

### 🟢 UJ-01: First-Time Multi-Child Roster Setup
* **Primary Persona:** Jari (Logistics Anchor) & Laura (Blended Parent)
* **Context:** Initial app boot or start of a new sports season.
* **Goal:** Configure profiles for 2+ children across different sports (Football & Floorball) in under 60 seconds with zero password friction.
* **User Flow:**
  1. Opens PWA $\rightarrow$ sees single welcoming input *"1. Lisää pelaaja / lapsi"*.
  2. Types *"Otso"* $\rightarrow$ taps *"Jatka →"*.
  3. 1-taps preset *"PPJ/Laru sin · P13 Kolmonen"*.
  4. Taps *"+ Tallenna ja lisää seuraava pelaaja"* $\rightarrow$ types *"Sofia"* $\rightarrow$ selects *"ErVi Salibandy"*.
  5. Taps *"Valmis"* $\rightarrow$ instant transition to unified family timeline.
* **Acceptance Criteria:**
  - Zero login/email gates.
  - Sub-60s completion time.
  - Multi-child schedules combined in a single unified view.

---

### 🟢 UJ-02: Matchday Morning Mission Control & Departure HUD
* **Primary Persona:** Jari (Logistics Anchor) & Otso (Junior Athlete)
* **Context:** Saturday 07:30 AM wake-up for a 09:30 AM kickoff.
* **Goal:** Eliminate morning panic: calculate exact departure time, required boot studs, and weather-appropriate clothing.
* **User Flow:**
  1. Jari opens app $\rightarrow$ `HeroMatchCard.tsx` highlights Otso's match at *Töölön Pallokenttä*.
  2. HUD displays:
     - **Time to Leave (TTL):** *"Lähde 08:35 (45 min alkulämpö + 20 min ajo)"*.
     - **Footwear Pill:** *"AG / FG -tekonurminappikset"* (queried from LIPAS.fi venue database).
     - **Kit Guidance:** *"Sininen koti-pelipaita, kerrasto alle (+7°C, tuulinen)"*.
  3. Otso checks the card on his own phone and packs the blue jersey.
  4. Jari checks off the water bottle, shin guards, and player pass in `KitChecklist.tsx`.
* **Acceptance Criteria:**
  - Departure countdown automatically adjusts dynamically as current time elapses.
  - Footwear guidance matches venue surface tag.

---

### 🟢 UJ-03: Live Weather Radar & Storm Proximity Check
* **Primary Persona:** Jari (Logistics Anchor) & Emma (Tag-Along Sibling)
* **Context:** Dark rain clouds rolling in 15 minutes before an outdoor match.
* **Goal:** Verify if rain will hit during playtime and check lightning safety protocols.
* **User Flow:**
  1. Jari taps the weather radar pill on the match card.
  2. `LiveWeatherRadarModal.tsx` opens with a 5-frame looping FMI Doppler radar animation centered on the pitch coordinates.
  3. App evaluates the Finnish **30/30 Lightning Safety Rule**: confirms no strikes within $10\text{km}$ (*"Turvallinen sää: Ei salamahavaintoja lähialueella"*).
  4. Weather summary advises: *"Sadekuuro klo 10:15–10:45. Pakkaa sateenvarjo ja lämmin istuinalusta Emmalle."*
  5. Jari packs the sibling's rain poncho and dismisses modal with `Escape` or backdrop tap.
* **Acceptance Criteria:**
  - Radar frames loop smoothly without network lag.
  - Lightning safety banner triggers automatically if strikes $< 10\text{km}$.

---

### 🟢 UJ-04: Pitch Navigation & Parking Risk Assessment
* **Primary Persona:** Jari (Driver) & Antti (Carpool Parent)
* **Context:** Driving to an unfamiliar away field (e.g. *Käpylän tekonurmi*).
* **Goal:** Navigate directly to the public parking area, avoid €80 municipal parking tickets, and set the parking disc correctly.
* **User Flow:**
  1. Jari taps *"Pysäköinti & Reitti"* on the match card.
  2. `ParkingDetailModal.tsx` displays:
     - **Parking Ease Score:** `82/100 (Kohtalainen tilaa)`
     - **Parking Rules:** *"Maksuton pysäköintikiekolla 4h (H12.1)"*
     - **Disc Setting:** Auto-computed Finnish arrival rule (*Tieliikennelaki*: saavut klo 08:35 $\rightarrow$ aseta kiekkoon klo 09:00).
     - **Fine Risk:** High enforcement warnings for nearby pedestrian walkways.
  3. Jari taps *"Google Maps"* / *"Apple Maps"* $\rightarrow$ launches external GPS intent with `noopener,noreferrer`.
* **Acceptance Criteria:**
  - Navigation links open exact parking entrance coordinates (not pitch centroid).
  - Disc time calculation follows official Finnish rounding legislation.

---

### 🟢 UJ-05: Unstructured WhatsApp Schedule Import (Zero-Cloud Local NLP)
* **Primary Persona:** Tiina (Team Manager) & Jari (Parent)
* **Context:** Coach sends a messy season fixture list in the team WhatsApp group.
* **Goal:** Ingest 12 games into the calendar in 5 seconds without manual data entry or privacy leaks.
* **User Flow:**
  1. Jari copies raw text from WhatsApp (*"Moi kaikki! Tässä syksyn pelit: 12.9 klo 17.30 PPJ - HJK Bollis 6, 19.9 klo 14.00 EPS - PPJ Espoonlahti..."*).
  2. Opens Pelipäivä $\rightarrow$ taps *"Lisää joukkue tai turnaus"* $\rightarrow$ *"WhatsApp"* tab.
  3. Pastes clipboard text $\rightarrow$ local NLP engine (`messageParserNLP.ts`) parses dates, times, home/away opponents, and field numbers client-side.
  4. Preview modal highlights extracted games with green confidence badges.
  5. Taps *"Tallenna ottelut"* $\rightarrow$ all 12 matches committed to IndexedDB instantly.
* **Acceptance Criteria:**
  - 100% offline client-side parsing (zero PII sent to external APIs).
  - Handles variations: `"klo 17.30"`, `"17:30"`, `"kokoontuminen 16.45"`.

---

### 🟢 UJ-06: Zero-Auth Family Sync & Peer-to-Peer Pairing
* **Primary Persona:** Jari (Logistics Anchor) & Mikko (Co-Parent)
* **Context:** Jari sets up the calendar and needs to sync it to Mikko's phone.
* **Goal:** Pair devices in 3 seconds with zero accounts, passwords, or emails.
* **User Flow:**
  1. Jari taps *"Jaa perheelle"* $\rightarrow$ app generates a 6-character CSPRNG code (`PELI-7K2`).
  2. Jari taps *"Jaa WhatsAppissa"* $\rightarrow$ sends invite link to Mikko.
  3. Mikko clicks the link $\rightarrow$ app opens on his browser, automatically imports the family roster, and syncs match schedules.
  4. Both parents see live synchronized event schedules via background Cloudflare KV sync.
* **Acceptance Criteria:**
  - Cryptographically secure Crockford-32 tokens via `crypto.getRandomValues()`.
  - Zero login walls or profile creation barriers for co-parent.

---

### 🟢 UJ-07: Talkoovahti & Volunteer Kiosk Shift Tracking
* **Primary Persona:** Jari (Parent) & Tiina (Jojo)
* **Context:** Parent is assigned a kiosk shift (*kahviovuoro*) or scorekeeper duty (*toimitsijavuoro*).
* **Goal:** Never miss a volunteer shift and balance duty workload across the season.
* **User Flow:**
  1. Calendar parser detects keywords in event description: `"Kahviovuoro klo 14:00-16:00"`.
  2. Dashboard card displays a prominent amber badge: `☕ Kahviovuoro klo 14:00–16:00`.
  3. Jari opens `TalkooBoard.tsx` to view family duty balance across the season.
  4. 1-tap WhatsApp share allows posting a reminder to the family group.
* **Acceptance Criteria:**
  - Volunteer duties clearly separated visually from player match kickoff times.
  - Duty time windows extracted accurately from descriptions.

---

### 🟢 UJ-08: Multi-Match Tournament Weekend Expedition
* **Primary Persona:** Jari (Parent), Otso (Athlete) & Emma (Sibling)
* **Context:** Helsinki Cup weekend: 5 games across Saturday & Sunday at different pitches.
* **Goal:** Manage dense tournament schedules, recovery times between matches, and meal buffers.
* **User Flow:**
  1. Jari opens `TournamentWeekendPanel.tsx`.
  2. Timeline displays chronological tournament fixtures with rest intervals (e.g. *1h 45min lepotauko pelien välissä*).
  3. Card recommends tournament expedition packing: *"Pitkä turnauspäivä: 3 peliä. Pakkaa eväät, 2× juomapullo, vaihtopaita, sadetakki."*
  4. 1-tap route button recalculates transit time to the next tournament venue.
* **Acceptance Criteria:**
  - Recovery buffer correctly calculated between consecutive match end and next warmup times.
  - Group stage fixtures grouped seamlessly by tournament name.

---

### 🟢 UJ-09: Offline Matchday Resilience in Concrete Sports Halls
* **Primary Persona:** Jari & Otso
* **Context:** Arriving at an underground bomb-shelter sports hall (*väestönsuoja / luolahalli*) with zero cellular bars.
* **Goal:** Seamlessly access schedules, opponent lineups, parking notes, and rules without network errors.
* **User Flow:**
  1. Jari launches Pelipäivä with device in airplane mode.
  2. Service Worker serves cached application shell and assets from precache.
  3. Dexie IndexedDB serves all local profiles, matches, and venue guides instantly.
  4. Jari updates match score locally $\rightarrow$ change queues for background sync when connection restores.
* **Acceptance Criteria:**
  - Zero blank screens, infinite spinners, or network crash alerts.
  - Complete local CRUD capability.

---

### 🟡 UJ-10: Sibling Schedule Collision & Cross-City Logistics Split
* **Primary Persona:** Jari (Parent A), Mikko (Parent B), Otso (Child 1) & Sofia (Child 2)
* **Context:** Saturday 11:00 AM: Otso plays football in Vuosaari (East Helsinki), Sofia plays floorball in Kauniainen (West Espoo).
* **Goal:** Detect the logistical conflict early and split driving responsibilities between parents.
* **User Flow:**
  1. Conflict detection engine flags simultaneous overlapping matches: `⚠️ Päällekkäiset ottelut klo 11:00`.
  2. App suggests split vehicle assignment: *"Jari ajaa: Otso (Vuosaari) · Mikko ajaa: Sofia (Kauniainen)"*.
  3. Jari taps *"Jaa ajojako WhatsAppissa"* $\rightarrow$ sends pre-formatted logistical plan to Mikko.
* **Acceptance Criteria:**
  - Overlap detection accounts for match duration + travel buffer between venues.
  - Generates clear bilateral carpool / caregiver assignment text.

---

### 🟡 UJ-11: Roster Attendance & Game Day Check-In Sync
* **Primary Persona:** Tiina (Jojo / Coach) & Jari (Parent)
* **Context:** Matchday morning attendance confirmation (*IN / OUT*).
* **Goal:** Confirm player availability with 1 tap without navigating heavy legacy portal logins.
* **User Flow:**
  1. Jari opens match card $\rightarrow$ taps quick toggle: `🟢 Mukana (IN)` / `🔴 Poissa (OUT)`.
  2. Status reflects immediately in the family Mission Control HUD.
  3. If child falls ill on matchday morning, parent taps `Poissa (OUT)` $\rightarrow$ triggers auto-generated WhatsApp notification for coach.
* **Acceptance Criteria:**
  - Single-tap status toggle stored locally and synced via Family Sync.

---

### 🟡 UJ-12: Volunteer Duty Emergency Swap & Hand-off
* **Primary Persona:** Jari (Parent) & Tiina (Jojo)
* **Context:** Jari is assigned a kiosk shift on Sunday, but child gets injured or family has an emergency.
* **Goal:** Request a volunteer duty swap with another team parent in under 10 seconds.
* **User Flow:**
  1. Jari taps his assigned volunteer shift in `TalkooBoard.tsx`.
  2. Taps *"Pyydä vuoroverrokkia / Vaihtoa"*.
  3. App generates a polite, pre-formatted WhatsApp message: *"Moi! Minulla on kahviovuoro su 14.9 klo 14–16 Töölössä. Pääseekö kukaan vaihtamaan esim. ensi viikon vuoroon?"*.
  4. Jari pastes it into the team parent WhatsApp group.
* **Acceptance Criteria:**
  - Pre-filled message includes exact date, time, venue, and shift type.

---

### 🟡 UJ-13: Sudden Pitch Relocation & Weather Re-routing
* **Primary Persona:** Jari (Driver) & Tiina (Jojo)
* **Context:** 45 minutes before kickoff, grass pitch is flooded $\rightarrow$ referee moves game to artificial turf (*Bollis 1 $\rightarrow$ Bollis 6*).
* **Goal:** Update match venue, surface advice, and navigation route with 1 tap.
* **User Flow:**
  1. Jari receives WhatsApp notification from coach: *"Kenttä vaihdettu: Bollis 6 TN"*.
  2. Jari taps *"Pikapäivitys"* (or uses Event Chat) $\rightarrow$ types/pastes *"Kenttä vaihdettu Bollis 6"*.
  3. Local parser immediately updates venue geocode, changes footwear advice from SG to AG/FG, and recalculates parking route.
* **Acceptance Criteria:**
  - Venue correction updates persist in IndexedDB (`db.events`).
  - GPS navigation destination updates immediately.

---

### 🟡 UJ-14: Uniform / Kit Clash Coordinator
* **Primary Persona:** Otso (Athlete) & Jari (Parent)
* **Context:** Playing against an away team with identical blue jerseys (e.g. PPJ Blue vs HJK Blue).
* **Goal:** Avoid kit clashes before leaving home; pack the correct alternate jersey (*keltainen vieraspaita / liivit*).
* **User Flow:**
  1. App cross-references home/away team primary colors in `teamColors.ts`.
  2. Match card highlights: `⚠️ Pelipaitavaroitus: Molemmilla sininen paita!`.
  3. Recommends: *"Vierasottelu: Pue oranssi/keltainen vieraspaita tai ota mukaan liivit"*.
  4. Otso packs the alternate jersey into his sports bag.
* **Acceptance Criteria:**
  - Automated detection of matching or conflicting primary shirt colors.
  - Weather/kit advice dynamically updates to reflect alternate kit.

---

## 3. Summary Persona-to-Journey Traceability Matrix

| Persona | UJ-01 | UJ-02 | UJ-03 | UJ-04 | UJ-05 | UJ-06 | UJ-07 | UJ-08 | UJ-09 | UJ-10 | UJ-11 | UJ-12 | UJ-13 | UJ-14 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. Logistics Anchor (Jari)** | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ | ⭐️ |
| **2. Co-Parent Consumer (Mikko)** | ⭐️ | ⭐️ | | ⭐️ | | ⭐️ | | | ⭐️ | ⭐️ | ⭐️ | | | |
| **3. Blended Parent (Laura)** | ⭐️ | | | | | ⭐️ | | | ⭐️ | ⭐️ | | | | |
| **4. Junior Athlete (Otso)** | | ⭐️ | | | | | | ⭐️ | ⭐️ | | ⭐️ | | ⭐️ | ⭐️ |
| **5. Tag-Along Sibling (Emma)** | | ⭐️ | ⭐️ | ⭐️ | | | | ⭐️ | | ⭐️ | | | | |
| **6. Multi-Hobby Child (Sofia)** | ⭐️ | ⭐️ | | | | | | ⭐️ | | ⭐️ | ⭐️ | | | |
| **7. Extended Family (Mummi)** | | ⭐️ | | ⭐️ | | ⭐️ | | | | | | | | |
| **8. Team Manager (Tiina)** | | | ⭐️ | | ⭐️ | | ⭐️ | ⭐️ | | | ⭐️ | ⭐️ | ⭐️ | ⭐️ |
| **9. Carpool Parent (Antti)** | | ⭐️ | | ⭐️ | | | | ⭐️ | | ⭐️ | | | ⭐️ | |
