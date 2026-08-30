/**
 * Per-device on-device LLM preference.
 * Default is off. Neural nets never run until the user explicitly enables
 * (and, for downloadable models, taps Lataa). Not synced via family KV.
 */

export type OnDeviceLlmChoice = 'off' | 'apple' | 'chrome' | 'qwen06';

export const ONDEVICE_LLM_CHOICE_KEY = 'pelipaiva_ondevice_llm';
export const ONDEVICE_LLM_LOADED_KEY = 'pelipaiva_ondevice_llm_loaded';

const memory: Record<string, string> = {};

function read(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    /* Safari private / denied */
  }
  return memory[key] ?? null;
}

function write(key: string, value: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  } catch {
    /* ignore */
  }
  if (value === null) delete memory[key];
  else memory[key] = value;
}

function isChoice(value: string | null): value is OnDeviceLlmChoice {
  return value === 'off' || value === 'apple' || value === 'chrome' || value === 'qwen06';
}

export function getOnDeviceLlmChoice(): OnDeviceLlmChoice {
  const raw = read(ONDEVICE_LLM_CHOICE_KEY);
  return isChoice(raw) ? raw : 'off';
}

export function setOnDeviceLlmChoice(choice: OnDeviceLlmChoice): void {
  write(ONDEVICE_LLM_CHOICE_KEY, choice);
  if (choice === 'off') {
    write(ONDEVICE_LLM_LOADED_KEY, null);
  }
}

/** True only when the user opted in. Missing key = off. */
export function isOnDeviceLlmEnabled(): boolean {
  return getOnDeviceLlmChoice() !== 'off';
}

export function getOnDeviceLlmLoaded(): OnDeviceLlmChoice | 'none' {
  const raw = read(ONDEVICE_LLM_LOADED_KEY);
  if (isChoice(raw) && raw !== 'off') return raw;
  return 'none';
}

export function markOnDeviceLlmLoaded(choice: OnDeviceLlmChoice | 'none'): void {
  if (choice === 'off' || choice === 'none') {
    write(ONDEVICE_LLM_LOADED_KEY, null);
    return;
  }
  write(ONDEVICE_LLM_LOADED_KEY, choice);
}

export function resetOnDeviceLlmPrefsForTests(): void {
  for (const key of Object.keys(memory)) delete memory[key];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ONDEVICE_LLM_CHOICE_KEY);
      localStorage.removeItem(ONDEVICE_LLM_LOADED_KEY);
    }
  } catch {
    /* ignore */
  }
}
