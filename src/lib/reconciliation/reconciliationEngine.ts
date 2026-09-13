import {
  MatchdayEvent,
  MismatchDiagnostics,
  OfficialLeagueFixture,
  ReconciliationResult
} from '../../types/matchday';
import { calculateTeamSimilarity, normalizeTeamName, MULTILINGUAL_COLORS } from './teamNameMatcher';

function isGenericOrSquadTag(tag: string): boolean {
  const t = (tag || '').trim().toLowerCase();
  if (!t || t.length <= 1) return true;
  if (MULTILINGUAL_COLORS[t]) return true;
  const GENERIC_MATCH_TERMS = [
    'piirisarja',
    'sarjapeli',
    'sarjaottelu',
    'harkkapeli',
    'harjoitusottelu',
    'peli',
    'ottelu',
    'turnaus',
    'haaste',
    'kilpa',
    'edustus',
    'akatemia',
    'pelipäivä',
    'omatoimi',
    'liiga',
    'cup'
  ];
  return GENERIC_MATCH_TERMS.some((term) => t === term || t.startsWith(term) || t.endsWith(term));
}

export function isTournamentish(event: MatchdayEvent): boolean {
  return (
    event.eventType === 'tournament' ||
    Boolean(event.isTournament) ||
    /turnaus|tournament|cup\b|memorial|pelitapahtuma|vastuuturnaus/i.test(
      `${event.title} ${event.tournamentName || ''} ${event.notes || ''}`
    )
  );
}

/** Nimenhuuto turnaus DTSTART is kokoontuminen. Undo the old 45-min invented warmup. */
export function normalizeTournamentArrival<T extends { startTime: string; warmupTime?: string }>(
  event: T
): T {
  const start = new Date(event.startTime).getTime();
  if (!Number.isFinite(start)) return event;
  const warm = event.warmupTime ? new Date(event.warmupTime).getTime() : NaN;
  if (Number.isFinite(warm) && Math.abs(start - warm - 45 * 60_000) <= 2 * 60_000) {
    event.warmupTime = event.startTime;
  } else if (!event.warmupTime) {
    event.warmupTime = event.startTime;
  }
  return event;
}

/**
 * TASO/Torneopal owns kickoff. MyClub/Nimenhuuto owns arrival (kokoontuminen).
 * Calendar DTSTART is often the gathering time, 30–60 min before official kickoff.
 */
export function applyOfficialKickoffKeepCalendarArrival<
  T extends { startTime: string; warmupTime?: string; endTime?: string }
>(
  event: T,
  official: { startTime: string; endTime?: string },
  defaultWarmupMins = 45
): T {
  const calendarStart = event.startTime
  const calendarWarmup = event.warmupTime
  const offMs = new Date(official.startTime).getTime()
  if (!Number.isFinite(offMs)) return event

  event.startTime = official.startTime
  if (official.endTime) event.endTime = official.endTime

  const arrivals = [calendarWarmup, calendarStart]
    .filter((t): t is string => Boolean(t))
    .map((t) => new Date(t).getTime())
    .filter((ms) => Number.isFinite(ms) && ms < offMs)

  const arrivalMs = arrivals.length ? Math.max(...arrivals) : offMs - defaultWarmupMins * 60_000
  event.warmupTime = new Date(arrivalMs).toISOString()
  return event
}

const KICKOFF_BEFORE_ARRIVAL_SLACK_MS = 5 * 60_000;

type TeamSides = { homeTeam?: string; awayTeam?: string; title?: string };

export function ownTeamFromCalendar(cal: TeamSides): string {
  const home = cal.homeTeam?.trim() || '';
  const away = cal.awayTeam?.trim() || '';
  const title = cal.title?.trim() || '';
  if (home && !isGenericOrSquadTag(home)) return home;
  if (away && !isGenericOrSquadTag(away)) return away;
  return title;
}

function identityConflicts(calendarText: string, fixtureTeam: string): boolean {
  const a = normalizeTeamName(calendarText);
  const b = normalizeTeamName(fixtureTeam);
  if (a.color && b.color && a.color !== b.color) return true;
  if (a.squad && b.squad && a.squad !== b.squad) return true;
  if (a.ageGroup && b.ageGroup && a.ageGroup !== b.ageGroup) return true;
  return false;
}

/** TASO row is this child’s team as home or away — not another Indians/PPJ squad. */
export function fixtureInvolvesOwnTeam(cal: TeamSides, fix: TeamSides): boolean {
  const fixHome = fix.homeTeam?.trim() || '';
  const fixAway = fix.awayTeam?.trim() || '';
  if (!fixHome || !fixAway) return false;

  const own = ownTeamFromCalendar(cal);
  const blob = `${own} ${cal.title || ''}`.trim();
  if (!blob) return false;

  const scored = [
    { team: fixHome, sim: Math.max(calculateTeamSimilarity(own, fixHome), calculateTeamSimilarity(cal.title || '', fixHome)) },
    { team: fixAway, sim: Math.max(calculateTeamSimilarity(own, fixAway), calculateTeamSimilarity(cal.title || '', fixAway)) }
  ];
  return scored.some((s) => s.sim >= 0.70 && !identityConflicts(blob, s.team));
}

/**
 * Nimenhuuto/MyClub DTSTART is kokoontuminen. Torneopal kickoff must not be earlier
 * (morning pool games do not belong on a 15.00 meetup card). Equal times = calendar is kickoff.
 */
export function isKickoffAfterKokoontuminen(
  cal: { startTime: string; warmupTime?: string; eventType?: string; isTournament?: boolean; title?: string; tournamentName?: string; notes?: string },
  officialStartIso: string
): boolean {
  const kick = new Date(officialStartIso).getTime();
  if (!Number.isFinite(kick)) return false;
  const tournament = isTournamentish(cal as MatchdayEvent);
  let arrivalIso = cal.startTime;
  if (!tournament && cal.warmupTime) {
    const warm = new Date(cal.warmupTime).getTime();
    const start = new Date(cal.startTime).getTime();
    if (Number.isFinite(warm) && warm < start) arrivalIso = cal.warmupTime;
  }
  const arrival = new Date(arrivalIso).getTime();
  if (!Number.isFinite(arrival)) return false;
  return kick + KICKOFF_BEFORE_ARRIVAL_SLACK_MS >= arrival;
}

/** Helsinki-local calendar-day key — UTC keys mis-bucketed 00:00–02:59 FI events
 *  against the ±180 min tolerance window (M-19/V6, SPEC §5.1 "same day" is local). */
function helsinkiDayKey(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Computes explicit mismatch diagnostics between a calendar event and an official league fixture.
 */
export function computeMismatchDiagnostics(
  calendarEvent: MatchdayEvent,
  officialFixture: OfficialLeagueFixture
): MismatchDiagnostics {
  const calStart = new Date(calendarEvent.startTime);
  const offStart = new Date(officialFixture.startTime);

  const timeDiffMinutes = Math.round(Math.abs(offStart.getTime() - calStart.getTime()) / 60000);
  
  // MyClub events frequently start 30–60 min before official kickoff for gathering/warmup
  const isIntentionalWarmupOffset = offStart.getTime() > calStart.getTime() && timeDiffMinutes >= 15 && timeDiffMinutes <= 75;
  const hasKickoffMismatch = timeDiffMinutes >= 5;

  const calTimeStr = calStart.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  const offTimeStr = offStart.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

  // Venue comparison
  const calVenue = calendarEvent.venue?.name || '';
  const offVenue = officialFixture.venueName || '';
  const normCalVenue = calVenue.toLowerCase().replace(/[\s\-_]/g, '');
  const normOffVenue = offVenue.toLowerCase().replace(/[\s\-_]/g, '');
  const hasVenueMismatch = normCalVenue.length > 0 && normOffVenue.length > 0 && !normCalVenue.includes(normOffVenue) && !normOffVenue.includes(normCalVenue);

  // Opponent comparison
  const calOpponent = calendarEvent.awayTeam || calendarEvent.homeTeam || '';
  const offOpponent = officialFixture.isHome ? officialFixture.awayTeam : officialFixture.homeTeam;
  const oppSim = calculateTeamSimilarity(calOpponent, offOpponent);
  const hasOpponentMismatch = oppSim < 0.60;

  return {
    hasKickoffMismatch,
    isWarmupOffset: isIntentionalWarmupOffset,
    calendarStartTime: calTimeStr,
    officialStartTime: offTimeStr,
    timeDiffMinutes,
    hasVenueMismatch,
    calendarVenueName: calVenue,
    officialVenueName: offVenue,
    hasOpponentMismatch,
    calendarOpponent: calOpponent,
    officialOpponent: offOpponent
  };
}

/**
 * Conservative fuzzy join engine that links calendar events with official league fixtures.
 * Only auto-matches when:
 * - Match date is the same calendar day
 * - Time window is within ±3 hours (180 mins)
 * - Opponent similarity is >= 0.85
 */
export function reconcileCalendarWithOfficial(
  calendarEvents: MatchdayEvent[],
  officialFixtures: OfficialLeagueFixture[],
  customAliasesMap?: Map<string, string>
): Map<string, ReconciliationResult> {
  const resultMap = new Map<string, ReconciliationResult>();

  for (const event of calendarEvents) {
    if (event.isTraining || event.eventType === 'training' || event.eventType === 'meeting') {
      resultMap.set(event.id, {
        status: 'unlinked',
        confidenceScore: 0.0
      });
      continue;
    }

    const eventDate = new Date(event.startTime);
    const eventDayKey = helsinkiDayKey(eventDate);

    const candidates: { fixture: OfficialLeagueFixture; score: number }[] = [];

    for (const fixture of officialFixtures) {
      const fixDate = new Date(fixture.startTime);
      const fixDayKey = helsinkiDayKey(fixDate);

      // Date must match or be within 24h
      if (eventDayKey !== fixDayKey) continue;

      // Time proximity check: ±3h (180 minutes)
      const timeDiffMins = Math.abs(fixDate.getTime() - eventDate.getTime()) / 60000;
      if (timeDiffMins > 180) continue;
      if (!isKickoffAfterKokoontuminen(event, fixture.startTime)) continue;

      // Opponent comparison
      const offOpponent = fixture.isHome ? fixture.awayTeam : fixture.homeTeam;
      const offOwnTeam = fixture.isHome ? fixture.homeTeam : fixture.awayTeam;
      let simAway = calculateTeamSimilarity(event.awayTeam, offOpponent);
      let simHome = calculateTeamSimilarity(event.homeTeam, offOpponent);

      // Check learned custom aliases
      if (customAliasesMap) {
        const learnedAway = customAliasesMap.get(event.awayTeam.toLowerCase().trim());
        const learnedHome = customAliasesMap.get(event.homeTeam.toLowerCase().trim());
        if (learnedAway && offOpponent.toLowerCase().includes(learnedAway.toLowerCase())) {
          simAway = 1.0;
        }
        if (learnedHome && offOpponent.toLowerCase().includes(learnedHome.toLowerCase())) {
          simHome = 1.0;
        }
      }

      let bestMatchSim = Math.max(simAway, simHome);

      // If opponent is not named in calendar event (e.g. MyClub title is "PPJ Laru 2013: PIIRISARJA - SININEN"),
      // check if this is the team's internal match entry for this exact fixture.
      if (bestMatchSim < 0.40) {
        const isInternalTag = isGenericOrSquadTag(event.awayTeam) || !event.awayTeam;
        if (isInternalTag) {
          const simOwnHome = calculateTeamSimilarity(event.homeTeam, offOwnTeam);
          const simOwnTitle = calculateTeamSimilarity(event.title, offOwnTeam);
          const simOwn = Math.max(simOwnHome, simOwnTitle);

          if (simOwn >= 0.60) {
            const normAway = normalizeTeamName(event.awayTeam);
            const normHome = normalizeTeamName(event.homeTeam);
            const normTitle = normalizeTeamName(event.title);
            const normOff = normalizeTeamName(offOwnTeam);

            const eventColor = normAway.color || normTitle.color || normHome.color;
            const fixtureColor = normOff.color;
            const hasColorConflict = eventColor && fixtureColor && eventColor !== fixtureColor;

            if (!hasColorConflict) {
              bestMatchSim = eventColor && fixtureColor && eventColor === fixtureColor ? 0.95 : 0.85;
            }
          }
        }
      }

      // Must have at least basic similarity (>= 0.40) to be a valid candidate
      if (bestMatchSim < 0.40) continue;

      // Time score: 1.0 if calendar event is 15-75 min early (intentional coach warmup), or dropping from 1.0 to 0.0 across 180 min
      const isIntentionalWarmup = fixDate.getTime() > eventDate.getTime() && timeDiffMins >= 15 && timeDiffMins <= 75;
      const timeScore = isIntentionalWarmup ? 1.0 : Math.max(0, 1 - timeDiffMins / 180);

      // Overall confidence score
      const confidenceScore = Math.round((0.7 * bestMatchSim + 0.3 * timeScore) * 100) / 100;

      if (confidenceScore >= 0.50) {
        candidates.push({ fixture, score: confidenceScore });
      }
    }

    if (candidates.length === 0 && isTournamentish(event)) {
      const sameDay = officialFixtures.filter((fixture) => {
        if (helsinkiDayKey(new Date(fixture.startTime)) !== eventDayKey) return false;
        if (!isKickoffAfterKokoontuminen(event, fixture.startTime)) return false;
        return fixtureInvolvesOwnTeam(event, fixture);
      });
      const pool = sameDay.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
      const first = pool[0];
      if (first) {
        candidates.push({ fixture: first, score: 0.86 });
      }
    }

    if (candidates.length === 0) {
      resultMap.set(event.id, {
        status: 'unlinked',
        confidenceScore: 0.0
      });
      continue;
    }

    // Sort by confidence score descending
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;

    const mismatches = computeMismatchDiagnostics(event, best.fixture);

    // Auto-match threshold >= 0.85 and no ambiguous tie
    const hasAmbiguity = candidates.length > 1 && candidates[1] && Math.abs(best.score - candidates[1].score) < 0.10;

    if (best.score >= 0.85 && !hasAmbiguity) {
      resultMap.set(event.id, {
        status: 'auto_matched',
        confidenceScore: best.score,
        officialFixture: best.fixture,
        mismatches
      });
    } else if (best.score >= 0.60) {
      resultMap.set(event.id, {
        status: 'candidate_match',
        confidenceScore: best.score,
        officialFixture: best.fixture,
        mismatches
      });
    } else {
      resultMap.set(event.id, {
        status: 'unlinked',
        confidenceScore: best.score,
        officialFixture: best.fixture,
        mismatches
      });
    }
  }

  return resultMap;
}

/**
 * Applies a 1-tap user conflict resolution decision to a calendar event.
 * Decisions:
 * - 'use_official': Adopts official fixture start time and venue.
 * - 'keep_calendar': Retains private calendar time and venue.
 * - 'unlink': Completely severs match link between calendar event and official fixture.
 */
export function applyResolutionDecision(
  event: MatchdayEvent,
  officialFixture: OfficialLeagueFixture,
  decision: 'use_official' | 'keep_calendar' | 'unlink'
): MatchdayEvent {
  const now = new Date().toISOString();

  if (decision === 'use_official') {
    const warmupOffsetMins = 45;
    const offStartDate = new Date(officialFixture.startTime);
    const warmupDate = new Date(offStartDate.getTime() - warmupOffsetMins * 60 * 1000);
    const endDate = new Date(offStartDate.getTime() + 90 * 60 * 1000);

    return {
      ...event,
      startTime: officialFixture.startTime,
      warmupTime: warmupDate.toISOString(),
      endTime: endDate.toISOString(),
      homeTeam: officialFixture.homeTeam,
      awayTeam: officialFixture.awayTeam,
      isHomeMatch: officialFixture.isHome,
      officialFixtureId: officialFixture.id,
      reconciliationStatus: 'manual_matched',
      userOverride: {
        action: 'adopt_official',
        appliedAt: now,
        notes: 'Synkronoitu virallisen liigadatan kanssa'
      }
    };
  }

  if (decision === 'keep_calendar') {
    return {
      ...event,
      officialFixtureId: officialFixture.id,
      reconciliationStatus: 'manual_matched',
      userOverride: {
        action: 'keep_calendar',
        appliedAt: now,
        notes: 'Säilytetty omat kalenterimerkinnät'
      }
    };
  }

  // 'unlink'
  return {
    ...event,
    officialFixtureId: undefined,
    reconciliationStatus: 'unlinked',
    userOverride: {
      action: 'unlink',
      appliedAt: now,
      notes: 'Ottelulinkki purettu'
    }
  };
}

/**
 * Verifies whether a calendar event and an official bare fixture correspond to the same match.
 * Enforces two-sided team verification when both teams are known, preventing false merges
 * from single-team matches.
 */
function isCalendarFixtureMatch(cal: MatchdayEvent, fix: MatchdayEvent): boolean {
  const fixHome = fix.homeTeam?.trim() || '';
  const fixAway = fix.awayTeam?.trim() || '';
  if (!fixHome || !fixAway) return false;

  const calHome = cal.homeTeam?.trim() || '';
  const calAway = cal.awayTeam?.trim() || '';
  const rawTitle = cal.title?.trim() || '';

  // Check if rawTitle explicitly has two teams (e.g. "PPJ Laru Sininen vs VJS")
  const cleanTitle = rawTitle.replace(/^(?:peli|ottelu|seriematch|friendly)\s*[:@-]?\s*/i, '').trim();
  const vsMatch = cleanTitle.match(/^(.+?)\s+(?:vs\.?|v|-)\s+(.+)$/i);
  if (vsMatch && vsMatch[1] && vsMatch[2]) {
    const tHome = vsMatch[1].trim();
    const tAway = vsMatch[2].trim();
    if (!isGenericOrSquadTag(tHome) && !isGenericOrSquadTag(tAway)) {
      const dHome = calculateTeamSimilarity(tHome, fixHome);
      const dAway = calculateTeamSimilarity(tAway, fixAway);
      if (dHome >= 0.70 && dAway >= 0.70) return true;

      const fHome = calculateTeamSimilarity(tHome, fixAway);
      const fAway = calculateTeamSimilarity(tAway, fixHome);
      if (fHome >= 0.70 && fAway >= 0.70) return true;
    }
  }

  const isHomeGeneric = !calHome || isGenericOrSquadTag(calHome);
  const isAwayGeneric = !calAway || isGenericOrSquadTag(calAway);

  // Case 1: Both teams explicitly identified on the calendar event
  if (!isHomeGeneric && !isAwayGeneric) {
    // Direct match: cal home matches fix home AND cal away matches fix away
    const directHome = calculateTeamSimilarity(calHome, fixHome);
    const directAway = calculateTeamSimilarity(calAway, fixAway);
    if (directHome >= 0.70 && directAway >= 0.70) {
      return true;
    }

    // Flipped match: calendar perspective was inverted (e.g. away match written as "Opponent vs Home")
    const flippedHome = calculateTeamSimilarity(calHome, fixAway);
    const flippedAway = calculateTeamSimilarity(calAway, fixHome);
    if (flippedHome >= 0.70 && flippedAway >= 0.70) {
      return true;
    }

    return false;
  }

  // Case 2: One team is generic/squad tag, or only title has text (e.g. "PPJ Laru 2013: PIIRISARJA - SININEN")
  const candidateCalTeam = !isHomeGeneric ? calHome : (!isAwayGeneric ? calAway : rawTitle);
  const simOwnHome = calculateTeamSimilarity(candidateCalTeam, fixHome);
  const simOwnAway = calculateTeamSimilarity(candidateCalTeam, fixAway);
  const simOwnTitleHome = calculateTeamSimilarity(rawTitle, fixHome);
  const simOwnTitleAway = calculateTeamSimilarity(rawTitle, fixAway);

  const bestHome = Math.max(simOwnHome, simOwnTitleHome);
  const bestAway = Math.max(simOwnAway, simOwnTitleAway);
  const maxSimOwn = Math.max(bestHome, bestAway);

  if (maxSimOwn >= 0.70) {
    const matchedFixTeam = bestHome >= bestAway ? fixHome : fixAway;
    const combinedCalText = `${rawTitle} ${calHome} ${calAway}`;
    const normCal = normalizeTeamName(combinedCalText);
    const normFix = normalizeTeamName(matchedFixTeam);

    if (normCal.color && normFix.color && normCal.color !== normFix.color) {
      return false;
    }
    if (normCal.squad && normFix.squad && normCal.squad !== normFix.squad) {
      return false;
    }
    if (normCal.ageGroup && normFix.ageGroup && normCal.ageGroup !== normFix.ageGroup) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Stitches club calendar events (e.g. MyClub / Nimenhuuto) with bare official fixtures (e.g. Torneopal / SPL)
 * on the same calendar day matching the team or opponent.
 *
 * Invariants:
 * - Own team must be TASO home or away (colour / age / squad may not conflict).
 * - Official kickoff must be at or after calendar kokoontuminen (5 min slack).
 * - Matches on the same local date.
 * - Adopts authoritative official fixture start time as match kickoff.
 * - Preserves earlier calendar start time as coach warmup/gathering time.
 * - Reconciles venues: adopts Torneopal venue and flags non-breaking venueMismatch for the UI banner.
 * - Suppresses bare fixture duplicates, guaranteeing a single enriched event card.
 */
export function stitchCalendarEventsWithFixtures(rawEvents: MatchdayEvent[]): MatchdayEvent[] {
  const rawAll = rawEvents.filter((e) => !e.isHidden).map((e) => ({ ...e }));

  const enrichedFixtureIds = new Set<string>();
  const bareFixtureIdsToDelete = new Set<string>();
  const usedFixtureIds = new Set<string>();

  for (const e of rawAll) {
    if (e.officialFixtureId && !e.id.startsWith('fixture-')) {
      enrichedFixtureIds.add(e.officialFixtureId);
    }
  }

  // Process calendar matches chronologically
  const calendarMatches = rawAll
    .filter((e) => !e.id.startsWith('fixture-') && !e.isTraining)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const bareFixtures = rawAll
    .filter((e) => e.id.startsWith('fixture-'))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  for (const cal of calendarMatches) {
    const calDate = new Date(cal.startTime);

    const collectSameDay = (includeLinked: boolean) =>
      bareFixtures.filter((fix) => {
        if (usedFixtureIds.has(fix.id) || bareFixtureIdsToDelete.has(fix.id)) return false;
        if (!includeLinked && fix.officialFixtureId && enrichedFixtureIds.has(fix.officialFixtureId)) return false;
        if (fix.sport && cal.sport && fix.sport !== cal.sport) return false;
        if (helsinkiDayKey(calDate) !== helsinkiDayKey(new Date(fix.startTime))) return false;
        if (includeLinked && (fix.officialFixtureId === cal.officialFixtureId || fix.id.endsWith(cal.officialFixtureId || '—'))) {
          return false;
        }
        return isCalendarFixtureMatch(cal, fix) || fixtureInvolvesOwnTeam(cal, fix);
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Already linked: still fold leftover same-day own-team TASO games onto this card.
    if (cal.officialFixtureId) {
      const extras = collectSameDay(true);
      if (extras.length) {
        const selfTitle =
          cal.homeTeam && cal.awayTeam ? `${cal.homeTeam} vs ${cal.awayTeam}` : cal.title;
        const merged = [
          {
            startTime: cal.startTime,
            title: selfTitle,
            officialFixtureId: cal.officialFixtureId,
            score: cal.score
          },
          ...extras.map((f) => ({
            startTime: f.startTime,
            title: f.homeTeam && f.awayTeam ? `${f.homeTeam} vs ${f.awayTeam}` : f.title,
            officialFixtureId: f.officialFixtureId || f.id.replace(/^fixture-[^-]+-/, ''),
            score: f.score
          }))
        ].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const seen = new Set<string>();
        cal.officialGameTimes = merged.filter((g) => {
          const k = g.officialFixtureId || g.startTime;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        for (const f of extras) {
          usedFixtureIds.add(f.id);
          bareFixtureIdsToDelete.add(f.id);
        }
      }
      continue;
    }
    let bestFix: MatchdayEvent | undefined;
    let bestDiffMins = Infinity;
    let sameDayPool: MatchdayEvent[] = [];

    // Always fold every same-day TASO game for this team onto one card
    // (turnaus, two league games, cup — title does not matter).
    const sameDayTeam = bareFixtures.filter((fix) => {
      if (usedFixtureIds.has(fix.id) || bareFixtureIdsToDelete.has(fix.id)) return false;
      if (fix.officialFixtureId && enrichedFixtureIds.has(fix.officialFixtureId)) return false;
      if (fix.sport && cal.sport && fix.sport !== cal.sport) return false;
      if (helsinkiDayKey(calDate) !== helsinkiDayKey(new Date(fix.startTime))) return false;
      return isCalendarFixtureMatch(cal, fix) || fixtureInvolvesOwnTeam(cal, fix);
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (sameDayTeam.length >= 1) {
      const afterMeetup = sameDayTeam.filter((f) => isKickoffAfterKokoontuminen(cal, f.startTime));
      bestFix = afterMeetup[0] || sameDayTeam[0];
      if (sameDayTeam.length >= 2) {
        sameDayPool = sameDayTeam;
      }
    } else if (!isTournamentish(cal)) {
      for (const fix of bareFixtures) {
        if (usedFixtureIds.has(fix.id) || bareFixtureIdsToDelete.has(fix.id)) continue;
        if (fix.officialFixtureId && enrichedFixtureIds.has(fix.officialFixtureId)) continue;

        const fixDate = new Date(fix.startTime);
        const diffMins = Math.abs(fixDate.getTime() - calDate.getTime()) / 60000;
        if (diffMins > 180 || helsinkiDayKey(calDate) !== helsinkiDayKey(fixDate)) continue;
        if (!isKickoffAfterKokoontuminen(cal, fix.startTime)) continue;

        if (isCalendarFixtureMatch(cal, fix)) {
          if (diffMins < bestDiffMins) {
            bestDiffMins = diffMins;
            bestFix = fix;
          }
        }
      }
    }

    if (sameDayPool.length >= 2) {
      cal.officialGameTimes = sameDayPool.map((f) => ({
        startTime: f.startTime,
        title: f.homeTeam && f.awayTeam ? `${f.homeTeam} vs ${f.awayTeam}` : f.title,
        officialFixtureId: f.officialFixtureId || f.id.replace(/^fixture-[^-]+-/, ''),
        score: f.score
      }));
      for (const f of sameDayPool) {
        usedFixtureIds.add(f.id);
        bareFixtureIdsToDelete.add(f.id);
      }
    }

    if (bestFix) {
      const fix = bestFix;
      const fixDate = new Date(fix.startTime);
      const keepMultiGameTitle = isTournamentish(cal) || sameDayPool.length >= 2;

      if (!keepMultiGameTitle) {
        cal.homeTeam = fix.homeTeam;
        cal.awayTeam = fix.awayTeam;
        cal.title = `${fix.homeTeam} vs ${fix.awayTeam}`;
      }
      cal.officialFixtureId = fix.officialFixtureId || fix.id.replace(/^fixture-[^-]+-/, '');
      cal.reconciliationStatus = 'auto_matched';
      cal.score = fix.score || cal.score;
      cal.tournamentName = cal.tournamentName || fix.tournamentName;

      applyOfficialKickoffKeepCalendarArrival(cal, fix);
      if (keepMultiGameTitle) {
        cal.warmupTime = new Date(calDate).toISOString();
      }

      // If official kickoff differs from original calendar time, attach mismatch flags
      const timeDiffMins = Math.round(Math.abs(fixDate.getTime() - calDate.getTime()) / 60000);
      if (timeDiffMins >= 5) {
        cal.mismatchFlags = {
          ...cal.mismatchFlags,
          timeMismatch: true,
          timeDiffMinutes: timeDiffMins,
          calendarStartTime: calDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' }),
          officialStartTime: fixDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' }),
          officialStartTimeIso: fix.startTime,
        };
      }

      // Venue adoption & mismatch diagnostics
      const calVenueName = cal.venue?.name?.trim() || '';
      const fixVenueName = fix.venue?.name?.trim() || '';

      if (fix.venue && !calVenueName) {
        // Empty/undefined calendar venue: adopt authoritative fixture venue cleanly
        cal.venue = fix.venue;
      } else if (fixVenueName && calVenueName) {
        const venuesDiffer =
          fixVenueName.toLowerCase() !== calVenueName.toLowerCase() &&
          (fix.venue?.normalizedName || fixVenueName.toLowerCase()) !==
            (cal.venue?.normalizedName || calVenueName.toLowerCase());
        if (venuesDiffer) {
          cal.mismatchFlags = {
            ...cal.mismatchFlags,
            venueMismatch: true,
            calendarVenueName: calVenueName,
            officialVenueName: fixVenueName
          };
          cal.venue = fix.venue;
        } else if (fix.venue) {
          cal.venue = fix.venue;
        }
      }

      // Claim fixture: prevent greedy overwriting in doubleheaders (<180m apart)
      usedFixtureIds.add(fix.id);
      bareFixtureIdsToDelete.add(fix.id);
      if (cal.officialFixtureId) {
        enrichedFixtureIds.add(cal.officialFixtureId);
      }
    }
  }

  // Suppress bare fixture duplicates if an enriched calendar event already represents it
  const filteredEvents = rawAll.filter((e) => {
    if (e.id.startsWith('fixture-')) {
      if (e.officialFixtureId && enrichedFixtureIds.has(e.officialFixtureId)) {
        return false;
      }
      if (bareFixtureIdsToDelete.has(e.id)) {
        return false;
      }
    }
    return true;
  });

  // Cross-calendar duplicate deduplication:
  // If two non-training match events for the same player occur within ±90 minutes
  // and represent the exact same match (e.g. MyClub "PPJ Laru 2013: Piirisarja - ORANSSI"
  // and linked/official "IF Gnistan/sininen vs PPJ/Laru oran"), merge into a single card!
  const finalEvents: MatchdayEvent[] = [];
  const mergedEventIds = new Set<string>();

  for (let i = 0; i < filteredEvents.length; i++) {
    const e1 = filteredEvents[i]!;
    if (mergedEventIds.has(e1.id)) continue;

    for (let j = i + 1; j < filteredEvents.length; j++) {
      const e2 = filteredEvents[j]!;
      if (mergedEventIds.has(e2.id)) continue;

      if (e1.profileId && e2.profileId && e1.profileId !== e2.profileId) continue;
      if (e1.sport !== e2.sport) continue;
      if (e1.isTraining || e2.isTraining) continue;
      if (isTournamentish(e1) || isTournamentish(e2)) continue;

      const t1 = new Date(e1.startTime);
      const t2 = new Date(e2.startTime);
      if (helsinkiDayKey(t1) !== helsinkiDayKey(t2)) continue;
      if (Math.abs(t1.getTime() - t2.getTime()) > 90 * 60 * 1000) continue;

      const isMatch = isCalendarFixtureMatch(e1, e2) || isCalendarFixtureMatch(e2, e1);
      if (isMatch) {
        const e1HasBoth = Boolean(e1.homeTeam && e1.awayTeam && !isGenericOrSquadTag(e1.awayTeam));
        const e2HasBoth = Boolean(e2.homeTeam && e2.awayTeam && !isGenericOrSquadTag(e2.awayTeam));
        const primary = (e2HasBoth && !e1HasBoth) || (!e1.officialFixtureId && e2.officialFixtureId) ? e2 : e1;
        const secondary = primary === e1 ? e2 : e1;

        if (!primary.warmupTime && secondary.warmupTime) {
          primary.warmupTime = secondary.warmupTime;
        }
        if (secondary.volunteerDuty && !primary.volunteerDuty) {
          primary.volunteerDuty = secondary.volunteerDuty;
        }
        if (secondary.attendanceStatus && !primary.attendanceStatus) {
          primary.attendanceStatus = secondary.attendanceStatus;
        }

        mergedEventIds.add(secondary.id);
        break;
      }
    }

    if (!mergedEventIds.has(e1.id)) {
      finalEvents.push(e1);
    }
  }

  return finalEvents.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

