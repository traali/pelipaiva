import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
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
  fridayISO: string
): WeekendDayStrip[] {
  const days = [0, 1, 2].map((offset) => addHelsinkiDays(fridayISO, offset));
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
    return {
      date,
      weekday,
      label,
      events: dayEvents.map((e) => ({
        eventId: e.id,
        time: formatFiTime(e.startTime),
        childName: childName(e, profiles),
        colorHex: colorOf(e, profiles),
        sport: e.sport,
        title: e.isTraining ? e.title : `${e.homeTeam} vs ${e.awayTeam || '—'}`,
        venueName: e.venue.name,
        isTalkoo: Boolean(e.volunteerDuty)
      }))
    };
  });
}

/**
 * Deterministic family mission-control graph.
 * Planner runs specialists in a fixed order — no LLM, no network.
 */
export function runMissionControlGraph(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  now: Date = new Date()
): MissionControlSnapshot {
  const weekend = sportsWeekendRange(now);
  const windowEvents = eventsInRange(events, weekend.start, weekend.end).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const horizon =
    windowEvents.length > 0
      ? windowEvents
      : [...events]
          .filter((e) => new Date(e.endTime).getTime() >= now.getTime() - 2 * 3600 * 1000)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(0, 8);

  const conflicts = conflictAgent(horizon, profiles);
  const carpool = carpoolAgent(horizon, profiles, conflicts);
  const talkoo = volunteerAgent(horizon, profiles);
  const tournaments = tournamentAgent(horizon, profiles);
  const kitByEventId = kitAgent(horizon, profiles);

  const nextEvent = horizon.find((e) => new Date(e.endTime).getTime() >= now.getTime()) || horizon[0];
  const nextPlayer = nextEvent ? profiles.find((p) => p.id === nextEvent.profileId) : undefined;
  const depart = nextEvent ? calculateDepartureCountdown(nextEvent) : undefined;

  const fridayISO = helsinkiDateISO(weekend.start);
  const days = buildDayStrips(horizon, profiles, fridayISO);

  const conflictLine =
    conflicts.length === 0
      ? 'Ei päällekkäisyyksiä.'
      : `${conflicts.length} ristiriita${conflicts.length === 1 ? '' : 'a'}: ${conflicts[0]!.message}`;

  const summary =
    horizon.length === 0
      ? 'Ei merkittyjä otteluita tälle urheiluviikonlopulle.'
      : `${horizon.length} tapahtumaa ${weekend.label}. ${conflictLine} ${talkoo.recommendation}`;

  const ambientLine = nextEvent
    ? `${childName(nextEvent, profiles)} · lähde klo ${depart?.departureTime} · ${nextEvent.venue.name}`
    : 'Ei seuraavaa peliä.';

  const whatsAppShareText = [
    `PELIPÄIVÄ ${weekend.label}`,
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
