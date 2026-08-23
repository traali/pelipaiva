import { describe, it, expect } from 'vitest';
import {
  generateJoinWhatsApp,
  generateRosterDeltaWhatsApp,
  generateTalkooWhatsApp,
  parseFamilyWhatsAppMessage
} from './familyWhatsApp';
import {
  FIXTURE_1_JOIN,
  FIXTURE_2_ADD_CUP,
  FIXTURE_3_ADD_KW,
  FIXTURE_4_ADD_HELSINKI_CUP,
  FIXTURE_5_COACH_NOISE
} from './familyWhatsApp.examples';

describe('familyWhatsApp Synthetics & Parse-back', () => {
  it('Fixture 1: parses join WhatsApp message into familyCode PERHE-2', () => {
    const parsed = parseFamilyWhatsAppMessage(FIXTURE_1_JOIN);
    expect(parsed.type).toBe('join');
    expect(parsed.familyCode).toBe('PERHE-2');
  });

  it('Fixture 2: parses Espoo Liikkuu cup addition delta', () => {
    const parsed = parseFamilyWhatsAppMessage(FIXTURE_2_ADD_CUP);
    expect(parsed.type).toBe('delta');
    expect(parsed.playerName).toBe('Aada');
    expect(parsed.teamName).toBe('TOPOLA');
    expect(parsed.cupOrLeagueName).toBe('Espoo Liikkuu Tournament 2026');
    expect(parsed.url).toBe('https://espooliikkuutournament.fi/team/203621');
  });

  it('Fixture 3: parses KW Memorial delta with Torneopal query URL', () => {
    const parsed = parseFamilyWhatsAppMessage(FIXTURE_3_ADD_KW);
    expect(parsed.type).toBe('delta');
    expect(parsed.playerName).toBe('Eemil');
    expect(parsed.teamName).toBe('EräViikingit');
    expect(parsed.cupOrLeagueName).toBe('KW Memorial Cup 2026');
    expect(parsed.url).toContain('kwmemorialcup26.torneopal.fi');
  });

  it('Fixture 4: parses Helsinki Cup delta preserving raw season query', () => {
    const parsed = parseFamilyWhatsAppMessage(FIXTURE_4_ADD_HELSINKI_CUP);
    expect(parsed.type).toBe('delta');
    expect(parsed.playerName).toBe('Simo');
    expect(parsed.teamName).toBe('PPJ/Laru sin');
    expect(parsed.cupOrLeagueName).toBe('Helsinki Cup 2026');
    expect(parsed.url).toBe(
      'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
    );
  });

  it('Fixture 5: safely ignores coach noise and does not join', () => {
    const parsed = parseFamilyWhatsAppMessage(FIXTURE_5_COACH_NOISE);
    expect(parsed.type).toBe('none');
    expect(parsed.familyCode).toBeUndefined();
  });

  it('does not treat Crockford-illegal SAIMA-4 as a join code', () => {
    const parsed = parseFamilyWhatsAppMessage(
      'Pelipäivä-perhe SAIMA-4\nAvaa: https://pelipaiva.pages.dev/?perhe=SAIMA-4'
    );
    expect(parsed.type).toBe('none');
  });

  it('generates exact deterministic join and delta templates', () => {
    const join = generateJoinWhatsApp('PERHE-2');
    expect(join).toBe(FIXTURE_1_JOIN);

    const delta = generateRosterDeltaWhatsApp(
      'Aada',
      'TOPOLA',
      'Espoo Liikkuu Tournament 2026',
      'https://espooliikkuutournament.fi/team/203621'
    );
    expect(delta).toBe(FIXTURE_2_ADD_CUP);
  });

  it('generates talkoo summaries cleanly', () => {
    const talkoo = generateTalkooWhatsApp([
      { playerName: 'Simo', time: '09:45', role: 'Kahvio', venueName: 'Tapanilan Mosahalli' },
      { playerName: 'Aada', time: '10:30', role: 'Kellotus', venueName: 'Esport Center 2' }
    ]);
    expect(talkoo).toContain('Simo 09:45 Kahvio @ Tapanilan Mosahalli');
    expect(talkoo).toContain('Aada 10:30 Kellotus @ Esport Center 2');
  });
});
