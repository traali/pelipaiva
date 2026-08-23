/** Crockford-32 without I, L, O, U. Must match cloudflare-worker/worker.ts. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Display form XXXXX-C. Example: PERHE-2 (SAIMA-4 is invalid: I). */
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

export function generateFamilyCode(): string {
  let chars = '';
  for (let i = 0; i < 5; i++) {
    chars += CROCKFORD_ALPHABET[Math.floor(Math.random() * CROCKFORD_ALPHABET.length)];
  }
  const check = CROCKFORD_ALPHABET[Math.floor(Math.random() * CROCKFORD_ALPHABET.length)];
  return `${chars}-${check}`;
}

/** Existing KV row with missing or stale If-Match must 409. */
export function existingRosterPutConflicts(currentRev: number, ifMatchRaw: string | null): boolean {
  if (!ifMatchRaw) return true;
  const n = parseInt(ifMatchRaw.replace(/"/g, ''), 10);
  return Number.isNaN(n) || n !== currentRev;
}
