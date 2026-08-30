import type { MatchdayEvent, OfficialTeamData, SportType } from '../../types/matchday';
import {
  parseAssociationUrl,
  extractOfficialTeamData
} from '../stats/statsEngine';
import {
  saveOfficialTeamData,
  getOfficialFixtures,
  type PelipaivaDB,
  db
} from '../storage/db';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { generateMatchdayBriefing } from '../ai/deterministicReasoner';
import { buildMatchStatsFromOfficial, hasRenderableStats } from '../api/torneopalClient';
import { parseICSFeed } from '../calendar/icsParser';
import { DEFAULT_PROXY_URL } from '../api/proxyUrl';
import {
  reconcileCalendarWithOfficial,
  computeMismatchDiagnostics
} from '../reconciliation/reconciliationEngine';
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
    // FAMILY_SYNC_FINAL §3 constitution: fallbackToSynthetic is false — a failed
    // federation fetch must fail closed, never fabricate a season.
    officialData = await extractOfficialTeamData(parsedAssoc, {
      customTeamName: cup?.teamName || opts.teamName,
      fallbackToSynthetic: false
    }).catch(() => null);
  }

  officialData = mergeOfficialWithCupFallback(cup, officialData);

  if (!officialData || officialData.fixtures.length === 0) {
    // No synthetic or canned fallback: if federation returned 0 matches,
    // return null and let caller show "ei julkaistu".
    return { official: officialData, resolvedTeamName: cup?.teamName || opts.teamName };
  }

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
      if (weather) matchEvent.weather = weather;
      matchEvent.parking = parking;
    }
    return matchEvent;
  });

  for (const ev of events) {
    ev.briefing = generateMatchdayBriefing(ev, events);
  }

  if (events.length > 0) {
    const keep = new Set(events.map((e) => e.id));
    const existing = await database.events.where("profileId").equals(opts.profileId).toArray();
    const stale = existing
      .filter((e) => e.id.startsWith(`fixture-${opts.profileId}-`) && !keep.has(e.id))
      .map((e) => e.id);
    if (stale.length > 0) await database.events.bulkDelete(stale);
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

export async function fetchRawIcsFeed(url: string): Promise<string | null> {
  if (!url) return null;
  const raw = url.trim().replace(/^webcal:/i, 'https:');
  const target = `${DEFAULT_PROXY_URL}?url=${encodeURIComponent(raw)}`;
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.length >= 20 ? text : null;
  } catch {
    return null;
  }
}

export async function ingestIcsForProfile(opts: {
  profileId: string;
  teamName: string;
  sport: SportType;
  url: string;
  database?: PelipaivaDB;
  squadFilters?: string[];
}): Promise<number> {
  const database = opts.database || db;
  const text = await fetchRawIcsFeed(opts.url);
  if (!text) return 0;
  const parsed = await parseICSFeed(
    text,
    opts.profileId,
    opts.sport,
    opts.teamName,
    opts.squadFilters
  );
  const withMeta: MatchdayEvent[] = [];
  for (const ev of parsed) {
    const weather = await fetchFmiMatchWeather(ev.venue.coordinates, ev.startTime, ev.endTime);
    const parking = calculateParkingEase(ev.venue.name, ev.venue.coordinates, new Date(ev.startTime));
    const fullEv: MatchdayEvent = { ...ev, parking };
    if (weather) fullEv.weather = weather;
    fullEv.briefing = generateMatchdayBriefing(fullEv, parsed);
    withMeta.push(fullEv);
  }

  // Reconciliation producer (REQ-10/REQ-11): when this profile also has a
  // federation source, fuzzy-join the calendar events against its official
  // fixtures and attach mismatch diagnostics so the 1-tap banner is reachable.
  if (withMeta.length > 0) {
    const profile = await database.profiles.get(opts.profileId);
    let targetTeamId = profile?.teamId;
    if (!targetTeamId && profile?.playerName) {
      const allProfiles = await database.profiles.toArray();
      const peerProfile = allProfiles.find(
        (p) =>
          p.id !== opts.profileId &&
          (p.playerName || '').trim().toLowerCase() === profile.playerName.trim().toLowerCase() &&
          (p.sport === opts.sport || (opts.sport === 'football' && p.sport)) &&
          p.teamId
      );
      if (peerProfile) {
        targetTeamId = peerProfile.teamId;
        if (opts.sport === 'football' && peerProfile.sport && peerProfile.sport !== 'football') {
          for (const ev of withMeta) {
            if (ev.sport === 'football') {
              ev.sport = peerProfile.sport;
            }
          }
          await database.profiles.update(opts.profileId, { sport: peerProfile.sport });
        }
      }
    }

    if (targetTeamId) {
      const officialFixtures = await getOfficialFixtures(targetTeamId, database);
      if (officialFixtures.length > 0) {
        const aliasRows = await database.customAliases.toArray();
        const aliasMap = new Map(aliasRows.map((a) => [a.pattern.toLowerCase().trim(), a.canonicalClub]));
        const results = reconcileCalendarWithOfficial(withMeta, officialFixtures, aliasMap);
        const duplicateFixtureIdsToDelete: string[] = [];

        for (const ev of withMeta) {
          const result = results.get(ev.id);
          if (!result || result.status === 'unlinked' || !result.officialFixture) continue;
          ev.reconciliationStatus = result.status;
          ev.confidenceScore = result.confidenceScore;
          ev.officialFixtureId = result.officialFixture.id;

          // Enrich event with official match details
          if (result.officialFixture.homeTeam && result.officialFixture.awayTeam) {
            ev.homeTeam = result.officialFixture.homeTeam;
            ev.awayTeam = result.officialFixture.awayTeam;
            ev.title = `${result.officialFixture.homeTeam} vs ${result.officialFixture.awayTeam}`;
            ev.isHomeMatch = result.officialFixture.isHome;
            if (result.officialFixture.leagueName) {
              ev.tournamentName = result.officialFixture.leagueName;
            }
            if (result.officialFixture.score) {
              ev.score = result.officialFixture.score;
            }
          }

          const diag = computeMismatchDiagnostics(ev, result.officialFixture);
          if (diag.hasKickoffMismatch || diag.hasVenueMismatch || diag.hasOpponentMismatch) {
            ev.mismatchFlags = {
              timeMismatch: diag.hasKickoffMismatch,
              timeDiffMinutes: diag.timeDiffMinutes,
              calendarStartTime: diag.calendarStartTime,
              officialStartTime: diag.officialStartTime,
              officialStartTimeIso: result.officialFixture.startTime,
              venueMismatch: diag.hasVenueMismatch,
              calendarVenueName: diag.calendarVenueName,
              officialVenueName: diag.officialVenueName,
              opponentMismatch: diag.hasOpponentMismatch,
              calendarOpponent: diag.calendarOpponent,
              officialOpponent: diag.officialOpponent
            };
          }

          // Mark corresponding bare fixture event for deletion to avoid duplicates
          duplicateFixtureIdsToDelete.push(`fixture-${opts.profileId}-${result.officialFixture.id}`);
        }

        if (duplicateFixtureIdsToDelete.length > 0) {
          await database.events.bulkDelete(duplicateFixtureIdsToDelete).catch(() => {});
        }
      }
    }
  }

  if (withMeta.length > 0) await database.events.bulkPut(withMeta);
  await database.profiles.update(opts.profileId, {
    calendarUrl: opts.url,
    lastOfficialSyncAt: new Date().toISOString()
  });
  return withMeta.length;
}

/** Association JSON when the URL is a federation page; otherwise ICS via the worker proxy. */
export async function ingestSourceForProfile(opts: {
  profileId: string;
  playerName: string;
  teamName: string;
  sport: SportType;
  url: string;
  database?: PelipaivaDB;
  includeWeather?: boolean;
  squadFilters?: string[];
}): Promise<number> {
  const parsedAssoc = parseAssociationUrl(opts.url);
  const cup = exampleTournamentFromUrl(opts.url);
  if (parsedAssoc || cup) {
    const result = await ingestOfficialForProfile(opts);
    return result.official?.fixtures.length || 0;
  }
  return ingestIcsForProfile(opts);
}
