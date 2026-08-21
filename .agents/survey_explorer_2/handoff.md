# Handoff Report: R2 (Finnish Calendar Permutations & Fuzzy Join) & R4 (Configurable Arrival Rules)

**Agent**: `survey_explorer_2` (Teamwork Explorer)  
**Milestone**: Codebase Survey & Requirement Permutation Analysis  
**Working Directory**: `c:\dev2\pelipaiva\.agents\survey_explorer_2`  
**Date**: 2026-08-20  

---

## 1. Observation

A systematic review was conducted across `src/`, `types/`, `lib/`, `components/`, and tests to assess current capabilities against Requirements R2 and R4.

### 1.1 `src/types/matchday.ts`
- **Line 1–9 (`SportType`)**: Defines `'football' | 'floorball' | 'basketball' | 'volleyball' | 'icehockey' | 'futsal' | 'training' | 'other'`.
- **Line 11 (`EventType`)**: Defines `'match' | 'training' | 'tournament' | 'meeting' | 'other'`.
- **Line 89–98 (`PlayerProfile`)**:
  ```ts
  export interface PlayerProfile {
    id: string;
    playerName: string;
    teamName: string;
    sport: SportType;
    primaryColor: string;
    secondaryColor?: string;
    calendarUrl: string;
    colorHex: string;
  }
  ```
  *Observation*: Lacks R4 arrival rule configuration properties (e.g. `warmupOffsetHomeMinutes`, `warmupOffsetAwayMinutes`, `warmupOffsetTrainingMinutes`, `squadFilters`, `defaultDepartureBufferMinutes`).
- **Line 222–243 (`MatchdayEvent`)**: Contains `id, profileId, sport, eventType, isTraining, title, homeTeam, awayTeam, isHomeMatch, startTime, endTime, warmupTime, tournamentName?, venue, volunteerDuty?, weather?, lightning?, parking?, stats?, briefing?`.

### 1.2 `src/lib/calendar/icsParser.ts`
- **Lines 8–33 (`isTrainingEvent`)**:
  ```ts
  const trainingKeywords = [
    'harjoitukset', 'harjoitus', 'treenit', 'treeni', 'fysiikka',
    'lajiharjoitus', 'lajivuoro', 'kuntopiiri', 'aamujää', 'jäätreenit',
    'valmennus', 'taitotreenit', 'pukukoppipalaveri', 'fysiikkatreenit'
  ];
  if (text.includes(' vs ') && !text.includes('sisäinen')) {
    return false;
  }
  return trainingKeywords.some((kw) => text.includes(kw));
  ```
  *Observation*: 
  1. Classifies `'pukukoppipalaveri'` as training instead of `'meeting'`.
  2. Does not detect meetings (e.g. `vanhempainilta`, `kausipalaveri`, `tuomaripalaveri`, `päättäjäiset`, `föräldramöte`).
  3. Does not support Swedish/English training terms (e.g. `träning`, `fyssträning`, `isträning`, `practice`).
- **Lines 64–67 (Warmup Time Calculation)**:
  ```ts
  const isTraining = isTrainingEvent(title, description);
  const warmupOffsetMinutes = isTraining ? 15 : 45;
  const warmupDate = new Date(startDate.getTime() - warmupOffsetMinutes * 60 * 1000);
  ```
  *Observation*: Hardcodes 45 min / 15 min offsets subtracted directly from `startDate`. In Nimenhuuto/MyClub feeds, `DTSTART` is often already set to arrival/warmup time (e.g. 14:15), causing a double-offset error.
- **Lines 69–80 (Volunteer Duty Detection)**:
  ```ts
  let volunteerDuty: string | undefined;
  const descLower = description.toLowerCase();
  if (descLower.includes('kahviovuoro') || descLower.includes('kahvio')) {
    volunteerDuty = '☕ Kahviovuoro';
  } else if (descLower.includes('toimitsija') || descLower.includes('kirjuri')) {
    volunteerDuty = '⏱️ Toimitsijavuoro';
  } else if (descLower.includes('järkkäri') || descLower.includes('järjestyksenvalvoja')) {
    volunteerDuty = '🛡️ Järjestyksenvalvoja';
  } else if (descLower.includes('kirjuri') || descLower.includes('kello')) {
    volunteerDuty = '📝 Kirjuri/Kello';
  }
  ```
  *Observation*: Only inspects `description` (ignores `title`/`summary`). Does not extract duty time windows (e.g. `klo 14:30 - 16:00`). Missing duty categories: `kioski`, `makkaranpaisto`, `liivimies/liivit`, `kyyti/kuljetus`, `ensiapu/EA`, `striimaus/kuvaaja`, `pallokerääjä`.
- **Lines 88–106 (Match Title & Opponent Parsing)**:
  ```ts
  const cleanedTitle = title.replace(/^(peli|ottelu|sarjapeli|sarjaottelu|turnauspeli):\s*/i, '');
  const vsDelimiters = [' vs ', ' - ', ' v ', ' @ '];
  for (const delim of vsDelimiters) {
    if (cleanedTitle.includes(delim)) {
      const parts = cleanedTitle.split(delim);
      homeTeam = (parts[0] || '').trim();
      awayTeam = (parts[1] || '').trim();
      if (delim === ' @ ') {
        isHomeMatch = false;
        const temp = homeTeam;
        homeTeam = awayTeam;
        awayTeam = temp;
      }
      break;
    }
  }
  ```
  *Observation*:
  1. Fails on unspaced hyphenated matches (e.g. `HJK-EPS peli`).
  2. Fails on `@ <venue>` in title (e.g. `Peli @ Bubu vs Honka`).
  3. Fails on Swedish/English prefixes (`Seriematch: IFK - GrIFK`, `Friendly: KäPa vs Ilves`, `Träningsmatch:`).
  4. Retains trailing tournament round info (e.g. `(Kierros 4)` or `[Lohko 2]`) inside team names.
- **Lines 109–114 (EventType Assignment)**:
  ```ts
  let eventType: EventType = 'match';
  if (isTraining) {
    eventType = 'training';
  } else if (descLower.includes('turnaus') || title.toLowerCase().includes('turnaus') || descLower.includes('torneopal')) {
    eventType = 'tournament';
  }
  ```
  *Observation*: Never sets `eventType = 'meeting'`.

### 1.3 `src/lib/geo/sportsGeocoder.ts`
- **Lines 4–57 (`NATIONAL_FIELD_ALIASES`)**:
  Contains 27 venue alias mappings across Helsinki, Espoo, Vantaa, Tampere, Turku, Jyväskylä, Oulu, Lahti.
- **Lines 59–175 (`resolveSportsVenue`)**:
  Hierarchical resolution pipeline:
  1. IndexedDB custom user pins (`db.venuePins`)
  2. `NATIONAL_FIELD_ALIASES`
  3. LIPAS.fi Open Sports Facility API (`https://lipas.fi/api/sports-places`)
  4. Palvelukartta API (`https://api.hel.fi/servicemap/v2/search/`)
  5. Default fallback to Töölö sports hub (`60.1872, 24.9248`).
  *Observation*: The dictionary contains 27 entries. The requirement specifies 100+ Finnish pitch nicknames covering major national sports hubs.

### 1.4 `src/lib/ai/deterministicReasoner.ts`
- **Lines 118–130 (Departure Time Calculation)**:
  ```ts
  const warmupDate = new Date(warmupTime);
  const walkingMins = parking?.walkingTimeMinutes || 3;
  const bufferMins = 10;
  const drivingEstimateMins = 20;
  const leaveHomeDate = new Date(
    warmupDate.getTime() - (walkingMins + bufferMins + drivingEstimateMins) * 60000
  );
  ```
  *Observation*: `bufferMins` (10) and `drivingEstimateMins` (20) are hardcoded constants. They are not customizable per profile/user.

### 1.5 `src/components/CalendarImportModal.tsx` & `src/components/MultiProfileHeader.tsx`
- Modal collects `playerName`, `teamName`, `sport`, `icsUrl`.
- No controls for multi-squad splitting (e.g. detecting Sininen / Valkoinen / Musta from feed), custom warmup offsets, or home location.

---

## 2. Logic Chain

```
[Observation 1.2: Regex/string splitting in icsParser.ts]
  ├── Only handles basic Finnish prefixes ('peli:', 'ottelu:') and explicit delimiters (' vs ', ' - ')
  └── FAILS on: 'HJK-EPS peli', 'Peli @ Bubu vs Honka', 'Ottelu: VJS - PPJ (Kierros 4)', 'Seriematch: IFK - GrIFK', 'Friendly: KäPa vs Ilves', 'Turnaus / Pelitapahtuma'
       │
       ▼ (Deduction 1: Title Permutations Engine Required)
       Implement a multi-pass tokenizer and regex cleaner that strips Swedish/Finnish/English prefixes, extracts embedded venue/location tags, strips round/bracket metadata, and robustly separates home/away teams.

[Observation 1.2: isTrainingEvent only checks 14 keywords & never assigns 'meeting']
  ├── Missing meetings (vanhempainilta, palaveri, kausipalaveri, föräldramöte)
  └── Missing sport-specific training (aamujää, fysiikka, lajivuoro, oheisharjoitus, MV-treenit)
       │
       ▼ (Deduction 2: Three-Tier Event Classifier Required)
       Implement `classifyCalendarEvent(title, description)` returning `'match' | 'training' | 'meeting' | 'tournament' | 'other'` with full vocabulary across Football, Floorball, Basketball, Volleyball, Ice Hockey, and Futsal.

[Observation 1.2 & 1.4: Warmup time unconditionally subtracts 45m/15m from DTSTART]
  ├── DTSTART in Nimenhuuto/MyClub is frequently the arrival time, with kickoff in description ("Kokoontuminen 14:15, peli 15:00")
  └── Results in double-subtraction (warmup set to 13:30, kickoff 14:15)
       │
       ▼ (Deduction 3: Dual-Timestamp Disentanglement Engine Required)
       Parse description/summary for explicit kickoff vs gathering times using regex. If kickoff is stated, anchor kickoff at parsed time and warmup at DTSTART or configured arrival offset. Support EET/EEST timezone normalization.

[Observation 1.1 & 1.5: Single feed import maps all events to 1 profileId]
  ├── Club feeds (e.g. HJK T13, EPS P12) mix Sininen, Valkoinen, Musta, Kilpa, Haaste, T1, T2
  └── Parents get overloaded with events for squads their child does not play in
       │
       ▼ (Deduction 4: Multi-Squad Splitting & Tagging Architecture)
       Analyze ICS feed for squad identifiers ('Sininen', 'Valkoinen', 'Musta', 'Kilpa', 'Haaste', 'T1', 'T2'). Allow user during import (or in profile settings) to auto-split feeds into distinct profiles or apply squad filters.

[Observation 1.2: Volunteer duty detection is basic & lacks time window extraction]
  ├── Only catches 4 keywords in description
  └── Omits duty time window ("klo 14:30 - 16:00"), title-based duties, and roles (kioski, makkaranpaisto, liivimies, kyyti, striimaus)
       │
       ▼ (Deduction 5: Talkoovahti Volunteer Parser with Time Windows)
       Extract full duty metadata including duty type, emoji, and exact time window string.

[Observation 1.3: Geocoder alias dictionary has 27 entries vs 100+ required]
  ├── Only Helsinki + basic cities covered
  └── Missing major national pitch nicknames (e.g. Bollis 1-6, Sahara, Väiski, Braku, Kisis, Mosahalli, Kauppi 1-8, Kupittaa 1-8, Heinäpää, Vehkalampi, Kisapuisto, Väre Areena, Elisa Stadion, OmaSp Stadion, Keskari, etc.)
       │
       ▼ (Deduction 6: 100+ Curated Finnish Sports Pitch Slang Dictionary)
       Expand `NATIONAL_FIELD_ALIASES` to 100+ comprehensive entries with GPS coordinates, surface types, indoor/outdoor flags, and floodlight data.

[Observation 1.1, 1.4, 1.5: PlayerProfile lacks R4 arrival configuration fields]
  ├── Warmup offsets (home/away/training), driving buffers, and squad filters cannot be customized
  └── User cannot customize arrival rules per team
       │
       ▼ (Deduction 7: Configurable Arrival & Departure Rule Engine)
       Extend `PlayerProfile` and `PelipaivaDB` schema to persist custom offsets (`warmupOffsetHomeMinutes`, `warmupOffsetAwayMinutes`, `warmupOffsetTrainingMinutes`, `departureBufferMinutes`, `squadFilters`).
```

---

## 3. Detailed Technical Analysis & Specifications

### 3.1 R2.1: Title Permutation Engine Specification

The calendar title parser must handle the following comprehensive permutations:

| Input Title Pattern | Example | Expected Output |
| :--- | :--- | :--- |
| **Standard vs** | `HJK T13 Sininen vs EPS` | `homeTeam: "HJK T13 Sininen"`, `awayTeam: "EPS"`, `isHome: true` |
| **Hyphenated Match** | `HJK-EPS peli` | `homeTeam: "HJK"`, `awayTeam: "EPS"`, `isHome: true` |
| **Venue In Title** | `Peli @ Bubu vs Honka` | `homeTeam: "Kotijoukkue"`, `awayTeam: "Honka"`, `venueAlias: "Bubu"` |
| **Round / Bracket Suffix** | `Ottelu: VJS - PPJ (Kierros 4)` | `homeTeam: "VJS"`, `awayTeam: "PPJ"`, `round: "Kierros 4"` |
| **Swedish Match** | `Seriematch: IFK - GrIFK` | `homeTeam: "IFK"`, `awayTeam: "GrIFK"`, `isHome: true` |
| **Friendly / Harjoitusottelu** | `Friendly: KäPa vs Ilves` | `homeTeam: "KäPa"`, `awayTeam: "Ilves"`, `isFriendly: true` |
| **Away Notation (@ / borta)** | `Oilers @ ErVi` | `homeTeam: "ErVi"`, `awayTeam: "Oilers"`, `isHome: false` |
| **Tournament / Multi-Match** | `Turnaus: Helsinki Cup (3 peliä)` | `eventType: "tournament"`, `tournamentName: "Helsinki Cup"` |

#### Proposed Parsing Pipeline (`parseMatchTitle`):
```ts
export interface ParsedTitleResult {
  eventType: EventType;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  embeddedVenueHint?: string;
  roundInfo?: string;
  isFriendly?: boolean;
}

export function parseMatchTitle(rawTitle: string, defaultTeamName: string = ''): ParsedTitleResult {
  let title = rawTitle.trim();

  // 1. Extract bracketed round/group info: e.g. "(Kierros 4)", "[Lohko 2]"
  let roundInfo: string | undefined;
  const roundMatch = title.match(/[\(\[]\s*(kierros\s*\d+|lohko\s*\w+|\d+\s*ottelua?|ottelu\s*\d+\/\d+)\s*[\)\]]/i);
  if (roundMatch) {
    roundInfo = roundMatch[1];
    title = title.replace(roundMatch[0], '').trim();
  }

  // 2. Strip multi-lingual match/training prefixes
  const prefixRegex = /^(?:ottelu|peli|sarjapeli|sarjaottelu|turnauspeli|harjoitusottelu|treenipeli|friendly|match|seriematch|träningsmatch):\s*/i;
  const isFriendly = /^(?:harjoitusottelu|treenipeli|friendly|träningsmatch)/i.test(title);
  title = title.replace(prefixRegex, '').trim();

  // 3. Extract embedded venue: e.g. "Peli @ Bubu vs Honka" -> venue "Bubu", matchup "vs Honka"
  let embeddedVenueHint: string | undefined;
  const atVenueMatch = title.match(/@\s*([a-zA-Z0-9åäöÅÄÖ\s\-_]+?)(?=\s+(?:vs|-|v)\s+|$)/i);
  if (atVenueMatch && atVenueMatch[1]) {
    embeddedVenueHint = atVenueMatch[1].trim();
    title = title.replace(`@ ${atVenueMatch[1]}`, '').replace(/peli|ottelu/gi, '').trim();
  }

  // 4. Opponent Splitting with support for ' vs ', ' - ', ' v ', ' @ ', or 'HJK-EPS peli'
  const vsDelimiters = [' vs ', ' - ', ' v ', ' @ '];
  for (const delim of vsDelimiters) {
    if (title.includes(delim)) {
      const parts = title.split(delim);
      let home = (parts[0] || '').trim();
      let away = (parts[1] || '').trim();
      let isHome = true;

      if (delim === ' @ ') {
        isHome = false;
        const temp = home;
        home = away;
        away = temp;
      }

      return {
        eventType: 'match',
        homeTeam: home || defaultTeamName,
        awayTeam: away,
        isHomeMatch: isHome,
        embeddedVenueHint,
        roundInfo,
        isFriendly
      };
    }
  }

  // Check unspaced hyphen format e.g. "HJK-EPS peli"
  const unspacedMatch = title.match(/^([A-ZÅÄÖ0-9]+(?:[\s][A-ZÅÄÖ0-9]+)*)-([A-ZÅÄÖ0-9]+(?:[\s][A-ZÅÄÖ0-9]+)*)(?:\s+peli|\s+ottelu)?$/i);
  if (unspacedMatch && unspacedMatch[1] && unspacedMatch[2]) {
    return {
      eventType: 'match',
      homeTeam: unspacedMatch[1].trim(),
      awayTeam: unspacedMatch[2].trim(),
      isHomeMatch: true,
      embeddedVenueHint,
      roundInfo,
      isFriendly
    };
  }

  return {
    eventType: 'match',
    homeTeam: title,
    awayTeam: '',
    isHomeMatch: true,
    embeddedVenueHint,
    roundInfo,
    isFriendly
  };
}
```

---

### 3.2 R2.2: Event Type Classification Vocabulary

```ts
export const EVENT_CLASSIFICATION_RULES = {
  training: [
    'harjoitukset', 'harjoitus', 'treenit', 'treeni', 'fysiikka', 'fysiikkatreenit',
    'lajiharjoitus', 'lajivuoro', 'kuntopiiri', 'aamujää', 'jäätreenit', 'jäävuoro',
    'valmennus', 'taitotreenit', 'taitokoulu', 'luistelukoulu', 'oheisharjoitus',
    'oheiset', 'lajikoulu', 'kuntosali', 'pelisali', 'vesitreeni', 'juoksutreeni',
    'mv-treenit', 'maalivahtitreenit', 'träning', 'fyssträning', 'isträning', 'practice'
  ],
  meeting: [
    'palaveri', 'vanhempainilta', 'joukkueen palaveri', 'kausipalaveri', 'tuomaripalaveri',
    'valmentajapalaveri', 'päättäjäiset', 'seurakokous', 'kehityskeskustelu', 'möte',
    'föräldramöte', 'pukukoppipalaveri', 'joukkuepalaveri', 'taktiikkapalaveri'
  ],
  tournament: [
    'turnaus', 'pelitapahtuma', 'turnering', 'tournament', 'turnauspeli', 'cup'
  ]
};
```

---

### 3.3 R2.3: Timezone & Dual-Timestamp Disentanglement (Warmup vs Kickoff & DST)

Amateur sports feeds have two distinct time models:
1. **Kickoff-Anchored Feed**: `DTSTART` = 15:00 (kickoff). Description states "Kokoontuminen 14:15".
2. **Warmup-Anchored Feed**: `DTSTART` = 14:15 (arrival). Description states "Ottelu alkaa 15:00" or "Peli 15:00-16:15".

#### Timestamp Disentanglement Algorithm:
```ts
export function resolveEventTimes(
  dtStart: Date,
  dtEnd: Date,
  title: string,
  description: string,
  isTraining: boolean,
  defaultWarmupOffsetMins: number = 45
): { kickoffTime: Date; warmupTime: Date; endTime: Date } {
  const text = `${title} ${description}`;

  // Match: "peli alkaa klo 15:00", "kickoff 15:00", "ottelu 15.00", "peli 15:00"
  const kickoffMatch = text.match(/(?:peli|ottelu|kickoff|matsi|ottelu\s*alkaa|peli\s*alkaa)\s*(?:klo)?\s*(\d{1,2})[:.](\d{2})/i);
  
  // Match: "kokoontuminen klo 14:15", "paikalle klo 14:15", "alkulämpö 14.15"
  const warmupMatch = text.match(/(?:kokoontuminen|paikalle|paikalla|saapuminen|alkulämpö|lämpö)\s*(?:klo)?\s*(\d{1,2})[:.](\d{2})/i);

  let kickoffTime = new Date(dtStart);
  let warmupTime = new Date(dtStart.getTime() - defaultWarmupOffsetMins * 60 * 1000);

  if (kickoffMatch && kickoffMatch[1] && kickoffMatch[2]) {
    const kHours = parseInt(kickoffMatch[1], 10);
    const kMins = parseInt(kickoffMatch[2], 10);
    const candidateKickoff = new Date(dtStart);
    candidateKickoff.setHours(kHours, kMins, 0, 0);

    // If candidate kickoff is later than dtStart, dtStart was likely warmup time
    if (candidateKickoff.getTime() > dtStart.getTime() - 15 * 60 * 1000 &&
        candidateKickoff.getTime() < dtStart.getTime() + 120 * 60 * 1000) {
      kickoffTime = candidateKickoff;
      warmupTime = dtStart; // dtStart is the actual gathering time
    }
  } else if (warmupMatch && warmupMatch[1] && warmupMatch[2]) {
    const wHours = parseInt(warmupMatch[1], 10);
    const wMins = parseInt(warmupMatch[2], 10);
    const candidateWarmup = new Date(dtStart);
    candidateWarmup.setHours(wHours, wMins, 0, 0);
    if (candidateWarmup.getTime() < dtStart.getTime() + 30 * 60 * 1000) {
      warmupTime = candidateWarmup;
    }
  }

  return { kickoffTime, warmupTime, endTime: dtEnd };
}
```

---

### 3.4 R2.4: Multi-Squad Feed Splitting Architecture

Finnish sports clubs frequently maintain a single shared calendar feed for an age group (e.g. `HJK T13` or `EPS P12`). This single feed contains fixtures for multiple distinct squads:

**Common Finnish Squad Identifiers:**
- **Colors**: `Sininen` (Blue), `Valkoinen` (White), `Musta` (Black), `Punainen` (Red), `Keltainen` (Yellow), `Vihreä` (Green).
- **Levels**: `Kilpa` (Competitive), `Haaste` (Challenge), `Harraste` (Recreational), `Akatemia` (Academy), `Edustus` (First Team), `United`, `City`.
- **Numbered Groups**: `T1`, `T2`, `T3` (Girls 1/2/3), `P1`, `P2`, `P3` (Boys 1/2/3), `Ryhmä A`, `Ryhmä B`.

#### Multi-Squad Detection Pipeline:
1. **Feed Scan on Import**: Inspect all `SUMMARY` and `DESCRIPTION` lines in the imported `.ics`.
2. **Squad Group Aggregation**: Extract squad tokens matching the known vocabulary.
3. **User Profile Splitter**: Present detected squads to user with event counts. Allow user to:
   - Create separate profiles for each squad (e.g. "Maija - HJK Sininen" and "Maija - HJK Valkoinen").
   - Filter to one specific squad for the current profile.

---

### 3.5 R2.5: Volunteer Duty (Talkoovahti) Precision Parser

```ts
export interface VolunteerDutyResult {
  dutyTag: string; // e.g. "☕ Kahviovuoro (klo 14:30 - 16:00)"
  role: 'kahvio' | 'toimitsija' | 'kello_kirjuri' | 'jarjestysmies' | 'kioski' | 'kyyti' | 'makkara' | 'striimaus' | 'ensiapu';
  timeWindow?: string; // e.g. "14:30 - 16:00"
}

export function extractVolunteerDuty(summary: string, description: string): VolunteerDutyResult | undefined {
  const text = `${summary} ${description}`;
  const textLower = text.toLowerCase();

  // Time window regex: "klo 14:30 - 16:00", "11:00-13:30", "12.00 - 14.30"
  const timeMatch = text.match(/(?:klo\s*)?(\d{1,2}[:.]\d{2})\s*(?:-|–|—|kuni)\s*(\d{1,2}[:.]\d{2})/i);
  const timeWindow = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : undefined;
  const timeSuffix = timeWindow ? ` (${timeWindow})` : '';

  if (textLower.includes('kahviovuoro') || textLower.includes('kahvio')) {
    return { dutyTag: `☕ Kahviovuoro${timeSuffix}`, role: 'kahvio', timeWindow };
  }
  if (textLower.includes('kioski') || textLower.includes('kioskivuoro')) {
    return { dutyTag: `🍿 Kioskivuoro${timeSuffix}`, role: 'kioski', timeWindow };
  }
  if (textLower.includes('toimitsijavuoro') || textLower.includes('toimitsija')) {
    return { dutyTag: `⏱️ Toimitsijavuoro${timeSuffix}`, role: 'toimitsija', timeWindow };
  }
  if (textLower.includes('kirjuri') || textLower.includes('kello')) {
    return { dutyTag: `📝 Kirjuri/Kello${timeSuffix}`, role: 'kello_kirjuri', timeWindow };
  }
  if (textLower.includes('järkkäri') || textLower.includes('järjestyksenvalvoja') || textLower.includes('liivimies') || textLower.includes('liivit')) {
    return { dutyTag: `🦺 Järjestyksenvalvoja / Liivit${timeSuffix}`, role: 'jarjestysmies', timeWindow };
  }
  if (textLower.includes('makkaranpaisto') || textLower.includes('grillivuoro')) {
    return { dutyTag: `🌭 Grillivuoro / Makkara${timeSuffix}`, role: 'makkara', timeWindow };
  }
  if (textLower.includes('kyyti') || textLower.includes('kuljetus') || textLower.includes('peliauto')) {
    return { dutyTag: `🚗 Kyytivastuu / Peliauto${timeSuffix}`, role: 'kyyti', timeWindow };
  }
  if (textLower.includes('striimaus') || textLower.includes('kuvaaja') || textLower.includes('livestriimi')) {
    return { dutyTag: `🎥 Livestriimaus${timeSuffix}`, role: 'striimaus', timeWindow };
  }
  if (textLower.includes('ensiapu') || textLower.includes('ea-vastaava')) {
    return { dutyTag: `🩹 Ensiapuvastaava${timeSuffix}`, role: 'ensiapu', timeWindow };
  }

  return undefined;
}
```

---

### 3.6 R2.6: National Pitch Nickname Dictionary (100+ Venues Across Finland)

The expanded `NATIONAL_FIELD_ALIASES` will contain 100+ key pitches across Finland:

1. **Helsinki (30+)**: Bubu (Puotila TN), Väiski (Väinämöinen), Sahara (Töölö), Bollis 1/2/6, Braku (Brahenkenttä), Käpylä TN 1/2, KäPa Kupla, Kisis (Töölön Kisahalli), Mosahalli, Talin jalkapallohalli, Pirkkolan urheilupuisto / jäähalli, Myllypuron pallomylly, Kontulan tekonurmi, Oulunkylän urheilupuisto (Mustapekka Areena / Oglu / Finski), Jätkäsaaren kupla, Hernesaaren kupla, Heteniitty (Heta / Vuosaari), Siltamäen urheilupuisto, Pukinmäen urheilupuisto, Malmin kupla, Velodromi, Ruskeasuon Arena Center, Liikuntamylly, Urhea-halli, Töölön Kisahalli A-puoli / B-puoli, Haagan tekonurmi, Lauttasaaren tekonurmi (Pukinparta), Paloheinän tekonurmi.
2. **Espoo & Kauniainen (18+)**: Matinkylän TN 1/2 (Mata), Tapiolan Urheilupuisto TN 1/2/3, Honkahalli, Esport Arena / Center, Leppävaaran stadion / TN, Kameleonten, Keski-Espoon TN 1/2 (EBK), Otaniemen kenttä (Otaranta), Kauklahti TN, Laaksolahden jalkapallohalli (Kupla), Kauniaisten keskuskenttä (Grani), Tuulimäen väestönsuoja, Ratiopharm Areena.
3. **Vantaa (15+)**: Myyrmäen Jalkapallostadion, Energia Areena, Myyrmäkihalli, Trio Areena (Tikkurila), Tikkurilan UP TN, Hakunilan urheilupuisto, Kartanon kenttä, Havukosken tekonurmi, Hiekkaharjun urheilupuisto, Peakfin Arena, Kalamuoto / Rajatorppa, Länsimäen kenttä, Korson kenttä, Arena Center Myyrmäki.
4. **Tampere & Pirkanmaa (12+)**: Kaupin Urheilupuisto TN 1–8, Pyynikin urheilukenttä, Tammelan Stadion, Hervannan tekonurmi, Raholan liikuntakeskus, Kaukajärven vapaa-aikatalo, Tesoman palloiluhalli, Varalan urheiluopisto, Tampereen Messu- ja Urheilukeskus (Pirkkahalli), Ahvenisjärven tekonurmi, Ikurin liikuntahalli.
5. **Turku & Varsinais-Suomi (10+)**: Kupittaan Tekonurmet 1–8, Kupittaan Palloiluhalli, Veritas Stadion, Urheilupuiston Yläkenttä, Parkin kenttä, Impivaaran jalkapallohalli / jäähalli, Javenture-Areena, Nunnavuoren palloiluhalli, Raunistulan kenttä.
6. **Oulu (6+)**: Heinäpään palloiluhalli / TN 1-2, Castrenin kenttä, Raatin stadion, Ouluhalli, Garam Masala Areena, Zemppi Areena (Kempele).
7. **Jyväskylä (6+)**: Vehkalammen tekonurmi 1/2, Harjun stadion, Viitaniemen kenttä, Hipposhalli, Killerin palloiluhalli, Huhtasuon kenttä.
8. **Lahti (5+)**: Kisapuiston tekonurmi, Mukkulan kupla / tekonurmi, Lahden Stadion, Suurhalli, Paavolan kenttä.
9. **Kuopio (4+)**: Väre Areena (Keskuskenttä), Lippumäen ylipainehalli, Kuopio-halli, Mölymäki.
10. **Vaasa & Pohjanmaa (4+)**: Elisa Stadion (Hietalahti), Fennia Arena, Botniahalli (Mustasaari), Kaarlen kenttä.
11. **Seinäjoki (3+)**: OmaSp Stadion, Wallsport Areena, Jouppilanvuoren tekonurmi.
12. **Rovaniemi (3+)**: Rovaniemen Keskuskenttä (Keskari), Saarenkylän kenttä, Ounashalli.
13. **Pori (4+)**: Porin Stadion, Karhuhalli, Herralahden kenttä, Musan tekonurmi.
14. **Kouvola (3+)**: Saviniemen jalkapallostadion, Sami Hyypiä Areena (Kuusankoski), Lehtomäen tekonurmi.
15. **Muut maakuntakeskukset (10+)**: Mehtimäki & Joensuu Areena, Kimpinen & Visma Areena (Lappeenranta), Kauriala & Säästöpankki Areena (Hämeenlinna), Arto Tolsa Areena & Ruonalan halli (Kotka), Kokonniemi & Uusimaa Areena (Porvoo), Kokkolan Keskuskenttä & Kippari Halli, Mikkelin Urheilupuisto & Hänski.

---

### 3.7 R4: Configurable Match & Training Arrival Rules Model

#### Extended `PlayerProfile` in `types/matchday.ts`:
```ts
export interface ArrivalRules {
  warmupOffsetHomeMinutes: number;      // default: 45
  warmupOffsetAwayMinutes: number;      // default: 60
  warmupOffsetTrainingMinutes: number;  // default: 15
  warmupOffsetTournamentMinutes: number;// default: 30
  volunteerDutyArrivalBufferMinutes: number; // default: 15
  defaultDrivingEstimateMinutes: number;// default: 20
  defaultDepartureBufferMinutes: number;// default: 10
  squadFilter?: string[];               // e.g. ['Sininen']
}

export interface PlayerProfile {
  id: string;
  playerName: string;
  teamName: string;
  sport: SportType;
  primaryColor: string;
  secondaryColor?: string;
  calendarUrl: string;
  colorHex: string;
  arrivalRules?: ArrivalRules;
}
```

---

## 4. Caveats

1. **ICS Input Quality & Private URL Access**: Feed URLs from private Nimenhuuto/MyClub require the existing Cloudflare Worker CORS proxy (`/api/proxy/ics`) to stream text content without browser CORS blocking.
2. **LIPAS API Availability**: `resolveSportsVenue` falls back gracefully to `NATIONAL_FIELD_ALIASES` and standard coordinates when LIPAS API is offline or when running in a Node.js/Vitest environment without global network access.
3. **Scope Boundary**: Official Torneopal league scraper (R1) and Visual Mismatch UI (R3) are covered by peer survey agents (`survey_explorer_1` / `survey_spec_miner_3`), but R2 and R4 define the clean interfaces and data contracts needed for their integration.

---

## 5. Conclusion

- The current codebase contains solid foundations (pure local-first Dexie.js architecture, fast Vitest suite, LIPAS + initial 27-venue alias geocoder, and baseline ICS parser).
- **Required enhancements for R2**:
  1. Replace basic title stripping in `src/lib/calendar/icsParser.ts` with `parseMatchTitle` supporting 8+ Finnish/Swedish/English title patterns.
  2. Implement full `classifyCalendarEvent` distinguishing matches, training, tournaments, and meetings.
  3. Disentangle dual-timestamp feeds (warmup vs kickoff) and normalize EET/EEST daylight savings time.
  4. Expand `NATIONAL_FIELD_ALIASES` in `src/lib/geo/sportsGeocoder.ts` from 27 to 100+ national sports venues.
  5. Upgrade `Talkoovahti` volunteer duty parsing to extract exact duty time windows and cover all 9 duty roles.
  6. Introduce multi-squad detection and splitting logic during feed ingestion.
- **Required enhancements for R4**:
  1. Extend `PlayerProfile` with `ArrivalRules` (per-team warmup offsets for home/away/training, departure buffers, squad filters).
  2. Connect `generateMatchdayBriefing` to profile-specific arrival rules.
  3. Add Arrival Rule settings controls to `CalendarImportModal` and profile settings.

---

## 6. Verification Method

To verify these findings and future implementations:
1. **Automated Unit Tests**:
   ```pwsh
   npm test
   ```
   Execute Vitest suite (`icsParser.test.ts`, `sportsGeocoder.test.ts`, `deterministicReasoner.test.ts`).
2. **TypeScript Strict Type Check**:
   ```pwsh
   npx tsc --noEmit
   ```
   Must pass with 0 type errors.
3. **Specific Validation Test Cases to Add**:
   - Title permutation test matrix (Swedish `Seriematch`, `HJK-EPS peli`, `@ Bubu`, bracketed rounds).
   - Dual-timestamp test case: Nimenhuuto event starting at 14:15 with description "Peli alkaa 15:00" correctly sets `kickoffTime = 15:00` and `warmupTime = 14:15`.
   - 100+ venue geocoding test assertions across all Finnish regions.
   - Volunteer duty time window extraction test.
   - Multi-squad splitting test with mixed squad ICS feed.
