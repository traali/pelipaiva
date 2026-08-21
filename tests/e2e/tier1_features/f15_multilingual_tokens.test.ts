import { describe, it, expect } from 'vitest';
import {
  normalizeTeamName,
  calculateTeamSimilarity,
  MULTILINGUAL_COLORS,
  CLUB_ALIASES
} from '../../../src/lib/reconciliation/teamNameMatcher';

describe('Feature 15: Multilingual & Alias Token Normalizer', () => {
  it('should normalize multilingual colors (Finnish, Swedish, English) to canonical tokens', () => {
    expect(normalizeTeamName('HJK T13 Sininen').color).toBe('sininen');
    expect(normalizeTeamName('HJK T13 Blå').color).toBe('sininen');
    expect(normalizeTeamName('HJK T13 Blue').color).toBe('sininen');

    expect(normalizeTeamName('KäPa Valkoinen').color).toBe('valkoinen');
    expect(normalizeTeamName('KäPa Vit').color).toBe('valkoinen');
    expect(normalizeTeamName('KäPa White').color).toBe('valkoinen');

    expect(normalizeTeamName('ErVi Musta').color).toBe('musta');
    expect(normalizeTeamName('ErVi Svart').color).toBe('musta');
    expect(normalizeTeamName('ErVi Black').color).toBe('musta');
  });

  it('should normalize age group tokens across standard Finnish formats (T13, P11, F08, U14, B-pojat)', () => {
    expect(normalizeTeamName('HJK T13 Sininen').ageGroup).toBe('T13');
    expect(normalizeTeamName('KäPa P11 Musta').ageGroup).toBe('P11');
    expect(normalizeTeamName('GrIFK F08 Grön').ageGroup).toBe('F08');
    expect(normalizeTeamName('Honka U14 Green').ageGroup).toBe('U14');
  });

  it('should resolve Finnish club abbreviations via alias dictionary (HJK, KäPa, GrIFK, ErVi, TiPS, VJS)', () => {
    expect(normalizeTeamName('Helsingin Jalkapalloklubi').club).toBe('hjk');
    expect(normalizeTeamName('Käpylän Pallo').club).toBe('käpa');
    expect(normalizeTeamName('Grankulla IFK').club).toBe('grifk');
    expect(normalizeTeamName('EräViikingit ry').club).toBe('ervi');
    expect(normalizeTeamName('Tikkurilan Palloseura').club).toBe('tips');
    expect(normalizeTeamName('Vantaan Jalkapalloseura').club).toBe('vjs');
  });

  it('should score high similarity for equivalent multilingual and abbreviated names', () => {
    const sim1 = calculateTeamSimilarity('HJK T13 Sininen', 'Helsingin Jalkapalloklubi T13 Blue');
    expect(sim1).toBeGreaterThanOrEqual(0.85);

    const sim2 = calculateTeamSimilarity('ErVi P12 Musta', 'EräViikingit P12 Svart');
    expect(sim2).toBeGreaterThanOrEqual(0.85);

    const sim3 = calculateTeamSimilarity('Honka U14', 'Tapiolan Honka U14 Green');
    expect(sim3).toBeGreaterThanOrEqual(0.80);
  });

  it('should score lower similarity between different squad colors or distinct clubs', () => {
    const diffSquad = calculateTeamSimilarity('HJK T13 Sininen', 'HJK T13 Valkoinen');
    expect(diffSquad).toBeLessThan(0.85);

    const diffClub = calculateTeamSimilarity('HJK T13 Sininen', 'KäPa T13 Sininen');
    expect(diffClub).toBeLessThan(0.60);
  });
});
