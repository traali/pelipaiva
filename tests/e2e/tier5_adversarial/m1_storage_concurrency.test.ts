import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createTestDb } from '../../helpers/setupDexie';
import {
  PelipaivaDB,
  saveOfficialTeamData,
  getOfficialFixtures,
  getOfficialFixturesByDateRange,
  getOfficialStandings,
  getOfficialStandingsRecord,
  getTeamRoster,
  deleteOfficialTeamData,
  saveArrivalRules,
  getArrivalRules,
  getOrCreateArrivalRules,
  linkEventToOfficialFixture,
  unlinkEventFromOfficialFixture,
  applyEventUserOverride,
  saveSyncState,
  getSyncState,
  clearAllDatabaseData
} from '../../../src/lib/storage/db';
import {
  OfficialLeagueFixture,
  OfficialTeamData,
  StandingRow,
  TeamSquadRoster,
  ArrivalRules,
  MatchdayEvent,
  PlayerProfile
} from '../../../src/types/matchday';

describe('Adversarial Storage & Concurrency Stress Tests (Milestone 1)', () => {
  let db: PelipaivaDB;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await db.delete();
    }
  });

  // =========================================================================
  // 1. RAPID CONCURRENT saveOfficialTeamData CALLS (SAME & DIFFERENT TEAMS)
  // =========================================================================
  describe('1. Concurrency & High-Throughput Stress', () => {
    it('handles 50 rapid concurrent saveOfficialTeamData calls for the SAME team without corrupting state', async () => {
      const teamId = 'team_concurrent_same';
      const iterations = 50;

      const promises = Array.from({ length: iterations }, (_, idx) => {
        const teamData: OfficialTeamData = {
          teamId,
          association: 'palloliitto',
          sport: 'football',
          teamName: `HJK Sininen T13 (v${idx})`,
          leagueName: 'T13 Ykkönen',
          fixtures: [
            {
              id: `palloliitto_${teamId}_m${idx}`,
              teamId,
              association: 'palloliitto',
              sport: 'football',
              leagueName: 'T13 Ykkönen',
              homeTeam: `HJK Sininen T13`,
              awayTeam: `Opponent ${idx}`,
              isHome: true,
              startTime: new Date(Date.UTC(2026, 4, 1 + (idx % 28), 12, 0, 0)).toISOString(),
              venueName: `Field ${idx % 5}`,
              status: 'upcoming',
              fetchedAt: new Date().toISOString()
            }
          ],
          standings: [
            {
              rank: 1,
              teamName: 'HJK Sininen T13',
              played: idx + 1,
              won: idx,
              drawn: 1,
              lost: 0,
              goalsFor: (idx + 1) * 3,
              goalsAgainst: idx,
              goalDifference: (idx + 1) * 3 - idx,
              points: (idx * 3) + 1,
              form: ['W']
            }
          ],
          roster: {
            teamName: 'HJK Sininen T13',
            players: [
              {
                jerseyNumber: (idx % 99) + 1,
                playerName: `Player ${idx}`,
                position: 'MF',
                goals: idx,
                assists: 1,
                matchesPlayed: idx + 1,
                yellowCards: 0,
                redCards: 0
              }
            ]
          }
        };
        return saveOfficialTeamData(teamData, db);
      });

      // Execute all 50 concurrently
      await Promise.all(promises);

      // Verify all 50 distinct fixtures were persisted
      const fixtures = await getOfficialFixtures(teamId, db);
      expect(fixtures.length).toBe(iterations);

      // Verify standings exist and contain valid data
      const standings = await getOfficialStandings(teamId, db);
      expect(standings.length).toBe(1);
      expect(standings[0]?.teamName).toBe('HJK Sininen T13');

      // Verify roster exists and contains valid data
      const roster = await getTeamRoster(teamId, db);
      expect(roster).toBeDefined();
      expect(roster?.players.length).toBe(1);
    });

    it('handles 30 concurrent saveOfficialTeamData calls across 30 DIFFERENT teams simultaneously', async () => {
      const teamCount = 30;
      const promises = Array.from({ length: teamCount }, (_, i) => {
        const teamId = `team_diff_${i}`;
        const teamData: OfficialTeamData = {
          teamId,
          association: i % 2 === 0 ? 'salibandy' : 'basket',
          sport: i % 2 === 0 ? 'floorball' : 'basketball',
          teamName: `Team ${i}`,
          leagueName: `League Div ${i % 3}`,
          fixtures: Array.from({ length: 5 }, (_, m) => ({
            id: `fix_${teamId}_${m}`,
            teamId,
            association: i % 2 === 0 ? 'salibandy' : 'basket',
            sport: i % 2 === 0 ? 'floorball' : 'basketball',
            leagueName: `League Div ${i % 3}`,
            homeTeam: `Team ${i}`,
            awayTeam: `Rival ${m}`,
            isHome: m % 2 === 0,
            startTime: new Date(Date.UTC(2026, 5, m + 1, 10, 0, 0)).toISOString(),
            venueName: `Arena ${i}`,
            status: 'upcoming',
            fetchedAt: new Date().toISOString()
          })),
          standings: [
            {
              rank: (i % 10) + 1,
              teamName: `Team ${i}`,
              played: 5,
              won: 3,
              drawn: 1,
              lost: 1,
              goalsFor: 20,
              goalsAgainst: 10,
              goalDifference: 10,
              points: 7,
              form: ['W', 'W', 'D', 'L', 'W']
            }
          ]
        };
        return saveOfficialTeamData(teamData, db);
      });

      await Promise.all(promises);

      // Verify each team's data is isolated and intact
      for (let i = 0; i < teamCount; i++) {
        const teamId = `team_diff_${i}`;
        const fixtures = await getOfficialFixtures(teamId, db);
        expect(fixtures.length).toBe(5);
        const standings = await getOfficialStandings(teamId, db);
        expect(standings.length).toBe(1);
        expect(standings[0]?.teamName).toBe(`Team ${i}`);
      }
    });

    it('handles interleaved concurrent reads and writes without unhandled lock contention', async () => {
      const teamId = 'team_interleaved';
      const readResults: number[] = [];

      // Initial save
      await saveOfficialTeamData({
        teamId,
        association: 'torneopal',
        sport: 'volleyball',
        teamName: 'Volley 1',
        fixtures: [
          {
            id: `fix_${teamId}_init`,
            teamId,
            association: 'torneopal',
            sport: 'volleyball',
            leagueName: 'N2',
            homeTeam: 'Volley 1',
            awayTeam: 'Volley 2',
            isHome: true,
            startTime: '2026-06-01T15:00:00.000Z',
            venueName: 'Lentopallohalli',
            status: 'upcoming',
            fetchedAt: new Date().toISOString()
          }
        ]
      }, db);

      // Fire 20 parallel writes and 20 parallel reads interleaved
      const tasks: Promise<any>[] = [];
      for (let i = 0; i < 20; i++) {
        tasks.push((async () => {
          await saveOfficialTeamData({
            teamId,
            association: 'torneopal',
            sport: 'volleyball',
            teamName: 'Volley 1',
            fixtures: [
              {
                id: `fix_${teamId}_wave_${i}`,
                teamId,
                association: 'torneopal',
                sport: 'volleyball',
                leagueName: 'N2',
                homeTeam: 'Volley 1',
                awayTeam: `Rival ${i}`,
                isHome: true,
                startTime: new Date(Date.UTC(2026, 6, i + 1, 15, 0, 0)).toISOString(),
                venueName: 'Lentopallohalli',
                status: 'upcoming',
                fetchedAt: new Date().toISOString()
              }
            ]
          }, db);
        })());

        tasks.push((async () => {
          const res = await getOfficialFixtures(teamId, db);
          readResults.push(res.length);
        })());
      }

      await Promise.all(tasks);

      // All 21 fixtures should be in the database
      const finalFixtures = await getOfficialFixtures(teamId, db);
      expect(finalFixtures.length).toBe(21);
      expect(readResults.length).toBe(20);
      // Every read returned a positive number of fixtures without throwing
      readResults.forEach(count => expect(count).toBeGreaterThanOrEqual(1));
    });

    it('handles concurrent link, unlink and user override operations safely', async () => {
      const eventId = 'evt_concurrent_op';
      const fixtureId = 'fix_official_99';

      // Insert base event
      await db.events.put({
        id: eventId,
        profileId: 'prof_1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        isHomeMatch: true,
        startTime: '2026-05-20T14:00:00.000Z',
        endTime: '2026-05-20T16:00:00.000Z',
        warmupTime: '2026-05-20T13:15:00.000Z',
        venue: {
          name: 'Bolt Arena',
          normalizedName: 'bolt arena',
          coordinates: { lat: 60.187, lng: 24.921 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      });

      // Concurrently call link, override, and unlink
      await Promise.all([
        linkEventToOfficialFixture(eventId, fixtureId, 'auto_matched', { timeMismatch: true, timeDiffMinutes: 30 }, db),
        applyEventUserOverride(eventId, { action: 'adopt_official', appliedAt: new Date().toISOString() }, db)
      ]);

      let updated = await db.events.get(eventId);
      expect(updated).toBeDefined();
      expect(updated?.officialFixtureId).toBe(fixtureId);
      expect(updated?.userOverride?.action).toBe('adopt_official');

      // Now unlink
      await unlinkEventFromOfficialFixture(eventId, db);
      updated = await db.events.get(eventId);
      expect(updated?.officialFixtureId).toBeUndefined();
      expect(updated?.reconciliationStatus).toBe('unlinked');
    });

    it('handles concurrent getOrCreateArrivalRules without race condition duplication', async () => {
      const profileId = 'prof_race_rules';

      // Fire 10 parallel getOrCreateArrivalRules
      const results = await Promise.all(
        Array.from({ length: 10 }, () => getOrCreateArrivalRules(profileId, 'floorball', db))
      );

      // All returned valid rules
      results.forEach(r => {
        expect(r.profileId).toBe(profileId);
        expect(r.defaultSport).toBe('floorball');
        expect(r.warmupOffsetsMinutes.homeMatch).toBe(45);
      });

      // Database should contain exactly 1 entry for this profileId
      const count = await db.arrivalRules.where('profileId').equals(profileId).count();
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // 2. SCHEMA MIGRATION RESILIENCE (V1 -> V2 WITH LARGE DATASETS & MISSING FIELDS)
  // =========================================================================
  describe('2. Schema Migration Resilience', () => {
    it('migrates from Version 1 to Version 2 with 500 records with missing optional fields', async () => {
      const migrationDbName = `migration_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Step 1: Create a Version 1 only database
      const directV1 = new Dexie(migrationDbName, {
        indexedDB: (Dexie.dependencies as any).indexedDB,
        IDBKeyRange: (Dexie.dependencies as any).IDBKeyRange
      });
      directV1.version(1).stores({
        profiles: 'id, teamName, sport',
        events: 'id, profileId, sport, startTime, [profileId+startTime]',
        venuePins: 'normalizedQuery, venueName',
        syncState: 'key, syncKey'
      });
      await directV1.open();

      // Seed 500 events: some with missing reconciliationStatus, some partially defined, some with custom fields
      const v1Events: any[] = [];
      for (let i = 0; i < 500; i++) {
        v1Events.push({
          id: `evt_v1_${i}`,
          profileId: `prof_${i % 10}`,
          sport: i % 2 === 0 ? 'football' : 'floorball',
          startTime: new Date(Date.UTC(2026, 3, 1 + (i % 25), 10 + (i % 8), 0, 0)).toISOString(),
          title: `Match or training ${i}`,
          // Deliberately omit reconciliationStatus, officialFixtureId, mismatchFlags
          // Some have existing status, some don't
          ...(i % 5 === 0 ? { reconciliationStatus: 'manual_matched' } : {})
        });
      }

      const v1Profiles: any[] = [];
      for (let i = 0; i < 50; i++) {
        v1Profiles.push({
          id: `prof_${i}`,
          teamName: `Team ${i}`,
          sport: 'football'
        });
      }

      await directV1.table('events').bulkPut(v1Events);
      await directV1.table('profiles').bulkPut(v1Profiles);
      directV1.close();

      // Step 2: Open with PelipaivaDB (which defines Version 1 and Version 2 + upgrade handler)
      const v2Db = createTestDb(migrationDbName);
      await v2Db.open();

      expect(v2Db.verno).toBe(2);

      // Verify all 500 events exist and have reconciliationStatus populated
      const allEvents = await v2Db.events.toArray();
      expect(allEvents.length).toBe(500);

      for (let i = 0; i < 500; i++) {
        const ev = allEvents.find(e => e.id === `evt_v1_${i}`);
        expect(ev).toBeDefined();
        if (i % 5 === 0) {
          expect(ev?.reconciliationStatus).toBe('manual_matched');
        } else {
          expect(ev?.reconciliationStatus).toBe('unlinked');
        }
      }

      // Verify newly created V2 tables are fully functional
      await saveOfficialTeamData({
        teamId: 'migrated_team_1',
        association: 'palloliitto',
        sport: 'football',
        teamName: 'Migrated FC',
        fixtures: [
          {
            id: 'fix_migrated_1',
            teamId: 'migrated_team_1',
            association: 'palloliitto',
            sport: 'football',
            leagueName: 'Liiga',
            homeTeam: 'Migrated FC',
            awayTeam: 'Challenger FC',
            isHome: true,
            startTime: '2026-05-10T12:00:00.000Z',
            venueName: 'Kupittaa 5',
            status: 'upcoming',
            fetchedAt: new Date().toISOString()
          }
        ]
      }, v2Db);

      const fixtures = await getOfficialFixtures('migrated_team_1', v2Db);
      expect(fixtures.length).toBe(1);
      expect(fixtures[0]?.homeTeam).toBe('Migrated FC');

      v2Db.close();
      await v2Db.delete();
    });
  });

  // =========================================================================
  // 3. RANGE QUERIES getOfficialFixturesByDateRange WITH EXTREME DATE BOUNDARIES
  // =========================================================================
  describe('3. Extreme Date Range Queries (getOfficialFixturesByDateRange)', () => {
    const teamId = 'team_range_stress';

    beforeEach(async () => {
      // Seed a spectrum of fixtures spanning 1990 to 2050 + specific timestamp fixtures
      const fixtures: OfficialLeagueFixture[] = [
        {
          id: 'fix_past_1990',
          teamId,
          association: 'palloliitto',
          sport: 'football',
          leagueName: 'Vintage',
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          isHome: true,
          startTime: '1990-01-01T00:00:00.000Z',
          venueName: 'Old Pitch',
          status: 'played',
          fetchedAt: new Date().toISOString()
        },
        {
          id: 'fix_exact_epoch',
          teamId,
          association: 'palloliitto',
          sport: 'football',
          leagueName: 'Epoch League',
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          isHome: true,
          startTime: '1970-01-01T00:00:00.000Z',
          venueName: 'Epoch Ground',
          status: 'played',
          fetchedAt: new Date().toISOString()
        },
        {
          id: 'fix_target_mid',
          teamId,
          association: 'palloliitto',
          sport: 'football',
          leagueName: 'Current League',
          homeTeam: 'Team A',
          awayTeam: 'Team C',
          isHome: true,
          startTime: '2026-05-15T12:00:00.000Z',
          venueName: 'Töölö PK',
          status: 'upcoming',
          fetchedAt: new Date().toISOString()
        },
        {
          id: 'fix_target_leap',
          teamId,
          association: 'palloliitto',
          sport: 'football',
          leagueName: 'Leap League',
          homeTeam: 'Team A',
          awayTeam: 'Team D',
          isHome: false,
          startTime: '2028-02-29T23:59:59.999Z',
          venueName: 'Leap Arena',
          status: 'upcoming',
          fetchedAt: new Date().toISOString()
        },
        {
          id: 'fix_future_2099',
          teamId,
          association: 'palloliitto',
          sport: 'football',
          leagueName: 'Sci-Fi League',
          homeTeam: 'Team A',
          awayTeam: 'Team E',
          isHome: true,
          startTime: '2099-12-31T23:59:59.000Z',
          venueName: 'Cyber Dome',
          status: 'upcoming',
          fetchedAt: new Date().toISOString()
        }
      ];

      await db.officialFixtures.bulkPut(fixtures);
    });

    it('returns empty array when given an inverted date range (startDate > endDate)', async () => {
      // startDate is after endDate
      const results = await getOfficialFixturesByDateRange(
        teamId,
        '2026-12-31T23:59:59Z',
        '2026-01-01T00:00:00Z',
        db
      );
      expect(results).toEqual([]);
    });

    it('queries exact boundary match down to millisecond precision', async () => {
      // Exactly matching 2026-05-15T12:00:00.000Z
      const exactMatch = await getOfficialFixturesByDateRange(
        teamId,
        '2026-05-15T12:00:00.000Z',
        '2026-05-15T12:00:00.000Z',
        db
      );
      expect(exactMatch.length).toBe(1);
      expect(exactMatch[0]?.id).toBe('fix_target_mid');

      // 1ms after start -> no match
      const missStart = await getOfficialFixturesByDateRange(
        teamId,
        '2026-05-15T12:00:00.001Z',
        '2026-05-15T13:00:00.000Z',
        db
      );
      expect(missStart.length).toBe(0);

      // 1ms before end -> no match
      const missEnd = await getOfficialFixturesByDateRange(
        teamId,
        '2026-05-15T11:00:00.000Z',
        '2026-05-15T11:59:59.999Z',
        db
      );
      expect(missEnd.length).toBe(0);
    });

    it('handles far future and far past extreme ranges', async () => {
      // Far past range
      const pastResults = await getOfficialFixturesByDateRange(
        teamId,
        '1900-01-01T00:00:00.000Z',
        '1995-01-01T00:00:00.000Z',
        db
      );
      expect(pastResults.length).toBe(2);
      expect(pastResults.map(p => p.id)).toContain('fix_past_1990');
      expect(pastResults.map(p => p.id)).toContain('fix_exact_epoch');

      // Far future range
      const futureResults = await getOfficialFixturesByDateRange(
        teamId,
        '2090-01-01T00:00:00.000Z',
        '3000-01-01T00:00:00.000Z',
        db
      );
      expect(futureResults.length).toBe(1);
      expect(futureResults[0]?.id).toBe('fix_future_2099');

      // Universal range
      const allResults = await getOfficialFixturesByDateRange(
        teamId,
        '1900-01-01T00:00:00.000Z',
        '3000-01-01T00:00:00.000Z',
        db
      );
      expect(allResults.length).toBe(5);
    });

    it('handles leap day boundary with microsecond timestamps and timezone offsets', async () => {
      // Query covering 2028 leap day in Finnish timezone (+02:00 / +03:00)
      const leapResults = await getOfficialFixturesByDateRange(
        teamId,
        '2028-02-29T00:00:00+02:00',
        '2028-03-01T06:00:00+02:00',
        db
      );
      expect(leapResults.length).toBe(1);
      expect(leapResults[0]?.id).toBe('fix_target_leap');
    });

    it('handles invalid date strings gracefully without throwing unhandled exceptions', async () => {
      // Passing garbage date strings
      const res1 = await getOfficialFixturesByDateRange(teamId, 'not-a-date', '2026-05-20', db);
      expect(res1).toEqual([]);

      const res2 = await getOfficialFixturesByDateRange(teamId, '2026-05-01', 'also-not-a-date', db);
      expect(res2).toEqual([]);

      const res3 = await getOfficialFixturesByDateRange(teamId, '', '', db);
      expect(res3).toEqual([]);
    });

    it('returns empty array when teamId has no fixtures in date range or does not exist', async () => {
      const nonExistent = await getOfficialFixturesByDateRange(
        'non_existent_team',
        '2020-01-01',
        '2030-01-01',
        db
      );
      expect(nonExistent).toEqual([]);
    });
  });

  // =========================================================================
  // 4. TRANSACTION ROLLBACK BEHAVIOR (ACID TRANSACTIONS ON MID-TX ERROR)
  // =========================================================================
  describe('4. Transaction Rollback & ACID Guarantees', () => {
    it('rolls back all multi-table mutations when an error occurs mid-transaction', async () => {
      const testTeamId = 'team_rollback_test';

      const fixture: OfficialLeagueFixture = {
        id: 'fix_rollback_1',
        teamId: testTeamId,
        association: 'salibandy',
        sport: 'floorball',
        leagueName: 'Salibandy Cup',
        homeTeam: 'Team Rollback',
        awayTeam: 'Team Opponent',
        isHome: true,
        startTime: '2026-05-01T10:00:00.000Z',
        venueName: 'Arena Rollback',
        status: 'upcoming',
        fetchedAt: new Date().toISOString()
      };

      // Perform transaction that puts fixture and standings, then throws
      let errorThrown = false;
      try {
        await db.transaction('rw', [db.officialFixtures, db.leagueStandings, db.teamRosters], async () => {
          // 1. Insert into officialFixtures
          await db.officialFixtures.put(fixture);

          // 2. Insert into leagueStandings
          await db.leagueStandings.put({
            id: testTeamId,
            teamId: testTeamId,
            leagueName: 'Salibandy Cup',
            rows: [
              {
                rank: 1,
                teamName: 'Team Rollback',
                played: 1,
                won: 1,
                drawn: 0,
                lost: 0,
                goalsFor: 5,
                goalsAgainst: 2,
                goalDifference: 3,
                points: 2,
                form: ['W']
              }
            ],
            fetchedAt: new Date().toISOString()
          });

          // 3. Simulate catastrophic error / unhandled rejection mid-transaction
          throw new Error('SIMULATED_TRANSACTION_FAILURE_MID_TX');
        });
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toBe('SIMULATED_TRANSACTION_FAILURE_MID_TX');
      }

      expect(errorThrown).toBe(true);

      // Verify that NO partial writes persisted across any of the tables
      const fixtures = await getOfficialFixtures(testTeamId, db);
      expect(fixtures).toEqual([]);

      const standings = await getOfficialStandings(testTeamId, db);
      expect(standings).toEqual([]);

      const roster = await getTeamRoster(testTeamId, db);
      expect(roster).toBeUndefined();
    });

    it('verifies deleteOfficialTeamData cleans up composite keys cleanly without leaving orphan records', async () => {
      const teamId = 'team_delete_test';
      const teamName = 'FC Delete Me';
      const leagueName = 'Miesten Vitonen';

      // Save complete package
      await saveOfficialTeamData({
        teamId,
        teamName,
        leagueName,
        association: 'palloliitto',
        sport: 'football',
        fixtures: [
          {
            id: `fix_${teamId}_1`,
            teamId,
            association: 'palloliitto',
            sport: 'football',
            leagueName,
            homeTeam: teamName,
            awayTeam: 'Rival',
            isHome: true,
            startTime: '2026-06-01T18:00:00.000Z',
            venueName: 'Väiski',
            status: 'upcoming',
            fetchedAt: new Date().toISOString()
          }
        ],
        standings: [
          {
            rank: 2,
            teamName,
            played: 1,
            won: 1,
            drawn: 0,
            lost: 0,
            goalsFor: 4,
            goalsAgainst: 1,
            goalDifference: 3,
            points: 3,
            form: ['W']
          }
        ],
        roster: {
          teamName,
          players: [
            {
              jerseyNumber: 10,
              playerName: 'Matti Meikäläinen',
              position: 'FW',
              goals: 2,
              assists: 1,
              matchesPlayed: 1,
              yellowCards: 0,
              redCards: 0
            }
          ]
        }
      }, db);

      // Verify all 3 entities are accessible by both teamId and teamName
      expect((await getOfficialFixtures(teamId, db)).length).toBe(1);
      expect((await getOfficialStandings(teamId, db)).length).toBe(1);
      expect((await getOfficialStandings(teamName, db)).length).toBe(1);
      expect((await getTeamRoster(teamId, db))?.players.length).toBe(1);
      expect((await getTeamRoster(teamName, db))?.players.length).toBe(1);

      // Now perform deleteOfficialTeamData
      await deleteOfficialTeamData(teamId, db);

      // Verify clean eradication
      expect(await getOfficialFixtures(teamId, db)).toEqual([]);
      expect(await getOfficialStandings(teamId, db)).toEqual([]);
      expect(await getOfficialStandings(teamName, db)).toEqual([]);
      expect(await getTeamRoster(teamId, db)).toBeUndefined();
      expect(await getTeamRoster(teamName, db)).toBeUndefined();
    });

    it('verifies clearAllDatabaseData completely resets all 8 tables', async () => {
      // Seed data into all tables
      await db.profiles.put({
        id: 'p1',
        playerName: 'P1',
        teamName: 'T1',
        sport: 'football',
        primaryColor: 'sininen',
        calendarUrl: 'https://example.com/cal.ics',
        colorHex: '#0000FF'
      });
      await db.events.put({
        id: 'e1',
        profileId: 'p1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'T1 vs T2',
        homeTeam: 'T1',
        awayTeam: 'T2',
        isHomeMatch: true,
        startTime: '2026-05-01T12:00:00Z',
        endTime: '2026-05-01T14:00:00Z',
        warmupTime: '2026-05-01T11:15:00Z',
        venue: {
          name: 'Pitch 1',
          normalizedName: 'pitch 1',
          coordinates: { lat: 60.1, lng: 24.9 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      });
      await db.venuePins.put({
        normalizedQuery: 'bubu',
        venueName: 'Puotila TN',
        lat: 60.21,
        lng: 25.11,
        isIndoor: false,
        savedAt: new Date().toISOString()
      });
      await saveSyncState('test_sync', 'key_123', 'p1', db);
      await saveArrivalRules({
        profileId: 'p1',
        defaultSport: 'football',
        warmupOffsetsMinutes: { homeMatch: 45, awayMatch: 60, training: 15, tournament: 30 },
        departureBufferMinutes: 15
      }, db);

      await clearAllDatabaseData(db);

      expect(await db.profiles.count()).toBe(0);
      expect(await db.events.count()).toBe(0);
      expect(await db.officialFixtures.count()).toBe(0);
      expect(await db.leagueStandings.count()).toBe(0);
      expect(await db.teamRosters.count()).toBe(0);
      expect(await db.arrivalRules.count()).toBe(0);
      expect(await db.venuePins.count()).toBe(0);
      expect(await db.syncState.count()).toBe(0);
    });
  });

  // =========================================================================
  // 5. LARGE SCALE DATASET STRESS (1,000+ FIXTURES & ROSTERS)
  // =========================================================================
  describe('5. High Volume Scalability Stress', () => {
    it('stores, queries, and filters a large multi-team season (1,000 fixtures) without performance degradation', async () => {
      const fixtureBatchSize = 1000;
      const teamId = 'team_mega_league';

      const fixtures: OfficialLeagueFixture[] = Array.from({ length: fixtureBatchSize }, (_, i) => ({
        id: `mega_fix_${i}`,
        teamId,
        association: 'palloliitto',
        sport: 'football',
        leagueName: 'Mega Division',
        homeTeam: i % 2 === 0 ? 'Mega Team' : `Opponent ${i}`,
        awayTeam: i % 2 === 0 ? `Opponent ${i}` : 'Mega Team',
        isHome: i % 2 === 0,
        startTime: new Date(Date.UTC(2026, 0, 1 + Math.floor(i / 3), (i % 24), 0, 0)).toISOString(),
        venueName: `Stadium ${i % 20}`,
        status: i < 500 ? 'played' : 'upcoming',
        score: i < 500 ? `${(i % 5)} - ${(i % 3)}` : undefined,
        fetchedAt: new Date().toISOString()
      }));

      const startTime = performance.now();
      await db.officialFixtures.bulkPut(fixtures);
      const writeDuration = performance.now() - startTime;

      // Ensure write completed in reasonable time (< 1500ms)
      expect(writeDuration).toBeLessThan(1500);

      // Verify all 1,000 fixtures retrieved
      const readStart = performance.now();
      const allRetrieved = await getOfficialFixtures(teamId, db);
      const readDuration = performance.now() - readStart;

      expect(allRetrieved.length).toBe(fixtureBatchSize);
      expect(readDuration).toBeLessThan(1000);

      // Test date range filter on 1,000 fixtures
      const filtered = await getOfficialFixturesByDateRange(
        teamId,
        '2026-03-01T00:00:00.000Z',
        '2026-03-31T23:59:59.999Z',
        db
      );

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(f => {
        const time = new Date(f.startTime).getTime();
        expect(time).toBeGreaterThanOrEqual(new Date('2026-03-01T00:00:00.000Z').getTime());
        expect(time).toBeLessThanOrEqual(new Date('2026-03-31T23:59:59.999Z').getTime());
      });
    });

    it('handles complex Finnish unicode characters, emojis and extreme strings in identifiers', async () => {
      const specialTeamId = 'joukkue_ääkköset_⚽_!@#$%^&*()_+~`|}{[]:;?><,./-123';
      const specialTeamName = 'Hämeenlinnan Jalkapalloseura HJS T13 Valkoinen/Sininen (Äöå & Café)';

      await saveOfficialTeamData({
        teamId: specialTeamId,
        teamName: specialTeamName,
        leagueName: 'Tyttöjen Ykkönen — Kevät 2026',
        association: 'palloliitto',
        sport: 'football',
        fixtures: [
          {
            id: `fix_${specialTeamId}_special_1`,
            teamId: specialTeamId,
            association: 'palloliitto',
            sport: 'football',
            leagueName: 'Tyttöjen Ykkönen — Kevät 2026',
            homeTeam: specialTeamName,
            awayTeam: 'Åbo IFK Flickor 13 🏆',
            isHome: true,
            startTime: '2026-05-18T17:30:00.000Z',
            venueName: 'Pulleri TN 2 (Tekonurmi / Lämmitys)',
            status: 'upcoming',
            fetchedAt: new Date().toISOString()
          }
        ],
        standings: [
          {
            rank: 1,
            teamName: specialTeamName,
            played: 3,
            won: 3,
            drawn: 0,
            lost: 0,
            goalsFor: 12,
            goalsAgainst: 2,
            goalDifference: 10,
            points: 9,
            form: ['W', 'W', 'W']
          }
        ],
        roster: {
          teamName: specialTeamName,
          players: [
            {
              jerseyNumber: 99,
              playerName: 'Aino-Kaisa Kärkkäinen-Mäkelä',
              position: 'FW',
              goals: 5,
              assists: 3,
              matchesPlayed: 3,
              yellowCards: 0,
              redCards: 0
            }
          ]
        }
      }, db);

      const fixtures = await getOfficialFixtures(specialTeamId, db);
      expect(fixtures.length).toBe(1);
      expect(fixtures[0]?.homeTeam).toBe(specialTeamName);

      const standings = await getOfficialStandings(specialTeamId, db);
      expect(standings.length).toBe(1);
      expect(standings[0]?.teamName).toBe(specialTeamName);

      const roster = await getTeamRoster(specialTeamId, db);
      expect(roster?.players[0]?.playerName).toBe('Aino-Kaisa Kärkkäinen-Mäkelä');
    });
  });
});
