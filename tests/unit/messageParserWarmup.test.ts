import { describe, it, expect } from 'vitest';
import {
  extractTimesFromFinnishText,
  parseFreeformSportsMessage,
  parseMultipleSportsMessages
} from '../../src/lib/ai/messageParserNLP';

describe('NLP Timestamp & Warmup Extraction Engine', () => {
  describe('1. Explicit Warmup & Kickoff Parsing', () => {
    it('extracts explicit warmup time when formatted as "kokoontuminen klo 15:45"', () => {
      const text = 'Peli lauantaina klo 16:30 alkaen (kokoontuminen klo 15:45)';
      const times = extractTimesFromFinnishText(text);

      expect(times.kickoff).toBe('16:30');
      expect(times.warmup).toBe('15:45');
    });

    it('extracts explicit warmup time when formatted as "paikalla 09.15, peli 10.00"', () => {
      const text = 'Turnauspeli: paikalla 09.15, peli alkaa klo 10.00';
      const times = extractTimesFromFinnishText(text);

      expect(times.kickoff).toBe('10:00');
      expect(times.warmup).toBe('09:15');
    });

    it('extracts explicit warmup time when formatted as "Alkulämpö 17.00, ottelu 18.00"', () => {
      const text = 'Sarjaottelu: Alkulämpö klo 17.00, ottelu 18.00 - 19.30';
      const times = extractTimesFromFinnishText(text);

      expect(times.kickoff).toBe('18:00');
      expect(times.warmup).toBe('17:00');
      expect(times.end).toBe('19:30');
    });
  });

  describe('2. Implicit Sports Warmup Default Calculation (45 min prior)', () => {
    it('defaults warmup to 45 minutes prior for sports matches when no explicit warmup is given', () => {
      const msg = 'Lauantaina 12.9. ottelu PPJ Laru vs KäPa klo 14:00 Väinämöisen kentällä';
      const result = parseFreeformSportsMessage(msg, 'Maija');

      expect(result.kickoffTime).toBe('14:00');
      expect(result.warmupTime).toBe('13:15'); // 14:00 - 45 min
    });

    it('defaults warmup to 45 minutes prior for floorball matches crossing hour boundaries cleanly', () => {
      const msg = 'Salibandypeli su 20.9. klo 10:15 Mosahalli';
      const result = parseFreeformSportsMessage(msg, 'Eemil');

      expect(result.kickoffTime).toBe('10:15');
      expect(result.warmupTime).toBe('09:30'); // 10:15 - 45 min
    });
  });

  describe('3. School, Dentist, and Non-Sport Events Warmup Exemption', () => {
    it('sets warmupTime equal to kickoffTime for school exams (no 45min warmup)', () => {
      const msg = 'Matematiikan koe tiistaina 8.9. klo 09:15 - 10:45 luokassa B12';
      const result = parseFreeformSportsMessage(msg, 'Simo');

      expect(result.sport).toBe('school');
      expect(result.kickoffTime).toBe('09:15');
      expect(result.warmupTime).toBe('09:15');
      expect(result.endTime).toBe('10:45');
    });

    it('sets warmupTime equal to kickoffTime for doctor appointments', () => {
      const msg = 'Hammaslääkäri keskiviikkona 16.9. klo 14.30';
      const result = parseFreeformSportsMessage(msg, 'Aada');

      expect(result.sport).toBe('other');
      expect(result.kickoffTime).toBe('14:30');
      expect(result.warmupTime).toBe('14:30');
    });
  });

  describe('4. Multi-Event Message Ingestion with Varied Warmups', () => {
    it('parses multiple matches on same day with distinct warmups', () => {
      const tournamentSchedule = `Turnauspäivä la 3.10. Mosahallilla:
1. Peli klo 10:00 (kokoontuminen 09:15) vs ErVi
2. Peli klo 13:30 (paikalla 13:00) vs Oilers
3. Peli klo 16:00 vs TiPS`;

      const events = parseMultipleSportsMessages(tournamentSchedule, 'Eemil');

      expect(events.length).toBe(3);

      expect(events[0].kickoffTime).toBe('10:00');
      expect(events[0].warmupTime).toBe('09:15');

      expect(events[1].kickoffTime).toBe('13:30');
      expect(events[1].warmupTime).toBe('13:00');

      expect(events[2].kickoffTime).toBe('16:00');
      expect(events[2].warmupTime).toBe('15:15'); // 16:00 - 45 min default
    });
  });
});
