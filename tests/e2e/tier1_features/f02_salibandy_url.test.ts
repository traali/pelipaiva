import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  detectAssociationType,
  normalizeAssociationUrl
} from '../../../src/lib/api/associationUrlParser';

describe('Feature 2: Salibandyliitto Team URL Parser', () => {
  it('should parse valid Salibandyliitto team URL with sport floorball and association salibandy', () => {
    const url = 'https://tulospalvelu.salibandy.fi/team/45210';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.association).toBe('salibandy');
    expect(parsed?.sport).toBe('floorball');
    expect(parsed?.teamId).toBe('45210');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.salibandy.fi/team/45210');
  });

  it('should extract series, season, and tab query parameters', () => {
    const url = 'https://tulospalvelu.salibandy.fi/team/45210/ottelut?series=P12Kilpa&season=2026&tab=sarjataulukko';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('45210');
    expect(parsed?.seasonId).toBe('2026');
    expect(parsed?.leagueId).toBe('P12Kilpa');
    expect(parsed?.tab).toBe('sarjataulukko');
  });

  it('should handle variations with www, http, and trailing slashes', () => {
    const url = 'http://www.tulospalvelu.salibandy.fi/team/88771/';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('88771');
    expect(parsed?.sport).toBe('floorball');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.salibandy.fi/team/88771');
  });

  it('should reject non-team Salibandy URLs such as series, player, or club pages', () => {
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/series/1001')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/match/sb-2026-101')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/club/erv')).toBeNull();
    expect(parseAssociationUrl('https://salibandy.fi/fi/uutiset/')).toBeNull();
  });

  it('should detect association type and normalize URL correctly for Salibandy', () => {
    const url = 'https://tulospalvelu.salibandy.fi/team/45210';
    expect(detectAssociationType(url)).toBe('salibandy');
    expect(normalizeAssociationUrl(url)).toBe('https://tulospalvelu.salibandy.fi/team/45210');
  });
});
