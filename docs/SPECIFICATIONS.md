# 📋 PELIPÄIVÄ (MATCHDAY HUB) — VAATIMUSMÄÄRITTELY & TEKNINEN SPESIFIKAATIO
**Versio:** 2.0.0  
**Status:** Tuotantovalmis spesifikaatio (Ground Zero Implementation Blueprint)  
**Arkkitehtuurimalli:** Local-First, Zero-Auth, Edge-Proxied Progressive Web App (PWA)

---

## 1. Järjestelmän Yleiskuva ja Tavoite

### 1.1 Visio
Pelipäivä on suomalaisen juniori- ja amatööriurheilun keskitetty **ottelupäivän komentokeskus**, joka kokoaa yhteen seurojen ja joukkueiden omat kalenterit (**Nimenhuuto, MyClub, Jopox**) sekä urheiluliittojen viralliset sarjajärjestelmät (**Palloliitto, Salibandyliitto, Basket.fi, Torneopal / Lentopalloliitto**).

Sovellus poistaa perheiden ja pelaajien ottelupäivän kitkan: se erottaa ottelut treeneistä, korjaa aikataulu- ja kenttävääristymät, paikantaa kenttäslaagin lempinimet, arvioi pysäköinnin vaikeusasteen, ennustaa kenttäolosuhteet ja suosittelee nappulakengät.

### 1.2 Ydinarvot ja Reunaehdot
1. **Local-First & Zero-Auth:** Ei käyttäjätilejä, salasanoja tai keskitettyjä käyttäjätietokantoja. Kaikki tiedot tallennetaan selaimen IndexedDB-kantaan (Dexie.js).
2. **Deterministic & Conservative:** Ottelutietoja ei koskaan yhdistetä arvaten. Vain korkean luottamustason ($\ge 0.85$) ottelut liitetään automaattisesti; epävarmat näytetään erillisinä.
3. **Reunaprosessointi (CORS Proxy):** Ulkoiset `.ics`-syötteet ja liittosivut haetaan kevyen Cloudflare Worker -reunaprosessin kautta CORS-rajoitusten ohittamiseksi.

---

## 2. Tietomalli ja Paikallistallennus (Dexie.js Schema v2)

Järjestelmä käyttää IndexedDB-tietokantaa (`PelipaivaDB`) versiossa 2.

```typescript
// Dexie v2 Stores
const dbSchema = {
  profiles: 'id, teamName, sport, isFavorite',
  events: 'id, profileId, sport, startTime, eventType, isTraining, officialFixtureId, reconciliationStatus, [profileId+startTime]',
  officialFixtures: 'id, teamId, association, sport, startTime, status, [association+teamId]',
  arrivalRules: 'profileId, sport, defaultWarmupMinutesHome, defaultWarmupMinutesAway, defaultTrainingWarmupMinutes',
  leagueStandings: 'id, association, teamId, leagueName, rank',
  teamRosters: 'id, teamId, association, sport',
  venuePins: 'normalizedQuery, venueName',
  syncState: 'key, syncKey'
};
```

### 2.1 Keskeiset Rajapintatyypit (`types/matchday.ts`)
* `SportType`: `'football' | 'floorball' | 'basketball' | 'volleyball' | 'icehockey' | 'futsal' | 'other'`
* `EventType`: `'match' | 'training' | 'meeting' | 'other'`
* `ReconciliationStatus`: `'unlinked' | 'auto_matched' | 'candidate_match' | 'manual_matched'`
* `MatchdayEvent`: Sisältää kalenteritapahtuman, alkulämpöajan, arvioidun sään, pysäköintianalyysin, varustesuosituksen ja mahdolliset liittoristiriidat.
* `OfficialLeagueFixture`: Virallisen liigan ottelu, vastustaja, sarjanimi, eräpisteet ja virallinen kenttä.

---

## 3. Tietolähteet ja Ingestio-spesifikaatiot

Järjestelmän tulee tukea kahdentyyppistä syötedataa:

### 3.1 Urheiluliittojen Joukkuesivujen URL-jäsentimet
Järjestelmän on automaattisesti tunnistettava syötetystä URL-osoitteesta liitto, laji ja joukkueen tunniste (`teamId`):

| Liitto / Palvelu | Tuettu URL-formaatti | Tunnistettu laji |
| :--- | :--- | :--- |
| **Palloliitto** | `tulospalvelu.palloliitto.fi/team/{teamId}` | `football` |
| **Salibandyliitto** | `tulospalvelu.salibandy.fi/team/{teamId}` | `floorball` |
| **Basket.fi** | `basket.fi/basket/sarjat/joukkue/?team_id={teamId}` | `basketball` |
| **Torneopal (Lentopallo ym.)** | `*.torneopal.fi/taso/joukkue.php?joukkue={teamId}` | `volleyball` |

#### HTML-taulukon Tokenisointi (`associationExtractor.ts`):
* Puhdas merkkijonopohjainen taulukkoparseri, joka erottaa `<tr>` ja `<td>` -solut riippumatta selaimen DOMParser-tuesta (toimii Node/Worker/selain-ympäristöissä).
* Erottaa sarakkeet: Päivämäärä, Kellonaika, Kotijoukkue, Tulos/Erätulokset, Vierasjoukkue ja Pelipaikka.
* Erottaa lentopallon eräpisteet (esim. `25-22, 23-25, 25-18`).

### 3.2 Joukkueiden iCal-kalenterisyötteet (`.ics`)
Järjestelmän on parsittava standardit `VCALENDAR` / `VEVENT` -syötteet:
* **Nimenhuuto.com:** `.ics`-tilausosoitteet
* **MyClub.fi:** iCal-kalenterilinkit
* **Jopox:** Synkronointiosoitteet
* **Aikavyöhyketurvallisuus:** Kaikki ajat muunnetaan Suomen normaali-/kesäaikaan (EET/EEST) UTC-muodossa.

---

## 4. Suomalaisen Amatööriurheilun Permutaatiosäännöt

### 4.1 Tapahtumatyypin Luokittelu (Ottelu vs. Harjoitus)
Järjestelmän tulee tunnistaa tapahtumat otsikon ja kuvauksen perusteella:
* **Harjoitukset (`isTraining: true`):** *Harjoitukset, Treenit, Fysiikka, Lajivuoro, Aamujää, Oheiset, Fyssa*.
  - Treenitapahtumista piilotetaan vastustaja ja tulospalkit; fokus on kokoontumisajassa (15 min) ja varusteissa.
* **Ottelut (`isTraining: false`, `eventType: 'match'`):** *vs, v., peli, ottelu, seriematch, match, friendly, turnaus*.

### 4.2 Kokoontumisaika vs. Kickoff-aika
* Kalenteritapahtumassa alkamisaika voi olla kokoontumisaika (esim. 14:15) tai ottelun alkamisaika (15:00).
* Jos kuvauksessa lukee *"Kokoontuminen klo 14:15"* ja tapahtuma alkaa 15:00, alkulämmöksi asetetaan 14:15 ja kickoffiksi 15:00.
* Jos kalenteritapahtuma alkaa 14:15 ja liiton ottelu alkaa 15:00, järjestelmä tunnistaa 45 minuutin alkulämpösiirtymän.

### 4.3 Monikieliset Väri- ja Tasotunnisteet
Joukkueiden nimistä erotetaan värit ja peliryhmät monikielisesti:
* **Värit:** `Sininen / Blå / Blue`, `Valkoinen / Vit / White`, `Musta / Svart / Black`, `Punainen / Röd / Red`, `Keltainen / Gul / Yellow`, `Vihreä / Grön / Green`.
* **Tasot ja ikäluokat:** `T13, P11, U14, Kilpa, Haaste, Harraste, Akatemia, Edustus, 1, 2`.

### 4.4 Talkoovahti (Vanhempainvuorot)
Tekstianalyysi etsii vanhempien vuoromerkinnät kalenterin tekstistä:
* ☕ **Kahviovuoro:** *kahvio, kanttiini, kioski, kahvilavuoro, buffet*
* ⏱️ **Toimitsijavuoro:** *kirjuri, kello, toimitsija, tulostaulu, pöytäkirja*
* 🦺 **Järjestysmies:** *järkkäri, järjestyksenvalvoja, liivimies*

### 4.5 Kenttäslaagi ja 100+ Lempinimeä (`sportsGeocoder.ts`)
Yhdistää puhekieliset nimitykset virallisiin LIPAS.fi-paikkatietoihin:
* *Bubu* $\to$ Töölön Pallokenttä 6 TN
* *Väiski* $\to$ Väinämöisenkenttä
* *Sahara* $\to$ Töölön Pallokenttä 1 TN
* *Bollis* $\to$ Töölön Pallokenttä
* *Kupla* $\to$ Tali / Matinkylä / Tapiola jalkapallohalli
* *Kisis* $\to$ Töölön Kisahalli
* *Mosahalli, Kauppi, Kupittaa, Puotila TN, Leppävaara 1 TN...*

---

## 5. Konservatiivinen Heuristinen Yhdistäjä & Ristiriitamoottori

### 5.1 Liittämisalgoritmi (`reconciliationEngine.ts`)
Ottelut yhdistetään kalenterin ja liigan välillä seuraavin säännöin:
1. **Päivämäärätarkistus:** Tapahtuman ja virallisen ottelun on oltava samana **Helsinki-local** kalenteripäivänä (UTC-avaimet ohittivät klo 00.00–02.59 tapahtumat; korjattu `reconciliationEngine.ts`).
2. **Aikaikkuna:** Kalenterin ja ottelun aikaero saa olla enintään $\pm 180\text{ min}$ (3 tuntia).
3. **Vastustajan Samankaltaisuus (Dice-Sørensen bigram-kerroin & Oppimisaliakset):**
   - Verrataan kalenterin vastustajatokeneita liigan vastustajatietoon hyödyntäen seuranimien alias-sanakirjaa (`HJK`, `KäPa`, `GrIFK`, `ErVi`, `TiPS`, `VJS`, `Honka`, `Ilves`, `TPS`, `EPS`, `PPJ`, `PK-35`, `ÅIFK` jne.) sekä laitteen oppimia `customAliases`-merkintöjä.
   - Jos vastustajan samankaltaisuus on $< 0.40$, ottelua **ei yhdistetä** (`unlinked`).
4. **Luottamuspisteytys ($S$):**
   $$S = 0.7 \times \text{OpponentSimilarity} + 0.3 \times \max\left(0, 1 - \frac{\Delta t_{\text{min}}}{180}\right)$$
5. **Tilaluokitus:**
   - $S \ge 0.85$ ja ei tasatilannetta $\to$ `auto_matched`
   - $0.60 \le S < 0.85 \to$ `candidate_match`
   - $S < 0.60 \to$ `unlinked`

### 5.2 Paikallinen Oppimismuisti (`customAliases`)
Kun käyttäjä manuaalisesti vahvistaa ehdokasottelun tai ratkaisee ristiriidan, luotu joukkuealiaspari tallennetaan paikalliseen `customAliases`-tauluun. Tulevissa kalenterilatauksissa sama epävirallinen lempinimi tunnistetaan automaattisesti 1.0 luottamustasolla.

### 5.3 Ristiriitatunnistus (Mismatch Diagnostics)
Jos ottelu on yhdistetty, tarkistetaan:
* **Aikatauluero:** $|\text{kalenteriaika} - \text{virallinen aloitusaika}| > 5\text{ min}$.
* **Kenttäero:** Kalenterin kenttä poikkeaa virallisesta kentästä.

### 5.4 1-Napin Ristiriidan Ratkaisu (Resolution Actions)
* **`use_official` (Päivitä liiton tietoon):** Korvaa kalenteriajan virallisella otteluajalla, laskee alkulämmön automaattisesti (-45 min) ja asettaa virallisen kentän.
* **`keep_calendar` (Säilytä oma merkintä):** Säilyttää omat ajat ja kuittaa varoituksen.
* **`unlink` (Pura linkitys):** Irrottaa ottelut toisistaan.

---

## 6. Apumoottorit (Micro-Engines)

### 6.1 Parkkis — Pysäköintianalyysi
* Laskee pysäköinnin vaikeuden (`🟢 Helppo`, `🟡 Kohtalainen`, `🔴 Haastava`) kentän tyypin, otteluajankohdan ja turnausruuhkan mukaan.
* Arvioi kävelyetäisyyden ja -ajan parkkipaikalta kentälle (esim. `🚶 3 min`).
* Näyttää pysäköintiohjeet ja aikarajoitukset (esim. *"Kiekkopaikka 2h"*, *"Ilmainen halliparkki"*).
* 1-napin suora avaus Google Mapsiin / Apple Mapsiin.

### 6.2 Nappisvahti & Täsmäsää (FMI)
* Hakee Ilmatieteen laitoksen (FMI) avoimesta rajapinnasta sääennusteen kentän GPS-koordinaateille.
* **Kenkäsuositus (Footwear Reasoner):**
  - Luonnonnurmi, kuiva $\to$ FG (Firm Ground)
  - Luonnonnurmi, märkä $\to$ SG (Soft Ground / Alunapit)
  - Tekonurmi $\to$ AG (Artificial Grass)
  - Pakkanen / Liukas tekonurmi $\to$ TT (Turf)
  - Sisähalli / Parketti $\to$ IN (Indoor sisäpelikengät)
* **Salamaturvallisuus (30/30-sääntö):** Jos salamanisku havaitaan $< 10\text{ km}$ säteellä, antaa välittömän turvallisuusvaroituksen ja 30 minuutin laskurin.

### 6.3 Monilajitilastokeskus (Match Stats Hub)
Ottelukortista avautuva 5-välilehtinen tilastoikkuna:
1. **Otteluvertailu:** Pallonhallinta %, maalintekoyritykset, laukaukset kohti maalia, kulmapotkut, rikkeet, varoitukset. Lentopallossa eräpisteet.
2. **Sarjataulukko:** Koko sarjan tilanne (O, V, T, H, TM, PM, ME, P). Rivin klikkaus avaa suoraan kyseisen joukkueen pelaajalistan.
3. **Maalipörssi (Top Scorers):** Sarjan parhaat maalintekijät.
4. **Yhteiset vastustajat & H2H:** Molempien joukkueiden keskinäiset ottelut sekä ottelut samoja vastustajia vastaan V/T/H-koodein.
5. **Pelaajat & Maalit:** Joukkueiden kokoonpanot pelipaikkoineen (`GK`, `DF`, `MF`, `FW`), kapteenin nauhat, pelinumerot ja maalit.

---

## 7. Käyttöliittymä ja Nova Design Protocol

1. **Dual Theme (Daylight / Floodlight OLED):**
   - Päiväteema: Selkeä ulkoilmateema korkealla kontrastilla auringonpaisteeseen.
   - Iltateema (Floodlight OLED): Syvä musta (#06080c) tekonurmen vihreillä korostuksilla (#10b981).
2. **Fluid Typography (`clamp()`):**
   - Tekstikoot skaalautuvat sulavasti ilman manuaalisia katkopisteitä (`--nv-text-base: clamp(1rem, 0.93rem + 0.33vw, 1.2rem)`).
3. **Ambient Mode (Kokoontumistila):**
   - Erillinen häiriötön suurinäyttötila pukukopin seinälle tai eteisen tabletille.
4. **Suosikkijoukkueiden Hallinta (Multi-Profile Pills):**
   - Yläpalkin pillerit mahdollistavat suodattamisen yhden lapsen/joukkueen peleihin tai "Kaikki pelit" -yhteisnäkymään.

---

## 8. Laadunvarmistus ja Testauskriteerit

Spesifikaation mukaisen toteutuksen tulee läpäistä 100 % seuraavista testeistä:
* **Tier 1 (Feature Tests f01–f19):** Kaikki 19 ominaisuustestiä liittourleista, talkoovahdista, kielitunnisteista ja ristiriitojen korjauksesta.
* **Tier 2 (Boundary Tests):** 500+ tapahtuman kalenterisyötteiden suorituskyky (< 100 ms), rajatapaukset ja kellonaikatoleranssit.
* **Tier 5 (Adversarial Tests):** Rinnakkaiset IndexedDB-transaktiot, skeeman migraatio V1 $\to$ V2 (500 tietuetta) ja monilajipelipaikat.
* **TypeScript Strict:** 0 virhettä `tsc -b` -käännöksessä.
* **Tuotantotarkastus:** Vahvistettu toimivuus Cloudflare Pages -ympäristössä (`HTTP 200 OK`).

---
*Dokumentin omistaja: Traali / Pelipäivä Team*
