import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseAssociationUrl,
  detectAssociationType,
  normalizeAssociationUrl,
  inferSportFromSubdomain
} from '../../../src/lib/api/associationUrlParser';
import {
  detectSportFromText,
  detectPlayerFromText
} from '../../../src/lib/ai/eventCandidateRanker';
import {
  parseICSFeed,
  classifyCalendarEvent
} from '../../../src/lib/calendar/icsParser';
import {
  resolveSportsVenue
} from '../../../src/lib/geo/sportsGeocoder';
import {
  determineFootwear,
  generateMatchdayBriefing,
  calculateDepartureCountdown
} from '../../../src/lib/ai/deterministicReasoner';
import {
  buildSportKitPlan
} from '../../../src/lib/agents/kitAgent';
import {
  searchPopularClubs,
  POPULAR_FINNISH_CLUBS
} from '../../../src/lib/clubs/popularClubsCatalog';
import {
  harmonizeStartupSports
} from '../../../src/lib/sport/startupHarmonizer';
import { PelipaivaDB } from '../../../src/lib/storage/db';
import { createTestDb } from '../../helpers/setupDexie';
import type {
  MatchdayEvent,
  PlayerProfile,
  SportType,
  PitchSurface,
  FootwearRecommendation
} from '../../../src/types/matchday';

type AnyFootwear = FootwearRecommendation | 'SKATES';

describe('Multi-Sport Total Integration & Physics Verification (Tiers 1-4)', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE ACROSS ALL 9 SPORTS
  // ==========================================================================
  describe('Tier 1 — Feature Coverage: Multi-Sport Ingestion & Contracts', () => {

    describe('1.1 Association URL Parsing & Canonical Generation', () => {
      it('should parse Palloliitto football team URLs with canonical generation', () => {
        const url = 'https://tulospalvelu.palloliitto.fi/team/12345/info';
        const parsed = parseAssociationUrl(url);

        expect(parsed).not.toBeNull();
        expect(parsed?.sport).toBe('football');
        expect(parsed?.association).toBe('palloliitto');
        expect(parsed?.teamId).toBe('12345');
        expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.palloliitto.fi/team/12345');
      });

      it('should parse Palloliitto futsal team URLs and Torneopal futsal URLs', () => {
        // Palloliitto futsal
        const splFutsal = 'https://tulospalvelu.palloliitto.fi/team/98765/info?category=futsal';
        const parsedSpl = parseAssociationUrl(splFutsal);

        expect(parsedSpl).not.toBeNull();
        expect(parsedSpl?.sport).toBe('futsal');
        expect(parsedSpl?.association).toBe('palloliitto');
        expect(parsedSpl?.teamId).toBe('98765');

        // Torneopal futsal
        const tpFutsal = 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3321';
        const parsedTp = parseAssociationUrl(tpFutsal);

        expect(parsedTp).not.toBeNull();
        expect(parsedTp?.sport).toBe('futsal');
        expect(parsedTp?.association).toBe('torneopal');
        expect(parsedTp?.teamId).toBe('3321');
        expect(parsedTp?.subdomain).toBe('futsal');
      });

      it('should parse Salibandyliitto and Torneopal floorball cup URLs', () => {
        const salibandyUrl = 'https://tulospalvelu.salibandy.fi/team/4412';
        const parsedSb = parseAssociationUrl(salibandyUrl);

        expect(parsedSb).not.toBeNull();
        expect(parsedSb?.sport).toBe('floorball');
        expect(parsedSb?.association).toBe('salibandy');
        expect(parsedSb?.teamId).toBe('4412');

        const tpSb = 'https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=5521';
        const parsedTpSb = parseAssociationUrl(tpSb);
        expect(parsedTpSb?.sport).toBe('floorball');
        expect(parsedTpSb?.teamId).toBe('5521');
      });

      it('should parse Basket.fi and Espoo Liikkuu basketball URLs', () => {
        const basketUrl = 'https://basket.fi/basket/sarjat/joukkue/?team_id=60112';
        const parsedBasket = parseAssociationUrl(basketUrl);

        expect(parsedBasket).not.toBeNull();
        expect(parsedBasket?.sport).toBe('basketball');
        expect(parsedBasket?.association).toBe('basket');
        expect(parsedBasket?.teamId).toBe('60112');

        const esliUrl = 'https://espooliikkuutournament.fi/team/7701';
        const parsedEsli = parseAssociationUrl(esliUrl);
        expect(parsedEsli?.sport).toBe('basketball');
        expect(parsedEsli?.teamId).toBe('7701');
      });

      it('should parse Lentopalloliitto and Torneopal volleyball URLs', () => {
        const volleyUrl = 'https://tulospalvelu.lentopallo.fi/team/2205';
        const parsedVolley = parseAssociationUrl(volleyUrl);

        expect(parsedVolley).not.toBeNull();
        expect(parsedVolley?.sport).toBe('volleyball');
        expect(parsedVolley?.teamId).toBe('2205');

        const tpVolley = 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=30200';
        const parsedTpVolley = parseAssociationUrl(tpVolley);
        expect(parsedTpVolley?.sport).toBe('volleyball');
        expect(parsedTpVolley?.teamId).toBe('30200');
      });

      it('should parse Torneopal ice hockey subdomains (hockey, jaakiekko, kiekko)', () => {
        const hockeySubdomains = ['hockey', 'jaakiekko', 'kiekko'];
        for (const sub of hockeySubdomains) {
          const url = `https://${sub}.torneopal.fi/taso/joukkue.php?joukkue=990${sub.length}`;
          const parsed = parseAssociationUrl(url);
          expect(parsed).not.toBeNull();
          expect(parsed?.sport).toBe('icehockey');
          expect(parsed?.association).toBe('torneopal');
          expect(parsed?.subdomain).toBe(sub);
        }
      });
    });

    describe('1.2 Calendar Ingestion & Compound-Aware NLP Sport Detection', () => {
      it('should detect all 9 sports from Finnish keywords including compound nouns', () => {
        const testCases: Array<{ text: string; expectedSport: SportType }> = [
          { text: 'Lauantain futismatsi Bollis 1', expectedSport: 'football' },
          { text: 'Illan futistreenit tekonurmella', expectedSport: 'football' },
          { text: 'Lauantain säbäturnaus Mosahallissa', expectedSport: 'floorball' },
          { text: 'Tiistain säbätreenit koululla', expectedSport: 'floorball' },
          { text: 'Korisottelu Kisahallissa ToPo vs HNMKY', expectedSport: 'basketball' },
          { text: 'Aamun koristreenit Namika Areenalla', expectedSport: 'basketball' },
          { text: 'Lentopalloerät ja lentistreenit', expectedSport: 'volleyball' },
          { text: 'Lauantaiaamun lätkätreenit Matinkylässä', expectedSport: 'icehockey' },
          { text: 'Kiekkomatsi ja jääkiekkoturnaus', expectedSport: 'icehockey' },
          { text: 'Torstain futsaltreenit salissa', expectedSport: 'futsal' },
          { text: 'Fysiikkatreenit ja kuntosali', expectedSport: 'training' },
          { text: 'Punttisali ja oheisharjoitus', expectedSport: 'training' },
          { text: 'Matematiikan koe ja Wilma-merkintä', expectedSport: 'school' },
          { text: 'Koulupäivä ja läksyt', expectedSport: 'school' },
          { text: 'Hammaslääkärikäynti ja partioretki', expectedSport: 'other' }
        ];

        for (const tc of testCases) {
          const detected = detectSportFromText(tc.text);
          expect(
            detected,
            `Expected text "${tc.text}" to detect sport "${tc.expectedSport}", got "${detected}"`
          ).toBe(tc.expectedSport);
        }
      });

      it('should classify school calendar events properly in classifyCalendarEvent', () => {
        expect(classifyCalendarEvent('Matematiikan koe', 'Luokka 5B')).toBe('school');
        expect(classifyCalendarEvent('Wilma: Koulukuvasto', 'Opettaja')).toBe('school');
        expect(classifyCalendarEvent('Oppitunti', 'Fysiikka')).toBe('school');
        expect(classifyCalendarEvent('Lätkätreenit', 'Aamujää')).toBe('training');
        expect(classifyCalendarEvent('Futisottelu HJK vs Honka', 'Bollis')).toBe('match');
      });

      it('should parse an ICS calendar with multi-sport events and retain accurate sports', async () => {
        const rawIcs = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Pelipaiva MultiSport//FI',
          'X-WR-CALNAME:Perheen Urheilukalenteri',
          'BEGIN:VEVENT',
          'UID:ev-hockey-1',
          'SUMMARY:Lätkätreenit U12',
          'LOCATION:Matinkylän jäähalli',
          'DTSTART:20261114T080000Z',
          'DTEND:20261114T093000Z',
          'DESCRIPTION:Muista luistimet ja kaulasuoja',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:ev-futsal-2',
          'SUMMARY:Futsaltreenit',
          'LOCATION:Opinmäen liikuntahalli',
          'DTSTART:20261114T120000Z',
          'DTEND:20261114T133000Z',
          'DESCRIPTION:Sisäpelikengät',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:ev-school-3',
          'SUMMARY:Koulun joulukonsertti',
          'LOCATION:Tapiolan koulu',
          'DTSTART:20261114T160000Z',
          'DTEND:20261114T173000Z',
          'DESCRIPTION:Wilma-tiedote',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');

        const events = await parseICSFeed(rawIcs, 'prof-multi-1', 'football');
        expect(events.length).toBe(3);

        const hockeyEv = events.find((e) => e.id.includes('hockey') || e.title.includes('Lätkä'));
        expect(hockeyEv).toBeDefined();
        expect(hockeyEv?.sport).toBe('icehockey');

        const futsalEv = events.find((e) => e.id.includes('futsal') || e.title.includes('Futsal'));
        expect(futsalEv).toBeDefined();
        expect(futsalEv?.sport).toBe('futsal');

        const schoolEv = events.find((e) => e.id.includes('school') || e.title.includes('koulu'));
        expect(schoolEv).toBeDefined();
        expect(schoolEv?.sport).toBe('school');
      });
    });

    describe('1.3 Venue Geocoding & Surface Physics', () => {
      it('should resolve iconic ice halls to isIndoor: true and surface: "ice"', async () => {
        const iceVenues = [
          'Matinkylän jäähalli',
          'Pirkkolan jäähalli',
          'Hernesaaren jäähalli',
          'Nordis jäähalli',
          'Tikkurilan jäähalli',
          'Kaukalo 2'
        ];

        for (const venueName of iceVenues) {
          const resolved = await resolveSportsVenue(venueName);
          expect(resolved.isIndoor, `Venue "${venueName}" should be indoor`).toBe(true);
          expect(
            resolved.surface,
            `Venue "${venueName}" should have surface "ice", got "${resolved.surface}"`
          ).toBe('ice');
        }
      });

      it('should resolve school gyms to indoor_parquet', async () => {
        const gyms = [
          'Lauttasaaren yhteiskoulu (LYK)',
          'Munkkiniemen yhteiskoulu (MYK)',
          'Töölön kisahalli (Kisis)'
        ];

        for (const gym of gyms) {
          const resolved = await resolveSportsVenue(gym);
          expect(resolved.isIndoor).toBe(true);
          expect(resolved.surface).toBe('indoor_parquet');
        }
      });

      it('should resolve outdoor football pitches to turf or grass', async () => {
        const pitches = [
          { name: 'Töölön Pallokenttä 1 (Bollis)', expected: 'natural_grass' },
          { name: 'Puotilan Tekonurmi', expected: 'artificial_turf_3g' },
          { name: 'Lauttasaaren urheilupuisto "Pyrkkä"', expected: 'artificial_turf_3g' }
        ];

        for (const p of pitches) {
          const resolved = await resolveSportsVenue(p.name);
          expect(resolved.isIndoor).toBe(false);
          expect(resolved.surface).toBe(p.expected);
        }
      });
    });

    describe('1.4 Deterministic Footwear & Matchday Briefing Kit Reasoning', () => {
      it('should recommend SKATES ("Luistimet") for ice surface / ice hockey', () => {
        // Cast to test expected contract
        const fn = determineFootwear as unknown as (
          surface: PitchSurface,
          tempC: number,
          precipMmh: number,
          isIndoor: boolean,
          sport?: SportType
        ) => { footwear: AnyFootwear; reason: string };

        const resIceSurface = fn('ice', -2, 0, true, 'icehockey');
        expect(resIceSurface.footwear).toBe('SKATES');
        expect(resIceSurface.reason.toLowerCase()).toMatch(/luistimet|jää/i);
      });

      it('should include mandatory kaulasuoja and warm spectator advice for ice hockey in cold halls', () => {
        const hockeyEvent: MatchdayEvent = {
          id: 'ev-test-hockey',
          profileId: 'p1',
          sport: 'icehockey',
          eventType: 'match',
          title: 'Kiekko-Espoo vs HIFK U12',
          homeTeam: 'Kiekko-Espoo',
          awayTeam: 'HIFK',
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T11:30:00.000Z',
          venue: {
            name: 'Matinkylän jäähalli',
            coordinates: { lat: 60.158, lng: 24.75 },
            isIndoor: true,
            surface: 'ice',
            hasFloodlights: true
          },
          isHomeMatch: true
        };

        const briefing = generateMatchdayBriefing(hockeyEvent);
        // Spectator gear in ice hall must warn about cold hall temperature (+4...+8 °C)
        expect(briefing.gearAndPackingAdvice.spectatorGear.toLowerCase()).toMatch(/kylmä|halli|toppatakki|lämmin|katsomo/i);
        expect(briefing.gearAndPackingAdvice.clothing.toLowerCase()).not.toMatch(/suojalasit \(säbä\)/i);

        const kitPlan = buildSportKitPlan(hockeyEvent);
        const playerLabels = kitPlan.playerItems.map((i) => i.label.toLowerCase()).join(' ');
        expect(playerLabels).toMatch(/kaulasuoja|kypärä|luistimet/i);
      });

      it('should restrict floorball goggles (suojalasit) strictly to floorball', () => {
        const floorballEvent: MatchdayEvent = {
          id: 'ev-fb',
          profileId: 'p1',
          sport: 'floorball',
          eventType: 'match',
          title: 'Oilers vs Indians',
          homeTeam: 'Oilers',
          awayTeam: 'Indians',
          startTime: '2026-11-20T12:00:00.000Z',
          endTime: '2026-11-20T13:30:00.000Z',
          venue: {
            name: 'Otahalli',
            coordinates: { lat: 60.185, lng: 24.832 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          },
          isHomeMatch: true
        };

        const basketballEvent: MatchdayEvent = {
          ...floorballEvent,
          id: 'ev-bb',
          sport: 'basketball',
          title: 'ToPo vs HNMKY'
        };

        const volleyballEvent: MatchdayEvent = {
          ...floorballEvent,
          id: 'ev-vb',
          sport: 'volleyball',
          title: 'PuMa vs VaLePa'
        };

        const futsalEvent: MatchdayEvent = {
          ...floorballEvent,
          id: 'ev-fs',
          sport: 'futsal',
          title: 'KaDy vs GFT'
        };

        // Floorball gets goggles
        const fbBriefing = generateMatchdayBriefing(floorballEvent);
        const fbKit = buildSportKitPlan(floorballEvent);
        expect(fbKit.playerItems.some((i) => i.label.toLowerCase().includes('suojalasit'))).toBe(true);

        // Basketball does NOT get floorball goggles
        const bbBriefing = generateMatchdayBriefing(basketballEvent);
        const bbKit = buildSportKitPlan(basketballEvent);
        expect(bbBriefing.gearAndPackingAdvice.clothing.toLowerCase()).not.toContain('suojalasit (säbä)');
        expect(bbKit.playerItems.some((i) => i.label.toLowerCase().includes('suojalasit'))).toBe(false);

        // Volleyball gets knee pads (polvisuojat), no floorball goggles
        const vbKit = buildSportKitPlan(volleyballEvent);
        expect(vbKit.playerItems.some((i) => i.label.toLowerCase().includes('polvi'))).toBe(true);
        expect(vbKit.playerItems.some((i) => i.label.toLowerCase().includes('suojalasit'))).toBe(false);

        // Futsal gets shin guards (säärystimet / säärisuojat), no floorball goggles
        const fsKit = buildSportKitPlan(futsalEvent);
        expect(fsKit.playerItems.some((i) => i.label.toLowerCase().includes('sääry') || i.label.toLowerCase().includes('sääri'))).toBe(true);
        expect(fsKit.playerItems.some((i) => i.label.toLowerCase().includes('suojalasit'))).toBe(false);
      });

      it('should handle school & other activities with 5-min buffer and non-match reminders', () => {
        const schoolEvent: MatchdayEvent = {
          id: 'ev-sc',
          profileId: 'p1',
          sport: 'school',
          eventType: 'school',
          title: 'Matematiikan loppukoe',
          startTime: '2026-11-20T08:00:00.000Z',
          endTime: '2026-11-20T09:30:00.000Z',
          venue: {
            name: 'Koulu',
            coordinates: { lat: 60.16, lng: 24.87 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          },
          isHomeMatch: false
        };

        const countdown = calculateDepartureCountdown(schoolEvent);
        expect(countdown.departureTime).toBeDefined();

        const briefing = generateMatchdayBriefing(schoolEvent);
        expect(briefing.postMatchWhatsAppTemplate).toContain('📌 Muistutus: Matematiikan loppukoe');
        expect(briefing.postMatchWhatsAppTemplate).not.toContain('Pelipäivän tulos');
        expect(briefing.gearAndPackingAdvice.footwearReason.toLowerCase()).toContain('koulu');
      });
    });

    describe('1.5 Popular Clubs Catalog Search & Multi-Sport Presets', () => {
      it('should return authentic presets for ice hockey and futsal clubs', () => {
        const hockeyResults = searchPopularClubs('HIFK');
        const hockeyHit = hockeyResults.find((c) => c.sport === 'icehockey' || c.name.toLowerCase().includes('hifk'));
        expect(hockeyHit).toBeDefined();

        const futsalResults = searchPopularClubs('KaDy');
        const futsalHit = futsalResults.find((c) => c.sport === 'futsal' || c.name.toLowerCase().includes('kady'));
        expect(futsalHit).toBeDefined();
      });

      it('should support sport filtering in searchPopularClubs', () => {
        const fn = searchPopularClubs as unknown as (query: string, sport?: SportType) => typeof POPULAR_FINNISH_CLUBS;

        const hockeyOnly = fn('', 'icehockey');
        expect(hockeyOnly.length).toBeGreaterThanOrEqual(1);
        expect(hockeyOnly.every((c) => c.sport === 'icehockey')).toBe(true);

        const futsalOnly = fn('', 'futsal');
        expect(futsalOnly.length).toBeGreaterThanOrEqual(1);
        expect(futsalOnly.every((c) => c.sport === 'futsal')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // ==========================================================================
  describe('Tier 2 — Boundary & Corner Cases', () => {
    it('should handle mixed-case URLs, arbitrary whitespace padding and query parameters', () => {
      const paddedUrl = '   hTTps://TuLosPalvelu.palloliitto.fi/Team/185085/iNFo?Season=2026&Category=Futsal   ';
      const parsed = parseAssociationUrl(paddedUrl);

      expect(parsed).not.toBeNull();
      expect(parsed?.sport).toBe('futsal');
      expect(parsed?.teamId).toBe('185085');
    });

    it('should distinguish outdoor ice (ulkotekojää) from indoor ice halls', async () => {
      const outdoorIce = await resolveSportsVenue('Käpylän tekojää');
      expect(outdoorIce.surface).toBe('ice');

      // Outdoor ice should not mark isIndoor if it's an outdoor rink
      if (!outdoorIce.isIndoor) {
        const { footwear } = determineFootwear('ice', -5, 0, false);
        expect((footwear as string)).toBe('SKATES');
      }
    });

    it('should handle boundary temperatures: 3G turf < 0°C vs >= 0°C, and sand turf <= 3°C', () => {
      // 3G turf frozen at -0.1 °C -> TF
      const freezingTurf = determineFootwear('artificial_turf_3g', -0.1, 0, false);
      expect(freezingTurf.footwear).toBe('TF_TURF_SHOES');

      // 3G turf thawed at 0.0 °C -> AG
      const thawedTurf = determineFootwear('artificial_turf_3g', 0.0, 0, false);
      expect(thawedTurf.footwear).toBe('AG_ARTIFICIAL_GRASS');

      // Sand turf hard as concrete at <= 3 °C -> TF
      const coldSand = determineFootwear('sand_artificial_turf', 3.0, 0, false);
      expect(coldSand.footwear).toBe('TF_TURF_SHOES');
      expect(coldSand.reason).toContain('betoni');
    });

    it('should safely reject invalid inputs, non-HTTP protocols, and arbitrary domains', () => {
      expect(parseAssociationUrl('')).toBeNull();
      expect(parseAssociationUrl('   ')).toBeNull();
      expect(parseAssociationUrl('ftp://tulospalvelu.palloliitto.fi/team/123')).toBeNull();
      expect(parseAssociationUrl('javascript:alert(1)')).toBeNull();
      expect(parseAssociationUrl('https://example.com/team/123')).toBeNull();
      expect(detectSportFromText('')).toBeUndefined();
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS & STATE HARMONIZATION
  // ==========================================================================
  describe('Tier 3 — Cross-Feature Combinations', () => {
    it('should detect family schedule conflicts across different children in different sports', async () => {
      const child1Event: MatchdayEvent = {
        id: 'ev-c1-hockey',
        profileId: 'child-1-ville',
        sport: 'icehockey',
        eventType: 'match',
        title: 'Ville: Lätkämatsi Matinkylä',
        homeTeam: 'K-Espoo',
        awayTeam: 'Jokerit',
        startTime: '2026-11-21T09:00:00.000Z',
        endTime: '2026-11-21T10:30:00.000Z',
        venue: {
          name: 'Matinkylän jäähalli',
          coordinates: { lat: 60.158, lng: 24.75 },
          isIndoor: true,
          surface: 'ice',
          hasFloodlights: true
        },
        isHomeMatch: true
      };

      const child2Event: MatchdayEvent = {
        id: 'ev-c2-basket',
        profileId: 'child-2-aino',
        sport: 'basketball',
        eventType: 'match',
        title: 'Aino: Korismatsi Kisahalli',
        homeTeam: 'ToPo',
        awayTeam: 'HNMKY',
        startTime: '2026-11-21T09:30:00.000Z', // Overlaps Ville's match!
        endTime: '2026-11-21T11:00:00.000Z',
        venue: {
          name: 'Töölön kisahalli (Kisis)',
          coordinates: { lat: 60.183, lng: 24.928 },
          isIndoor: true,
          surface: 'indoor_parquet',
          hasFloodlights: true
        },
        isHomeMatch: false
      };

      // Generate briefing for Child 1 in the context of Child 2's schedule
      const briefing = generateMatchdayBriefing(child1Event, [child1Event, child2Event]);
      expect(briefing.conflictWarning).toBeDefined();
      expect(briefing.conflictWarning).toContain('AIKATAULURUUHKI');
      expect(briefing.conflictWarning).toContain('Aino: Korismatsi Kisahalli');
    });

    it('should ensure non-destructive startup harmonization preserves distinct sports', async () => {
      // Setup multi-sport profiles & events in test database
      const profileFootball: PlayerProfile = {
        id: 'prof-ville-football',
        playerName: 'Ville',
        teamName: 'PPJ Laru Sininen',
        sport: 'football',
        colorHex: '#003580',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z'
      };

      const events: MatchdayEvent[] = [
        {
          id: 'ev-v-hockey',
          profileId: 'prof-ville-football',
          sport: 'icehockey',
          eventType: 'match',
          title: 'Ville: Lätkämatsi',
          homeTeam: 'Kiekko-Espoo',
          awayTeam: 'HIFK',
          startTime: '2026-11-22T08:00:00.000Z',
          endTime: '2026-11-22T09:30:00.000Z',
          venue: {
            name: 'Matinkylän jäähalli',
            coordinates: { lat: 60.158, lng: 24.75 },
            isIndoor: true,
            surface: 'ice',
            hasFloodlights: true
          },
          isHomeMatch: true
        },
        {
          id: 'ev-v-school',
          profileId: 'prof-ville-football',
          sport: 'school',
          eventType: 'school',
          title: 'Ville: Matematiikan koe',
          startTime: '2026-11-22T10:00:00.000Z',
          endTime: '2026-11-22T11:00:00.000Z',
          venue: {
            name: 'Koulu',
            coordinates: { lat: 60.16, lng: 24.87 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          },
          isHomeMatch: false
        },
        {
          id: 'ev-v-futsal',
          profileId: 'prof-ville-football',
          sport: 'futsal',
          eventType: 'match',
          title: 'Ville: Futsalturnaus',
          homeTeam: 'GFT',
          awayTeam: 'KaDy',
          startTime: '2026-11-22T14:00:00.000Z',
          endTime: '2026-11-22T15:30:00.000Z',
          venue: {
            name: 'Opinmäki sali',
            coordinates: { lat: 60.19, lng: 24.7 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          },
          isHomeMatch: true
        }
      ];

      await testDb.profiles.put(profileFootball);
      for (const ev of events) {
        await testDb.events.put(ev);
      }

      // Execute pure startup harmonization
      const res = harmonizeStartupSports([profileFootball], events);
      // Non-destructive rule: hockey, school, and futsal events must NEVER be updated to football!
      const clobbered = res.eventUpdates.filter(
        (u) => u.updates.sport === 'football'
      );
      expect(clobbered.length).toBe(0);

      // Directly verify DB state is intact
      const storedEvents = await testDb.events.toArray();
      const hockey = storedEvents.find((e) => e.id === 'ev-v-hockey');
      expect(hockey?.sport).toBe('icehockey');

      const school = storedEvents.find((e) => e.id === 'ev-v-school');
      expect(school?.sport).toBe('school');

      const futsal = storedEvents.find((e) => e.id === 'ev-v-futsal');
      expect(futsal?.sport).toBe('futsal');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ==========================================================================
  describe('Tier 4 — Real-World Multi-Child Family Weekend Logistics Simulation', () => {
    it('should simulate an authentic 2-child, 4-sport weekend with complete end-to-end reasoning', async () => {
      // Child 1: Ville (Hockey + School)
      // Child 2: Aino (Football + Futsal)
      const profiles: PlayerProfile[] = [
        {
          id: 'prof-ville',
          playerName: 'Ville',
          teamName: 'Kiekko-Espoo U12',
          sport: 'icehockey',
          colorHex: '#002855',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z'
        },
        {
          id: 'prof-aino',
          playerName: 'Aino',
          teamName: 'HJK T13 Sininen',
          sport: 'football',
          colorHex: '#003580',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z'
        }
      ];

      for (const p of profiles) {
        await testDb.profiles.put(p);
      }

      // Weekend Schedule:
      // Saturday:
      // - 08:30 Ville: Aamujää (Matinkylän jäähalli) [icehockey]
      // - 11:30 Aino: Syyskierroksen peli (Töölön Pallokenttä 1) [football]
      // - 15:00 Ville: Koulun esiintyminen (Tapiolan koulu) [school]
      // Sunday:
      // - 10:00 Aino: Futsal-avaus (Leppävaaran liikuntahalli) [futsal]
      const weekendEvents: MatchdayEvent[] = [
        {
          id: 'ev-sat-ville-hockey',
          profileId: 'prof-ville',
          sport: 'icehockey',
          eventType: 'training',
          title: 'Ville: Aamujää ja lajiharjoitus',
          startTime: '2026-11-21T06:30:00.000Z', // 08:30 local
          endTime: '2026-11-21T08:00:00.000Z',
          venue: {
            name: 'Matinkylän jäähalli',
            coordinates: { lat: 60.158, lng: 24.75 },
            isIndoor: true,
            surface: 'ice',
            hasFloodlights: true
          },
          weather: {
            temperatureC: 4, // Cold ice rink ambient
            precipitationMmh: 0,
            windSpeedMs: 0,
            weatherCode: 0,
            weatherDescription: 'Sisähalli'
          },
          isTraining: true,
          isHomeMatch: true
        },
        {
          id: 'ev-sat-aino-football',
          profileId: 'prof-aino',
          sport: 'football',
          eventType: 'match',
          title: 'Aino: HJK vs EPS',
          homeTeam: 'HJK',
          awayTeam: 'EPS',
          startTime: '2026-11-21T09:30:00.000Z', // 11:30 local
          endTime: '2026-11-21T11:00:00.000Z',
          venue: {
            name: 'Töölön Pallokenttä 1 (Bollis)',
            coordinates: { lat: 60.1872, lng: 24.9248 },
            isIndoor: false,
            surface: 'natural_grass',
            hasFloodlights: true
          },
          weather: {
            temperatureC: 8,
            precipitationMmh: 1.5, // Wet natural grass
            windSpeedMs: 4,
            weatherCode: 61,
            weatherDescription: 'Kevyttä sadetta'
          },
          isTraining: false,
          isHomeMatch: true
        },
        {
          id: 'ev-sat-ville-school',
          profileId: 'prof-ville',
          sport: 'school',
          eventType: 'school',
          title: 'Ville: Koulun esiintyminen',
          startTime: '2026-11-21T13:00:00.000Z', // 15:00 local
          endTime: '2026-11-21T14:30:00.000Z',
          venue: {
            name: 'Tapiolan koulu',
            coordinates: { lat: 60.177, lng: 24.805 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          },
          isTraining: false,
          isHomeMatch: false
        },
        {
          id: 'ev-sun-aino-futsal',
          profileId: 'prof-aino',
          sport: 'futsal',
          eventType: 'match',
          title: 'Aino: Futsal-avaus GFT vs KaDy',
          homeTeam: 'GFT',
          awayTeam: 'KaDy',
          startTime: '2026-11-22T08:00:00.000Z', // 10:00 local
          endTime: '2026-11-22T09:30:00.000Z',
          venue: {
            name: 'Leppävaaran Liikuntahalli',
            coordinates: { lat: 60.2225, lng: 24.8085 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          },
          weather: {
            temperatureC: 19,
            precipitationMmh: 0,
            windSpeedMs: 0,
            weatherCode: 0,
            weatherDescription: 'Sisähalli'
          },
          isTraining: false,
          isHomeMatch: true
        }
      ];

      for (const ev of weekendEvents) {
        await testDb.events.put(ev);
      }

      // 1. Verify Event Kit Plans for all 4 distinct events
      const kitPlans = weekendEvents.map((ev) => {
        const p = profiles.find((prof) => prof.id === ev.profileId);
        return buildSportKitPlan(ev, p);
      });

      // Ville Hockey: Skates, neck protector, warm spectator
      const hockeyPlan = kitPlans[0]!;
      expect(hockeyPlan.sport).toBe('icehockey');
      const hockeyItems = hockeyPlan.playerItems.map((i) => i.label.toLowerCase()).join(' ');
      expect(hockeyItems).toMatch(/kaulasuoja|kypärä|luistimet/i);

      // Aino Football: Wet grass -> SG/FG boots, rain gear for spectator
      const footballPlan = kitPlans[1]!;
      expect(footballPlan.sport).toBe('football');
      expect(footballPlan.footwearLabel).toMatch(/SG|FG|nappikset/i);
      expect(footballPlan.spectatorItems.some((i) => i.label.toLowerCase().includes('sade') || i.label.toLowerCase().includes('sateenvarjo'))).toBe(true);

      // Ville School: School items, backpack, normal clothes
      const schoolPlan = kitPlans[2]!;
      expect(schoolPlan.sport).toBe('school');

      // Aino Futsal: Indoor flat shoes + shin guards
      const futsalPlan = kitPlans[3]!;
      expect(futsalPlan.sport).toBe('futsal');
      const futsalItems = futsalPlan.playerItems.map((i) => i.label.toLowerCase()).join(' ');
      expect(futsalItems).toMatch(/sääry|sääri/i);

      // 2. Verify Briefings
      const hockeyBriefing = generateMatchdayBriefing(weekendEvents[0]!, weekendEvents);
      expect(hockeyBriefing.gearAndPackingAdvice.spectatorGear.toLowerCase()).toMatch(/kylmä|katsomo|toppatakki|lämmin/i);

      const footballBriefing = generateMatchdayBriefing(weekendEvents[1]!, weekendEvents);
      expect(footballBriefing.gearAndPackingAdvice.spectatorGear.toLowerCase()).toMatch(/sade|sateenvarjo/i);

      const schoolBriefing = generateMatchdayBriefing(weekendEvents[2]!, weekendEvents);
      expect(schoolBriefing.postMatchWhatsAppTemplate).toContain('📌 Muistutus: Ville: Koulun esiintyminen');

      // 3. Verify Database Integrity
      const count = await testDb.events.count();
      expect(count).toBe(4);
      const allDbEvents = await testDb.events.toArray();
      const distinctSports = new Set(allDbEvents.map((e) => e.sport));
      expect(distinctSports.has('icehockey')).toBe(true);
      expect(distinctSports.has('football')).toBe(true);
      expect(distinctSports.has('school')).toBe(true);
      expect(distinctSports.has('futsal')).toBe(true);
    });
  });
});
