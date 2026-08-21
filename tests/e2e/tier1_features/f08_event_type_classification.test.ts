import { describe, it, expect } from 'vitest';
import { classifyCalendarEvent, isTrainingEvent } from '../../../src/lib/calendar/icsParser';

describe('Feature 8: Event Type Classification', () => {
  it('should classify league and friendly matches as match', () => {
    expect(classifyCalendarEvent('HJK vs Honka')).toBe('match');
    expect(classifyCalendarEvent('Sarjaottelu: VJS - PPJ')).toBe('match');
    expect(classifyCalendarEvent('Seriematch: IFK - GrIFK')).toBe('match');
    expect(classifyCalendarEvent('Friendly: KäPa vs Ilves')).toBe('match');
  });

  it('should classify Finnish training sessions (Harjoitukset, Treenit, Fysiikka, Lajivuoro, Aamujää, Träning) as training', () => {
    expect(classifyCalendarEvent('Lajiharjoitukset Bollis')).toBe('training');
    expect(classifyCalendarEvent('Fysiikkatreenit ja juoksu')).toBe('training');
    expect(classifyCalendarEvent('Aamujää & taitotreeni')).toBe('training');
    expect(classifyCalendarEvent('Lajivuoro / Säbä')).toBe('training');
    expect(classifyCalendarEvent('Träning på Väiski')).toBe('training');
  });

  it('should classify parent evenings and meetings (Vanhempainilta, Palaveri, Möte) as meeting', () => {
    expect(classifyCalendarEvent('Kauden Vanhempainilta')).toBe('meeting');
    expect(classifyCalendarEvent('Joukkuepalaveri ja kausisopimukset')).toBe('meeting');
    expect(classifyCalendarEvent('Valmentajapalaveri')).toBe('meeting');
    expect(classifyCalendarEvent('Föräldramöte')).toBe('meeting');
  });

  it('should classify tournaments and game events (Turnaus, Pelitapahtuma, Cup) as tournament', () => {
    expect(classifyCalendarEvent('Helsinki Cup Turnaus')).toBe('tournament');
    expect(classifyCalendarEvent('Pelitapahtuma Mosahalli')).toBe('tournament');
    expect(classifyCalendarEvent('Särkänniemi Turnering')).toBe('tournament');
    expect(classifyCalendarEvent('Kevätturnaus 2026')).toBe('tournament');
  });

  it('should correctly distinguish internal training games from external matches', () => {
    expect(isTrainingEvent('Harjoituspeli (sisäinen)')).toBe(true);
    expect(isTrainingEvent('HJK T13 vs EPS')).toBe(false);
    expect(isTrainingEvent('Treenit klo 17')).toBe(true);
    expect(isTrainingEvent('Kokoontuminen ja pelipalaveri')).toBe(true);
  });
});
