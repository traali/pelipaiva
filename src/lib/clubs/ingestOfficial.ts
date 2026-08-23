import type { MatchdayEvent, SportType } from '../../types/matchday';
import { db, saveOfficialTeamData } from '../storage/db';
import { parseAssociationUrl } from '../stats/statsEngine';
import { extractOfficialTeamData } from '../api/associationExtractor';
import { exampleTournamentFromUrl, mergeOfficialWithCupFallback, isCupName } from './exampleTournaments';
import { buildMatchStatsFromOfficial } from '../api/torneopalClient';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { generateMatchdayBriefing } from '../ai/deterministicReasoner';

export interface IngestOfficialOptions {
  profileId: string;
  url: string;
  playerName: string;
  teamName?: string;
  sport?: SportType;
  dbInstance?: typeof db;
}

export interface IngestOfficialResult {
  success: boolean;
  importedCount: number;
  teamName?: string;
  leagueName?: string;
  officialDataFound: boolean;
}

export async function ingestOfficialForProfile(
  options: IngestOfficialOptions
): Promise<IngestOfficialResult> {
  const { profileId, url, playerName, teamName, sport = 'football', dbInstance = db } = options;

  const parsedAssoc = parseAssociationUrl(url);
  const cup = exampleTournamentFromUrl(url);

  let officialData: Awaited<ReturnType<typeof extractOfficialTeamData>> | null = null;
  if (parsedAssoc) {
    try {
      officialData = await extractOfficialTeamData(parsedAssoc, {
        customTeamName: cup?.teamName || teamName,
        fallbackToSynthetic: false
      });
    } catch (err) {
      console.warn('[INGEST_OFFICIAL] Official fetch failed, checking cup fallback', err);
    }
  }

  // Only use cup fallback if live officialData produced 0 fixtures
  if (!officialData || officialData.fixtures.length === 0) {
    officialData = mergeOfficialWithCupFallback(cup, officialData);
  }

  if (!officialData || officialData.fixtures.length === 0) {
    return {
      success: false,
      importedCount: 0,
      officialDataFound: false
    };
  }

  // Save fixtures, standings, and roster to Dexie
  await saveOfficialTeamData(officialData, dbInstance);

  const resolvedTeamName =
    officialData.teamName && !/joukkue \d+/i.test(officialData.teamName)
      ? officialData.teamName
      : cup?.teamName || teamName || 'Joukkue';

  await dbInstance.profiles.update(profileId, {
    teamName: resolvedTeamName,
    teamId: parsedAssoc?.teamId || cup?.teamId,
    associationType: parsedAssoc?.association,
    associationUrl: url,
    lastOfficialSyncAt: new Date().toISOString()
  });

  const cupish = Boolean(cup) || isCupName(officialData.leagueName);
  const fixtures = cupish
    ? officialData.fixtures.filter((f) => f.status !== 'cancelled')
    : officialData.fixtures;

  const eventsToInsert: MatchdayEvent[] = [];

  for (const fixture of fixtures) {
    const venue = await resolveSportsVenue(fixture.venueName, {
      lat: fixture.venueLat,
      lng: fixture.venueLng,
      city: fixture.venueCity
    });

    const startTime = fixture.startTime || new Date().toISOString();
    const endTime =
      fixture.endTime || new Date(new Date(startTime).getTime() + 90 * 60 * 1000).toISOString();
    const warmupTime = new Date(new Date(startTime).getTime() - 45 * 60 * 1000).toISOString();

    const isHome =
      fixture.isHome ??
      (fixture.homeTeam.toLowerCase().includes((resolvedTeamName || '').toLowerCase()) ||
        fixture.homeTeam.toLowerCase().includes(playerName.toLowerCase()));

    const thisCup = cupish || isCupName(fixture.leagueName);
    const stats = buildMatchStatsFromOfficial(officialData, fixture);

    const matchEvent: MatchdayEvent = {
      id: `fixture-${profileId}-${fixture.id}`,
      profileId,
      title: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      eventType: thisCup ? 'tournament' : 'match',
      isTraining: false,
      sport: officialData.sport || parsedAssoc?.sport || sport,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      isHomeMatch: isHome,
      startTime,
      endTime,
      warmupTime,
      tournamentName: thisCup ? fixture.leagueName || officialData.leagueName : undefined,
      stage: fixture.stage,
      matchNumber: fixture.matchNumber,
      venue,
      officialFixtureId: fixture.id,
      reconciliationStatus: 'auto_matched',
      confidenceScore: 1.0,
      stats
    };

    eventsToInsert.push(matchEvent);
  }

  const existingEvents = await dbInstance.events.toArray().catch(() => []);
  const allEventsCombined = [...existingEvents.filter(e => !eventsToInsert.some(n => n.id === e.id)), ...eventsToInsert];

  for (const ev of eventsToInsert) {
    const sameDayEvents = allEventsCombined.filter(
      (other) => other.startTime.slice(0, 10) === ev.startTime.slice(0, 10)
    );
    try {
      const weather = await fetchFmiMatchWeather(ev.venue.coordinates, ev.startTime, ev.endTime);
      const parking = calculateParkingEase(ev.venue.name, ev.venue.coordinates, new Date(ev.startTime));
      ev.weather = weather;
      ev.parking = parking;
      ev.briefing = generateMatchdayBriefing(ev, sameDayEvents);
    } catch {
      // Offline / graceful degradation
    }
    await dbInstance.events.put(ev);
  }

  return {
    success: true,
    importedCount: eventsToInsert.length,
    teamName: resolvedTeamName,
    leagueName: officialData.leagueName,
    officialDataFound: true
  };
}
