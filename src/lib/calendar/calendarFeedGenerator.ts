import { MatchdayEvent, PlayerProfile } from '../../types/matchday';

/**
 * Formats a Date object or ISO string into iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ
 */
export function formatIcsDateUtc(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '19700101T000000Z';
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return (
    `${d.getUTCFullYear()}` +
    `${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}` +
    `${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Escapes text according to RFC 5545 (commas, semicolons, backslashes, newlines)
 */
export function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export interface CalendarFeedOptions {
  calendarTitle?: string;
  familyCode?: string;
  includeAlarms?: boolean;
}

/**
 * Generates an RFC 5545 compliant iCalendar string from a list of MatchdayEvents and Profiles.
 */
export function generateIcsCalendarFeed(
  events: MatchdayEvent[],
  profiles: PlayerProfile[] = [],
  options: CalendarFeedOptions = {}
): string {
  const calendarTitle = options.calendarTitle || (options.familyCode ? `FamDay (${options.familyCode})` : 'FamDay');
  const nowUtc = formatIcsDateUtc(new Date().toISOString());

  const profileMap = new Map<string, PlayerProfile>();
  for (const p of profiles) {
    profileMap.set(p.id, p);
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FamDay//FamDay Family Calendar 1.0//FI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
    'X-WR-TIMEZONE:Europe/Helsinki',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H'
  ];

  for (const ev of events) {
    const profile = ev.profileId ? profileMap.get(ev.profileId) : undefined;
    const playerName = profile?.playerName || '';
    const uid = `famday-${ev.id || Math.random().toString(36).slice(2)}@famday.app`;
    const dtStart = formatIcsDateUtc(ev.startTime);
    
    // Default 60 min duration if endTime is not set or invalid
    let dtEnd = ev.endTime ? formatIcsDateUtc(ev.endTime) : '';
    if (!dtEnd || dtEnd === dtStart) {
      const startMs = new Date(ev.startTime).getTime();
      dtEnd = formatIcsDateUtc(new Date(startMs + 60 * 60 * 1000).toISOString());
    }

    // Build rich summary
    let summary = ev.title;
    if (playerName && !summary.toLowerCase().includes(playerName.toLowerCase())) {
      summary = `${playerName}: ${summary}`;
    }

    // Build rich description
    const descParts: string[] = [];
    if (ev.isTraining) descParts.push('🏃 HARJOITUKSET / TREENIT');
    if (ev.eventType === 'school') descParts.push('📚 KOULU / WILMA');
    if (ev.eventType === 'tournament' || ev.tournamentName) descParts.push(`🏆 TURNAUS: ${ev.tournamentName || ''}`);
    if (ev.stage) descParts.push(`Sarja / Lohko: ${ev.stage}`);

    if (ev.warmupTime) {
      const warmupD = new Date(ev.warmupTime);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      descParts.push(`⏰ Kokoontuminen: klo ${pad(warmupD.getHours())}:${pad(warmupD.getMinutes())}`);
    }

    if (ev.briefing?.recommendedDepartureTime) {
      const leaveD = new Date(ev.briefing.recommendedDepartureTime);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      descParts.push(`🚗 Kotoalähtöaika: klo ${pad(leaveD.getHours())}:${pad(leaveD.getMinutes())}`);
    }

    const kitAdvice = (ev as any).kitAdvice;
    if (kitAdvice) {
      const primary = kitAdvice.primaryJerseyColor || kitAdvice.primaryColor || '';
      const alternate = kitAdvice.alternateJerseyColor || kitAdvice.alternateColor || '';
      descParts.push(`👕 Peliasu: ${primary}${alternate ? ` (varapaita: ${alternate})` : ''}`);
    } else if (ev.briefing?.gearAndPackingAdvice?.kitRecommendation) {
      descParts.push(`👕 Peliasu: ${ev.briefing.gearAndPackingAdvice.kitRecommendation}`);
    }

    if (ev.volunteerDuty) {
      descParts.push(`☕ Talkoovuoro: ${ev.volunteerDuty}`);
    }

    if (ev.notes) {
      descParts.push(`📝 Huomiot & Kyydit: ${ev.notes}`);
    }

    if (ev.score) {
      descParts.push(`⚽ Lopputulos: ${ev.score}`);
    }

    descParts.push('—\nFamDay: https://pelipaiva.pages.dev');

    const location = ev.venue?.address
      ? `${ev.venue.name}, ${ev.venue.address}`
      : ev.venue?.name || '';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowUtc}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);
    lines.push('STATUS:CONFIRMED');

    // Geo coordinates if present
    if (ev.venue?.coordinates?.lat && ev.venue?.coordinates?.lng) {
      lines.push(`GEO:${ev.venue.coordinates.lat};${ev.venue.coordinates.lng}`);
    }

    // Optional 30 min alarm
    if (options.includeAlarms !== false) {
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT30M');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(`Muistutus: ${summary}`)}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
