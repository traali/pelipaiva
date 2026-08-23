import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import type { TournamentBlock } from './types';
import { formatFiTime, helsinkiDateISO } from './time';

export function tournamentAgent(events: MatchdayEvent[], profiles: PlayerProfile[]): TournamentBlock[] {
  const groups = new Map<string, MatchdayEvent[]>();

  for (const ev of events) {
    const day = helsinkiDateISO(new Date(ev.startTime));
    const explicit = ev.eventType === 'tournament';
    const key = explicit
      ? `${ev.profileId}|${ev.tournamentName || 'turnaus'}|${day}`
      : `${ev.profileId}|${ev.venue.normalizedName || ev.venue.name}|${day}`;
    const list = groups.get(key) || [];
    list.push(ev);
    groups.set(key, list);
  }

  const blocks: TournamentBlock[] = [];
  for (const [, list] of groups) {
    const matches = list.filter((e) => !e.isTraining && e.eventType !== 'meeting');
    const isNamed = list.some((e) => e.eventType === 'tournament');
    if (!isNamed && matches.length < 2) continue;
    if (isNamed && matches.length < 1) continue;

    const sorted = [...matches].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const profile = profiles.find((p) => p.id === first.profileId);
    const recovery =
      sorted.length >= 2
        ? Math.round(
            (new Date(sorted[1]!.startTime).getTime() - new Date(first.endTime).getTime()) / 60000
          )
        : 0;
    const { departureTime } = calculateDepartureCountdown(first);

    blocks.push({
      id: `tn-${first.id}`,
      name: first.tournamentName || `${first.venue.name} · turnauspäivä`,
      date: helsinkiDateISO(new Date(first.startTime)),
      venueName: first.venue.name,
      childName: profile?.playerName || 'Lapsi',
      profileId: first.profileId,
      matchCount: sorted.length,
      firstKickoff: first.startTime,
      lastEnd: last.endTime,
      recoveryMinutes: Math.max(0, recovery),
      eventIds: sorted.map((e) => e.id),
      leaveBy: departureTime,
      packingNote:
        sorted.length >= 3
          ? `Pitkä päivä: ${sorted.length} peliä. Eväät, 2× juoma, kuiva paita, istuinalusta.`
          : sorted.length === 2
            ? `Kaksi peliä samassa hallissa. Jätä kassi autoon, eväs väliin.`
            : `Turnauspäivä @ ${first.venue.name}. Eväät ja kuiva paita.`
    });
  }

  return blocks.sort((a, b) => new Date(a.firstKickoff).getTime() - new Date(b.firstKickoff).getTime());
}

export function tournamentLeaveHint(block: TournamentBlock): string {
  const first = formatFiTime(block.firstKickoff);
  const last = formatFiTime(block.lastEnd);
  return `${block.childName}: ${block.matchCount} peliä ${first}–${last}. Lähde klo ${block.leaveBy}.`;
}
