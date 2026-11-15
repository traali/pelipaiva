import { describe, it, expect } from 'vitest';
import { detectSportFromText } from '../../src/lib/ai/eventCandidateRanker';
import { parseMatchTitle, parseICSFeed, sideMatchesOwnTeam } from '../../src/lib/calendar/icsParser';
import { sportFromTaso, mapFixture } from '../../src/lib/api/torneopalClient';
import type { ParsedAssociationUrl } from '../../src/types/matchday';
import { stitchCalendarEventsWithFixtures } from '../../src/lib/reconciliation/reconciliationEngine';
import { harmonizeStartupSports } from '../../src/lib/sport/startupHarmonizer';
import {
  mergeRosters,
  retractTombstonesForReadd,
  canonicalAssociationProfileId
} from '../../src/lib/sync/familyCloud';
import { generateStableProfileId, readdProfileIds } from '../../src/lib/clubs/attachTeam';
import type { MatchdayEvent, PlayerProfile } from '../../src/types/matchday';
import type { FamilyRosterV1 } from '../../src/lib/sync/familyCloud';

const parsedFootball: ParsedAssociationUrl = {
  sport: 'football',
  association: 'palloliitto',
  teamId: '35224455',
  canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/35224455'
};

function ev(partial: Partial<MatchdayEvent> & Pick<MatchdayEvent, 'id' | 'title' | 'startTime'>): MatchdayEvent {
  return {
    profileId: 'p:test',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    homeTeam: '',
    awayTeam: '',
    isHomeMatch: true,
    endTime: partial.startTime,
    ...partial
  } as MatchdayEvent;
}

describe('Winterliiga and official football sport', () => {
  it('detects Winterliiga as football, not futsal', () => {
    expect(detectSportFromText('PPJ Laru 2013: WINTERLIIGA - ORANSSI')).toBe('football');
    expect(detectSportFromText('Winterliiga 2026–2027')).toBe('football');
  });

  it('keeps a real futsal title as futsal', () => {
    expect(detectSportFromText('PPJ Laru 2013: Futsal - Oranssi')).toBe('futsal');
  });

  it('uses TASO sport_id and Winterliiga competition as football', () => {
    expect(
      sportFromTaso(parsedFootball, {
        sport_id: 'football',
        competition_name: 'Winterliiga 2026–2027',
        category_name: 'Pojat C14 (2013) Harraste'
      })
    ).toBe('football');
    expect(
      sportFromTaso({ ...parsedFootball, sport: 'futsal' }, { competition_name: 'Winterliiga 2026–2027' })
    ).toBe('football');
  });

  it('maps the official 15.11 Oranssi Winterliiga fixture as football', () => {
    const fixture = mapFixture(
      {
        date: '2026-11-15',
        time: '15:00:00',
        time_end: '16:00:00',
        team_A_name: 'PPJ/Laru Oranssi',
        team_B_name: 'HJS/Sininen',
        team_A_id: '35224455',
        team_B_id: '35229296',
        venue_name: 'Pikkupekka Areena',
        competition_id: 'kapa_0025',
        competition_name: 'Winterliiga 2026–2027',
        category_name: 'Pojat C14 (2013) Harraste',
        sport_id: 'football',
        status: 'Fixture',
        match_id: '4379327'
      },
      parsedFootball,
      'PPJ/Laru Oranssi'
    );
    expect(fixture?.sport).toBe('football');
    expect(fixture?.isHome).toBe(true);
    expect(fixture?.leagueName).toContain('Winterliiga');
  });

  it('heals a stored official Winterliiga/futsal-labelled fixture back to football', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p:simo:tulospalvelu.palloliitto.fi:35224455',
        playerName: 'Simo',
        teamName: 'PPJ/Laru Oranssi',
        sport: 'football',
        primaryColor: 'oranssi',
        colorHex: '#f97316'
      }
    ];
    const events: MatchdayEvent[] = [
      ev({
        id: 'fixture-p:simo:tulospalvelu.palloliitto.fi:35224455-4379327',
        profileId: profiles[0]!.id,
        title: 'PPJ/Laru Oranssi vs HJS/Sininen',
        sport: 'futsal',
        leagueName: 'Winterliiga 2026–2027',
        startTime: '2026-11-15T13:00:00.000Z',
        homeTeam: 'PPJ/Laru Oranssi',
        awayTeam: 'HJS/Sininen'
      })
    ];
    const result = harmonizeStartupSports(profiles, events);
    expect(result.eventUpdates.find((u) => u.id === events[0]!.id)?.updates.sport).toBe('football');
  });

  it('heals the live 15.11 official card even when leagueName was never stored', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p:simo:tulospalvelu.palloliitto.fi:35224455',
        playerName: 'Simo',
        teamName: 'PPJ/Laru Oranssi',
        sport: 'football',
        primaryColor: 'oranssi',
        colorHex: '#f97316'
      }
    ];
    const events: MatchdayEvent[] = [
      ev({
        id: 'fixture-p:simo:tulospalvelu.palloliitto.fi:35224455-palloliitto_35224455_4379327',
        profileId: profiles[0]!.id,
        officialFixtureId: 'palloliitto_35224455_4379327',
        title: 'PPJ/Laru Oranssi vs HJS/Sininen',
        sport: 'futsal',
        startTime: '2026-11-15T13:00:00.000Z',
        endTime: '2026-11-15T14:00:00.000Z',
        homeTeam: 'PPJ/Laru Oranssi',
        awayTeam: 'HJS/Sininen',
        venue: { name: 'Pikkupekka Areena' }
      })
    ];
    const result = harmonizeStartupSports(profiles, events);
    expect(result.eventUpdates.find((u) => u.id === events[0]!.id)?.updates.sport).toBe('football');
  });
});

describe('MyClub Winterliiga merges with the official game', () => {
  it('stitches a WINTERLIIGA – ORANSSI calendar row onto the official 15:00 fixture', () => {
    const cal = ev({
      id: 'ics-winter-oranssi',
      title: 'PPJ Laru 2013: WINTERLIIGA - ORANSSI',
      sport: 'football',
      homeTeam: 'PPJ Laru 2013 ORANSSI',
      awayTeam: '',
      startTime: '2026-11-15T12:30:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' }
    });
    const fix = ev({
      id: 'fixture-oranssi-4379327',
      officialFixtureId: 'palloliitto_35224455_4379327',
      title: 'PPJ/Laru Oranssi vs HJS/Sininen',
      sport: 'football',
      homeTeam: 'PPJ/Laru Oranssi',
      awayTeam: 'HJS/Sininen',
      startTime: '2026-11-15T13:00:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' }
    });
    const stitched = stitchCalendarEventsWithFixtures([cal, fix]);
    expect(stitched.filter((e) => !e.isHidden).length).toBe(1);
    const card = stitched.find((e) => e.id === cal.id)!;
    expect(card.startTime).toBe(fix.startTime);
    expect(card.homeTeam).toBe('PPJ/Laru Oranssi');
    expect(card.awayTeam).toBe('HJS/Sininen');
    expect(card.officialFixtureId).toBe(fix.officialFixtureId);
    expect(stitched.some((e) => e.id === fix.id)).toBe(false);
  });

  it('merges the live 14:30 MyClub WINTERLIIGA card into the 15:00 official game even if the official card is still labelled futsal', () => {
    const official = ev({
      id: 'fixture-p:simo:tulospalvelu.palloliitto.fi:35224455-palloliitto_35224455_4379327',
      officialFixtureId: 'palloliitto_35224455_4379327',
      title: 'PPJ/Laru Oranssi vs HJS/Sininen',
      sport: 'futsal',
      homeTeam: 'PPJ/Laru Oranssi',
      awayTeam: 'HJS/Sininen',
      startTime: '2026-11-15T13:00:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' }
    });
    const winter = ev({
      id: 'ics-winter-oranssi',
      title: 'PPJ Laru 2013: WINTERLIIGA - ORANSSI',
      sport: 'football',
      homeTeam: 'PPJ Laru 2013 ORANSSI',
      awayTeam: '',
      startTime: '2026-11-15T12:30:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' }
    });
    const futsal = ev({
      id: 'ics-futsal-oranssi',
      title: 'PPJ Laru 2013: Futsal - Oranssi',
      sport: 'futsal',
      homeTeam: 'PPJ Laru 2013 Oranssi',
      awayTeam: '',
      startTime: '2026-11-15T10:45:00.000Z',
      endTime: '2026-11-15T12:00:00.000Z'
    });
    const stitched = stitchCalendarEventsWithFixtures([winter, official, futsal]);
    const visible = stitched.filter((e) => !e.isHidden);
    expect(visible).toHaveLength(2);
    const card = visible.find((e) => e.id === winter.id)!;
    expect(card.startTime).toBe(official.startTime);
    expect(card.endTime).toBe(official.endTime);
    expect(card.sport).toBe('football');
    expect(card.officialFixtureId).toBe(official.officialFixtureId);
    expect(card.homeTeam).toBe('PPJ/Laru Oranssi');
    expect(card.awayTeam).toBe('HJS/Sininen');
    expect(visible.some((e) => e.id === official.id)).toBe(false);
    const futsalCard = visible.find((e) => e.id === futsal.id)!;
    expect(futsalCard.sport).toBe('futsal');
    expect(futsalCard.startTime).toBe(futsal.startTime);
    expect(futsalCard.officialFixtureId).toBeFalsy();
  });

  it('still keeps the 12:45 Futsal card separate after the official card is healed to football', () => {
    const official = ev({
      id: 'fixture-p:simo:tulospalvelu.palloliitto.fi:35224455-palloliitto_35224455_4379327',
      officialFixtureId: 'palloliitto_35224455_4379327',
      title: 'PPJ/Laru Oranssi vs HJS/Sininen',
      sport: 'football',
      homeTeam: 'PPJ/Laru Oranssi',
      awayTeam: 'HJS/Sininen',
      startTime: '2026-11-15T13:00:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' }
    });
    const winter = ev({
      id: 'ics-winter-oranssi',
      title: 'PPJ Laru 2013: WINTERLIIGA - ORANSSI',
      sport: 'football',
      homeTeam: 'PPJ Laru 2013 ORANSSI',
      awayTeam: '',
      startTime: '2026-11-15T12:30:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' }
    });
    const futsal = ev({
      id: 'ics-futsal-oranssi',
      title: 'PPJ Laru 2013: Futsal - Oranssi',
      sport: 'futsal',
      homeTeam: 'PPJ Laru 2013 Oranssi',
      awayTeam: '',
      startTime: '2026-11-15T10:45:00.000Z',
      endTime: '2026-11-15T12:00:00.000Z'
    });
    const stitched = stitchCalendarEventsWithFixtures([winter, official, futsal]);
    const visible = stitched.filter((e) => !e.isHidden);
    expect(visible).toHaveLength(2);
    const card = visible.find((e) => e.id === winter.id)!;
    expect(card.startTime).toBe(official.startTime);
    expect(card.sport).toBe('football');
    expect(card.officialFixtureId).toBe(official.officialFixtureId);
    const futsalCard = visible.find((e) => e.id === futsal.id)!;
    expect(futsalCard.sport).toBe('futsal');
    expect(futsalCard.startTime).toBe(futsal.startTime);
    expect(futsalCard.officialFixtureId).toBeFalsy();
  });
});

describe('Home/away from titled club-calendar games', () => {
  it('marks KaU vs. ToPoLa as an away game when ToPoLa is the family team', () => {
    const result = parseMatchTitle(
      'Tytöt 2014-15 joukkue (kausi 2026-27): WU13 1div. KaU vs. ToPoLa',
      'Lilli:n joukkue',
      ['TOPOLA', 'ToPoLa']
    );
    expect(result.homeTeam).toMatch(/KaU/i);
    expect(result.awayTeam).toMatch(/ToPoLa/i);
    expect(result.isHomeMatch).toBe(false);
  });

  it('keeps ToPoLa vs HNMKY as a home game', () => {
    const result = parseMatchTitle(
      'Tytöt 2014-15 joukkue (kausi 2026-27): WU13 2div. ToPoLa vs. HNMKY/Stadi',
      'Lilli:n joukkue',
      ['TOPOLA']
    );
    expect(result.isHomeMatch).toBe(true);
  });

  it('heals a stored away title that was defaulted to home', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p:lilli:basket',
        playerName: 'Lilli',
        teamName: 'TOPOLA',
        sport: 'basketball',
        primaryColor: 'vihreä',
        colorHex: '#15803d'
      },
      {
        id: 'p:lilli:myclub',
        playerName: 'Lilli',
        teamName: 'Lilli:n joukkue',
        sport: 'basketball',
        primaryColor: 'keltainen',
        colorHex: '#eab308'
      }
    ];
    const events: MatchdayEvent[] = [
      ev({
        id: 'ics-kau',
        profileId: 'p:lilli:myclub',
        title: 'Tytöt 2014-15 joukkue (kausi 2026-27): WU13 1div. KaU vs. ToPoLa',
        sport: 'basketball',
        homeTeam: 'KaU',
        awayTeam: 'ToPoLa',
        isHomeMatch: true,
        startTime: '2026-11-28T10:45:00.000Z'
      })
    ];
    const result = harmonizeStartupSports(profiles, events);
    expect(result.eventUpdates.find((u) => u.id === 'ics-kau')?.updates.isHomeMatch).toBe(false);
    expect(sideMatchesOwnTeam('ToPoLa', ['TOPOLA'])).toBe(true);
  });
});

describe('Empty ICS location is not Töölön Pallokenttä', () => {
  it('leaves venue empty when the calendar row has no LOCATION', async () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:no-venue@test.fi
DTSTART:20261120T150000Z
DTEND:20261120T163000Z
SUMMARY:PPJ Laru 2013 vs EPS
END:VEVENT
END:VCALENDAR`;
    const events = await parseICSFeed(ics, 'p:simo:myclub', 'football', 'PPJ Laru 2013');
    expect(events).toHaveLength(1);
    expect(events[0]!.venue?.name || '').toBe('');
    expect(JSON.stringify(events[0])).not.toMatch(/Töölön Pallokenttä/i);
  });
});

describe('Deliberate re-add clears deletion suppression', () => {
  it('builds re-add ids with and without the season suffix', () => {
    const withSeason = 'https://tulospalvelu.palloliitto.fi/team/185085/info?season=etejp26';
    const bare = 'https://tulospalvelu.palloliitto.fi/team/185085/info';
    expect(generateStableProfileId('Simo', bare)).toBe('p:simo:tulospalvelu.palloliitto.fi:185085');
    expect(readdProfileIds('Simo', withSeason)).toEqual(
      expect.arrayContaining([
        'p:simo:tulospalvelu.palloliitto.fi:185085:etejp26',
        'p:simo:tulospalvelu.palloliitto.fi:185085'
      ])
    );
    expect(canonicalAssociationProfileId('p:simo:tulospalvelu.palloliitto.fi:185085:etejp26')).toBe(
      'p:simo:tulospalvelu.palloliitto.fi:185085'
    );
  });

  it('retracts the bare team tombstone when the team is re-added', () => {
    const url = 'https://tulospalvelu.palloliitto.fi/team/185085/info';
    const tombstones = [
      { id: 'p:simo:tulospalvelu.palloliitto.fi:185085', deletedAt: '2026-08-30T08:14:40.454Z' },
      { id: 'p:lilli:other', deletedAt: '2026-08-30T08:12:42.699Z' }
    ];
    const next = retractTombstonesForReadd(tombstones, 'Simo', url, 'p:simo:tulospalvelu.palloliitto.fi:185085');
    expect(next.map((t) => t.id)).toEqual(['p:lilli:other']);
  });

  it('does not let a leftover local tombstone delete a team the remote roster still has', () => {
    const local: PlayerProfile[] = [
      {
        id: 'p:simo:tulospalvelu.palloliitto.fi:185085',
        playerName: 'Simo',
        teamName: 'PPJ/Laru sin',
        sport: 'football',
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        associationUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info'
      }
    ];
    const remote: FamilyRosterV1 = {
      v: 1,
      rev: 10,
      updatedAt: new Date().toISOString(),
      profiles: [
        {
          id: 'p:simo:tulospalvelu.palloliitto.fi:185085',
          playerName: 'Simo',
          teamName: 'PPJ/Laru sin',
          sport: 'football',
          colorHex: '#3b82f6',
          calendarUrl: '',
          associationUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info'
        }
      ],
      tombstones: []
    };
    const localTombs = [{ id: 'p:simo:tulospalvelu.palloliitto.fi:185085', deletedAt: '2026-08-30T08:14:40.454Z' }];
    const { mergedProfiles, tombstones } = mergeRosters(local, remote, localTombs);
    expect(mergedProfiles.map((p) => p.id)).toContain('p:simo:tulospalvelu.palloliitto.fi:185085');
    expect(tombstones.map((t) => t.id)).not.toContain('p:simo:tulospalvelu.palloliitto.fi:185085');
  });

  it('still honours a remote tombstone when the roster no longer lists the team', () => {
    const local: PlayerProfile[] = [
      {
        id: 'p:simo:tulospalvelu.palloliitto.fi:185085',
        playerName: 'Simo',
        teamName: 'PPJ/Laru sin',
        sport: 'football',
        primaryColor: 'sininen',
        colorHex: '#3b82f6'
      }
    ];
    const remote: FamilyRosterV1 = {
      v: 1,
      rev: 11,
      updatedAt: new Date().toISOString(),
      profiles: [],
      tombstones: [{ id: 'p:simo:tulospalvelu.palloliitto.fi:185085', deletedAt: new Date().toISOString() }]
    };
    const { mergedProfiles } = mergeRosters(local, remote, []);
    expect(mergedProfiles.length).toBe(0);
  });
});
