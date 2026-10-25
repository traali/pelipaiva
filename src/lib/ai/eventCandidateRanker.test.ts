import { describe, it, expect } from 'vitest';
import {
  detectSportFromText,
  detectPlayerFromText,
  rankEventCandidatesForMessage,
  generateSuggestedUpdateNarrative
} from './eventCandidateRanker';
import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';

describe('NLP Sport Detection & Candidate Ranker', () => {
  describe('detectSportFromText - Finnish Compound Words & Sport Parity', () => {
    it('treats school venue locatives as location, not as a school event', () => {
      expect(detectSportFromText('Tiistain säbätreenit koululla')).toBe('floorball');
      expect(detectSportFromText('Koristreenit Lauttasaaren yhteiskoulussa')).toBe('basketball');
      expect(detectSportFromText('Futsal koulun salissa')).toBe('futsal');
      // A bare school venue with no sport keyword still classifies as school
      expect(detectSportFromText('Joulujuhla koululla')).toBe('school');
      expect(detectSportFromText('Tapaaminen koululla')).toBe('school');
    });

    it('detects ice hockey from isolated keywords and compound words', () => {
      expect(detectSportFromText('lätkätreenit')).toBe('icehockey');
      expect(detectSportFromText('jääkiekko-ottelu')).toBe('icehockey');
      expect(detectSportFromText('Kiekkotreenit Pirkkolassa')).toBe('icehockey');
      expect(detectSportFromText('Muista luistimet ja kypärä jäähallille')).toBe('icehockey');
      expect(detectSportFromText('HIFK vs Kiekko-Espoo')).toBe('icehockey');
      expect(detectSportFromText('Tappara - Jokerit matsi')).toBe('icehockey');
      expect(detectSportFromText('Aamujää klo 07:00')).toBe('icehockey');
    });

    it('detects futsal from compound words, clubs and league terms', () => {
      expect(detectSportFromText('futsaltreenit')).toBe('futsal');
      expect(detectSportFromText('Futsalpeli lauantaina')).toBe('futsal');
      expect(detectSportFromText('Futsal-Liiga ottelu')).toBe('futsal');
      expect(detectSportFromText('KaDy vs GFT')).toBe('futsal');
      expect(detectSportFromText('Akaa Futsal kotipeli')).toBe('futsal');
    });

    it('detects floorball from compound words, clubs and terms', () => {
      expect(detectSportFromText('säbätreenit')).toBe('floorball');
      expect(detectSportFromText('salibandyturnaus')).toBe('floorball');
      expect(detectSportFromText('sählypeli')).toBe('floorball');
      expect(detectSportFromText('Westend Indians vs Oilers')).toBe('floorball');
      expect(detectSportFromText('ErVi vs Tiikerit')).toBe('floorball');
      expect(detectSportFromText('Suojalasit ja reikäpallo')).toBe('floorball');
    });

    it('detects basketball from compound words, clubs and terms', () => {
      expect(detectSportFromText('koristreenit')).toBe('basketball');
      expect(detectSportFromText('koripallo-ottelu')).toBe('basketball');
      expect(detectSportFromText('Topola vs HNMKY')).toBe('basketball');
      expect(detectSportFromText('Honka basket matsi')).toBe('basketball');
      expect(detectSportFromText('Korisliiga kierros')).toBe('basketball');
    });

    it('detects volleyball from compound words, clubs and terms', () => {
      expect(detectSportFromText('lentistreenit')).toBe('volleyball');
      expect(detectSportFromText('lentopalloharjoitukset')).toBe('volleyball');
      expect(detectSportFromText('PuMa-Volley vs LP Viesti')).toBe('volleyball');
      expect(detectSportFromText('VaLePa mestaruusliiga')).toBe('volleyball');
      expect(detectSportFromText('Hihalyönti ja sormilyönti harjoitus')).toBe('volleyball');
    });

    it('detects football from compound words, clubs and terms', () => {
      expect(detectSportFromText('futistreenit')).toBe('football');
      expect(detectSportFromText('jalkapallo-ottelu')).toBe('football');
      expect(detectSportFromText('HJK vs PPJ')).toBe('football');
      expect(detectSportFromText('Bollis tekonurmi peli')).toBe('football');
      expect(detectSportFromText('Ota nappikset ja säärisuojat mukaan')).toBe('football');
      expect(detectSportFromText('Piirisarja 8vs8')).toBe('football');
    });

    it('detects general physical training when no specific sport is mentioned', () => {
      expect(detectSportFromText('fysiikkatreenit')).toBe('training');
      expect(detectSportFromText('kuntosali ja sauna')).toBe('training');
      expect(detectSportFromText('punttisali')).toBe('training');
      expect(detectSportFromText('juoksutreenit')).toBe('training');
      expect(detectSportFromText('oheisharjoitus hallilla')).toBe('training');
      expect(detectSportFromText('kehonhuolto ja venyttely')).toBe('training');
    });

    it('prioritizes specific sports over generic training keywords in compound context', () => {
      expect(detectSportFromText('Säbä fysiikkatreenit')).toBe('floorball');
      expect(detectSportFromText('Futis juoksutreenit')).toBe('football');
      expect(detectSportFromText('Lätkä oheistreenit')).toBe('icehockey');
    });

    it('detects school events accurately', () => {
      expect(detectSportFromText('Matematiikan koe')).toBe('school');
      expect(detectSportFromText('Ruotsin oppitunti')).toBe('school');
      expect(detectSportFromText('Wilma: Läksyt tekemättä')).toBe('school');
      expect(detectSportFromText('Koulupäivä 09-14')).toBe('school');
      expect(detectSportFromText('Luokkaretki Suomenlinnaan')).toBe('school');
    });

    it('detects personal appointments and non-sports as other', () => {
      expect(detectSportFromText('Hammaslääkäri klo 14:00')).toBe('other');
      expect(detectSportFromText('Pianotunti Musiikkiopistolla')).toBe('other');
      expect(detectSportFromText('Kitaratunti')).toBe('other');
      expect(detectSportFromText('Synttärit')).toBe('other');
      expect(detectSportFromText('Partiokokous')).toBe('other');
    });

    it('returns undefined for non-sport unspecific text', () => {
      expect(detectSportFromText('')).toBeUndefined();
      expect(detectSportFromText('Moi miten menee')).toBeUndefined();
      expect(detectSportFromText('Nähdään huomenna')).toBeUndefined();
    });
  });

  describe('detectPlayerFromText & Candidate Ranking', () => {
    const mockProfiles: PlayerProfile[] = [
      {
        id: 'p:simo',
        playerName: 'Simo',
        teamName: 'PPJ Laru',
        sport: 'football',
        primaryColor: 'sininen',
        calendarUrl: '',
        colorHex: '#3b82f6'
      },
      {
        id: 'p:aada',
        playerName: 'Aada',
        teamName: 'ToPo',
        sport: 'basketball',
        primaryColor: 'punainen',
        calendarUrl: '',
        colorHex: '#ef4444'
      }
    ];

    it('detects inflected Finnish player names', () => {
      expect(detectPlayerFromText('Simon peli huomenna', mockProfiles)?.id).toBe('p:simo');
      expect(detectPlayerFromText('Simolle kyyti', mockProfiles)?.id).toBe('p:simo');
      expect(detectPlayerFromText('Aadan treenit', mockProfiles)?.id).toBe('p:aada');
      expect(detectPlayerFromText('Aadalle pallo', mockProfiles)?.id).toBe('p:aada');
    });

    it('boosts candidates with matching sport and penalizes mismatching sport', () => {
      const events: MatchdayEvent[] = [
        {
          id: 'ev-1',
          profileId: 'p:simo',
          sport: 'football',
          eventType: 'match',
          isTraining: false,
          title: 'PPJ vs HJK',
          homeTeam: 'PPJ Laru',
          awayTeam: 'HJK',
          isHomeMatch: true,
          startTime: '2026-08-20T15:00:00Z',
          endTime: '2026-08-20T16:30:00Z',
          warmupTime: '2026-08-20T14:30:00Z',
          venue: {
            name: 'Väinämöisen kenttä',
            normalizedName: 'vainamoisen kentta',
            coordinates: { lat: 60.173, lng: 24.914 },
            isIndoor: false,
            surface: 'artificial_turf_3g',
            hasFloodlights: true
          }
        },
        {
          id: 'ev-2',
          profileId: 'p:aada',
          sport: 'basketball',
          eventType: 'match',
          isTraining: false,
          title: 'ToPo vs HNMKY',
          homeTeam: 'ToPo',
          awayTeam: 'HNMKY',
          isHomeMatch: true,
          startTime: '2026-08-20T15:00:00Z',
          endTime: '2026-08-20T16:30:00Z',
          warmupTime: '2026-08-20T14:30:00Z',
          venue: {
            name: 'Kisahalli',
            normalizedName: 'kisahalli',
            coordinates: { lat: 60.183, lng: 24.927 },
            isIndoor: true,
            surface: 'indoor_parquet',
            hasFloodlights: true
          }
        }
      ];

      const result = rankEventCandidatesForMessage('Koristreenit ToPo peli', events, mockProfiles);
      expect(result.detectedSport).toBe('basketball');
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0]!.event.id).toBe('ev-2');
    });

    it('generates clear suggested update narratives', () => {
      const narrative = generateSuggestedUpdateNarrative('Tulos 3-1 ja mustat paidat');
      expect(narrative).toContain('Tulos 3–1');
      expect(narrative).toContain('Musta peliasu');
    });
  });
});
