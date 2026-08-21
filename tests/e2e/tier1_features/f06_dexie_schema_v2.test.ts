import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PelipaivaDB,
  saveOfficialTeamData,
  getOfficialFixtures,
  getOfficialStandings,
  getTeamRoster,
  saveArrivalRules,
  getArrivalRules,
  saveSyncState,
  getSyncState
} from '../../../src/lib/storage/db';
import { createTestDb } from '../../helpers/setupDexie';
import { OfficialLeagueFixture, OfficialTeamData, ArrivalRules } from '../../../src/types/matchday';

describe('Feature 6: Dexie Schema Version 2 Persistence', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('should store and retrieve official fixtures using teamId index and compound keys', async () => {
    const fixture: OfficialLeagueFixture = {
      id: 'palloliitto_60341_m1',
      teamId: '60341',
      association: 'palloliitto',
      sport: 'football',
      leagueName: 'T13 Ykkönen',
      homeTeam: 'HJK T13 Sininen',
      awayTeam: 'EPS',
      isHome: true,
      startTime: '2026-05-16T12:00:00.000Z',
      venueName: 'Puotila TN (Bubu)',
      status: 'upcoming',
      fetchedAt: new Date().toISOString()
    };

    await testDb.officialFixtures.put(fixture);
    const retrieved = await getOfficialFixtures('60341', testDb);

    expect(retrieved.length).toBe(1);
    expect(retrieved[0]?.id).toBe('palloliitto_60341_m1');
    expect(retrieved[0]?.homeTeam).toBe('HJK T13 Sininen');
  });

  it('should perform transactional batch save of fixtures, standings, and rosters via saveOfficialTeamData', async () => {
    const mockData: OfficialTeamData = {
      teamId: '45210',
      association: 'salibandy',
      sport: 'floorball',
      teamName: 'EräViikingit Musta',
      fixtures: [
        {
          id: 'salibandy_45210_sb1',
          teamId: '45210',
          association: 'salibandy',
          sport: 'floorball',
          leagueName: 'P12 Kilpa',
          homeTeam: 'EräViikingit Musta',
          awayTeam: 'Oilers',
          isHome: true,
          startTime: '2026-04-11T11:00:00.000Z',
          venueName: 'Mosahalli 1',
          status: 'upcoming',
          fetchedAt: new Date().toISOString()
        }
      ],
      standings: [
        {
          rank: 1,
          teamName: 'EräViikingit Musta',
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 6,
          goalsAgainst: 3,
          goalDifference: 3,
          points: 2,
          form: ['W']
        }
      ],
      roster: {
        teamName: 'EräViikingit Musta',
        players: [
          {
            jerseyNumber: 88,
            playerName: 'Eetu Aaltonen',
            position: 'FW',
            goals: 3,
            assists: 1,
            matchesPlayed: 1,
            yellowCards: 0,
            redCards: 0
          }
        ]
      }
    };

    await saveOfficialTeamData(mockData, testDb);

    const fixtures = await getOfficialFixtures('45210', testDb);
    expect(fixtures.length).toBe(1);

    const standings = await getOfficialStandings('EräViikingit Musta', testDb);
    expect(standings.length).toBe(1);
    expect(standings[0]?.rank).toBe(1);
    expect(standings[0]?.points).toBe(2);

    const roster = await getTeamRoster('EräViikingit Musta', testDb);
    expect(roster?.players.length).toBe(1);
    expect(roster?.players[0]?.playerName).toBe('Eetu Aaltonen');
  });

  it('should store, update and retrieve arrival rules per profile', async () => {
    const rules: ArrivalRules = {
      profileId: 'profile-hjk-1',
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 45,
        awayMatch: 60,
        training: 15,
        tournament: 30
      },
      departureBufferMinutes: 15,
      squadAliases: ['Sininen', 'Kilpa']
    };

    await saveArrivalRules(rules, testDb);
    const retrieved = await getArrivalRules('profile-hjk-1', testDb);

    expect(retrieved).toBeDefined();
    expect(retrieved?.warmupOffsetsMinutes.awayMatch).toBe(60);
    expect(retrieved?.squadAliases).toContain('Sininen');
  });

  it('should store and query syncState records', async () => {
    await saveSyncState('nimenhuuto_sync', 'sync-key-12345', 'profile-1', testDb);
    const state = await getSyncState('nimenhuuto_sync', testDb);

    expect(state).toBeDefined();
    expect(state?.syncKey).toBe('sync-key-12345');
    expect(state?.activeProfileId).toBe('profile-1');
  });

  it('should support Schema Version 2 migration alongside profiles and events tables', async () => {
    await testDb.profiles.put({
      id: 'prof-test',
      playerName: 'Maija',
      teamName: 'HJK Sininen',
      sport: 'football',
      primaryColor: 'sininen',
      calendarUrl: 'https://nimenhuuto.com/feed.ics',
      colorHex: '#0055A5'
    });

    const prof = await testDb.profiles.get('prof-test');
    expect(prof?.playerName).toBe('Maija');
    expect(testDb.verno).toBe(2);
  });
});
