import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resetOnDeviceLlmPrefsForTests,
  getOnDeviceLlmChoice,
  setOnDeviceLlmChoice,
  isOnDeviceLlmEnabled,
  markOnDeviceLlmLoaded,
  getOnDeviceLlmLoaded
} from './onDeviceLlmPrefs';
import {
  createOnDeviceLanguageSession,
  describeOnDeviceRuntime,
  detectOnDevicePlatform,
  requestLoadOnDeviceModel,
  turnOffOnDeviceLlm
} from './onDeviceLlm';
import { parseSportsMessageHybrid } from './chromeBuiltinAi';

describe('on-device LLM prefs (default off)', () => {
  const originalNavigator = (globalThis as any).navigator;

  beforeEach(() => {
    resetOnDeviceLlmPrefsForTests();
    delete (globalThis as any).LanguageModel;
    delete (globalThis as any).FamdayNativeAi;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetOnDeviceLlmPrefsForTests();
    delete (globalThis as any).LanguageModel;
    delete (globalThis as any).FamdayNativeAi;
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    }
  });

  it('defaults to off and does not enable neural net', () => {
    expect(getOnDeviceLlmChoice()).toBe('off');
    expect(isOnDeviceLlmEnabled()).toBe(false);
    expect(getOnDeviceLlmLoaded()).toBe('none');
  });

  it('opt-in is explicit and per-device', () => {
    setOnDeviceLlmChoice('chrome');
    expect(isOnDeviceLlmEnabled()).toBe(true);
    expect(getOnDeviceLlmChoice()).toBe('chrome');
    setOnDeviceLlmChoice('off');
    expect(isOnDeviceLlmEnabled()).toBe(false);
    expect(getOnDeviceLlmLoaded()).toBe('none');
  });

  it('does not create a session while off even if Chrome Prompt API exists', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn()
    };
    const session = await createOnDeviceLanguageSession('sys');
    expect(session).toBeNull();
    expect((globalThis as any).LanguageModel.create).not.toHaveBeenCalled();
  });

  it('hybrid parser stays on fast NLP while the toggle is off', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn(),
        destroy: vi.fn()
      })
    };
    const res = await parseSportsMessageHybrid(
      'Peli ensi viikolla Espoossa, ottakaa mustat paidat ja nappikset.',
      'Lilli'
    );
    expect(res.engineUsed).toBe('fast_nlp');
    expect((globalThis as any).LanguageModel.create).not.toHaveBeenCalled();
  });

  it('Chrome laptop: load is user-initiated then session is allowed', async () => {
    const destroy = vi.fn();
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn().mockResolvedValue('ok'),
        destroy
      })
    };
    const load = await requestLoadOnDeviceModel('chrome');
    expect(load.ok).toBe(true);
    expect(getOnDeviceLlmChoice()).toBe('chrome');
    expect(getOnDeviceLlmLoaded()).toBe('chrome');

    const boxed = await createOnDeviceLanguageSession('sys');
    expect(boxed?.engine).toBe('chrome_gemini_nano');
    expect(boxed?.session).toBeTruthy();
  });

  it('iOS Safari has no neural option without native bridge', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', platform: 'iPhone', maxTouchPoints: 5 },
      configurable: true
    });
    expect(detectOnDevicePlatform()).toBe('ios-safari');
    const runtime = await describeOnDeviceRuntime();
    const apple = runtime.options.find((o) => o.id === 'apple');
    const qwen = runtime.options.find((o) => o.id === 'qwen06');
    expect(apple?.available).toBe(false);
    expect(qwen?.available).toBe(false);
    expect(runtime.neuralReady).toBe(false);
    expect(runtime.summaryFi).toMatch(/Safari/i);
  });

  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36';
  const DESKTOP_CHROME =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
  const IOS_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/148.0.0.0 Mobile/15E148 Safari/604.1';

  it('Android Chrome is the chrome platform, not Apple/Qwen', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: ANDROID_CHROME, platform: 'Linux armv8l', maxTouchPoints: 5 },
      configurable: true
    });
    expect(detectOnDevicePlatform()).toBe('chrome');
    const runtime = await describeOnDeviceRuntime();
    expect(runtime.options.some((o) => o.id === 'apple')).toBe(false);
    expect(runtime.options.some((o) => o.id === 'qwen06')).toBe(false);
    const chrome = runtime.options.find((o) => o.id === 'chrome');
    expect(chrome).toBeTruthy();
    expect(chrome?.available).toBe(false);
    expect(runtime.summaryFi).toMatch(/Android Chrome/i);
    expect(runtime.neuralReady).toBe(false);
  });

  it('Android Chrome with Prompt API can opt in like laptop Chrome', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: ANDROID_CHROME, platform: 'Linux armv8l', maxTouchPoints: 5 },
      configurable: true
    });
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt: vi.fn().mockResolvedValue('ok'), destroy: vi.fn() })
    };
    const load = await requestLoadOnDeviceModel('chrome');
    expect(load.ok).toBe(true);
    const runtime = await describeOnDeviceRuntime();
    expect(runtime.activeEngine).toBe('chrome_gemini_nano');
    expect(runtime.summaryFi).toMatch(/Gemini Nano/i);
  });

  it('desktop Chrome is chrome platform with Gemini Nano option', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: DESKTOP_CHROME, platform: 'Linux x86_64', maxTouchPoints: 0 },
      configurable: true
    });
    expect(detectOnDevicePlatform()).toBe('chrome');
    const runtime = await describeOnDeviceRuntime();
    expect(runtime.options.find((o) => o.id === 'chrome')).toBeTruthy();
    expect(runtime.options.find((o) => o.id === 'apple')).toBeFalsy();
    expect(runtime.summaryFi).toMatch(/Chrome/i);
  });

  it('iOS Chrome (CriOS) stays ios-safari — WebKit has no Prompt API', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: IOS_CHROME, platform: 'iPhone', maxTouchPoints: 5 },
      configurable: true
    });
    expect(detectOnDevicePlatform()).toBe('ios-safari');
    const runtime = await describeOnDeviceRuntime();
    expect(runtime.options.find((o) => o.id === 'chrome')).toBeFalsy();
    expect(runtime.options.find((o) => o.id === 'apple')?.available).toBe(false);
  });

  it('iOS native bridge can expose Apple Intelligence after opt-in', async () => {
    (globalThis as any).FamdayNativeAi = {
      availability: vi.fn().mockResolvedValue('readily'),
      engine: vi.fn().mockResolvedValue('apple_foundation'),
      prompt: vi.fn().mockResolvedValue('{"ok":true}'),
      loadQwen: vi.fn(),
      unload: vi.fn()
    };
    expect(detectOnDevicePlatform()).toBe('ios-native');
    const load = await requestLoadOnDeviceModel('apple');
    expect(load.ok).toBe(true);
    const boxed = await createOnDeviceLanguageSession('sys');
    expect(boxed?.engine).toBe('apple_foundation');
    const out = await boxed!.session.prompt('Simo la 10:00 Tapiola');
    expect(out).toContain('ok');
    expect((globalThis as any).FamdayNativeAi.prompt).toHaveBeenCalled();
  });

  it('Qwen 0.6B is not used until the user loads it', async () => {
    (globalThis as any).FamdayNativeAi = {
      availability: vi.fn().mockResolvedValue('readily'),
      engine: vi.fn().mockResolvedValue('apple_core_ai'),
      prompt: vi.fn(),
      loadQwen: vi.fn().mockResolvedValue({ ok: true }),
      unload: vi.fn()
    };
    setOnDeviceLlmChoice('qwen06');
    const before = await createOnDeviceLanguageSession('sys');
    expect(before).toBeNull();
    expect((globalThis as any).FamdayNativeAi.loadQwen).not.toHaveBeenCalled();

    const load = await requestLoadOnDeviceModel('qwen06');
    expect(load.ok).toBe(true);
    expect(getOnDeviceLlmLoaded()).toBe('qwen06');
    markOnDeviceLlmLoaded('qwen06');
    const after = await describeOnDeviceRuntime();
    expect(after.activeEngine).toBe('apple_core_ai');
  });

  it('turn off unloads and never calls native prompt afterwards', async () => {
    (globalThis as any).FamdayNativeAi = {
      availability: vi.fn().mockResolvedValue('readily'),
      engine: vi.fn().mockResolvedValue('apple_foundation'),
      prompt: vi.fn(),
      unload: vi.fn().mockResolvedValue(undefined)
    };
    await requestLoadOnDeviceModel('apple');
    turnOffOnDeviceLlm();
    expect(isOnDeviceLlmEnabled()).toBe(false);
    const session = await createOnDeviceLanguageSession('sys');
    expect(session).toBeNull();
    expect((globalThis as any).FamdayNativeAi.unload).toHaveBeenCalled();
  });
});
