import { describe, it, expect } from 'vitest';
import {
  detectSquadGroups,
  splitICSBySquad,
  parseICSFeed
} from '../../../src/lib/calendar/icsParser';
import { loadIcsFixture } from '../../helpers/fixtureLoader';

describe('Feature 10: Multi-Squad Feed Separation', () => {
  it('should detect distinct squad groups in shared Nimenhuuto calendar feed', () => {
    const icsContent = loadIcsFixture('nimenhuuto_hjk_multisquad.ics');
    const squads = detectSquadGroups(icsContent);

    expect(squads.length).toBeGreaterThanOrEqual(2);
    const names = squads.map((s) => s.squadName);
    expect(names).toContain('Sininen');
    expect(names).toContain('Valkoinen');
  });

  it('should filter ICS feed down to only Sininen squad events', () => {
    const icsContent = loadIcsFixture('nimenhuuto_hjk_multisquad.ics');
    const sininenICS = splitICSBySquad(icsContent, 'Sininen');

    expect(sininenICS).toContain('Sininen');
    expect(sininenICS).not.toContain('HJK T13 Valkoinen vs KäPa');
  });

  it('should filter ICS feed down to only Valkoinen squad events', () => {
    const icsContent = loadIcsFixture('nimenhuuto_hjk_multisquad.ics');
    const valkoinenICS = splitICSBySquad(icsContent, 'Valkoinen');

    expect(valkoinenICS).toContain('Valkoinen');
    expect(valkoinenICS).not.toContain('HJK T13 Sininen vs EPS');
  });

  it('should successfully parse isolated Sininen feed into clean MatchdayEvent list', async () => {
    const icsContent = loadIcsFixture('nimenhuuto_hjk_multisquad.ics');
    const sininenICS = splitICSBySquad(icsContent, 'Sininen');
    const events = await parseICSFeed(sininenICS, 'prof-sininen', 'football');

    expect(events.length).toBeGreaterThanOrEqual(2);
    // Should include Sininen match
    expect(events.some((e) => e.title.includes('HJK T13 Sininen vs EPS'))).toBe(true);
    // Should NOT include Valkoinen-only match
    expect(events.some((e) => e.title.includes('HJK T13 Valkoinen vs FC Espoo'))).toBe(false);
  });

  it('should handle multi-squad keywords such as Kilpa, Haaste, Musta, T1, T2', () => {
    const syntheticICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:ErVi P12 Kilpa vs Classic
DTSTART:20260502T100000Z
DTEND:20260502T113000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:ErVi P12 Haaste vs TiPS
DTSTART:20260502T120000Z
DTEND:20260502T133000Z
END:VEVENT
END:VCALENDAR`;

    const squads = detectSquadGroups(syntheticICS);
    const names = squads.map((s) => s.squadName);
    expect(names).toContain('Kilpa');
    expect(names).toContain('Haaste');

    const kilpaOnly = splitICSBySquad(syntheticICS, 'Kilpa');
    expect(kilpaOnly).toContain('Kilpa');
    expect(kilpaOnly).not.toContain('Haaste');
  });

  it('should extract CATEGORIES tags from Nimenhuuto feeds (Treenit, Peli kilpa, Peli haastaja)', () => {
    const nimenhuutoICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Westend Indians P14: Treenit 15:15-17:15
CATEGORIES:Treenit
DTSTART:20260824T121500Z
DTEND:20260824T141500Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Westend Indians P14: Mestareiden Cup
CATEGORIES:Peli kilpa
DTSTART:20260825T121500Z
DTEND:20260825T141500Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Westend Indians P14: Sarjapeli
CATEGORIES:Peli haastaja
DTSTART:20260826T121500Z
DTEND:20260826T141500Z
END:VEVENT
END:VCALENDAR`;

    const squads = detectSquadGroups(nimenhuutoICS);
    const names = squads.map((s) => s.squadName);
    expect(names).toContain('Kilpa');
    expect(names).toContain('Haastaja');

    const kilpaOnly = splitICSBySquad(nimenhuutoICS, 'Kilpa');
    expect(kilpaOnly).toContain('Peli kilpa');
    expect(kilpaOnly).not.toContain('Peli haastaja');
  });
});
