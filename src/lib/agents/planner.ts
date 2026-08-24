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
  mondayISO: string,
  now = new Date()
): WeekendDayStrip[] {
  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addHelsinkiDays(mondayISO, offset));
  const todayISO = helsinkiDateISO(now);
  const nowMs = now.getTime();

  return days.map((date) => {
    const dayEvents = events
      .filter((e) => helsinkiDateISO(new Date(e.startTime)) === date)
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

function byStart(a: MatchdayEvent, b: MatchdayEvent): number {
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
  arrivalRules: ArrivalRules[] = []
): MissionControlSnapshot {
  const week = sportsWeekRange(now);
  const lookbackMs = now.getTime() - 2 * 3600 * 1000;
  const rulesFor = (profileId: string) => arrivalRules.find((r) => r.profileId === profileId);

  const upcoming = [...events].filter((e) => new Date(e.endTime).getTime() >= lookbackMs).sort(byStart);

  const nextEvent = upcoming.find((e) => new Date(e.endTime).getTime() >= now.getTime()) || upcoming[0];
  const nextPlayer = nextEvent ? profiles.find((p) => p.id === nextEvent.profileId) : undefined;
  const depart = nextEvent ? calculateDepartureCountdown(nextEvent, rulesFor(nextEvent.profileId)) : undefined;

  const windowEvents = eventsInRange(events, week.start, week.end).sort(byStart);

  const graphEvents = upcoming.filter((e) => new Date(e.startTime).getTime() <= week.end.getTime());
  const specialistEvents =
    nextEvent && !graphEvents.some((e) => e.id === nextEvent.id) ? [...graphEvents, nextEvent] : graphEvents;

  const conflicts = conflictAgent(specialistEvents, profiles);
  const carpool = carpoolAgent(specialistEvents, profiles, conflicts, arrivalRules);
  const talkoo = volunteerAgent(specialistEvents, profiles);
  const tournaments = tournamentAgent(events, profiles, arrivalRules, now);
  const kitByEventId = kitAgent(specialistEvents, profiles);

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
    kitByEventId,
    ambientLine,
    whatsAppShareText,
    summary
  };
}
