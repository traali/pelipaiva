/** Crockford-32 without I, L, O, U. Must match cloudflare-worker/worker.ts. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Display form XXXXX-C. Issued slots live in the Worker secret FAMILY_CODES, not in this repo. */
export const FAMILY_CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$/;

export function normalizeFamilyCode(code: string): string {
  const clean = code.trim().toUpperCase();
  if (clean.includes('-')) return clean;
  if (clean.length === 6) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  return clean;
}

export function generateFamilyCode(): string {
  const getRandomChar = (): string => {
    const randomBuffer = new Uint8Array(1);
    crypto.getRandomValues(randomBuffer);
    return CROCKFORD_ALPHABET[(randomBuffer[0] ?? 0) % CROCKFORD_ALPHABET.length] ?? '0';
  };
  return `${Array.from({ length: 5 }, getRandomChar).join('')}-${getRandomChar()}`;
}

export function isValidFamilyCode(code?: string): boolean {
  if (!code) return false;
  return FAMILY_CODE_REGEX.test(normalizeFamilyCode(code));
}

/** Parse Worker/env allowlist. Empty → fail closed (no slots). */
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
