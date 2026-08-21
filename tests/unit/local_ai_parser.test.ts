import { describe, it, expect } from 'vitest';
import {
  parseFreeformSportsMessage,
  extractDateFromFinnishText,
  extractTimesFromFinnishText,
  extractVenueFromFinnishText,
  extractVolunteerDutiesFromText,
  extractKitColorFromText
} from '../../src/lib/ai/messageParserNLP';
import {
  parsePastedSpreadsheetText,
  parseTableRows
} from '../../src/lib/ai/tableAndExcelParser';
import {
  planFamilyLogistics,
  queryFamilySchedule
} from '../../src/lib/ai/localAiEngine';
import { MatchdayEvent, PlayerProfile } from '../../src/types/matchday';

describe('🤖 Finnish Sports NLP & Local AI Engine', () => {
  describe('1. Freeform WhatsApp & Coach Message Parsing', () => {
    it('parses typical Finnish football coach announcement with volunteer duty and kit color', () => {
      const msg = `Moi vanhemmat! Lauantaina 24.8. pelataan harkkapeli Väiskillä klo 16:30 alkaen (kokoontuminen klo 15:45). Mustat pelipaidat päälle. Maijalla ja Villellä kahviovuoro klo 16-18, tuokaa maitoa ja mokkapaloja.`;
      const result = parseFreeformSportsMessage(msg, 'Maija');

      expect(result.sport).toBe('football');
      expect(result.kickoffTime).toBe('16:30');
      expect(result.warmupTime).toBe('15:45');
      expect(result.venueHint).toContain('Väinämöisen');
      expect(result.kitColor).toContain('Musta');
      expect(result.volunteerDuties.some((d) => d.includes('Kahviovuoro'))).toBe(true);
    });

    it('parses floorball tournament announcement with table official duty', () => {
      const msg = `Salibandyturnaus Mosahallilla su 15.9. Ensimmäinen peli alkaa klo 10.00 (paikalla 09.15). Toimitsijavuoro: Eemilin vanhemmat klo 11:30 kirjuri ja kello.`;
      const result = parseFreeformSportsMessage(msg, 'Eemil');

      expect(result.sport).toBe('floorball');
      expect(result.eventType).toBe('tournament');
      expect(result.kickoffTime).toBe('10:00');
      expect(result.warmupTime).toBe('09:15');
      expect(result.venueHint).toContain('Mosahalli');
      expect(result.volunteerDuties.some((d) => d.includes('Toimitsija') || d.includes('Kirjuri'))).toBe(true);
    });

    it('parses training session announcement', () => {
      const msg = `Muistutus: Huomenna futistreenit Bollis 2 kentällä klo 18:00 - 19:30. Omat pallot mukaan.`;
      const result = parseFreeformSportsMessage(msg, 'Maija');

      expect(result.eventType).toBe('training');
      expect(result.kickoffTime).toBe('18:00');
      expect(result.endTime).toBe('19:30');
      expect(result.venueHint).toContain('Pallokenttä 2');
    });

    it('parses typical MyClub event description block', () => {
      const myClubText = `Tapahtuma: Sarjapeli PPJ Laru vs KäPa Barca
Päivämäärä: 24.8.2026
Aika: 16.30 - 18.00 (Kokoontuminen 15.45)
Paikka: Väinämöisen kenttä (Väiski)
Lisätiedot: Peliasuna sininen pelipaita. Kahviovuoro: Maijan vanhemmat.`;

      const result = parseFreeformSportsMessage(myClubText, 'Maija');

      expect(result.homeTeam).toContain('PPJ Laru');
      expect(result.awayTeam).toContain('KäPa Barca');
      expect(result.kickoffTime).toBe('16:30');
      expect(result.warmupTime).toBe('15:45');
      expect(result.venueHint).toContain('Väinämöisen');
      expect(result.kitColor).toContain('Sininen');
      expect(result.volunteerDuties.some((d) => d.includes('Kahviovuoro'))).toBe(true);
    });

    it('parses casual quick note typed by parent', () => {
      const note = `Lauantaina Maijalla peli Tapiola 2 kentällä klo 14.30`;
      const result = parseFreeformSportsMessage(note, 'Maija');

      expect(result.kickoffTime).toBe('14:30');
      expect(result.warmupTime).toBe('13:45');
      expect(result.venueHint).toContain('Tapiola');
    });
  });

  describe('2. Excel & Google Sheets Table Ingestion', () => {
    it('parses tab-separated values copied from Google Sheets / Excel', () => {
      const tsv = `Pvm\tKlo\tOttelu\tKenttä\tKahviovuoro
24.8.2026\t15:00\tHJK T13 vs EPS Valkoinen\tVäiski\tMaija
31.8.2026\t12:30\tFC Honka vs HJK T13\tTapiola 2 TN\tEemil
07.9.2026\t17:00\tHJK T13 vs VJS Tytöt\tBollis 1\tVille`;

      const result = parsePastedSpreadsheetText(tsv, 'football', 'Maija');

      expect(result.events.length).toBe(3);
      expect(result.events[0].kickoffTime).toBe('15:00');
      expect(result.events[0].homeTeam).toBe('HJK T13');
      expect(result.events[0].awayTeam).toBe('EPS Valkoinen');
      expect(result.events[0].venueHint).toContain('Väinämöisen');
      expect(result.events[0].volunteerDuties[0]).toContain('Maija');

      expect(result.events[1].kickoffTime).toBe('12:30');
      expect(result.events[1].homeTeam).toBe('FC Honka');
    });

    it('parses semicolon-separated CSV table without header safely', () => {
      const csv = `24.08.2026;14:00;ToPo U14 vs HNMKY;Kisis;Toimitsija (Kello)`;
      const result = parsePastedSpreadsheetText(csv, 'basketball', 'Eemil');

      expect(result.events.length).toBe(1);
      expect(result.events[0].kickoffTime).toBe('14:00');
      expect(result.events[0].venueHint).toContain('Kisahalli');
      expect(result.events[0].volunteerDuties[0]).toContain('Toimitsija');
    });
  });

  describe('3. Multi-Child Family Logistics Copilot', () => {
    const mockProfiles: PlayerProfile[] = [
      {
        id: 'prof-1',
        playerName: 'Maija',
        teamName: 'HJK T13',
        sport: 'football',
        primaryColor: 'sininen',
        calendarUrl: '',
        colorHex: '#10b981'
      },
      {
        id: 'prof-2',
        playerName: 'Eemil',
        teamName: 'ErVi P11',
        sport: 'floorball',
        primaryColor: 'punainen',
        calendarUrl: '',
        colorHex: '#ef4444'
      }
    ];

    const mockEvents: MatchdayEvent[] = [
      {
        id: 'ev-1',
        profileId: 'prof-1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs EPS',
        homeTeam: 'HJK',
        awayTeam: 'EPS',
        isHomeMatch: true,
        startTime: '2026-08-24T15:00:00+03:00',
        endTime: '2026-08-24T16:30:00+03:00',
        warmupTime: '2026-08-24T14:15:00+03:00',
        venue: {
          name: 'Puotila TN (Bubu)',
          normalizedName: 'puotila tn',
          coordinates: { lat: 60.21, lng: 25.1 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      },
      {
        id: 'ev-2',
        profileId: 'prof-2',
        sport: 'floorball',
        eventType: 'match',
        isTraining: false,
        title: 'ErVi vs Oilers',
        homeTeam: 'ErVi',
        awayTeam: 'Oilers',
        isHomeMatch: true,
        startTime: '2026-08-24T15:30:00+03:00',
        endTime: '2026-08-24T17:00:00+03:00',
        warmupTime: '2026-08-24T14:45:00+03:00',
        venue: {
          name: 'Tapiola 2 TN',
          normalizedName: 'tapiola 2 tn',
          coordinates: { lat: 60.18, lng: 24.8 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        },
        volunteerDuty: '☕ Kahviovuoro klo 15-17'
      }
    ];

    it('detects cross-child venue overlap on the same afternoon', () => {
      const plan = planFamilyLogistics(mockEvents, mockProfiles, '2026-08-24');

      expect(plan.hasConflicts).toBe(true);
      expect(plan.departureSchedule.length).toBe(2);
      expect(plan.conflictDetails[0]).toContain('Päällekkäisyys');
      expect(plan.whatsAppShareText).toContain('Kyytisuunnitelma');
    });

    it('answers schedule question about volunteer duties', () => {
      const qResult = queryFamilySchedule('Onko minulla kahviovuoroa tällä viikolla?', mockEvents, mockProfiles);

      expect(qResult.answer).toContain('Kahviovuoro');
      expect(qResult.relevantEvents.length).toBe(1);
    });

    it('answers next game question accurately', () => {
      const futureEvents = mockEvents.map((e) => ({
        ...e,
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        warmupTime: new Date(Date.now() + 80000000).toISOString()
      }));

      const qResult = queryFamilySchedule('Milloin on seuraava peli?', futureEvents, mockProfiles);

      expect(qResult.answer).toContain('Seuraava ottelu on');
      expect(qResult.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});
