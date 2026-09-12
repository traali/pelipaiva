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
    return true;
  }

  return false;
}

/**
 * Stitches club calendar events (e.g. MyClub / Nimenhuuto) with bare official fixtures (e.g. Torneopal / SPL)
 * on the same calendar day matching the team or opponent.
 *
 * Invariants:
 * - Matches within ±180 min on the same local date.
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
    // If calendar event already represents a linked official fixture, do not re-match
    if (cal.officialFixtureId) continue;

    const calDate = new Date(cal.startTime);
    let bestFix: MatchdayEvent | undefined;
    let bestDiffMins = Infinity;

    // Search for closest matching candidate within 180 min window on the same local date
    for (const fix of bareFixtures) {
      if (usedFixtureIds.has(fix.id) || bareFixtureIdsToDelete.has(fix.id)) continue;
      if (fix.officialFixtureId && enrichedFixtureIds.has(fix.officialFixtureId)) continue;

      const fixDate = new Date(fix.startTime);
      const diffMins = Math.abs(fixDate.getTime() - calDate.getTime()) / 60000;
      if (diffMins > 180 || helsinkiDayKey(calDate) !== helsinkiDayKey(fixDate)) continue;

      if (isCalendarFixtureMatch(cal, fix)) {
        if (diffMins < bestDiffMins) {
          bestDiffMins = diffMins;
          bestFix = fix;
        }
      }
    }

    if (bestFix) {
      const fix = bestFix;
      const fixDate = new Date(fix.startTime);

      cal.homeTeam = fix.homeTeam;
      cal.awayTeam = fix.awayTeam;
      cal.title = `${fix.homeTeam} vs ${fix.awayTeam}`;
      cal.officialFixtureId = fix.officialFixtureId || fix.id.replace(/^fixture-[^-]+-/, '');
      cal.reconciliationStatus = 'auto_matched';
      cal.score = fix.score || cal.score;
      cal.tournamentName = fix.tournamentName || cal.tournamentName;

      // Kickoff & Warmup timing
      const originalCalStart = cal.startTime;
      if (fixDate.getTime() > calDate.getTime()) {
        cal.warmupTime = cal.warmupTime || originalCalStart;
        cal.startTime = fix.startTime;
        cal.endTime = fix.endTime || cal.endTime;
      } else {
        cal.startTime = fix.startTime;
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

