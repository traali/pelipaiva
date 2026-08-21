import { describe, it, expect } from 'vitest';
import {
  extractFixturesFromHtml,
  extractStandingsFromHtml,
  extractRosterFromHtml,
  fetchOfficialTeamData
} from '../../../src/lib/api/associationExtractor';
import { parseAssociationUrl } from '../../../src/lib/api/associationUrlParser';
import { loadHtmlFixture } from '../../helpers/fixtureLoader';
import { createMockFetch } from '../../helpers/mockFetch';

describe('Feature 5: Official Fixtures & Standings Ingestion', () => {
  it('should parse Palloliitto HTML fixture into structured official fixtures', () => {
    const html = loadHtmlFixture('palloliitto_team_page.html');
    const parsedUrl = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/60341')!;
    const fixtures = extractFixturesFromHtml(html, parsedUrl);

    expect(fixtures.length).toBeGreaterThanOrEqual(4);
    
    // First fixture played
    const f1 = fixtures[0]!;
    expect(f1.id).toBe('palloliitto_60341_spl-2026-099');
    expect(f1.homeTeam).toBe('HJK T13 Sininen');
    expect(f1.awayTeam).toBe('VJS');
    expect(f1.status).toBe('played');
    expect(f1.homeScore).toBe(4);
    expect(f1.awayScore).toBe(0);
    expect(f1.venueName).toBe('Bollis 6');

    // Upcoming fixture
    const f3 = fixtures[2]!;
    expect(f3.id).toBe('palloliitto_60341_spl-2026-101');
    expect(f3.status).toBe('upcoming');
    expect(f3.awayTeam).toBe('EPS');
    expect(f3.venueName).toContain('Bubu');
  });

  it('should parse Salibandyliitto HTML fixtures and scores', () => {
    const html = loadHtmlFixture('salibandy_team_page.html');
    const parsedUrl = parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/45210')!;
    const fixtures = extractFixturesFromHtml(html, parsedUrl);

    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    const f1 = fixtures[0]!;
    expect(f1.id).toBe('salibandy_45210_sb-2026-299');
    expect(f1.homeTeam).toBe('TPS Salibandy');
    expect(f1.awayTeam).toBe('EräViikingit Musta');
    expect(f1.status).toBe('played');
    expect(f1.homeScore).toBe(3);
    expect(f1.awayScore).toBe(6);
  });

  it('should extract league standings rows accurately from Palloliitto and Basket.fi HTML', () => {
    const palloHtml = loadHtmlFixture('palloliitto_team_page.html');
    const palloStandings = extractStandingsFromHtml(palloHtml);
    expect(palloStandings.length).toBe(5);
    expect(palloStandings[0]?.teamName).toBe('HJK T13 Sininen');
    expect(palloStandings[0]?.rank).toBe(1);
    expect(palloStandings[0]?.points).toBe(6);

    const basketHtml = loadHtmlFixture('basket_fi_team_page.html');
    const basketStandings = extractStandingsFromHtml(basketHtml);
    expect(basketStandings.length).toBe(3);
    expect(basketStandings[0]?.teamName).toBe('Tapiolan Honka Green');
    expect(basketStandings[0]?.rank).toBe(1);
  });

  it('should extract player squad rosters with jersey numbers and positions', () => {
    const html = loadHtmlFixture('palloliitto_team_page.html');
    const roster = extractRosterFromHtml(html);

    expect(roster).toBeDefined();
    expect(roster?.players.length).toBe(5);
    expect(roster?.players[0]?.jerseyNumber).toBe(1);
    expect(roster?.players[0]?.playerName).toBe('Emma Lahtinen');
    expect(roster?.players[0]?.position).toBe('GK');

    const captain = roster?.players.find((p) => p.isCaptain);
    expect(captain).toBeDefined();
    expect(captain?.playerName).toBe('Aada Virtanen');
  });

  it('should fetch and assemble complete OfficialTeamData via fetchOfficialTeamData with mock fetch', async () => {
    const mockFetch = createMockFetch();
    const parsedUrl = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123')!;
    const data = await fetchOfficialTeamData(parsedUrl, mockFetch as unknown as typeof fetch);

    expect(data.teamId).toBe('88123');
    expect(data.association).toBe('torneopal');
    expect(data.sport).toBe('volleyball');
    expect(data.fixtures.length).toBeGreaterThanOrEqual(3);
    expect(data.fixtures[0]?.setScores).toEqual(['25-22', '23-25', '25-18', '25-20']);
    expect(data.standings).toBeDefined();
    expect(data.roster).toBeDefined();
  });
});
