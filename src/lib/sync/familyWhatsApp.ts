/**
 * Deterministic WhatsApp synthetics and parse-back per docs/FAMILY_SYNC_FINAL.md
 */

export interface ParsedWhatsAppResult {
  type: 'join' | 'delta' | 'none';
  familyCode?: string;
  playerName?: string;
  teamName?: string;
  cupOrLeagueName?: string;
  url?: string;
}

/**
 * 8.1 / 10 Join invite template
 */
export function generateJoinWhatsApp(code: string): string {
  const cleanCode = code.trim().toUpperCase();
  return `FamDay-perhe ${cleanCode}
Avaa: https://pelipaiva.pages.dev/?perhe=${cleanCode}

Etunimi ja joukkue-URL Cloudflareen 7 pv.
Ottelut tulospalvelusta. Ei sukunimeä, ei vammoja.`;
}

/**
 * 8.2 / 10 Roster delta template after adding a team
 */
export function generateRosterDeltaWhatsApp(
  playerName: string,
  teamName: string,
  cupOrLeagueName: string,
  rawCalendarUrl: string
): string {
  return `FamDay: ${playerName.trim()} → ${teamName.trim()}
${cupOrLeagueName.trim()}
${rawCalendarUrl.trim()}`;
}

/**
 * 8.3 / 10 Talkoo summary
 */
export function generateTalkooWhatsApp(
  duties: Array<{ playerName: string; time: string; role: string; venueName: string }>
): string {
  if (!duties || duties.length === 0) {
    return 'Talkoo: Ei talkoovuoroja merkittynä.';
  }
  const lines = duties.map(
    (d) => `• ${d.playerName} ${d.time} ${d.role} @ ${d.venueName}`
  );
  return `Talkoo:\n${lines.join('\n')}`;
}

/**
 * 8.4 / 10 Parse-back in Quick Drop and Smart Import
 */
export function parseFamilyWhatsAppMessage(rawText: string): ParsedWhatsAppResult {
  if (!rawText || typeof rawText !== 'string') return { type: 'none' };
  const text = rawText.trim();

  // 1. Check for ?perhe= deep link: e.g. /?perhe=PERHE-2
  const deepLinkMatch = text.match(
    /[?&]perhe=([0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]|[0-9A-HJKMNP-TV-Z]{6})/i
  );
  if (deepLinkMatch && deepLinkMatch[1]) {
    let code = deepLinkMatch[1].toUpperCase();
    if (!code.includes('-') && code.length === 6) {
      code = `${code.slice(0, 5)}-${code.slice(5)}`;
    }
    return { type: 'join', familyCode: code };
  }

  // 2. Check for "FamDay-perhe" / "Pelipäivä-perhe" header
  const headerMatch = text.match(
    /(?:FamDay|Pelipäivä)-perhe\s+([0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]|[0-9A-HJKMNP-TV-Z]{6})/i
  );
  if (headerMatch && headerMatch[1]) {
    let code = headerMatch[1].toUpperCase();
    if (!code.includes('-') && code.length === 6) {
      code = `${code.slice(0, 5)}-${code.slice(5)}`;
    }
    return { type: 'join', familyCode: code };
  }

  // 3. Check for Delta format: "FamDay: Aada → TOPOLA" / "Pelipäivä: Aada → TOPOLA"
  const deltaMatch = text.match(/(?:FamDay|Pelipäivä):\s*([^→\n]+?)\s*→\s*([^\n]+)/i);
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);

  if (deltaMatch && deltaMatch[1] && deltaMatch[2] && urlMatch && urlMatch[0]) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const middleLines = lines.filter(
      (l) => !l.startsWith('FamDay:') && !l.startsWith('Pelipäivä:') && !l.startsWith('http')
    );
    return {
      type: 'delta',
      playerName: deltaMatch[1].trim(),
      teamName: deltaMatch[2].trim(),
      cupOrLeagueName: middleLines[0] || undefined,
      url: urlMatch[0]
    };
  }

  return { type: 'none' };
}
