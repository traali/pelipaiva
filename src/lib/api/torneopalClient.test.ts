import { describe, it, expect } from 'vitest';
import {
  buildGetMatchesParams,
  isTorneopalCompetitionId,
  looksLikeCupRequest,
  mapFixture,
  shouldTryAssociationEndpoint
} from './torneopalClient';
import type { ParsedAssociationUrl } from '../../types/matchday';

const espoo: ParsedAssociationUrl = {
  sport: 'basketball',
  association: 'basket',
  teamId: '203621',
  seasonId: 'esli2026',
  canonicalUrl: 'https://espooliikkuutournament.fi/team/203621'
};

const league: ParsedAssociationUrl = {
  sport: 'football',
  association: 'palloliitto',
  teamId: '185085',
  canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/185085'
};

const kw: ParsedAssociationUrl = {
  sport: 'floorball',
  association: 'torneopal',
  teamId: '34013',
  subdomain: 'kwmemorialcup26',
  seasonId: 'EräViikingit_0005',
  leagueId: '2546',
  canonicalUrl: 'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013'
};

describe('torneopal match params', () => {
  it('does not send cup subdomain team ids to tupa (ids collide across federations)', () => {
    expect(shouldTryAssociationEndpoint('kwmemorialcup26')).toBe(false);
    expect(shouldTryAssociationEndpoint('spl')).toBe(true);
    expect(shouldTryAssociationEndpoint(undefined)).toBe(true);
  });

  it('accepts compact competition ids and rejects turnaus slugs', () => {
    expect(isTorneopalCompetitionId('hc2026')).toBe(true);
    expect(isTorneopalCompetitionId('esli2026')).toBe(true);
    expect(isTorneopalCompetitionId('EräViikingit_0005')).toBe(false);
  });

  it('does not clip cup getMatches to −21/+90 and does not send slug competition_id', () => {
    expect(looksLikeCupRequest(espoo)).toBe(true);
    const cup = buildGetMatchesParams(espoo);
    expect(cup.start_date).toBeUndefined();
    expect(cup.competition_id).toBe('esli2026');

    const kwParams = buildGetMatchesParams(kw);
    expect(kwParams.start_date).toBeUndefined();
    expect(kwParams.competition_id).toBe('EräViikingit_0005');
    expect(kwParams.category_id).toBe('2546');
    expect(kwParams.per_page).toBe('100');

    const leagueParams = buildGetMatchesParams(league);
    expect(leagueParams.start_date).toBeDefined();
    expect(leagueParams.end_date).toBeDefined();
  });

  it('keeps Helsinki Cup season and B13-8 category on getMatches', () => {
    const hc: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '185085',
      seasonId: 'hc2026',
      leagueId: 'B13-8',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/185085?season=hc2026&category=B13-8'
    };
    expect(looksLikeCupRequest(hc)).toBe(true);
    const params = buildGetMatchesParams(hc);
    expect(params.competition_id).toBe('hc2026');
    expect(params.category_id).toBe('B13-8');
    expect(params.start_date).toBeUndefined();
  });

  it('maps match_number and stage from live Torneopal fields', () => {
    const fixture = mapFixture(
      {
        team_A_name: 'LINKKI',
        team_B_name: 'TOPOLA',
        status: 'Played',
        fs_A: '9',
        fs_B: '45',
        date: '2026-08-23',
        time: '17:20:00',
        venue_name: 'Esport Center 2',
        venue_lat: '60.175962',
        venue_lon: '24.782342',
        match_id: 'm1055',
        match_number: '1055',
        stage: 'alku',
        group_name: '1-4',
        competition_name: 'Espoo liikkuu Tournament 2026',
        playing_time_min: '60'
      },
      espoo,
      'TOPOLA'
    );
    expect(fixture?.matchNumber).toBe('1055');
    expect(fixture?.stage).toBe('alku');
    expect(fixture?.score).toBe('9–45');
    expect(fixture?.isHome).toBe(false);
  });
});
