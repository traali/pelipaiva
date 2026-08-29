import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  detectAssociationType,
  normalizeAssociationUrl
} from '../../../src/lib/api/associationUrlParser';

describe('Feature 3: Basket.fi Team URL Parser', () => {
  it('should parse standard Basket.fi query-parameter team URL', () => {
    const url = 'https://basket.fi/basket/sarjat/joukkue/?team_id=12894';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.association).toBe('basket');
    expect(parsed?.sport).toBe('basketball');
    expect(parsed?.teamId).toBe('12894');
    expect(parsed?.canonicalUrl).toBe('https://basket.fi/basket/sarjat/joukkue/?team_id=12894');
  });

  it('should parse Basket.fi URL with extra query params (season_id, league_id)', () => {
    const url = 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=12894&season_id=125433&league_id=4';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('12894');
    expect(parsed?.seasonId).toBe('125433');
    expect(parsed?.leagueId).toBe('4');
    expect(parsed?.canonicalUrl).toBe('https://basket.fi/basket/sarjat/joukkue/?team_id=12894');
  });

  it('should parse joukkue_id alias and alternative path format /joukkue/{teamId}', () => {
    const url1 = 'https://basket.fi/basket/sarjat/joukkue/?joukkue_id=98765';
    const parsed1 = parseAssociationUrl(url1);
    expect(parsed1?.teamId).toBe('98765');

    const url2 = 'basket.fi/joukkue/98765';
    const parsed2 = parseAssociationUrl(url2);
    expect(parsed2?.teamId).toBe('98765');
  });

  it('should reject invalid Basket.fi URLs missing team_id parameter or non-team paths', () => {
    expect(parseAssociationUrl('https://basket.fi/basket/sarjat/sarja/?league_id=4')).toBeNull();
    expect(parseAssociationUrl('https://basket.fi/basket/uutiset/artikkeli/')).toBeNull();
    expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/')).toBeNull();
  });

  it('should parse modern tulospalvelu.basket.fi team info URL (e.g. team 5756346)', () => {
    const url = 'https://tulospalvelu.basket.fi/team/5756346/info';
    const parsed = parseAssociationUrl(url);

    expect(parsed).not.toBeNull();
    expect(parsed?.association).toBe('basket');
    expect(parsed?.sport).toBe('basketball');
    expect(parsed?.teamId).toBe('5756346');
    expect(parsed?.tab).toBe('info');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.basket.fi/team/5756346');
  });

  it('should parse tulospalvelu.basket.fi fixture tab as the same team', () => {
    const parsed = parseAssociationUrl('https://tulospalvelu.basket.fi/team/5756346/fixture');
    expect(parsed?.teamId).toBe('5756346');
    expect(parsed?.tab).toBe('fixture');
    expect(parsed?.association).toBe('basket');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.basket.fi/team/5756346');
  });

  it('should detect association type and normalize URL correctly for Basket.fi', () => {
    const url = 'https://basket.fi/basket/sarjat/joukkue/?team_id=12894';
    expect(detectAssociationType(url)).toBe('basket');
    expect(normalizeAssociationUrl(url)).toBe('https://basket.fi/basket/sarjat/joukkue/?team_id=12894');
  });
});
