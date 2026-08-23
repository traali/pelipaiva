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
  sportsWeekendRange
} from './time';

function childName(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.playerName || 'Lapsi';
}

function colorOf(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.colorHex || '#10b981';
}

function buildDayStrips(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  fridayISO: string,
  now = new Date()
): WeekendDayStrip[] {
  const days = [0, 1, 2].map((offset) => addHelsinkiDays(fridayISO, offset));
  const todayISO = helsinkiDateISO(now);
  const nowMs = now.getTime();

  return days.map((date) => {
    const dayEvents = events
      .filter((e) => helsinkiDateISO(new Date(e.startTime)) === date)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const weekday = formatFiWeekday(date);
    const label = new Date(`${date}T12:00:00+03:00`).toLocaleDateString('fi-FI', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric'
    });
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
        title: e.isTraining ? e.title : `${e.homeTeam} vs ${e.awayTeam || '—'}`,
        venueName: e.venue.name,
        isTalkoo: Boolean(e.volunteerDuty),
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
 * nextEvent / leave-by come from the full upcoming calendar so a Wednesday
 * match is never starved by a Saturday fixture. The Fri–Sun strip stays
 * weekend-only. Specialists run on "now → end of this sports weekend"
 * (plus nextEvent if it falls later) so midweek conflicts still surface.
 */
export function runMissionControlGraph(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  now: Date = new Date(),
  arrivalRules: ArrivalRules[] = []
): MissionControlSnapshot {
  const weekend = sportsWeekendRange(now);
  const lookbackMs = now.getTime() - 2 * 3600 * 1000;
  const rulesFor = (profileId: string) => arrivalRules.find((r) => r.profileId === profileId);

  const upcoming = [...events].filter((e) => new Date(e.endTime).getTime() >= lookbackMs).sort(byStart);

  const nextEvent = upcoming.find((e) => new Date(e.endTime).getTime() >= now.getTime()) || upcoming[0];
  const nextPlayer = nextEvent ? profiles.find((p) => p.id === nextEvent.profileId) : undefined;
  const depart = nextEvent ? calculateDepartureCountdown(nextEvent, rulesFor(nextEvent.profileId)) : undefined;

  const windowEvents = eventsInRange(events, weekend.start, weekend.end).sort(byStart);

  const graphEvents = upcoming.filter((e) => new Date(e.startTime).getTime() <= weekend.end.getTime());
  const specialistEvents =
    nextEvent && !graphEvents.some((e) => e.id === nextEvent.id) ? [...graphEvents, nextEvent] : graphEvents;

  const conflicts = conflictAgent(specialistEvents, profiles);
  const carpool = carpoolAgent(specialistEvents, profiles, conflicts);
  const talkoo = volunteerAgent(specialistEvents, profiles);
  const tournaments = tournamentAgent(events, profiles);
  const kitByEventId = kitAgent(specialistEvents, profiles);

  const fridayISO = helsinkiDateISO(weekend.start);
  const days = buildDayStrips(windowEvents, profiles, fridayISO, now);

  const conflictLine =
    conflicts.length === 0
      ? 'Ei päällekkäisyyksiä.'
      : `${conflicts.length} ristiriita${conflicts.length === 1 ? '' : 'a'}: ${conflicts[0]!.message}`;

  const summary =
    windowEvents.length === 0 && !nextEvent
      ? 'Ei merkittyjä otteluita tälle urheiluviikonlopulle.'
      : windowEvents.length === 0 && nextEvent
        ? `Seuraava: ${childName(nextEvent, profiles)} ${formatFiTime(nextEvent.startTime)} · ${nextEvent.venue.name}. ${conflictLine}`
        : `${windowEvents.length} tapahtumaa ${weekend.label}. ${conflictLine} ${talkoo.recommendation}`;

  const ambientLine = nextEvent
    ? `${childName(nextEvent, profiles)} · lähde klo ${depart?.departureTime} · ${nextEvent.venue.name}`
    : 'Ei seuraavaa peliä.';

  const whatsAppShareText = [
    `PELIPÄIVÄ ${weekend.label}`,
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
    weekendLabel: weekend.label,
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
