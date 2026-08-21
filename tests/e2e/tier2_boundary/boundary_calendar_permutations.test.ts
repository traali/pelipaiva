import { describe, it, expect } from 'vitest';
import {
  parseICSFeed,
  parseMatchTitle,
  classifyCalendarEvent,
  resolveEventTimes,
  extractVolunteerDuty,
  detectSquadGroups,
  splitICSBySquad
} from '../../../src/lib/calendar/icsParser';

describe('Tier 2 Boundary: Calendar Permutations, RFC 5545 & DST Robustness', () => {
  // 1. Empty & malformed ICS inputs
  it('should return empty events array for empty string or whitespace ICS', async () => {
    expect(await parseICSFeed('', 'prof-1')).toEqual([]);
    expect(await parseICSFeed('   \r\n\t   ', 'prof-1')).toEqual([]);
  });

  it('should return empty events array for ICS with only VCALENDAR wrapper', async () => {
    const emptyWrapper = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Pelipaiva//Test//FI',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(emptyWrapper, 'prof-1');
    expect(events).toEqual([]);
  });

  it('should parse safely without crashing on unclosed VEVENT block', async () => {
    const unclosed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'SUMMARY:HJK T13 vs EPS',
      'DTSTART:20260516T120000Z',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(unclosed, 'prof-1');
    expect(Array.isArray(events)).toBe(true);
  });

  // 2. Missing attributes & inverted timestamps
  it('should fallback to default title when SUMMARY is missing', async () => {
    const missingSummary = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:no-summary-1',
      'DTSTART:20260516T120000Z',
      'DTEND:20260516T133000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(missingSummary, 'prof-1');
    expect(events.length).toBe(1);
    expect(events[0]?.title).toBe('Tuntematon tapahtuma');
    expect(events[0]?.homeTeam).toBe('Tuntematon tapahtuma');
  });

  it('should handle inverted duration (DTEND < DTSTART) by ensuring valid positive duration', () => {
    const start = new Date('2026-05-16T15:00:00Z');
    const end = new Date('2026-05-16T14:00:00Z'); // 1 hour earlier
    const resolved = resolveEventTimes(start, end, 'HJK vs Honka');

    expect(resolved.endTime.getTime()).toBeGreaterThan(resolved.kickoffTime.getTime());
  });

  it('should handle zero-second duration (DTSTART === DTEND) with default 90m match duration', () => {
    const start = new Date('2026-05-16T15:00:00Z');
    const resolved = resolveEventTimes(start, start, 'HJK vs Honka');

    expect(resolved.endTime.getTime() - resolved.kickoffTime.getTime()).toBe(90 * 60 * 1000);
  });

  // 3. Folded lines & RFC 5545 whitespace continuation
  it('should parse folded long lines with whitespace continuation per RFC 5545', async () => {
    const foldedIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:folded-1',
      'SUMMARY:HJK T13 Sininen vs E',
      ' PS Valkoinen Ottelu',
      'LOCATION:Töölön Pallokenttä ',
      ' 1 Tekonurmi',
      'DESCRIPTION:Ottelu alkaa klo 15:00. K',
      ' okoontuminen klo 14:15.',
      'DTSTART:20260516T111500Z',
      'DTEND:20260516T133000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(foldedIcs, 'prof-1');
    expect(events.length).toBe(1);
    expect(events[0]?.title).toContain('HJK T13 Sininen vs EPS Valkoinen Ottelu');
  });

  // 4. Finnish diacritics & sports emojis
  it('should preserve Finnish characters (Ä, Ö, Å, é, ü) and sports emojis across all fields', async () => {
    const emojiIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:emoji-1',
      'SUMMARY:⚽ ÅIFK P11 Grön vs KäPa Ässät 🥅',
      'LOCATION:Brahenkenttä (Väiski) 🏟️',
      'DESCRIPTION:☕ Kahviovuoro (klo 14:30 - 16:00) ja ⏱️ Toimitsijavuoro.',
      'DTSTART:20260516T120000Z',
      'DTEND:20260516T133000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(emojiIcs, 'prof-1');
    expect(events.length).toBe(1);
    expect(events[0]?.title).toContain('ÅIFK P11 Grön vs KäPa Ässät');
    expect(events[0]?.volunteerDuty).toContain('Kahviovuoro');
  });

  // 5. Daylight Saving Time (DST) Transitions
  it('should handle Spring Forward DST transition (EET UTC+2 to EEST UTC+3 in March)', async () => {
    const springIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:dst-spring-1',
      'SUMMARY:Kevätkierros: HJK vs Honka',
      'DTSTART:20260329T100000Z', // 12:00 EET / 13:00 EEST
      'DTEND:20260329T113000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(springIcs, 'prof-1');
    expect(events.length).toBe(1);
    expect(new Date(events[0]!.startTime).getUTCFullYear()).toBe(2026);
    expect(new Date(events[0]!.startTime).getUTCMonth()).toBe(2); // March = 2
    expect(new Date(events[0]!.startTime).getUTCDate()).toBe(29);
  });

  it('should handle Autumn Fallback DST transition (EEST UTC+3 to EET UTC+2 in October)', async () => {
    const autumnIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:dst-autumn-1',
      'SUMMARY:Syyskierros: TiPS vs GrIFK',
      'DTSTART:20261025T110000Z',
      'DTEND:20261025T123000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(autumnIcs, 'prof-1');
    expect(events.length).toBe(1);
    expect(new Date(events[0]!.startTime).getUTCMonth()).toBe(9); // October = 9
    expect(new Date(events[0]!.startTime).getUTCDate()).toBe(25);
  });

  // 6. Leap year date handling
  it('should handle leap year dates (February 29) without parsing exception', async () => {
    const leapIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:leap-1',
      'SUMMARY:Karkauspäivän ottelu: KäPa vs Ilves',
      'DTSTART:20280229T140000Z',
      'DTEND:20280229T153000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(leapIcs, 'prof-1');
    expect(events.length).toBe(1);
    expect(new Date(events[0]!.startTime).getUTCFullYear()).toBe(2028);
    expect(new Date(events[0]!.startTime).getUTCDate()).toBe(29);
  });

  // 7. Midnight crossing events
  it('should handle events crossing midnight (start 23:30, end 01:00 next day)', async () => {
    const midnightIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:midnight-1',
      'SUMMARY:Yöturnaus: HJK vs Honka',
      'DTSTART:20260605T203000Z', // 23:30 Finnish time
      'DTEND:20260605T220000Z',   // 01:00 next day
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(midnightIcs, 'prof-1');
    expect(events.length).toBe(1);
    const start = new Date(events[0]!.startTime);
    const end = new Date(events[0]!.endTime);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  // 8. Overlapping and identical timestamps
  it('should handle multiple events occurring at identical start and end timestamps', async () => {
    const overlappingIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:same-time-1',
      'SUMMARY:Peli 1: HJK Sininen vs EPS',
      'DTSTART:20260516T120000Z',
      'DTEND:20260516T133000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:same-time-2',
      'SUMMARY:Peli 2: HJK Valkoinen vs Honka',
      'DTSTART:20260516T120000Z',
      'DTEND:20260516T133000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(overlappingIcs, 'prof-1');
    expect(events.length).toBe(2);
    expect(events[0]?.id).toBe('same-time-1');
    expect(events[1]?.id).toBe('same-time-2');
  });

  // 9. Multi-squad naming permutations
  it('should detect distinct squad groups in complex multi-squad feed', () => {
    const multiSquadIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:HJK T13 Sininen vs EPS',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:HJK T13 Valkoinen vs Honka',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:P12 Kilpa vs ErVi',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:P12 Haaste vs TiPS',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const squads = detectSquadGroups(multiSquadIcs);
    const names = squads.map((s) => s.squadName);
    expect(names).toContain('Sininen');
    expect(names).toContain('Valkoinen');
    expect(names).toContain('Kilpa');
    expect(names).toContain('Haaste');
  });

  it('should split shared ICS feed cleanly by squad name', () => {
    const multiSquadIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:sin-1',
      'SUMMARY:HJK T13 Sininen vs EPS',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:valk-1',
      'SUMMARY:HJK T13 Valkoinen vs Honka',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const sininenIcs = splitICSBySquad(multiSquadIcs, 'Sininen');
    expect(sininenIcs).toContain('HJK T13 Sininen');
    expect(sininenIcs).not.toContain('HJK T13 Valkoinen');
  });

  // 10. Talkoovahti Volunteer Duty Boundary Cases
  it('should extract volunteer duty with missing end time safely', () => {
    const duty = extractVolunteerDuty('Peli vs EPS', '☕ Kahviovuoro klo 14:30 alkaen');
    expect(duty).toBeDefined();
    expect(duty?.role).toBe('kahvio');
  });

  it('should extract volunteer duty across all 9 volunteer role categories', () => {
    expect(extractVolunteerDuty('Kahviovuoro klo 12-14')?.role).toBe('kahvio');
    expect(extractVolunteerDuty('Kirjuri ja kello klo 14-16')?.role).toBe('kello_kirjuri');
    expect(extractVolunteerDuty('Toimitsijavuoro klo 10-12')?.role).toBe('toimitsija');
    expect(extractVolunteerDuty('Järjestyksenvalvoja / liivimies')?.role).toBe('jarjestysmies');
    expect(extractVolunteerDuty('Kioskivuoro klo 11-13')?.role).toBe('kioski');
    expect(extractVolunteerDuty('Makkaranpaisto ja grilli')?.role).toBe('makkara');
    expect(extractVolunteerDuty('Striimaus ja ottelukuvaus')?.role).toBe('striimaus');
    expect(extractVolunteerDuty('EA-vuoro / ensiapupiste')?.role).toBe('ensiapu');
    expect(extractVolunteerDuty('Kyytivastaava ja kuski vieraspeliin')?.role).toBe('kyyti');
  });

  it('should return undefined when no volunteer duty keyword is present in text', () => {
    expect(extractVolunteerDuty('Normaali sarjaottelu', 'Muista juomapullo')).toBeUndefined();
  });

  // 11. Large feed stress test (500+ events)
  it('should parse 500+ events from a massive seasonal calendar feed within performance budget', async () => {
    let hugeIcs = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Massive//Test//FI\r\n';
    for (let i = 1; i <= 500; i++) {
      const uid = `mass-event-${i}`;
      hugeIcs += [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `SUMMARY:Match ${i}: HJK Sininen vs Opponent ${i}`,
        'LOCATION:Töölön Pallokenttä 1',
        'DTSTART:20260501T120000Z',
        'DTEND:20260501T133000Z',
        'END:VEVENT\r\n'
      ].join('\r\n');
    }
    hugeIcs += 'END:VCALENDAR';

    const t0 = performance.now();
    const events = await parseICSFeed(hugeIcs, 'prof-mass');
    const elapsed = performance.now() - t0;

    expect(events.length).toBe(500);
    expect(events[0]?.title).toBe('Match 1: HJK Sininen vs Opponent 1');
    expect(events[499]?.title).toBe('Match 500: HJK Sininen vs Opponent 500');
    expect(elapsed).toBeLessThan(1000); // 500 events parsed in under 1 second
  });

  // 12. Unescaped special characters & syntax
  it('should handle unescaped commas and semicolons in ICS text attributes', async () => {
    const unescapedIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:unesc-1',
      'SUMMARY:HJK\\, T13 Sininen vs EPS\\; Pelipaikka\\: Bubu',
      'LOCATION:Puotila TN\\, Helsinki',
      'DTSTART:20260516T120000Z',
      'DTEND:20260516T133000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = await parseICSFeed(unescapedIcs, 'prof-1');
    expect(events.length).toBe(1);
    expect(events[0]?.title).toContain('HJK');
  });

  // 13. Event classification corner cases
  it('should classify diverse Finnish event types accurately', () => {
    expect(classifyCalendarEvent('Vanhempainilta ja kausi-info')).toBe('meeting');
    expect(classifyCalendarEvent('Kauden päättäjäispalaveri')).toBe('meeting');
    expect(classifyCalendarEvent('Kutsuturnaus: Särkänniemi Cup 2026')).toBe('tournament');
    expect(classifyCalendarEvent('Pelitapahtuma / Miniliiga')).toBe('tournament');
    expect(classifyCalendarEvent('Fysiikkatreenit & Lihashuolto')).toBe('training');
    expect(classifyCalendarEvent('Aamujää ja taitoharjoitus')).toBe('training');
    expect(classifyCalendarEvent('Träningsmatch: IFK vs GrIFK')).toBe('match');
    expect(classifyCalendarEvent('Ottelu: VJS - PPJ (Kierros 4)')).toBe('match');
  });

  it('should parse match titles with nested round numbers and friendly flags', () => {
    const parsed1 = parseMatchTitle('Friendly: KäPa vs Ilves');
    expect(parsed1.isFriendly).toBe(true);
    expect(parsed1.homeTeam).toBe('KäPa');
    expect(parsed1.awayTeam).toBe('Ilves');

    const parsed2 = parseMatchTitle('Ottelu: VJS - PPJ (Kierros 4)');
    expect(parsed2.roundInfo).toBe('(Kierros 4)');
    expect(parsed2.homeTeam).toBe('VJS');
    expect(parsed2.awayTeam).toBe('PPJ');
  });
});
