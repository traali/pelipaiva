import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import type { TournamentBlock } from './types';
import { helsinkiDateISO } from './time';

function venueKey(ev: MatchdayEvent): string {
  return (ev.venue.normalizedName || ev.venue.name || 'kenttä').toLowerCase().trim();
}

function tournamentKey(ev: MatchdayEvent): string {
  return (ev.tournamentName || venueKey(ev) || 'turnaus').toLowerCase().trim();
}

function involvesTeam(ev: MatchdayEvent, teamName?: string): boolean {
  if (!teamName) return true;
  const blob = `${ev.title} ${ev.homeTeam || ''} ${ev.awayTeam || ''}`.toLowerCase();
  const tokens = teamName
    .toLowerCase()
    .split(/[\s/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (!tokens.length) return blob.includes(teamName.toLowerCase());
  return tokens.some((t) => blob.includes(t));
}

export function tournamentAgent(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  now?: Date
): TournamentBlock[] {
  const groups = new Map<string, MatchdayEvent[]>();

  for (const ev of events) {
    const explicit = ev.eventType === 'tournament' || Boolean(ev.tournamentName) || Boolean(ev.isTournament);
    if (!explicit && ev.isTraining) continue;
    const day = helsinkiDateISO(new Date(ev.startTime));
    // One card = one child + one hall + one calendar day (never stash Sun/26.9 into Saturday).
    const key = `${ev.profileId}|${tournamentKey(ev)}|${venueKey(ev)}|${day}`;
    const list = groups.get(key) || [];
    list.push(ev);
    groups.set(key, list);
  }

  const lookbackMs = now ? now.getTime() - 2 * 3600 * 1000 : null;
  const blocks: TournamentBlock[] = [];
  for (const [, list] of groups) {
    let matches = list.filter((e) => !e.isTraining && e.eventType !== 'meeting');
    const isNamed = list.some((e) => e.eventType === 'tournament' || Boolean(e.tournamentName) || Boolean(e.isTournament));
    if (!isNamed && matches.length < 2) continue;
    if (isNamed && matches.length < 1) continue;

    const firstSeed = matches[0]!;
    const profile = profiles.find((p) => p.id === firstSeed.profileId);
    if (!profile) continue;

    const teamHits = matches.filter((m) => involvesTeam(m, profile.teamName));
    if (teamHits.length >= 1 && teamHits.length < matches.length) {
      matches = teamHits;
    }

    const sorted = [...matches].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;

    if (lookbackMs !== null && new Date(last.endTime).getTime() < lookbackMs) {
      continue;
    }

    const recovery =
      sorted.length >= 2
        ? Math.round(
            (new Date(sorted[1]!.startTime).getTime() - new Date(first.endTime).getTime()) / 60000
          )
        : 0;
    const { departureTime } = calculateDepartureCountdown(first, profile?.arrivalRules);
    const dayIso = helsinkiDateISO(new Date(first.startTime));

    blocks.push({
      id: `tn-${first.profileId}-${dayIso}-${venueKey(first)}`,
      name: first.tournamentName || `${first.venue.name} · turnauspäivä`,
      date: dayIso,
      venueName: first.venue.name,
      childName: profile?.playerName || 'Lapsi',
      teamName: profile?.teamName,
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