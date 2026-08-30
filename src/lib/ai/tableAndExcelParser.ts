import { ExtractedSportsEvent, extractDateFromFinnishText, extractTimesFromFinnishText, extractVenueFromFinnishText } from './messageParserNLP';
import { SportType, EventType } from '../../types/matchday';

export interface ParsedTableResult {
  events: ExtractedSportsEvent[];
  headers: string[];
  totalRows: number;
  unrecognizedRows: number;
}

/**
 * Normalizes header names for fuzzy column matching.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^a-z0-9äöå]/g, '');
}

/**
 * Auto-detects column indices from header row.
 */
function detectColumnMapping(headers: string[]): {
  dateCol: number;
  timeCol: number;
  eventCol: number;
  venueCol: number;
  dutyCol: number;
  playerCol: number;
} {
  let dateCol = -1;
  let timeCol = -1;
  let eventCol = -1;
  let venueCol = -1;
  let dutyCol = -1;
  let playerCol = -1;

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (['pvm', 'paiva', 'paivamaara', 'date', 'kierros'].some((k) => norm.includes(k)) && dateCol === -1) {
      dateCol = idx;
    } else if (['klo', 'aika', 'kellonaika', 'time', 'kickoff', 'alkaa'].some((k) => norm.includes(k)) && timeCol === -1) {
      timeCol = idx;
    } else if (['ottelu', 'vastustaja', 'peli', 'tapahtuma', 'match', 'opponent', 'event'].some((k) => norm.includes(k)) && eventCol === -1) {
      eventCol = idx;
    } else if (['kentta', 'paikka', 'sijainti', 'halli', 'venue', 'location', 'pitch'].some((k) => norm.includes(k)) && venueCol === -1) {
      venueCol = idx;
    } else if (['kahvio', 'toimitsija', 'kirjuri', 'kello', 'vuoro', 'duty', 'vastuu', 'vastuuhenkilo'].some((k) => norm.includes(k)) && dutyCol === -1) {
      dutyCol = idx;
    } else if (['pelaaja', 'nimi', 'lapsi', 'player', 'name'].some((k) => norm.includes(k)) && playerCol === -1) {
      playerCol = idx;
    }
  });

  // Fallback defaults for standard 4-5 column sheets without headers
  if (dateCol === -1 && headers.length > 0) dateCol = 0;
  if (timeCol === -1 && headers.length > 1) timeCol = 1;
  if (eventCol === -1 && headers.length > 2) eventCol = 2;
  if (venueCol === -1 && headers.length > 3) venueCol = 3;

  return { dateCol, timeCol, eventCol, venueCol, dutyCol, playerCol };
}

/**
 * Parses a 2D array of string cells into sports events.
 */
export function parseTableRows(
  rows: string[][],
  defaultSport: SportType = 'football',
  defaultPlayer = 'Maija'
): ParsedTableResult {
  if (!rows || rows.length === 0) {
    return { events: [], headers: [], totalRows: 0, unrecognizedRows: 0 };
  }

  // First row is headers if it contains header keywords and does not start with a date
  const firstRow = rows[0] || [];
  const firstCellStartsWithDate = /^\s*\d{1,2}\.\d{1,2}/.test(firstRow[0] || '');
  const hasKnownHeaderWord = firstRow.some((cell) => {
    const norm = normalizeHeader(cell);
    return ['pvm', 'paiva', 'klo', 'aika', 'ottelu', 'kentta', 'vuoro', 'vastuu', 'pelaaja', 'tapahtuma', 'vastustaja'].some((k) =>
      norm.includes(k)
    );
  });
  const isHeaderRow = !firstCellStartsWithDate && hasKnownHeaderWord;
  const headers = isHeaderRow ? firstRow.map((c) => c.trim()) : [];
  const dataRows = isHeaderRow ? rows.slice(1) : rows;

  const mapping = detectColumnMapping(headers.length > 0 ? headers : dataRows[0] || []);
  const events: ExtractedSportsEvent[] = [];
  let unrecognized = 0;

  for (const row of dataRows) {
    if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

    const dateRaw = row[mapping.dateCol] || '';
    const timeRaw = row[mapping.timeCol] || '';
    const eventRaw = row[mapping.eventCol] || '';
    const venueRaw = row[mapping.venueCol] || '';
    const dutyRaw = mapping.dutyCol >= 0 ? row[mapping.dutyCol] : '';

    if (!dateRaw && !eventRaw) {
      unrecognized++;
      continue;
    }

    const dateStr = extractDateFromFinnishText(dateRaw);
    const times = extractTimesFromFinnishText(timeRaw);
    const venueHint = extractVenueFromFinnishText(venueRaw);

    let homeTeam = defaultPlayer;
    let awayTeam = eventRaw.trim() || 'Vastustaja';
    let isHomeMatch = true;

    if (eventRaw.includes('vs') || eventRaw.includes('-') || eventRaw.includes('vastaan')) {
      const parts = eventRaw.split(/vs\.?|-|vastaan/i);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        homeTeam = parts[0].trim();
        awayTeam = parts[1].trim();
      }
    }

    const volunteerDuties: string[] = [];
    if (dutyRaw && dutyRaw.trim()) {
      volunteerDuties.push(dutyRaw.trim());
    }

    const isTraining = eventRaw.toLowerCase().includes('treenit') || eventRaw.toLowerCase().includes('harjoitukset');
    const eventType: EventType = isTraining ? 'training' : 'match';

    events.push({
      title: isTraining ? `Harjoitukset @ ${venueHint}` : `${homeTeam} vs ${awayTeam}`,
      eventType,
      sport: defaultSport,
      homeTeam,
      awayTeam,
      isHomeMatch,
      dateStr,
      kickoffTime: times.kickoff,
      warmupTime: times.warmup,
      endTime: times.end,
      venueHint,
      volunteerDuties,
      rawNotes: row.join(' | '),
      confidenceScore: 0.9
    });
  }

  return {
    events,
    headers,
    totalRows: dataRows.length,
    unrecognizedRows: unrecognized
  };
}

/**
 * Parses copy-pasted TSV text from Google Sheets or Excel.
 */
export function parsePastedSpreadsheetText(
  tsvText: string,
  sport: SportType = 'football',
  defaultPlayer = 'Maija'
): ParsedTableResult {
  const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = lines.map((line) => {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(';')) return line.split(';');
    if (line.includes(',')) return line.split(',');
    return [line];
  });

  return parseTableRows(rows, sport, defaultPlayer);
}

/**
 * Parses binary Excel (.xlsx / .xls) buffer into events.
 */
export async function parseExcelFileBuffer(
  buffer: ArrayBuffer,
  sport: SportType = 'football',
  defaultPlayer = 'Maija'
): Promise<ParsedTableResult> {
  // Size cap before parse: xlsx@0.18.5 (npm registry's last CE release) has
  // public prototype-pollution/ReDoS advisories on untrusted input; the
  // vendor's fixed versions are distributed off-registry. Cap + local-only
  // blast radius is the interim mitigation until a vendored upgrade lands.
  const MAX_BYTES = 2 * 1024 * 1024;
  if (buffer.byteLength > MAX_BYTES) {
    return { events: [], headers: [], totalRows: 0, unrecognizedRows: 0 };
  }
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { events: [], headers: [], totalRows: 0, unrecognizedRows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { events: [], headers: [], totalRows: 0, unrecognizedRows: 0 };
  }

  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
  const stringRows: string[][] = rawRows.map((r) => r.map((cell) => String(cell || '')));

  return parseTableRows(stringRows, sport, defaultPlayer);
}
