/** Crockford-32 without I, L, O, U. Must match cloudflare-worker/worker.ts. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Display form XXXXX-C. Any valid Crockford code may claim a Worker slot (cap 10). */
export const FAMILY_CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$/;

export function normalizeFamilyCode(code: string): string {
  const clean = code.trim().toUpperCase();
  if (clean.includes('-')) return clean;
  if (clean.length === 6) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  return clean;
}

export function isValidFamilyCode(code?: string): boolean {
  if (!code) return false;
  return FAMILY_CODE_REGEX.test(normalizeFamilyCode(code));
}

/** New family slot. Not issued by Cloudflare — the first PUT claims it. */
export function mintFamilyCode(): string {
  const n = CROCKFORD_ALPHABET.length;
  const buf = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 6; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  const chars = Array.from(buf, (b) => CROCKFORD_ALPHABET[b % n]!);
  return `${chars.slice(0, 5).join('')}-${chars[5]}`;
}

/** Parse optional Worker/env list. Empty means no reserved slots. */
export function parseFamilyAllowlist(csv?: string): Set<string> {
  const set = new Set<string>();
  if (!csv) return set;
  for (const part of csv.split(/[,\s]+/)) {
    if (!part.trim()) continue;
    const n = normalizeFamilyCode(part);
    if (FAMILY_CODE_REGEX.test(n)) set.add(n);
  }
  return set;
}

/** Existing KV row with missing or stale If-Match must 409. */
export function existingRosterPutConflicts(currentRev: number, ifMatchRaw: string | null): boolean {
  if (!ifMatchRaw) return true;
  const n = parseInt(ifMatchRaw.replace(/"/g, ''), 10);
  return Number.isNaN(n) || n !== currentRev;
}
