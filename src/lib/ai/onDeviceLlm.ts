import {
  getOnDeviceLlmChoice,
  getOnDeviceLlmLoaded,
  isOnDeviceLlmEnabled,
  markOnDeviceLlmLoaded,
  OnDeviceLlmChoice,
  setOnDeviceLlmChoice
} from './onDeviceLlmPrefs';
import { checkChromeAiCapabilities, createBuiltInLanguageSession } from './chromeBuiltinAi';

export type NeuralEngineId = 'chrome_gemini_nano' | 'apple_foundation' | 'apple_core_ai';
export type CopilotEngineId = 'deterministic' | NeuralEngineId;
export type ParseEngineId = 'fast_nlp' | NeuralEngineId;
export type OnDevicePlatform = 'ios-native' | 'ios-safari' | 'chrome' | 'other';

export type OnDeviceAvailability = 'readily' | 'downloadable' | 'unavailable';

export interface FamdayNativeAiBridge {
  availability: () => Promise<OnDeviceAvailability | 'no' | 'readily' | 'downloadable' | 'unavailable'>;
  engine: () => Promise<'apple_foundation' | 'apple_core_ai' | 'none' | string>;
  prompt: (system: string, user: string) => Promise<string>;
  loadQwen?: () => Promise<{ ok: boolean; error?: string } | boolean>;
  unload?: () => Promise<void>;
}

export interface OnDeviceEngineOption {
  id: OnDeviceLlmChoice;
  label: string;
  detail: string;
  available: boolean;
  needsUserLoad: boolean;
  reason?: string;
}

export interface OnDeviceRuntime {
  platform: OnDevicePlatform;
  choice: OnDeviceLlmChoice;
  loaded: OnDeviceLlmChoice | 'none';
  enabled: boolean;
  neuralReady: boolean;
  activeEngine: NeuralEngineId | 'none';
  options: OnDeviceEngineOption[];
  chromeStatus: 'readily' | 'after-download' | 'no';
  nativeStatus: OnDeviceAvailability;
  summaryFi: string;
}

type PromptSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

declare global {
  interface Window {
    FamdayNativeAi?: FamdayNativeAiBridge;
    webkit?: {
      messageHandlers?: {
        famdayAi?: { postMessage: (msg: unknown) => void };
      };
    };
    __famdayAiResolve?: (id: string, ok: boolean, value: unknown) => void;
  }
}

const nativePending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nativeSeq = 0;

function globalObj(): Record<string, any> {
  return globalThis as Record<string, any>;
}

export function detectOnDevicePlatform(): OnDevicePlatform {
  const g = globalObj();
  if (g.FamdayNativeAi || g.window?.FamdayNativeAi || g.webkit?.messageHandlers?.famdayAi || g.window?.webkit?.messageHandlers?.famdayAi) {
    return 'ios-native';
  }
  const nav = g.navigator as Navigator | undefined;
  const ua = nav?.userAgent || '';
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (nav?.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
  if (iOS) return 'ios-safari';
  const promptApi = g.LanguageModel || g.window?.LanguageModel || g.window?.ai?.languageModel || g.ai?.languageModel;
  if (promptApi) return 'chrome';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) return 'chrome';
  return 'other';
}

/** Android Chrome (not iOS CriOS). Same Prompt API contract as laptop Chrome. */
export function isAndroidChromeUa(ua?: string): boolean {
  const resolved = ua ?? (globalObj().navigator?.userAgent as string | undefined) ?? '';
  return /Android/i.test(resolved) && /Chrome\//.test(resolved) && !/Edg\//.test(resolved);
}

function installNativeResultHook(): void {
  const g = globalObj();
  if (g.__famdayAiResolve) return;
  g.__famdayAiResolve = (id: string, ok: boolean, value: unknown) => {
    const pending = nativePending.get(String(id));
    if (!pending) return;
    nativePending.delete(String(id));
    if (ok) pending.resolve(value);
    else pending.reject(new Error(typeof value === 'string' ? value : 'native_ai_error'));
  };
}

async function callNative(method: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  const g = globalObj();
  const bridge: FamdayNativeAiBridge | undefined = g.FamdayNativeAi || g.window?.FamdayNativeAi;
  if (bridge) {
    if (method === 'availability') return bridge.availability();
    if (method === 'engine') return bridge.engine();
    if (method === 'prompt') return bridge.prompt(String(payload.system || ''), String(payload.user || ''));
    if (method === 'loadQwen') return bridge.loadQwen ? bridge.loadQwen() : { ok: false, error: 'unsupported' };
    if (method === 'unload') return bridge.unload ? bridge.unload() : undefined;
  }

  const handler = g.webkit?.messageHandlers?.famdayAi || g.window?.webkit?.messageHandlers?.famdayAi;
  if (!handler || typeof handler.postMessage !== 'function') {
    throw new Error('no_native_ai');
  }

  installNativeResultHook();
  const id = `n${++nativeSeq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      nativePending.delete(id);
      reject(new Error('native_ai_timeout'));
    }, 20000);
    nativePending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      }
    });
    handler.postMessage({ id, method, ...payload });
  });
}

export function hasNativeAiBridge(): boolean {
  const g = globalObj();
  return Boolean(
    g.FamdayNativeAi ||
      g.window?.FamdayNativeAi ||
      g.webkit?.messageHandlers?.famdayAi ||
      g.window?.webkit?.messageHandlers?.famdayAi
  );
}

export async function probeNativeAvailability(): Promise<OnDeviceAvailability> {
  if (!hasNativeAiBridge()) return 'unavailable';
  try {
    const raw = await callNative('availability');
    const s = String(raw || '');
    if (s === 'readily' || s === 'available') return 'readily';
    if (s === 'downloadable' || s === 'after-download') return 'downloadable';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function describeOnDeviceRuntime(): Promise<OnDeviceRuntime> {
  const platform = detectOnDevicePlatform();
  const choice = getOnDeviceLlmChoice();
  const loaded = getOnDeviceLlmLoaded();
  const chrome = await checkChromeAiCapabilities();
  const nativeStatus = platform === 'ios-native' ? await probeNativeAvailability() : 'unavailable';

  const appleOk = platform === 'ios-native' && nativeStatus !== 'unavailable';
  const chromeOk = chrome.status === 'readily' || chrome.status === 'after-download';
  const qwenOk = platform === 'ios-native';

  const options: OnDeviceEngineOption[] = [
    {
      id: 'off',
      label: 'Ei käytössä',
      detail: 'Aikataulujärki (sääntöparsinta). Oletus. Ei mallia, ei latausta.',
      available: true,
      needsUserLoad: false
    }
  ];

  if (platform === 'ios-native' || platform === 'ios-safari') {
    options.push({
      id: 'apple',
      label: 'Apple Intelligence',
      detail: appleOk
        ? 'Puhelimen AFM 3 Core. Ei erillistä latausta. Kevyt JSON-purku.'
        : 'Safari-PWA ei voi käyttää Apple Intelligencea. Vaatii FamDay-sovelluksen (TestFlight / App Store).',
      available: appleOk,
      needsUserLoad: false,
      reason: appleOk ? undefined : 'ios_safari_no_core_ai'
    });
    options.push({
      id: 'qwen06',
      label: 'Qwen 3 0.6B',
      detail: qwenOk
        ? 'Core AI -malli. Ladataan vain jos otat sen käyttöön (Wi‑Fi). Kevyt, suomi ok.'
        : 'Lataus vain natiivissa FamDay-sovelluksessa, ei Safarissa.',
      available: qwenOk,
      needsUserLoad: true,
      reason: qwenOk ? undefined : 'ios_safari_no_core_ai'
    });
  }

  const android = isAndroidChromeUa();
  const deviceFi = android ? 'tälle puhelimelle' : 'tälle koneelle';

  if (platform === 'chrome' || chromeOk) {
    options.push({
      id: 'chrome',
      label: 'Chrome Gemini Nano',
      detail:
        chrome.status === 'readily'
          ? 'Selaimen paikallinen malli on valmiina. Käytetään vain kun otat sen käyttöön.'
          : chrome.status === 'after-download'
            ? `Malli pitää ladata Chromessa (kerran, ${deviceFi}). Ei lähde pilveen.`
            : 'Chrome 148+ Prompt API (Gemini Nano). Ei ole tässä selaimessa — Aikataulujärki toimii Androidissa ja laptopissa.',
      available: chromeOk,
      needsUserLoad: chrome.status === 'after-download',
      reason: chromeOk ? undefined : 'no_prompt_api'
    });
  }

  let activeEngine: NeuralEngineId | 'none' = 'none';
  if (choice === 'chrome' && chrome.status === 'readily') activeEngine = 'chrome_gemini_nano';
  if (choice === 'apple' && appleOk && nativeStatus === 'readily') activeEngine = 'apple_foundation';
  if (choice === 'qwen06' && qwenOk && loaded === 'qwen06' && nativeStatus === 'readily') {
    activeEngine = 'apple_core_ai';
  }

  const neuralReady = activeEngine !== 'none';

  let summaryFi = 'Aikataulujärki. Laitteen tekoäly on pois päältä.';
  if (choice === 'off') {
    if (platform === 'ios-safari') {
      summaryFi = 'iPhone Safari: Aikataulujärki. Apple / Qwen vaatii FamDay-sovelluksen.';
    } else if (platform === 'chrome' && chromeOk) {
      summaryFi = android
        ? 'Android Chrome: paikallinen malli on tarjolla. Ota käyttöön jos haluat.'
        : 'Chrome: paikallinen malli on tarjolla. Ota käyttöön Perhe-asetuksista jos haluat.';
    } else if (platform === 'chrome') {
      summaryFi = android
        ? 'Android Chrome: Aikataulujärki. Gemini Nano ei ole tässä selaimessa — sovellus toimii silti.'
        : 'Chrome: Aikataulujärki. Gemini Nano ei ole tässä selaimessa — sovellus toimii silti.';
    }
  } else if (neuralReady) {
    summaryFi =
      activeEngine === 'chrome_gemini_nano'
        ? 'Chrome Gemini Nano käytössä (paikallinen, kevyt).'
        : activeEngine === 'apple_foundation'
          ? 'Apple Intelligence käytössä (paikallinen, kevyt).'
          : 'Qwen 0.6B käytössä (Core AI, paikallinen).';
  } else if (choice === 'chrome' && chrome.status === 'after-download') {
    summaryFi = 'Chrome-malli valittu — lataa se ensin (Lataa).';
  } else if (choice === 'qwen06' && loaded !== 'qwen06') {
    summaryFi = 'Qwen 0.6B valittu — lataa se ensin (Lataa).';
  } else if (choice === 'apple' && !appleOk) {
    summaryFi = 'Apple-malli valittu, mutta se ei ole tässä ympäristössä. Aikataulujärki vastaa.';
  }

  return {
    platform,
    choice,
    loaded,
    enabled: isOnDeviceLlmEnabled(),
    neuralReady,
    activeEngine,
    options,
    chromeStatus: chrome.status,
    nativeStatus,
    summaryFi
  };
}

export async function createOnDeviceLanguageSession(systemPrompt: string): Promise<{
  session: PromptSession;
  engine: NeuralEngineId;
} | null> {
  if (!isOnDeviceLlmEnabled()) return null;
  const runtime = await describeOnDeviceRuntime();
  if (!runtime.neuralReady || runtime.activeEngine === 'none') return null;

  if (runtime.activeEngine === 'chrome_gemini_nano') {
    const session = await createBuiltInLanguageSession(systemPrompt);
    if (!session) return null;
    return { session, engine: 'chrome_gemini_nano' };
  }

  if (runtime.activeEngine === 'apple_foundation' || runtime.activeEngine === 'apple_core_ai') {
    const engine = runtime.activeEngine;
    const session: PromptSession = {
      prompt: async (input: string) => {
        const out = await callNative('prompt', { system: systemPrompt, user: input });
        return String(out || '');
      },
      destroy: () => {
        /* native session is per-call; Swift destroys after respond */
      }
    };
    return { session, engine };
  }

  return null;
}

/**
 * User-initiated load. Never called on first launch.
 * Chrome: LanguageModel.create() triggers Gemini Nano download.
 * Qwen: native Background Assets.
 */
export async function requestLoadOnDeviceModel(
  choice: Exclude<OnDeviceLlmChoice, 'off'>
): Promise<{ ok: boolean; error?: string }> {
  setOnDeviceLlmChoice(choice);

  if (choice === 'apple') {
    const native = await probeNativeAvailability();
    if (native === 'unavailable') {
      return { ok: false, error: 'Apple Intelligence ei ole tässä iPhonessa / sovelluksessa.' };
    }
    markOnDeviceLlmLoaded('apple');
    return { ok: true };
  }

  if (choice === 'chrome') {
    try {
      const g = globalObj();
      const api = g.LanguageModel || g.window?.LanguageModel;
      if (api && typeof api.create === 'function') {
        const session = await api.create({
          expectedInputs: [{ type: 'text' }],
          expectedOutputs: [{ type: 'text' }]
        });
        session?.destroy?.();
        markOnDeviceLlmLoaded('chrome');
        return { ok: true };
      }
      const legacy = g.window?.ai?.languageModel || g.ai?.languageModel;
      if (legacy && typeof legacy.create === 'function') {
        const session = await legacy.create({ temperature: 0.1 });
        session?.destroy?.();
        markOnDeviceLlmLoaded('chrome');
        return { ok: true };
      }
      return { ok: false, error: 'Chrome Prompt API ei ole tässä selaimessa.' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Lataus epäonnistui' };
    }
  }

  if (choice === 'qwen06') {
    try {
      const res = await callNative('loadQwen');
      const ok = res === true || (typeof res === 'object' && res !== null && (res as { ok?: boolean }).ok === true);
      if (!ok) {
        const error =
          typeof res === 'object' && res !== null && 'error' in res
            ? String((res as { error?: string }).error || 'Qwen-lataus epäonnistui')
            : 'Qwen-lataus epäonnistui';
        return { ok: false, error };
      }
      markOnDeviceLlmLoaded('qwen06');
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Qwen vaatii FamDay-sovelluksen'
      };
    }
  }

  return { ok: false, error: 'Tuntematon malli' };
}

export function turnOffOnDeviceLlm(): void {
  setOnDeviceLlmChoice('off');
  markOnDeviceLlmLoaded('none');
  if (hasNativeAiBridge()) {
    callNative('unload').catch(() => undefined);
  }
}

export function engineUsedToFi(engine: CopilotEngineId | ParseEngineId | 'none'): string {
  if (engine === 'chrome_gemini_nano') return 'Paikallinen malli (Chrome)';
  if (engine === 'apple_foundation') return 'Apple on-device';
  if (engine === 'apple_core_ai') return 'Qwen 0.6B';
  if (engine === 'fast_nlp' || engine === 'deterministic' || engine === 'none') {
    return 'Aikataulujärki';
  }
  return 'Aikataulujärki';
}
