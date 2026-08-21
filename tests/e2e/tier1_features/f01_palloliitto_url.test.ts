import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  detectAssociationType,
  normalizeAssociationUrl
} from '../../../src/lib/api/associationUrlParser';

describe('Feature 1: Palloliitto Team URL Parser', () => {
  it('should parse standard Palloliitto team URL with numeric teamId', () => {
    const url = 'https://tulospalvelu.palloliitto.fi/team/60341';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.association).toBe('palloliitto');
    expect(parsed?.sport).toBe('football');
    expect(parsed?.teamId).toBe('60341');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.palloliitto.fi/team/60341');
  });

  it('should extract query parameters and subpaths while generating canonical URL', () => {
    const url = 'https://tulospalvelu.palloliitto.fi/team/60341/fixtures?season=2026&category=T13&tab=matches';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('60341');
    expect(parsed?.seasonId).toBe('2026');
    expect(parsed?.leagueId).toBe('T13');
    expect(parsed?.tab).toBe('matches');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.palloliitto.fi/team/60341');
  });

  it('should handle protocol-less and http URLs with whitespace trimming', () => {
    const raw = '   tulospalvelu.palloliitto.fi/team/12345/players   ';
    const parsed = parseAssociationUrl(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('12345');
    expect(parsed?.sport).toBe('football');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.palloliitto.fi/team/12345');
  });

  it('should reject invalid Palloliitto non-team URLs and arbitrary domains', () => {
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/club/12345')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/match/spl-999')).toBeNull();
    expect(parseAssociationUrl('https://palloliitto.fi/uutiset/artikkeli')).toBeNull();
    expect(parseAssociationUrl('https://google.com/team/60341')).toBeNull();
    expect(parseAssociationUrl('')).toBeNull();
  });

  it('should parse modern Palloliitto team info URLs (e.g. 185085, 185083, 185086)', () => {
    const urls = [
      'https://tulospalvelu.palloliitto.fi/team/185085/info',
      'https://tulospalvelu.palloliitto.fi/team/185083/info',
      'https://tulospalvelu.palloliitto.fi/team/185086/info'
    ];

    for (const url of urls) {
      const parsed = parseAssociationUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.association).toBe('palloliitto');
      expect(parsed?.sport).toBe('football');
      expect(parsed?.tab).toBe('info');
      expect(['185085', '185083', '185086']).toContain(parsed?.teamId);
      expect(parsed?.canonicalUrl).toBe(`https://tulospalvelu.palloliitto.fi/team/${parsed?.teamId}`);
    }
  });

  it('should detect association type and canonical normalize string correctly', () => {
    const url = 'https://tulospalvelu.palloliitto.fi/team/60341';
    expect(detectAssociationType(url)).toBe('palloliitto');
    expect(normalizeAssociationUrl(url)).toBe('https://tulospalvelu.palloliitto.fi/team/60341');
    expect(detectAssociationType('https://random.fi/team/123')).toBeNull();
    expect(normalizeAssociationUrl('https://random.fi/team/123')).toBeNull();
  });
});
