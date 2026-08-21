import { describe, it, expect } from 'vitest';
import { extractVolunteerDuty, parseICSFeed } from '../../../src/lib/calendar/icsParser';
import { loadIcsFixture } from '../../helpers/fixtureLoader';

describe('Feature 11: Talkoovahti Volunteer Duty Windows', () => {
  it('should extract Kahviovuoro with exact time window from summary and description', () => {
    const summary = 'Kotiturnaus Mosahalli';
    const description = 'Talkootehtävät: Kahviovuoro klo 14:30 - 16:00 (Maijan vanhemmat).';

    const duty = extractVolunteerDuty(summary, description);

    expect(duty).toBeDefined();
    expect(duty?.role).toBe('kahvio');
    expect(duty?.timeWindow).toBe('klo 14:30 - 16:00');
    expect(duty?.dutyTag).toBe('☕ Kahviovuoro (klo 14:30 - 16:00)');
  });

  it('should extract Toimitsijavuoro and Kirjuri/Kello duties', () => {
    const duty1 = extractVolunteerDuty('Salibandypeli', 'Toimitsijavuoro klo 11.00 - 12.30');
    expect(duty1?.role).toBe('toimitsija');
    expect(duty1?.timeWindow).toBe('klo 11:00 - 12:30');

    const duty2 = extractVolunteerDuty('Ottelu vs TPS', 'Pöytäkirja ja kirjuri/kello vuoro klo 13:00 - 14:30');
    expect(duty2?.role).toBe('kello_kirjuri');
  });

  it('should extract Järjestyksenvalvoja (Järkkäri/Liivimies) and Makkaranpaisto duties', () => {
    const jarkkari = extractVolunteerDuty('HJK vs Honka', 'Järkkärivuoro / Liivimies klo 14:00 - 16:30 kentällä.');
    expect(jarkkari?.role).toBe('jarjestysmies');
    expect(jarkkari?.dutyTag).toContain('Järjestyksenvalvoja');

    const makkara = extractVolunteerDuty('Turnauspäivä', 'Makkaranpaisto ja grilli klo 10:00 - 12:00');
    expect(makkara?.role).toBe('makkara');
    expect(makkara?.dutyTag).toContain('Makkaranpaisto');
  });

  it('should extract volunteer duties from real-world MyClub Talkoovahti ICS feed', async () => {
    const icsContent = loadIcsFixture('myclub_ervi_talkoovahti.ics');
    const events = await parseICSFeed(icsContent, 'prof-ervi', 'floorball');

    expect(events.length).toBeGreaterThanOrEqual(1);
    const eventWithDuty = events.find((e) => e.volunteerDuty !== undefined);
    expect(eventWithDuty).toBeDefined();
    expect(eventWithDuty?.volunteerDuty).toMatch(/(☕|⏱️|📝|🦺|🍿|🌭)/);
  });

  it('should return undefined when no volunteer duties are present in event', () => {
    const duty = extractVolunteerDuty('Normaali treeni', 'Muista juomapullo ja sisäpelikengät.');
    expect(duty).toBeUndefined();
  });
});
