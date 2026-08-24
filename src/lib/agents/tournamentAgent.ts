import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import type { TournamentBlock } from './types';
import { helsinkiDateISO } from './time';

export function tournamentAgent(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  now?: Date
): TournamentBlock[] {
  const groups = new Map<string, MatchdayEvent[]>();

  for (const ev of events) {
    const explicit = ev.eventType === 'tournament';
    const day = helsinkiDateISO(new Date(ev.startTime));
    const key = explicit
      ? `${ev.profileId}|${(ev.tournamentName || 'turnaus').toLowerCase().trim()}`
      : `${ev.profileId}|${ev.venue.normalizedName || ev.venue.name}|${day}`;
    const list = groups.get(key) || [];
    list.push(ev);
    groups.set(key, list);
  }

  const lookbackMs = now ? now.getTime() - 2 * 3600 * 1000 : null;
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

    // Exclude if all matches in this tournament block have already ended
    if (lookbackMs !== null && new Date(last.endTime).getTime() < lookbackMs) {
      continue;
    }

    const profile = profiles.find((p) => p.id === first.profileId);
    if (!profile) continue;
    const recovery =
      sorted.length >= 2
        ? Math.round(
            (new Date(sorted[1]!.startTime).getTime() - new Date(first.endTime).getTime()) / 60000
          )
        : 0;
    const { departureTime } = calculateDepartureCountdown(first, profile?.arrivalRules);

    blocks.push({
      id: `tn-${first.id}`,
      name: first.tournamentName || `${first.venue.name} · turnauspäivä`,
      date: helsinkiDateISO(new Date(first.startTime)),
      venueName: first.venue.name,
      childName: profile?.playerName || 'Lapsi',
      profileId: first.profileId,
      colorHex: profile?.colorHex || '#10b981',
      matchCount: sorted.length,
      firstKickoff: first.startTime,
      lastEnd: last.endTime,
      recoveryMinutes: Math.max(0, recovery),
      eventIds: sorted.map((e) => e.id),
      matches: sorted,
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
