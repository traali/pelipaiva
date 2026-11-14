import { describe, it, expect } from 'vitest';
import { honestTitle, matchHeading } from './eventTitle';

describe('cards never show parser placeholders as team names', () => {
  it('replaces "Oma joukkue vs Vastustaja"', () => {
    expect(honestTitle('Oma joukkue vs Vastustaja')).toBe('Peli – joukkueet ei tiedossa');
  });
  it('keeps the known side', () => {
    expect(honestTitle('ToPoLa vs Vastustaja')).toBe('ToPoLa – vastustaja ei tiedossa');
    expect(honestTitle('Oma joukkue vs HNMKY/Stadi')).toBe('Vastaan HNMKY/Stadi');
  });
  it('passes real titles through', () => {
    expect(honestTitle('TOPOLA vs LePy Oranssi')).toBe('TOPOLA vs LePy Oranssi');
    expect(honestTitle('Junioripelaajat: Open Gym')).toBe('Junioripelaajat: Open Gym');
  });
  it('builds the heading from sides', () => {
    expect(matchHeading({ homeTeam: 'TOPO/White', awayTeam: 'TOPOLA' })).toBe('TOPO/White vs TOPOLA');
    expect(matchHeading({ homeTeam: 'Oma joukkue', awayTeam: 'Vastustaja' })).toBe('Peli – joukkueet ei tiedossa');
  });
});
