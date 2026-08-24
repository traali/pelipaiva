import type { ArrivalRules, MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import { carpoolAgent } from './carpoolAgent';
import { conflictAgent } from './conflictAgent';
import { kitAgent } from './kitAgent';
import { tournamentAgent } from './tournamentAgent';
import type { MissionControlSnapshot, WeekendDayStrip } from './types';
import { talkooWhatsAppLine, volunteerAgent } from './volunteerAgent';
import {
  addHelsinkiDays,
  eventsInRange,
  formatFiTime,
  formatFiWeekday,
  helsinkiDateISO,
  helsinkiOffsetForDateISO,
  sportsWeekRange
} from './time';

function helsinkiWallLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Helsinki'
  });
}

function childName(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.playerName || 'Lapsi';
}

function colorOf(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.colorHex || '#10b981';
}

function buildDayStrips(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  _mondayISO: string,
  now = new Date()
): WeekendDayStrip[] {
  const todayISO = helsinkiDateISO(now);
  // EET/EEST-aware offset — hardcoded +03:00 mis-derived weekdays after fall-back (M-51).
  const dow = new Date(`${todayISO}T12:00:00${helsinkiOffsetForDateISO(todayISO)}`).getDay(); // 0 Sun, 1 Mon...
  const isWeekday = dow >= 1 && dow <= 4;
  const fridayISO = addHelsinkiDays(todayISO, dow === 0 ? -2 : 5 - dow);
  const days = isWeekday
    ? Array.from({ length: Math.min(5, 7 - dow + 1) }, (_, offset) => addHelsinkiDays(todayISO, offset))
    : [0, 1, 2].map((offset) => addHelsinkiDays(fridayISO, offset));
  const nowMs = now.getTime();

  return days.map((date) => {
    const dayEvents = events
      .filter((e) => helsinkiDateISO(new Date(e.startTime)) === date && profiles.some((p) => p.id === e.profileId))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const weekday = formatFiWeekday(date);
    const label = helsinkiWallLabel(date);
    const isPastDay = date < todayISO;
    const isToday = date === todayISO;

    return {
      date,
      weekday,
      label,
      isPast: isPastDay,
      isToday,
      events: dayEvents.map((e) => ({
        eventId: e.id,
        time: formatFiTime(e.startTime),
        childName: childName(e, profiles),
        colorHex: colorOf(e, profiles),
        sport: e.sport,
        title: e.isTraining ? (e.title || 'Harjoitukset') : `${e.homeTeam} vs ${e.awayTeam || '—'}`,
        venueName: e.venue.name,
        isTalkoo: Boolean(e.volunteerDuty),
        isTraining: Boolean(e.isTraining || e.eventType === 'training'),
        isPast: new Date(e.endTime).getTime() < nowMs
      }))
    };
  });
}

export function detectDifficultDays(
  events: MatchdayEvent[],
  _profiles: PlayerProfile[],
  conflicts: ReturnType<typeof conflictAgent>,
  now: Date = new Date()
) {
  const todayISO = helsinkiDateISO(now);
  const lookaheadDays = 14;
  const warnings: import('./types').DifficultDayWarning[] = [];

  const eventsByDate = new Map<string, MatchdayEvent[]>();
  for (const ev of events) {
    const d = helsinkiDateISO(new Date(ev.startTime));
    if (d >= todayISO && d <= addHelsinkiDays(todayISO, lookaheadDays)) {
      const list = eventsByDate.get(d) || [];
      list.push(ev);
      eventsByDate.set(d, list);
    }
  }

  for (const [date, dayEvents] of eventsByDate.entries()) {
    const weekday = formatFiWeekday(date);
    const label = new Date(`${date}T12:00:00${helsinkiOffsetForDateISO(date)}`).toLocaleDateString('fi-FI', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric'
    });

    const dayConflicts = conflicts.filter((c) => {
      return dayEvents.some((e) => e.id === c.eventAId || e.id === c.eventBId);
    });

    const distinctKids = new Set(dayEvents.map((e) => e.profileId));
    const hasTalkoo = dayEvents.some((e) => Boolean(e.volunteerDuty));
    const tournamentMatches = dayEvents.filter((e) => e.eventType === 'tournament');
    const reasons: string[] = [];

    let severity: import('./types').DifficultDayWarning['severity'] | null = null;
    let headline = '';
    let suggestedAction = '';

    if (dayConflicts.length > 0) {
      severity = 'critical';
      headline = '🔴 Päällekkäiset ottelut — tarvitaan 2 kuskia / autoa';
      reasons.push(...dayConflicts.map((c) => c.message));
      suggestedAction = 'Järjestä toiselle lapselle kyyti joukkuekaverilta tai varaa perheen molemmat autot.';
    } else if (dayEvents.length >= 3 && distinctKids.size >= 2) {
      severity = 'warn';
      headline = `🟠 Ruuhkapäivä: ${dayEvents.length} ottelua eri lapsilla`;
      reasons.push(`${distinctKids.size} eri lapsella pelejä eri kentillä pitkin päivää.`);
      if (hasTalkoo) reasons.push('Lisäksi vanhemmalla talkoo-/toimitsijavuoro.');
      suggestedAction = 'Tarkista lähtöajat ajoissa ja pakkaa eväät ja varusteet valmiiksi edellisenä iltana.';
    } else if (tournamentMatches.length >= 3) {
      severity = 'warn';
      headline = `🟠 Pitkä turnauspäivä (${tournamentMatches.length} ottelua)`;
      reasons.push(`Turnauskentällä menee useita tunteja (${tournamentMatches.length} peliä).`);
      suggestedAction = 'Muista riittävät välipalat, 2× juomapulloa, istuinalusta ja kuiva vaihtopaita.';
    } else if (hasTalkoo && dayEvents.length >= 2) {
      severity = 'info';
      headline = 'ℹ️ Ottelut + vanhemman talkoovuoro';
      reasons.push('Pelin lisäksi olet sidottuna kahvioon tai toimitsijapöytään.');
      suggestedAction = 'Varaa saapumiseen 15 minuutin lisäaika vuoron perehdytykseen.';
    }

    if (severity) {
      warnings.push({
        date,
        weekday,
        label,
        severity,
        headline,
        reasons,
        suggestedAction,
        eventCount: dayEvents.length
      });
    }
  }

  return warnings.sort((a, b) => a.date.localeCompare(b.date));
}

export function byStart(a: MatchdayEvent, b: MatchdayEvent): number {
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

/**
 * Deterministic family mission-control graph.
 * Planner runs specialists in a fixed order — no LLM, no network.
 *
 * Covers games, tournaments, and training/practices across the full 7-day sports week.
 */
export function runMissionControlGraph(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  now: Date = new Date(),
  _arrivalRules: ArrivalRules[] = []
): MissionControlSnapshot {
  const week = sportsWeekRange(now);
  const lookbackMs = now.getTime() - 2 * 3600 * 1000;

  const upcoming = [...events].filter((e) => new Date(e.endTime).getTime() >= lookbackMs).sort(byStart);

  const nextEvent = upcoming.find((e) => new Date(e.endTime).getTime() >= now.getTime()) || upcoming[0];
  const nextPlayer = nextEvent ? profiles.find((p) => p.id === nextEvent.profileId) : undefined;
  const depart = nextEvent ? calculateDepartureCountdown(nextEvent, nextPlayer?.arrivalRules) : undefined;

  const windowEvents = eventsInRange(events, week.start, week.end).sort(byStart);

  const graphEvents = upcoming.filter((e) => new Date(e.startTime).getTime() <= week.end.getTime());
  const specialistEvents =
    nextEvent && !graphEvents.some((e) => e.id === nextEvent.id) ? [...graphEvents, nextEvent] : graphEvents;

  const conflicts = conflictAgent(specialistEvents, profiles);
  const carpool = carpoolAgent(specialistEvents, profiles, conflicts);
  const talkoo = volunteerAgent(specialistEvents, profiles);
  const tournaments = tournamentAgent(events, profiles, now);
  const kitByEventId = kitAgent(specialistEvents, profiles);
  const difficultDays = detectDifficultDays(events, profiles, conflicts, now);

  const mondayISO = helsinkiDateISO(week.start);
  const days = buildDayStrips(windowEvents, profiles, mondayISO, now);

  const conflictLine =
    conflicts.length === 0
      ? 'Ei päällekkäisyyksiä.'
      : `${conflicts.length} ristiriita${conflicts.length === 1 ? '' : 'a'}: ${conflicts[0]!.message}`;

  const summary =
    windowEvents.length === 0 && !nextEvent
      ? 'Ei merkittyjä otteluita tai harjoituksia tälle viikolle.'
      : windowEvents.length === 0 && nextEvent
        ? `Seuraava: ${childName(nextEvent, profiles)} ${formatFiTime(nextEvent.startTime)} · ${nextEvent.venue.name}. ${conflictLine}`
        : `${windowEvents.length} tapahtumaa ${week.label}. ${conflictLine} ${talkoo.recommendation}`;

  const ambientLine = nextEvent
    ? `${childName(nextEvent, profiles)} · lähde klo ${depart?.departureTime} · ${nextEvent.venue.name}`
    : 'Ei seuraavaa peliä.';

  const whatsAppShareText = [
    `PELIPÄIVÄ ${week.label}`,
    'Kyytisuunnitelma',
    ...carpool.map(
      (l) =>
        `• Lähde ${l.leaveBy} · ${l.childName} → ${l.venueName} (${l.driverSlot}${
          l.canShareRideWith ? ` + ${l.canShareRideWith}` : ''
        })`
    ),
    conflicts.length ? `\nHuom: ${conflicts.map((c) => c.message).join('\n')}` : '',
    talkooWhatsAppLine(talkoo)
  ]
    .filter(Boolean)
    .join('\n');

  return {
    generatedAt: now.toISOString(),
    weekendLabel: week.label,
    nextEvent,
    nextPlayer,
    leaveBy: depart?.departureTime,
    leaveCountdownMinutes: depart?.countdownMinutes,
    conflicts,
    carpool,
    talkoo,
    tournaments,
    days,
    difficultDays,
    kitByEventId,
    ambientLine,
    whatsAppShareText,
    summary
  };
}
