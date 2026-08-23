export interface TeamColorSwatch {
  hex: string;
  label: string;
  fi: string;
}

/** Distinct kit / player chips — never default everyone to pitch green. */
export const TEAM_COLOR_SWATCHES: TeamColorSwatch[] = [
  { hex: '#3b82f6', label: 'sininen', fi: 'Sininen' },
  { hex: '#1d4ed8', label: 'tummansininen', fi: 'Tummansininen' },
  { hex: '#21C3F7', label: 'syaani', fi: 'Syaani' },
  { hex: '#10b981', label: 'vihreä', fi: 'Vihreä' },
  { hex: '#15803d', label: 'tummanvihreä', fi: 'Tummanvihreä' },
  { hex: '#eab308', label: 'keltainen', fi: 'Keltainen' },
  { hex: '#f97316', label: 'oranssi', fi: 'Oranssi' },
  { hex: '#FF953E', label: 'kupari', fi: 'Kupari' },
  { hex: '#ef4444', label: 'punainen', fi: 'Punainen' },
  { hex: '#e11d48', label: 'roosa', fi: 'Roosa' },
  { hex: '#8b5cf6', label: 'violetti', fi: 'Violetti' },
  { hex: '#64748b', label: 'harmaa', fi: 'Harmaa' }
];

const DEFAULT_SWATCH = TEAM_COLOR_SWATCHES[0]!;

export function swatchForHex(hex: string | undefined): TeamColorSwatch {
  if (!hex) return DEFAULT_SWATCH;
  const n = hex.toLowerCase();
  return TEAM_COLOR_SWATCHES.find((s) => s.hex.toLowerCase() === n) || { hex, label: 'oma', fi: 'Oma' };
}

export function pickNextTeamColor(usedHexes: string[]): TeamColorSwatch {
  const used = new Set(usedHexes.map((h) => h.toLowerCase()));
  const free = TEAM_COLOR_SWATCHES.find((s) => !used.has(s.hex.toLowerCase()));
  if (free) return free;
  const idx = usedHexes.length % TEAM_COLOR_SWATCHES.length;
  return TEAM_COLOR_SWATCHES[idx]!;
}

export function colorFromNameHint(name: string): TeamColorSwatch | undefined {
  const n = name.toLowerCase();
  if (/\bsin(inen)?\b|blue/.test(n)) return swatchForHex('#3b82f6');
  if (/\bmus(ta)?\b|black/.test(n)) return swatchForHex('#64748b');
  if (/\boran(ssi)?\b|orange/.test(n)) return swatchForHex('#f97316');
  if (/\bpun(ainen)?\b|red/.test(n)) return swatchForHex('#ef4444');
  if (/\bkelt(ainen)?\b|yellow/.test(n)) return swatchForHex('#eab308');
  if (/\bvihr(eä|ea)\b|green/.test(n)) return swatchForHex('#10b981');
  if (/\bvalko(inen)?\b|white/.test(n)) return swatchForHex('#64748b');
  return undefined;
}

/**
 * Calculates WCAG 2.2 relative luminance and returns optimal contrast text color ('#0a0a0a' or '#ffffff').
 */
export function getContrastTextColor(hex: string | undefined): string {
  if (!hex) return '#ffffff';
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length < 6) return '#ffffff';
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return L > 0.36 ? '#0a0a0a' : '#ffffff';
}

