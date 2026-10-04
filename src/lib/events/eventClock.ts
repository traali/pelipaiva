/** Invented warmup = parser default, not a time from MyClub/Nimenhuuto text. */
export function isInventedWarmup(event: {
  startTime: string;
  warmupTime?: string;
  isTraining?: boolean;
  eventType?: string;
  officialFixtureId?: string;
  warmupIsEstimate?: boolean;
  notes?: string;
  title?: string;
}): boolean {
  if (!event.warmupTime) return true;
  const kick = new Date(event.startTime).getTime();
  const warm = new Date(event.warmupTime).getTime();
  if (!Number.isFinite(kick) || !Number.isFinite(warm)) return true;
  const diffMin = (kick - warm) / 60_000;
  if (diffMin <= 0) return true;
  if (event.warmupIsEstimate === true) return true;
  if (event.warmupIsEstimate === false) return false;
  const wroteIt = /kokoontum|paikalle|alkulämpö/i.test(`${event.notes || ''} ${event.title || ''}`);
  if (wroteIt) return false;
  const training = event.isTraining || event.eventType === 'training';
  if (training) return Math.abs(diffMin - 15) <= 2;
  // A linked fixture with a round 30/45/60 min gap is the app's fill-in, not a coach message.
  if (event.officialFixtureId && [30, 45, 60].some((gap) => Math.abs(diffMin - gap) <= 2)) return true;
  return Math.abs(diffMin - 45) <= 2;
}

export function shouldShowKokoontuminen(event: {
  startTime: string;
  warmupTime?: string;
  isTraining?: boolean;
  eventType?: string;
  officialFixtureId?: string;
  warmupIsEstimate?: boolean;
  notes?: string;
  title?: string;
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
  opts?: { multiGame?: boolean; warmupEqualsKickoff?: boolean; gameCount?: number }
): string {
  if (kind === 'training') return `Treeni klo ${kickoff}`;
  if (kind === 'school') return `Koulu klo ${kickoff}`;
  if (kind === 'other') return `Alkaa klo ${kickoff}`;
  if (kind === 'tournament' || opts?.multiGame) {
    if ((opts?.gameCount || 0) > 1) return `Turnaus, ${opts!.gameCount} peliä`;
    return opts?.warmupEqualsKickoff ? `Kokoontuminen klo ${kickoff}` : `1. peli klo ${kickoff}`;
  }
  return `Ottelu klo ${kickoff}`;
}

/** Middle column of the Lähde / Paikalla / Alkaa stepper. */
export function arrivalPhaseLabel(event: {
  startTime: string;
  warmupTime?: string;
  isTraining?: boolean;
  eventType?: string;
  sport?: string;
  officialFixtureId?: string;
  warmupIsEstimate?: boolean;
  notes?: string;
  title?: string;
}): 'Kokoontuminen' | 'Alkulämpö' | 'Saapuminen' {
  const school = event.sport === 'school' || event.eventType === 'school';
  const other =
    event.sport === 'other' || event.eventType === 'other' || event.eventType === 'meeting';
  if (school || other) return 'Saapuminen';
  // A written time is Kokoontuminen. A filled-in treeni or 45 min gap is only Alkulämpö.
  if (!isInventedWarmup(event)) return 'Kokoontuminen';
  return 'Alkulämpö';
}
