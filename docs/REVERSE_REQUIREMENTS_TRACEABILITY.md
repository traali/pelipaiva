# 🔍 KÄÄNTEINEN VAATIMUSMÄÄRITTELY & KOODIJÄLJITYS (REVERSE TRACEABILITY MATRIX)
**Projekti:** Pelipäivä (Matchday Hub)  
**Status:** Tuotantokoodista johdettu täydellinen vaatimusmatriisi  
**Periaate:** Jokainen vaatimus on suoraan jäljitettävissä lähdekooditiedostoihin, funktioihin, tietomalleihin ja automatisoituihin testeihin.

---

## 1. Vaatimusmatriisi (Requirements ➔ Code ➔ Tests)

| Vaatimus-ID | Vaatimuksen kuvaus | Lähdekooditiedosto & Pääfunktiot | Tietorakenteet & Tyypit | Automatisoitu Testitiedosto |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Liittojen URL-tunnistus**<br>(Palloliitto, Salibandyliitto, Basket.fi, Torneopal) | [`src/lib/api/associationUrlParser.ts`](file:///c:/dev2/pelipaiva/src/lib/api/associationUrlParser.ts)<br>• `parseAssociationUrl()`<br>• `getAssociationName()` | `ParsedAssociationUrl`<br>`SportsAssociationType` | `f01_palloliitto_url.test.ts`<br>`f02_salibandy_url.test.ts`<br>`f03_basket_url.test.ts`<br>`f04_torneopal_url.test.ts` |
| **REQ-02** | **Liittodatan & HTML-taulukoiden Ingestio**<br>(Sarjaottelut, Sarjataulukot, Rosterit, Eräpisteet) | [`src/lib/api/associationExtractor.ts`](file:///c:/dev2/pelipaiva/src/lib/api/associationExtractor.ts)<br>• `extractFixturesFromHtml()`<br>• `extractLeagueStandingsFromHtml()`<br>• `extractTeamRosterFromHtml()`<br>• `fetchOfficialTeamData()` | `OfficialLeagueFixture`<br>`LeagueStandingRow`<br>`TeamSquad`<br>`RosterPlayer` | `f05_official_fixtures_ingestion.test.ts`<br>`boundary_urls_and_api.test.ts`<br>`m1_adversarial_parser_extractor.test.ts` |
| **REQ-03** | **iCal-kalenterin jäsentäminen & Permutaatiot**<br>(Nimenhuuto, MyClub, Jopox, DST-siirtymät) | [`src/lib/calendar/icsParser.ts`](file:///c:/dev2/pelipaiva/src/lib/calendar/icsParser.ts)<br>• `parseICSFeed()`<br>• `parseMatchTitle()`<br>• `resolveEventTimes()` | `MatchdayEvent`<br>`ParsedTitleResult` | `f07_title_permutations.test.ts`<br>`f09_dual_timestamp_dst.test.ts`<br>`boundary_calendar_permutations.test.ts` |
| **REQ-04** | **Tapahtumatyyppien Luokittelu**<br>(Ottelut vs. Harjoitukset / Treenit) | [`src/lib/calendar/icsParser.ts`](file:///c:/dev2/pelipaiva/src/lib/calendar/icsParser.ts)<br>• `isTrainingEvent()`<br>• `parseMatchTitle()` | `EventType`<br>`isTraining: boolean` | `f08_event_type_classification.test.ts` |
| **REQ-05** | **Monijoukkueryhmien erottelu**<br>(Sininen, Valkoinen, Musta, T1, T2, Kilpa/Haaste) | [`src/lib/calendar/icsParser.ts`](file:///c:/dev2/pelipaiva/src/lib/calendar/icsParser.ts)<br>• `detectSquadFromTitle()` | `ParsedTitleResult.squad`<br>`ParsedTitleResult.color` | `f10_multi_squad_separation.test.ts` |
| **REQ-06** | **Talkoovahti (Vanhempainvuorot)**<br>(Kahvio, Kirjuri, Kello, Järkkäri) | [`src/lib/calendar/icsParser.ts`](file:///c:/dev2/pelipaiva/src/lib/calendar/icsParser.ts)<br>• `extractVolunteerDuty()` | `VolunteerDutyTag`<br>`dutyTag: string` | `f11_talkoovahti_duties.test.ts` |
| **REQ-07** | **Kenttäslaagi & LIPAS-geokoodaus**<br>(100+ lempinimeä: Bubu, Väiski, Sahara jne.) | [`src/lib/geo/sportsGeocoder.ts`](file:///c:/dev2/pelipaiva/src/lib/geo/sportsGeocoder.ts)<br>• `geocodeSportsVenue()`<br>• `FINNISH_PITCH_SLANG_ALIASES` | `VenueInfo`<br>`Coordinates` | `f12_pitch_nicknames.test.ts` |
| **REQ-08** | **Konservatiivinen Fuzzy Join & Luottamuslaskenta**<br>(Dice-Sørensen, $\pm 3\text{h}$ aikaikkuna, $\ge 0.85$ auto-match) | [`src/lib/reconciliation/reconciliationEngine.ts`](file:///c:/dev2/pelipaiva/src/lib/reconciliation/reconciliationEngine.ts)<br>• `reconcileCalendarWithOfficial()` | `ReconciliationStatus`<br>`ReconciliationResult` | `f14_fuzzy_reconciliation.test.ts`<br>`boundary_reconciliation_mismatches.test.ts` |
| **REQ-09** | **Joukkuenimien & Värien Normalisointi**<br>(Monikieliset värit, Seura-aliakset 30+ seuralle) | [`src/lib/reconciliation/teamNameMatcher.ts`](file:///c:/dev2/pelipaiva/src/lib/reconciliation/teamNameMatcher.ts)<br>• `normalizeTeamName()`<br>• `calculateTeamSimilarity()`<br>• `CLUB_ALIASES` | `NormalizedTeamName`<br>`NormalizedTeamResult` | `f15_multilingual_tokens.test.ts`<br>`boundary_reconciliation_mismatches.test.ts` |
| **REQ-10** | **Aikataulu- ja Kenttäerodiagnostiikka**<br>(Ennen/jälkeen -aikaleimat, kenttämuutokset) | [`src/lib/reconciliation/reconciliationEngine.ts`](file:///c:/dev2/pelipaiva/src/lib/reconciliation/reconciliationEngine.ts)<br>• `computeMismatchDiagnostics()` | `MismatchDiagnostics`<br>`mismatchFlags` | `f16_timestamp_diagnostics.test.ts`<br>`f17_venue_diagnostics.test.ts` |
| **REQ-11** | **1-Napin Ristiriidan Ratkaisu**<br>(`use_official`, `keep_calendar`, `unlink`) | [`src/lib/reconciliation/reconciliationEngine.ts`](file:///c:/dev2/pelipaiva/src/lib/reconciliation/reconciliationEngine.ts)<br>• `applyResolutionDecision()`<br>[`src/components/MatchdayCard.tsx`](file:///c:/dev2/pelipaiva/src/components/MatchdayCard.tsx) | `UserOverrideMetadata`<br>`ResolutionDecision` | `f18_conflict_resolution.test.ts` |
| **REQ-12** | **Kokoontumissäännöt & Lähtölaskurit**<br>(Koti/Vieras/Treeni alkulämpösiirtymät) | [`src/lib/storage/db.ts`](file:///c:/dev2/pelipaiva/src/lib/storage/db.ts)<br>• `arrivalRules` store<br>[`src/lib/calendar/icsParser.ts`](file:///c:/dev2/pelipaiva/src/lib/calendar/icsParser.ts)<br>• `resolveEventTimes()` | `ArrivalRule` | `f13_arrival_rules.test.ts`<br>`boundary_arrival_rules.test.ts` |
| **REQ-13** | **Parkkis — Pysäköintianalyysi**<br>(Pysäköinnin vaikeusaste, kävelyaika, kiekkosäännöt) | [`src/lib/stats/statsEngine.ts`](file:///c:/dev2/pelipaiva/src/lib/stats/statsEngine.ts)<br>• `calculateParkingEase()`<br>[`src/components/MatchdayCard.tsx`](file:///c:/dev2/pelipaiva/src/components/MatchdayCard.tsx) | `ParkingAnalysis`<br>`ParkingEaseStatus` | `f12_pitch_nicknames.test.ts` |
| **REQ-14** | **Nappisvahti & Täsmäsää**<br>(Kenkäsuositus FG/AG/SG/IN, FMI-sää, Salama 30/30) | [`src/lib/ai/deterministicReasoner.ts`](file:///c:/dev2/pelipaiva/src/lib/ai/deterministicReasoner.ts)<br>• `calculateNappisvahtiRecommendation()`<br>[`src/lib/weather/lightningSafety.ts`](file:///c:/dev2/pelipaiva/src/lib/weather/lightningSafety.ts)<br>• `evaluateLightningSafety()` | `NappisvahtiAdvice`<br>`LightningSafetyAlert` | `statsEngine.test.ts`<br>`icsParser.test.ts` |
| **REQ-15** | **Monilajitilastokeskus (Stats Hub)**<br>(Sarjataulukot, Maalipörssi, Yhteiset vastustajat V/T/H, Rosterit) | [`src/lib/stats/statsEngine.ts`](file:///c:/dev2/pelipaiva/src/lib/stats/statsEngine.ts)<br>• `generateOrResolveMatchStats()`<br>• `normalizePlayerPosition()`<br>[`src/components/MatchStatsModal.tsx`](file:///c:/dev2/pelipaiva/src/components/MatchStatsModal.tsx) | `PreMatchComparison`<br>`CommonOpponentRecord`<br>`TeamSquad`<br>`RosterPlayer` | `m1_adversarial_parser_extractor.test.ts` |
| **REQ-16** | **Local-First Paikallistallennus (Dexie v2)**<br>(Zero-Auth, Version 1 $\to$ Version 2 migraatio) | [`src/lib/storage/db.ts`](file:///c:/dev2/pelipaiva/src/lib/storage/db.ts)<br>• `PelipaivaDB`<br>• `db.version(2).upgrade()` | `PelipaivaDB`<br>`db` instanssi | `f06_dexie_schema_v2.test.ts`<br>`m1_storage_concurrency.test.ts` |
| **REQ-17** | **Suosikkijoukkueiden Hallinta & UI**<br>(Multi-Profile Pills, Ambient Mode, Nova Protocol) | [`src/components/MultiProfileHeader.tsx`](file:///c:/dev2/pelipaiva/src/components/MultiProfileHeader.tsx)<br>[`src/components/CalendarImportModal.tsx`](file:///c:/dev2/pelipaiva/src/components/CalendarImportModal.tsx)<br>[`src/components/AmbientView.tsx`](file:///c:/dev2/pelipaiva/src/components/AmbientView.tsx)<br>[`src/App.tsx`](file:///c:/dev2/pelipaiva/src/App.tsx) | `PlayerProfile` | `f19_onboarding_import_flow.test.ts` |

---

## 2. Koodimoduulien Arkkitehtuurijako

```
c:/dev2/pelipaiva/src/
├── lib/
│   ├── api/
│   │   ├── associationUrlParser.ts     # REQ-01: Palloliitto, Salibandy, Basket, Torneopal URL-parseri
│   │   └── associationExtractor.ts     # REQ-02: Pure-string HTML taulukkoparseri & otteluekstraktori
│   ├── calendar/
│   │   └── icsParser.ts                # REQ-03–06, 12: iCal-syötteet, treenitunnistus, talkoovahti, DST
│   ├── reconciliation/
│   │   ├── reconciliationEngine.ts     # REQ-08, 10, 11: Konservatiivinen fuzzy join & ristiriitadiagnostiikka
│   │   └── teamNameMatcher.ts          # REQ-09: Dice-Sørensen kerroin, monikieliset värit, seuranimien aliakset
│   ├── geo/
│   │   └── sportsGeocoder.ts           # REQ-07, 13: 100+ kenttäslaagin lempinimeä & LIPAS.fi koordinaatit
│   ├── stats/
│   │   └── statsEngine.ts              # REQ-13, 15: Parkkis-algoritmi, pelipaikat, sarjataulukot, Yhteiset vastustajat
│   ├── ai/
│   │   └── deterministicReasoner.ts    # REQ-14: Nappisvahti-kenkävalitsin kenttäpinnan mukaan
│   ├── weather/
│   │   ├── fmiWeather.ts               # REQ-14: Ilmatieteen laitoksen avoin säärajapinta
│   │   └── lightningSafety.ts          # REQ-14: Salamaturvallisuuden 30/30-sääntö
│   └── storage/
│       └── db.ts                       # REQ-16: Dexie.js v2 IndexedDB schema & migraatio
└── components/
    ├── MatchdayCard.tsx                # REQ-10, 11, 13, 14: Ottelukortti, ristiriitavaroitus, Parkkis, sää
    ├── MatchStatsModal.tsx             # REQ-15: 5-välilehtinen tilasto- ja rosterikeskus
    ├── CalendarImportModal.tsx         # REQ-01, 17: .ics- ja liittourl-tuontivalikko
    ├── MultiProfileHeader.tsx          # REQ-17: Suosikkijoukkueiden pillerisuodattimet
    ├── OnboardingWizard.tsx            # REQ-17: Ensikäyttäjän ohjattu käyttöönotto & demo
    └── AmbientView.tsx                 # REQ-17: Pukukoppi- ja eteistilan suurinäyttö
```

---

## 3. Testauskattavuuden Jäljitettävyys (100% Green / 321 Tests)

```
c:/dev2/pelipaiva/tests/
├── e2e/
│   ├── tier1_features/                 # 19 Feature-testiä (f01–f19)
│   │   ├── f01–f05                     # Liittojen URLit & virallisen otteludatan tallennus
│   │   ├── f06                         # Dexie v2 tietokantaskeema
│   │   ├── f07–f11                     # Kalenteripermutaatiot, treenitunnistus, talkoot
│   │   ├── f12–f13                     # Kenttäslaagi & alkulämpösäännöt
│   │   ├── f14–f18                     # Fuzzy match, kielitunnisteet, ristiriitadiagnostiikka & 1-napin korjaus
│   │   └── f19                         # Ensikäyttäjän tuontipolku
│   ├── tier2_boundary/                 # 4 Boundary-testiä
│   │   ├── boundary_arrival_rules.test.ts
│   │   ├── boundary_calendar_permutations.test.ts (500+ tapahtuman syötteen suorituskyky)
│   │   ├── boundary_reconciliation_mismatches.test.ts (±180 min toleranssit, eri vastustajat)
│   │   └── boundary_urls_and_api.test.ts
│   └── tier5_adversarial/              # 2 Stressitestiä
│       ├── m1_adversarial_parser_extractor.test.ts (Monilajipelipaikat & rikkinäiset HTML-taulukot)
│       └── m1_storage_concurrency.test.ts (V1 ➔ V2 migraatio 500 tietueella & transaktiolukot)
```
