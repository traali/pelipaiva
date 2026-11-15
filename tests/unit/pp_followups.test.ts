import { describe, it, expect } from 'vitest';
import { detectSportFromText } from '../../src/lib/ai/eventCandidateRanker';
import { parseMatchTitle, parseICSFeed, sideMatchesOwnTeam } from '../../src/lib/calendar/icsParser';
import { sportFromTaso, mapFixture } from '../../src/lib/api/torneopalClient';
import type { ParsedAssociationUrl } from '../../src/types/matchday';
import { stitchCalendarEventsWithFixtures, eventProfileIds, isPersistableCalendarOfficialLink, unstitchOverlinkedCalendarEvents, canAutoLinkCalendarToOfficial } from '../../src/lib/reconciliation/reconciliationEngine';
import { eventOfficialMatchKey } from '../../src/lib/sport/federationLinks';
import { filterEventsByActiveProfileId } from '../../src/lib/profiles/activeProfileSelection';
import { filterVisibleTimelineDays } from '../../src/components/TimelineCalendarView';
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


describe('Official fixtures are one card per TASO match_id', () => {
  const oranssiId = 'p:simo:tulospalvelu.palloliitto.fi:35224455';
  const sininenId = 'p:simo:tulospalvelu.palloliitto.fi:35224454';
  const oranFeedId = 'p:simo:tulospalvelu.palloliitto.fi:185086';
  const myclubId = 'p:simo:myclub:oranssi';

  const profiles: PlayerProfile[] = [
    { id: oranssiId, playerName: 'Simo', teamName: 'PPJ/Laru Oranssi', sport: 'football', primaryColor: 'oranssi', colorHex: '#f97316' },
    { id: sininenId, playerName: 'Simo', teamName: 'PPJ/Laru Sininen', sport: 'football', primaryColor: 'sininen', colorHex: '#2563eb' },
    { id: oranFeedId, playerName: 'Simo', teamName: 'PPJ/Laru oran', sport: 'football', primaryColor: 'oranssi', colorHex: '#f97316' },
    { id: myclubId, playerName: 'Simo', teamName: 'PPJ Laru 2013', sport: 'football', primaryColor: 'oranssi', colorHex: '#f97316' }
  ];

  function officialCopy(profileId: string, teamId: string, sport: MatchdayEvent['sport']) {
    return ev({
      id: `fixture-${profileId}-palloliitto_${teamId}_4379327`,
      profileId,
      officialFixtureId: `palloliitto_${teamId}_4379327`,
      title: 'PPJ/Laru Oranssi vs HJS/Sininen',
      sport,
      homeTeam: 'PPJ/Laru Oranssi',
      awayTeam: 'HJS/Sininen',
      startTime: '2026-11-15T13:00:00.000Z',
      endTime: '2026-11-15T14:00:00.000Z',
      venue: { name: 'Pikkupekka Areena' },
      leagueName: teamId === '35224455' ? 'Winterliiga 2026–2027' : undefined
    });
  }

  const myclubWinter = ev({
    id: 'ics-winter-oranssi',
    profileId: myclubId,
    title: 'PPJ Laru 2013: WINTERLIIGA - ORANSSI',
    sport: 'football',
    homeTeam: 'PPJ Laru 2013 ORANSSI',
    awayTeam: '',
    startTime: '2026-11-15T12:30:00.000Z',
    endTime: '2026-11-15T14:00:00.000Z',
    venue: { name: 'Pikkupekka Areena' }
  });

  const futsalOranssi = ev({
    id: 'ics-futsal-oranssi',
    profileId: myclubId,
    title: 'PPJ Laru 2013: Futsal - Oranssi',
    sport: 'futsal',
    homeTeam: 'PPJ Laru 2013 Oranssi',
    awayTeam: '',
    startTime: '2026-11-15T10:45:00.000Z',
    endTime: '2026-11-15T12:00:00.000Z'
  });

  function applyHarmonizer(events: MatchdayEvent[]): MatchdayEvent[] {
    const result = harmonizeStartupSports(profiles, events);
    const map = new Map(result.eventUpdates.map((u) => [u.id, u.updates]));
    return events.map((e) => (map.has(e.id) ? ({ ...e, ...map.get(e.id) } as MatchdayEvent) : e));
  }

  /** Stored device state, then the new version hydrates (harmonize) and stitches. */
  function loadNewVersion(stored: MatchdayEvent[]): MatchdayEvent[] {
    return stitchCalendarEventsWithFixtures(applyHarmonizer(stored)).filter((e) => !e.isHidden);
  }

  it('parses the same match_id from every team copy of the official fixture', () => {
    expect(eventOfficialMatchKey({ officialFixtureId: 'palloliitto_35224455_4379327' })).toBe('4379327');
    expect(eventOfficialMatchKey({ officialFixtureId: 'palloliitto_35224454_4379327' })).toBe('4379327');
    expect(eventOfficialMatchKey({
      id: 'fixture-p:simo:tulospalvelu.palloliitto.fi:185086-palloliitto_185086_4379327'
    })).toBe('4379327');
  });

  it('collapses official copies from Oranssi and Sininen following the same match into one football card', () => {
    const visible = loadNewVersion([
      officialCopy(oranssiId, '35224455', 'football'),
      officialCopy(sininenId, '35224454', 'futsal')
    ]);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.title).toBe('PPJ/Laru Oranssi vs HJS/Sininen');
    expect(visible[0]!.sport).toBe('football');
    expect(visible[0]!.startTime).toBe('2026-11-15T13:00:00.000Z');
    const ids = eventProfileIds(visible[0]!);
    expect(ids).toEqual(expect.arrayContaining([oranssiId, sininenId]));
  });

  it('replays the live cb23017 device state: two stored official copies, 14:30 MyClub, 12:45 Futsal', () => {
    const stored = [
      officialCopy(oranssiId, '35224455', 'football'),
      officialCopy(sininenId, '35224454', 'futsal'),
      officialCopy(oranFeedId, '185086', 'futsal'),
      myclubWinter,
      futsalOranssi
    ];
    const visible = loadNewVersion(stored);
    expect(visible).toHaveLength(2);

    const game = visible.find((e) => e.title === 'PPJ/Laru Oranssi vs HJS/Sininen')!;
    expect(game).toBeTruthy();
    expect(game.sport).toBe('football');
    expect(game.startTime).toBe('2026-11-15T13:00:00.000Z');
    expect(game.endTime).toBe('2026-11-15T14:00:00.000Z');
    expect(visible.some((e) => e.startTime === myclubWinter.startTime)).toBe(false);
    expect(visible.filter((e) => /WINTERLIIGA/i.test(e.title))).toHaveLength(0);
    expect(visible.filter((e) => e.startTime === '2026-11-15T13:00:00.000Z')).toHaveLength(1);

    const futsalCard = visible.find((e) => e.id === futsalOranssi.id)!;
    expect(futsalCard.sport).toBe('futsal');
    expect(futsalCard.startTime).toBe(futsalOranssi.startTime);
    expect(futsalCard.officialFixtureId).toBeFalsy();
    expect(futsalCard.title).toMatch(/Futsal/i);

    const simoEvents = filterEventsByActiveProfileId(visible, profiles, 'player:simo');
    expect(simoEvents).toHaveLength(2);
    expect(simoEvents.map((e) => e.sport).sort()).toEqual(['football', 'futsal']);
  });

  it('Tänään shows the whole Helsinki day, so a 12:45 game is not hidden as past', () => {
    const visible = loadNewVersion([
      officialCopy(oranssiId, '35224455', 'football'),
      officialCopy(sininenId, '35224454', 'futsal'),
      myclubWinter,
      futsalOranssi
    ]);
    const groups = [
      { dateStr: '2026-11-15', events: visible }
    ];
    const today = filterVisibleTimelineDays(groups, 'today', '2026-11-15');
    expect(today).toHaveLength(1);
    expect(today[0]!.events.some((e) => e.id === futsalOranssi.id)).toBe(true);
    expect(today[0]!.events.some((e) => e.startTime === '2026-11-15T13:00:00.000Z')).toBe(true);
  });
});


describe('12:45 Futsal - Oranssi is not folded into the 15:00 Winterliiga game', () => {
  const myclubId = 'p:simo:myclub:oranssi';
  const oranssiId = 'p:simo:tulospalvelu.palloliitto.fi:35224455';

  // Real family event from the 14.11 IndexedDB dump (tokens not included).
  const futsalLive = ev({
    id: 'ppj.myclub.fi-11689359',
    profileId: myclubId,
    title: 'PPJ Laru 2013: Futsal - Oranssi',
    sport: 'futsal',
    eventType: 'match',
    homeTeam: 'PPJ Laru 2013 Oranssi',
    awayTeam: '',
    startTime: '2026-11-15T10:45:00.000Z',
    endTime: '2026-11-15T14:00:00.000Z',
    warmupTime: '2026-11-15T10:00:00.000Z',
    venue: { name: 'Kameleonten Areena Leppävaara' }
  });
  const winterLive = ev({
    id: 'ppj.myclub.fi-11752200',
    profileId: myclubId,
    title: 'PPJ Laru 2013: WINTERLIIGA - ORANSSI ',
    sport: 'football',
    homeTeam: 'PPJ Laru 2013 ORANSSI',
    awayTeam: '',
    startTime: '2026-11-15T12:30:00.000Z',
    endTime: '2026-11-15T14:00:00.000Z',
    warmupTime: '2026-11-15T11:45:00.000Z',
    venue: { name: 'Pikkupekka Areena, Siltavoudintie 21, 00640 Helsinki' }
  });
  const officialLive = ev({
    id: 'fixture-p:simo:tulospalvelu.palloliitto.fi:35224455-palloliitto_35224455_4379327',
    profileId: oranssiId,
    officialFixtureId: 'palloliitto_35224455_4379327',
    title: 'PPJ/Laru Oranssi vs HJS/Sininen',
    sport: 'football',
    homeTeam: 'PPJ/Laru Oranssi',
    awayTeam: 'HJS/Sininen',
    startTime: '2026-11-15T13:00:00.000Z',
    endTime: '2026-11-15T14:00:00.000Z',
    venue: { name: 'Pikkupekka Areena' },
    leagueName: 'Winterliiga 2026–2027'
  });
  const officialStillFutsal = ev({ ...officialLive, sport: 'futsal', leagueName: undefined });

  it('does not persist-link a Futsal MyClub row to the Winterliiga official (sport or 135 min offset)', () => {
    expect(isPersistableCalendarOfficialLink(futsalLive, officialLive)).toBe(false);
    expect(canAutoLinkCalendarToOfficial(futsalLive, officialLive)).toBe(false);
    // Even when the official card is still wrongly labelled Futsal, 12:45 is 135 min before 15:00.
    expect(isPersistableCalendarOfficialLink(futsalLive, officialStillFutsal)).toBe(false);
    expect(canAutoLinkCalendarToOfficial(futsalLive, officialStillFutsal)).toBe(false);
  });

  it('still persist-links the 14:30 WINTERLIIGA MyClub row to the 15:00 official game', () => {
    expect(isPersistableCalendarOfficialLink(winterLive, officialLive)).toBe(true);
  });

  it('keeps the real 12:45–16:00 Futsal card when stitching with the official 15:00 game', () => {
    const visible = stitchCalendarEventsWithFixtures([futsalLive, winterLive, officialLive]).filter((e) => !e.isHidden);
    const futsalCard = visible.find((e) => e.id === futsalLive.id)!;
    expect(futsalCard).toBeTruthy();
    expect(futsalCard.sport).toBe('futsal');
    expect(futsalCard.startTime).toBe(futsalLive.startTime);
    expect(futsalCard.title).toMatch(/Futsal/i);
    expect(futsalCard.officialFixtureId).toBeFalsy();
    expect(visible.filter((e) => e.startTime === officialLive.startTime)).toHaveLength(1);
    expect(visible.some((e) => e.startTime === winterLive.startTime)).toBe(false);
  });

  it('restores a stored 12:45 row that the 180-minute startup linker had overwritten', () => {
    // What the App.tsx self-heal wrote: same MyClub id, official title/kickoff, official fixture deleted.
    const swallowed = ev({
      id: futsalLive.id,
      profileId: myclubId,
      title: 'PPJ/Laru Oranssi vs HJS/Sininen',
      sport: 'football',
      homeTeam: 'PPJ/Laru Oranssi',
      awayTeam: 'HJS/Sininen',
      startTime: officialLive.startTime,
      endTime: officialLive.endTime,
      warmupTime: futsalLive.startTime,
      officialFixtureId: officialLive.officialFixtureId,
      reconciliationStatus: 'auto_matched',
      venue: { name: 'Pikkupekka Areena' },
      mismatchFlags: {
        timeMismatch: true,
        timeDiffMinutes: 135,
        calendarStartTime: '12.45',
        officialStartTime: '15.00',
        officialStartTimeIso: officialLive.startTime
      }
    });
    const restored = unstitchOverlinkedCalendarEvents([swallowed]);
    const calendar = restored.find((e) => e.id === futsalLive.id)!;
    expect(calendar.officialFixtureId).toBeFalsy();
    expect(calendar.startTime).toBe(futsalLive.startTime);
    const official = restored.find((e) => e.id.startsWith('fixture-') || e.officialFixtureId === officialLive.officialFixtureId)!;
    expect(official.startTime).toBe(officialLive.startTime);

    const visible = stitchCalendarEventsWithFixtures(restored).filter((e) => !e.isHidden);
    expect(visible.some((e) => e.id === futsalLive.id && e.startTime === futsalLive.startTime)).toBe(true);
    expect(visible.filter((e) => e.startTime === officialLive.startTime)).toHaveLength(1);
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
