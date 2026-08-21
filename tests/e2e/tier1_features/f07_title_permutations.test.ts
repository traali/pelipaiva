import { describe, it, expect } from 'vitest';
import { parseMatchTitle } from '../../../src/lib/calendar/icsParser';

describe('Feature 7: Complex Title Permutations', () => {
  it('should parse standard Finnish match title "HJK T13 Sininen vs EPS"', () => {
    const result = parseMatchTitle('HJK T13 Sininen vs EPS');

    expect(result.eventType).toBe('match');
    expect(result.homeTeam).toBe('HJK T13 Sininen');
    expect(result.awayTeam).toBe('EPS');
    expect(result.isHomeMatch).toBe(true);
  });

  it('should parse hyphenated title format with peli suffix "HJK-EPS peli"', () => {
    const result = parseMatchTitle('HJK-EPS peli');

    expect(result.eventType).toBe('match');
    expect(result.homeTeam).toBe('HJK');
    expect(result.awayTeam).toBe('EPS');
  });

  it('should extract embedded pitch location and away notation "Peli @ Bubu vs Honka"', () => {
    const result = parseMatchTitle('Peli @ Bubu vs Honka');

    expect(result.eventType).toBe('match');
    expect(result.embeddedVenueHint).toBe('Bubu');
  });

  it('should parse round details and prefixes "Ottelu: VJS - PPJ (Kierros 4)"', () => {
    const result = parseMatchTitle('Ottelu: VJS - PPJ (Kierros 4)');

    expect(result.eventType).toBe('match');
    expect(result.homeTeam).toBe('VJS');
    expect(result.awayTeam).toBe('PPJ');
    expect(result.roundInfo).toBe('(Kierros 4)');
  });

  it('should parse Swedish format "Seriematch: IFK - GrIFK" and friendly match "Friendly: KäPa vs Ilves"', () => {
    const swedish = parseMatchTitle('Seriematch: IFK - GrIFK');
    expect(swedish.eventType).toBe('match');
    expect(swedish.homeTeam).toBe('IFK');
    expect(swedish.awayTeam).toBe('GrIFK');

    const friendly = parseMatchTitle('Friendly: KäPa vs Ilves');
    expect(friendly.eventType).toBe('match');
    expect(friendly.isFriendly).toBe(true);
    expect(friendly.homeTeam).toBe('KäPa');
    expect(friendly.awayTeam).toBe('Ilves');
  });
});
