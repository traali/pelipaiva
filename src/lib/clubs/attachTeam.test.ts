import { describe, it, expect } from 'vitest';
import type { PlayerProfile } from '../../types/matchday';
import { findExistingTeamProfile, teamSourceKey, generateStableProfileId } from './attachTeam';

const simo: PlayerProfile = {
  id: 'p1',
  playerName: 'Simo',
  teamName: 'PPJ/Laru sin',
  sport: 'football',
  primaryColor: 'sininen',
  calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
  teamId: '185085',
  colorHex: '#3b82f6'
};

describe('attachTeam', () => {
  it('treats the same Palloliitto team page as one source', () => {
    expect(teamSourceKey('https://tulospalvelu.palloliitto.fi/team/185085/info')).toBe(
      teamSourceKey('https://tulospalvelu.palloliitto.fi/team/185085')
    );
  });

  it('does not attach a second copy of the same team to the same child', () => {
    const hit = findExistingTeamProfile(
      [simo],
      'Simo',
      'https://tulospalvelu.palloliitto.fi/team/185085/info'
    );
    expect(hit?.id).toBe('p1');
  });

  it('keeps Helsinki Cup distinct from the same team league page', () => {
    expect(
      teamSourceKey('https://tulospalvelu.palloliitto.fi/team/185085/info')
    ).not.toBe(
      teamSourceKey(
        'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
      )
    );
    const hit = findExistingTeamProfile(
      [simo],
      'Simo',
      'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
    );
    expect(hit).toBeUndefined();
  });

  it('allows a different cup/team on the same child', () => {
    const hit = findExistingTeamProfile(
      [simo],
      'Simo',
      'https://espooliikkuutournament.fi/team/203621'
    );
    expect(hit).toBeUndefined();
  });

  it("does not steal another child's team", () => {
    const hit = findExistingTeamProfile(
      [simo],
      'Aada',
      'https://tulospalvelu.palloliitto.fi/team/185085/info'
    );
    expect(hit).toBeUndefined();
  });

  it('generates consistent deterministic stable profile IDs', () => {
    const id1 = generateStableProfileId('Aada', 'https://espooliikkuutournament.fi/team/203621');
    const id2 = generateStableProfileId('  aada  ', 'https://espooliikkuutournament.fi/team/203621');
    expect(id1).toBe('p:aada:espooliikkuutournament.fi:203621');
    expect(id2).toBe(id1);

    const hcId = generateStableProfileId(
      'Simo',
      'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
    );
    expect(hcId).toBe('p:simo:tulospalvelu.palloliitto.fi:185085:hc2026');

    const kwId = generateStableProfileId(
      'Eemil',
      'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546'
    );
    expect(kwId).toContain('p:eemil:kwmemorialcup26.torneopal.fi:34013');
  });
});
