import { describe, it, expect } from 'vitest';
import {
  parsePastedSpreadsheetText,
  parseExcelFileBuffer,
  parseTableRows
} from '../../src/lib/ai/tableAndExcelParser';

describe('Table and Spreadsheet Parser (Zero-Dependency CSV/TSV Engine)', () => {
  describe('1. TSV / Tab-delimited Parsing (Google Sheets & Excel Copy-Paste)', () => {
    it('parses Google Sheets tab-separated rows with Finnish headers', () => {
      const tsv = `Pvm\tKlo\tOttelu\tKenttä\tKahviovuoro
24.8.2026\t16:30\tPPJ Laru vs KäPa Barca\tVäinämöisen kenttä\tMaijan vanhemmat
25.8.2026\t18:00\tHJK Sininen vs PPJ Laru\tBolt Arena\tVille`;

      const result = parsePastedSpreadsheetText(tsv, 'football', 'Maija');

      expect(result.events.length).toBe(2);
      expect(result.headers).toEqual(['Pvm', 'Klo', 'Ottelu', 'Kenttä', 'Kahviovuoro']);

      const ev1 = result.events[0];
      expect(ev1.kickoffTime).toBe('16:30');
      expect(ev1.homeTeam).toContain('PPJ Laru');
      expect(ev1.awayTeam).toContain('KäPa Barca');
      expect(ev1.venueHint).toContain('Väinämöisen');
      expect(ev1.volunteerDuties).toEqual(['Maijan vanhemmat']);

      const ev2 = result.events[1];
      expect(ev2.kickoffTime).toBe('18:00');
      expect(ev2.homeTeam).toContain('HJK Sininen');
      expect(ev2.awayTeam).toContain('PPJ Laru');
    });

    it('handles headless tab-separated rows gracefully using positional column fallbacks', () => {
      const headlessTsv = `15.9.2026\t10:00\tIndians vs Oilers\tOtahalli
16.9.2026\t12:00\tErVi vs Indians\tMosahalli`;

      const result = parsePastedSpreadsheetText(headlessTsv, 'floorball', 'Eemil');

      expect(result.events.length).toBe(2);
      expect(result.events[0].kickoffTime).toBe('10:00');
      expect(result.events[0].homeTeam).toBe('Indians');
      expect(result.events[0].awayTeam).toBe('Oilers');
      expect(result.events[0].venueHint).toContain('Otahalli');
    });
  });

  describe('2. Semicolon & Comma Delimited CSV Parsing (Finnish & International Exports)', () => {
    it('parses Finnish Excel semicolon-delimited CSV with quoted strings', () => {
      const csv = `Päivämäärä;Kellonaika;Tapahtuma;Sijainti;Vastuu
"24.08.2026";"16:30";"PPJ Laru vs KäPa, Alkulohko A";"Lauttasaaren urheilupuisto ""Pyrkkä""";"Kahviovuoro"
"30.08.2026";"14:00";"Honka vs ToPo";"Tapiolan urheiluhalli";"Toimitsija"`;

      const result = parsePastedSpreadsheetText(csv, 'football', 'Simo');

      expect(result.events.length).toBe(2);
      expect(result.events[0].kickoffTime).toBe('16:30');
      expect(result.events[0].homeTeam).toBe('PPJ Laru');
      expect(result.events[0].awayTeam).toContain('KäPa');
      expect(result.events[0].venueHint).toContain('Pyrkkä');
      expect(result.events[0].volunteerDuties).toEqual(['Kahviovuoro']);

      expect(result.events[1].kickoffTime).toBe('14:00');
      expect(result.events[1].homeTeam).toBe('Honka');
      expect(result.events[1].awayTeam).toBe('ToPo');
      expect(result.events[1].venueHint).toBe('Tapiolan urheiluhalli');
    });

    it('parses comma-delimited international CSV with quoted commas in team names', () => {
      const csv = `Date,Time,Event,Venue
2026-09-05,11:00,"Turnaus, finaali: PPJ vs HJK",Töölön Pallokenttä 1
2026-09-06,13:30,"Pronssipeli: KäPa vs TiPS",Bollis 6`;

      const result = parsePastedSpreadsheetText(csv, 'football', 'Lilli');

      expect(result.events.length).toBe(2);
      expect(result.events[0].kickoffTime).toBe('11:00');
      expect(result.events[0].title).toContain('Turnaus, finaali');
      expect(result.events[0].venueHint).toContain('Töölön Pallokenttä');

      expect(result.events[1].kickoffTime).toBe('13:30');
      expect(result.events[1].venueHint).toContain('Töölön Pallokenttä 6');
    });
  });

  describe('3. File Buffer Decoding & Multi-Encoding Fallbacks', () => {
    it('decodes UTF-8 ArrayBuffer with Scandinavian characters', async () => {
      const text = `Pvm;Aika;Ottelu;Kenttä\n12.09.2026;15:00;KäPa vs Ässät;Töölö PK`;
      const buffer = new TextEncoder().encode(text).buffer;

      const result = await parseExcelFileBuffer(buffer, 'football', 'Aada');

      expect(result.events.length).toBe(1);
      expect(result.events[0].homeTeam).toBe('KäPa');
      expect(result.events[0].awayTeam).toBe('Ässät');
      expect(result.events[0].venueHint).toBe('Töölö PK');
    });

    it('decodes ISO-8859-1 encoded buffer when characters are encoded in legacy Windows format', async () => {
      // Encode "Päivä;Klo;KäPa vs HJK;Töölö" in ISO-8859-1 (ä = 0xE4, ö = 0xF6)
      const bytes = new Uint8Array([
        0x50, 0xE4, 0x69, 0x76, 0xE4, 0x3B, // Päivä;
        0x4B, 0x6C, 0x6F, 0x3B,             // Klo;
        0x4F, 0x74, 0x74, 0x65, 0x6C, 0x75, 0x3B, // Ottelu;
        0x4B, 0x65, 0x6E, 0x74, 0x74, 0xE4, 0x0A, // Kenttä\n
        0x32, 0x30, 0x2E, 0x39, 0x2E, 0x32, 0x30, 0x32, 0x36, 0x3B, // 20.9.2026;
        0x31, 0x37, 0x3A, 0x30, 0x30, 0x3B,                         // 17:00;
        0x4B, 0xE4, 0x50, 0x61, 0x20, 0x76, 0x73, 0x20, 0x48, 0x4A, 0x4B, 0x3B, // KäPa vs HJK;
        0x54, 0xF6, 0xF6, 0x6C, 0xF6                                // Töölö
      ]);

      const result = await parseExcelFileBuffer(bytes.buffer, 'football', 'Maija');

      expect(result.events.length).toBe(1);
      expect(result.events[0].homeTeam).toBe('KäPa');
      expect(result.events[0].awayTeam).toBe('HJK');
      expect(result.events[0].venueHint).toBe('Töölö');
    });

    it('safely rejects buffers exceeding maximum size limit', async () => {
      const largeBuffer = new ArrayBuffer(3 * 1024 * 1024); // 3MB > 2MB
      const result = await parseExcelFileBuffer(largeBuffer, 'football', 'Maija');

      expect(result.events).toEqual([]);
      expect(result.totalRows).toBe(0);
    });
  });

  describe('4. Empty and Edge Case Handling', () => {
    it('returns empty result on empty or whitespace strings', () => {
      expect(parsePastedSpreadsheetText('')).toEqual({
        events: [],
        headers: [],
        totalRows: 0,
        unrecognizedRows: 0
      });
      expect(parsePastedSpreadsheetText('   \n\n  \t  ')).toEqual({
        events: [],
        headers: [],
        totalRows: 0,
        unrecognizedRows: 0
      });
    });

    it('handles parseTableRows with empty arrays', () => {
      expect(parseTableRows([])).toEqual({
        events: [],
        headers: [],
        totalRows: 0,
        unrecognizedRows: 0
      });
    });
  });
});
