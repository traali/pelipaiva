import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  detectAssociationType,
  normalizeAssociationUrl
} from '../../../src/lib/api/associationUrlParser';

describe('Feature 4: Torneopal Team URL Parser', () => {
  it('should parse valid Torneopal team URL and extract subdomain and teamId', () => {
    const url = 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.association).toBe('torneopal');
    expect(parsed?.sport).toBe('volleyball');
    expect(parsed?.subdomain).toBe('lentopallo');
    expect(parsed?.teamId).toBe('88123');
    expect(parsed?.canonicalUrl).toBe('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123');
  });

  it('should detect multi-sport based on Torneopal subdomain (futsal, floorball, basket)', () => {
    const futsal = parseAssociationUrl('https://futsal.torneopal.fi/taso/joukkue.php?joukkue=123');
    expect(futsal?.sport).toBe('futsal');

    const floorball = parseAssociationUrl('https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=456');
    expect(floorball?.sport).toBe('floorball');

    const basket = parseAssociationUrl('https://kori.torneopal.fi/taso/joukkue.php?joukkue=789');
    expect(basket?.sport).toBe('basketball');

    const football = parseAssociationUrl('https://splhelsinki.torneopal.fi/taso/joukkue.php?joukkue=999');
    expect(football?.sport).toBe('football');
  });

  it('should support team and team_id parameter aliases', () => {
    const p1 = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?team=88123');
    expect(p1?.teamId).toBe('88123');

    const p2 = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?team_id=88123');
    expect(p2?.teamId).toBe('88123');
  });

  it('should reject non-team Torneopal URLs missing team ID parameter', () => {
    expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/sarja.php?sarja=123')).toBeNull();
    expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/ottelu.php?ottelu=tp-999')).toBeNull();
    expect(parseAssociationUrl('https://torneopal.fi/etusivu')).toBeNull();
  });

  it('should detect association type and normalize URL correctly for Torneopal', () => {
    const url = 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123';
    expect(detectAssociationType(url)).toBe('torneopal');
    expect(normalizeAssociationUrl(url)).toBe('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123');
  });
});
