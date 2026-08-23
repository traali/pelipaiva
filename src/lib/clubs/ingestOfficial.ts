import type { MatchdayEvent, OfficialTeamData, SportType } from '../../types/matchday';
import { parseAssociationUrl, extractOfficialTeamData } from '../stats/statsEngine';
import { saveOfficialTeamData, type PelipaivaDB, db } from '../storage/db';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { generateMatchdayBriefing } from '../ai/deterministicReasoner';
import { buildMatchStatsFromOfficial, hasRenderableStats } from '../api/torneopalClient';
import {
  exampleTournamentFromUrl,
  isCupName,
  mergeOfficialWithCupFallback,
  isUglyTeamName
} from './exampleTournaments';

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function ingestOfficialForProfile(opts: {
  profileId: string;
  playerName: string;
  teamName: string;
  sport: SportType;
  url: string;
  database?: PelipaivaDB;
  includeWeather?: boolean;
}): Promise<{ official: OfficialTeamData | null; resolvedTeamName: string }> {
  const database = opts.database || db;
  const cup = exampleTournamentFromUrl(opts.url);
  const parsedAssoc = parseAssociationUrl(opts.url);

  let officialData: OfficialTeamData | null = null;
  if (parsedAssoc) {
    officialData = await extractOfficialTeamData(parsedAssoc, {
      customTeamName: cup?.teamName || opts.teamName,
      fallbackToSynthetic: false
    }).catch(() => null);
  }

  officialData = mergeOfficialWithCupFallback(cup, officialData);
  if (!officialData || officialData.fixtures.length === 0) {
    return { official: officialData, resolvedTeamName: opts.teamName };
  }

  await saveOfficialTeamData(officialData, database);

  const resolvedName =
    officialData.teamName && !isUglyTeamName(officialData.teamName)
      ? officialData.teamName
      : cup?.teamName || opts.teamName;

  const cupish = Boolean(cup) || isCupName(officialData.leagueName);
  const fixtures = cupish
    ? officialData.fixtures.filter((f) => f.status !== 'cancelled')
    : officialData.fixtures;

  const events: MatchdayEvent[] = await mapPool(fixtures, 4, async (fixture) => {
    const venue = await resolveSportsVenue(fixture.venueName, {
      lat: fixture.venueLat,
      lng: fixture.venueLng,
      city: fixture.venueCity
    });
    const startTime = fixture.startTime;
    const endTime =
      fixture.endTime || new Date(new Date(startTime).getTime() + 90 * 60 * 1000).toISOString();
    const warmupMins = cupish ? 30 : fixture.isHome ? 45 : 60;
    const warmupTime = new Date(new Date(startTime).getTime() - warmupMins * 60 * 1000).toISOString();
    const thisCup = cupish || isCupName(fixture.leagueName);
    const officialStats = buildMatchStatsFromOfficial(officialData, fixture);

    const matchEvent: MatchdayEvent = {
      id: `fixture-${opts.profileId}-${fixture.id}`,
      profileId: opts.profileId,
      title: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      eventType: thisCup ? 'tournament' : 'match',
      isTraining: false,
      sport: officialData.sport || parsedAssoc?.sport || opts.sport,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      isHomeMatch: fixture.isHome,
      startTime,
      endTime,
      warmupTime,
      tournamentName: thisCup ? fixture.leagueName || officialData.leagueName : undefined,
      stage: fixture.stage,
      matchNumber: fixture.matchNumber,
      score: fixture.score,
      venue,
      officialFixtureId: fixture.id,
      reconciliationStatus: 'auto_matched',
      confidenceScore: 1.0,
      stats: hasRenderableStats(officialStats) ? officialStats : undefined
    };

    if (opts.includeWeather !== false) {
      const weather = await fetchFmiMatchWeather(venue.coordinates, startTime, endTime);
      const parking = calculateParkingEase(venue.name, venue.coordinates, new Date(startTime));
      matchEvent.weather = weather;
      matchEvent.parking = parking;
    }
    return matchEvent;
  });

  for (const ev of events) {
    ev.briefing = generateMatchdayBriefing(ev, events);
  }

  if (events.length > 0) {
    await database.events.bulkPut(events);
  }

  await database.profiles.update(opts.profileId, {
    teamName: resolvedName,
    teamId: parsedAssoc?.teamId || cup?.teamId,
    associationType: parsedAssoc?.association,
    associationUrl: opts.url,
    lastOfficialSyncAt: new Date().toISOString()
  });

  return { official: officialData, resolvedTeamName: resolvedName };
}
