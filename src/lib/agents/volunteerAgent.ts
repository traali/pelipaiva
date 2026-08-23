import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import type { TalkooBalance, TalkooShift } from './types';
import { formatFiTime } from './time';

const ROLE_LABEL: Record<string, string> = {
  kahvio: 'Kahviovuoro',
  toimitsija: 'Toimitsija',
  kello_kirjuri: 'Kirjuri / kello',
  jarjestysmies: 'Järjestysmies',
  kioski: 'Kioski',
  kyyti: 'Kyytivastaava',
  makkara: 'Makkara',
  striimaus: 'Striimaus',
  ensiapu: 'Ensiapu'
};

function inferRole(duty: string): string {
  const t = duty.toLowerCase();
  if (t.includes('kahvio') || t.includes('kahvi')) return 'kahvio';
  if (t.includes('kirjuri') || t.includes('kello')) return 'kello_kirjuri';
  if (t.includes('toimitsija')) return 'toimitsija';
  if (t.includes('järj') || t.includes('liivi')) return 'jarjestysmies';
  if (t.includes('kioski')) return 'kioski';
  if (t.includes('makkara') || t.includes('grilli')) return 'makkara';
  if (t.includes('striim') || t.includes('kuvaus')) return 'striimaus';
  if (t.includes('ensiapu') || t.includes('ea')) return 'ensiapu';
  if (t.includes('kyyti') || t.includes('kuski')) return 'kyyti';
  return 'talkoo';
}

export function volunteerAgent(events: MatchdayEvent[], profiles: PlayerProfile[]): TalkooBalance {
  const shifts: TalkooShift[] = [];
  for (const ev of events) {
    if (!ev.volunteerDuty) continue;
    const profile = profiles.find((p) => p.id === ev.profileId);
    const role = inferRole(ev.volunteerDuty);
    shifts.push({
      eventId: ev.id,
      profileId: ev.profileId,
      childName: profile?.playerName || 'Lapsi',
      role,
      roleLabel: ROLE_LABEL[role] || ev.volunteerDuty,
      timeWindow: ev.volunteerDuty.match(/klo[^\n)]+/i)?.[0],
      venueName: ev.venue.name,
      startTime: ev.startTime,
      loadScore: role === 'kahvio' || role === 'toimitsija' ? 2 : 1
    });
  }

  const byChild = new Map<string, TalkooShift[]>();
  for (const s of shifts) {
    const list = byChild.get(s.childName) || [];
    list.push(s);
    byChild.set(s.childName, list);
  }
  const perChild = Array.from(byChild.entries()).map(([childName, list]) => ({
    childName,
    count: list.length,
    roles: list.map((s) => s.roleLabel)
  }));

  const maxLoad = Math.max(0, ...perChild.map((c) => c.count));
  const overloadedParent = shifts.length >= 3 || maxLoad >= 2;

  let recommendation = 'Ei merkittyjä talkoovuoroja tälle jaksolle.';
  if (shifts.length === 1) {
    recommendation = `Yksi vuoro: ${shifts[0]!.roleLabel} @ ${shifts[0]!.venueName}. Saavu 15 min ennen.`;
  } else if (overloadedParent) {
    const heavy = perChild.sort((a, b) => b.count - a.count)[0];
    recommendation = `${heavy?.childName || 'Yksi lapsi'} kantaa ${heavy?.count} vuoroa. Pyydä toista vanhempaa / joukkuetta vaihtamaan kahvio.`;
  } else if (shifts.length > 0) {
    recommendation = `${shifts.length} talkoovuoroa jaossa tasaisesti.`;
  }

  return { overloadedParent, shifts, perChild, recommendation };
}

export function talkooWhatsAppLine(balance: TalkooBalance): string {
  if (balance.shifts.length === 0) return '';
  const lines = balance.shifts.map((s) => {
    const t = formatFiTime(s.startTime);
    return `• ${s.childName} ${t} ${s.roleLabel} @ ${s.venueName}`;
  });
  return `Talkoo:\n${lines.join('\n')}`;
}
