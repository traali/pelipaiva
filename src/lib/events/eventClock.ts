/** Invented warmup = parser default, not a time from MyClub/Nimenhuuto text. */
export function isInventedWarmup(event: {
  startTime: string;
  warmupTime?: string;
  isTraining?: boolean;
  eventType?: string;
  officialFixtureId?: string;
}): boolean {
  if (!event.warmupTime) return true;
  const kick = new Date(event.startTime).getTime();
  const warm = new Date(event.warmupTime).getTime();
  if (!Number.isFinite(kick) || !Number.isFinite(warm)) return true;
  const diffMin = (kick - warm) / 60_000;
  if (diffMin <= 0) return true;
  const training = event.isTraining || event.eventType === 'training';
  if (training) return Math.abs(diffMin - 15) <= 2;
  if (event.officialFixtureId) return false;
  return Math.abs(diffMin - 45) <= 2;
}

export function shouldShowKokoontuminen(event: {
  startTime: string;
  warmupTime?: string;
  isTraining?: boolean;
  eventType?: string;
  officialFixtureId?: string;
}): boolean {
  if (!event.warmupTime) return false;
  if (isInventedWarmup(event)) return false;
  const a = new Date(event.startTime).getTime();
  const b = new Date(event.warmupTime).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a !== b;
}

export type ClockKind = 'training' | 'match' | 'tournament' | 'school' | 'other';

export function clockHeadline(
  kind: ClockKind,
  kickoff: string,
  opts?: { multiGame?: boolean; warmupEqualsKickoff?: boolean }
): string {
  if (kind === 'training') return `Treeni klo ${kickoff}`;
  if (kind === 'school') return `Koulu klo ${kickoff}`;
  if (kind === 'other') return `Alkaa klo ${kickoff}`;
  if (kind === 'tournament' || opts?.multiGame) {
    return opts?.warmupEqualsKickoff ? `Kokoontuminen klo ${kickoff}` : `1. peli klo ${kickoff}`;
  }
  return `Ottelu klo ${kickoff}`;
}
