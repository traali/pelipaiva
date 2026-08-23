import type { PlayerProfile } from '../../types/matchday';

/** Stable id for a team/cup URL so the same child is not duplicated. */
export function teamSourceKey(url: string): string {
  const raw = url.trim();
  if (!raw) return '';
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const teamPath = u.pathname.match(/\/team\/(\d+)/i);
    if (teamPath?.[1]) return `${host}:${teamPath[1]}`;
    const joukkue = u.searchParams.get('joukkue') || u.searchParams.get('team_id');
    if (joukkue) return `${host}:${joukkue}`;
    return `${host}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function findExistingTeamProfile(
  profiles: PlayerProfile[],
  playerName: string,
  url: string
): PlayerProfile | undefined {
  const name = playerName.trim().toLowerCase();
  const key = teamSourceKey(url);
  if (!name || !key) return undefined;
  return profiles.find((p) => {
    if ((p.playerName || '').trim().toLowerCase() !== name) return false;
    if (p.calendarUrl && teamSourceKey(p.calendarUrl) === key) return true;
    if (p.associationUrl && teamSourceKey(p.associationUrl) === key) return true;
    const idFromKey = key.split(':')[1];
    return Boolean(p.teamId && idFromKey && p.teamId === idFromKey);
  });
}
