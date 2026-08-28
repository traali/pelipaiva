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
