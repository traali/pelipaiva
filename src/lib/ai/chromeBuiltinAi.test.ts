import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkChromeAiCapabilities,
  parseWithGeminiNano,
  reasonWithGeminiNano,
  parseSportsMessageHybrid,
  LlmContextGuide
} from './chromeBuiltinAi';

describe('Chrome Built-in AI (Gemini Nano Prompt API) Integration', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    delete (globalThis as any).LanguageModel;
  });

  it('should report unsupported when window.ai is not available (e.g. Safari / Firefox)', async () => {
    (global as any).window = {};
    const caps = await checkChromeAiCapabilities();
    expect(caps.isSupported).toBe(false);
    expect(caps.status).toBe('no');
  });

  it('should report supported when Chrome LanguageModel Prompt API is present', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn()
    };
    (global as any).window = {};

    const caps = await checkChromeAiCapabilities();
    expect(caps.isSupported).toBe(true);
    expect(caps.status).toBe('readily');
    expect(caps.modelName).toBe('Gemini Nano');

    delete (globalThis as any).LanguageModel;
  });

  it('prefers LanguageModel over obsolete window.ai', async () => {
    const promptCreate = vi.fn().mockResolvedValue({
      prompt: vi.fn().mockResolvedValue(JSON.stringify({
        action: 'create_new',
        extractedEvent: {
          title: 'Nano peli',
          eventType: 'match',
          sport: 'football',
          homeTeam: 'PPJ',
          awayTeam: 'HJK',
          dateStr: '2026-09-12',
          kickoffTime: '14:30',
          confidenceScore: 0.9
        }
      })),
      destroy: vi.fn()
    });
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: promptCreate
    };
    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn()
        }
      }
    };

    await parseWithGeminiNano('lauantaina peli', 'Simo');
    expect(promptCreate).toHaveBeenCalled();
    expect((global as any).window.ai.languageModel.create).not.toHaveBeenCalled();
    delete (globalThis as any).LanguageModel;
  });

  it('should report supported and ready when Chrome window.ai is present', async () => {
    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn()
        }
      }
    };

    const caps = await checkChromeAiCapabilities();
    expect(caps.isSupported).toBe(true);
    expect(caps.status).toBe('readily');
    expect(caps.modelName).toBe('Gemini Nano');
  });

  it('should parse freeform sports text using Gemini Nano session', async () => {
    const mockPromptResponse = JSON.stringify({
      action: 'create_new',
      detectedPlayerName: 'Simo',
      changesSummary: 'Uusi ottelu: PPJ Laru vs HJK Sininen',
      extractedEvent: {
        title: 'PPJ Laru vs HJK Sininen',
        eventType: 'match',
        sport: 'football',
        homeTeam: 'PPJ Laru',
        awayTeam: 'HJK Sininen',
        isHomeMatch: true,
        dateStr: '2026-09-12',
        kickoffTime: '14:30',
        warmupTime: '13:45',
        endTime: '16:00',
        venueHint: 'Ruukinlahden tekonurmi',
        kitColor: 'Sininen',
        volunteerDuties: ['Kahvio klo 13:30-15:00'],
        confidenceScore: 0.96
      }
    });

    const mockSession = {
      prompt: vi.fn().mockResolvedValue(`\`\`\`json\n${mockPromptResponse}\n\`\`\``),
      destroy: vi.fn()
    };

    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession)
        }
      }
    };

    const result = await parseWithGeminiNano(
      'Moi! Lauantaina 12.9. peli Ruukinlahdella HJK Sinistä vastaan. Kokoontuminen 13.45, peli 14.30. Sininen paita. Maija kahviossa.',
      'Simo'
    );

    expect(result).toBeDefined();
    expect(result?.title).toBe('PPJ Laru vs HJK Sininen');
    expect(result?.homeTeam).toBe('PPJ Laru');
    expect(result?.awayTeam).toBe('HJK Sininen');
    expect(result?.dateStr).toBe('2026-09-12');
    expect(result?.kickoffTime).toBe('14:30');
    expect(result?.warmupTime).toBe('13:45');
    expect(result?.venueHint).toBe('Ruukinlahden tekonurmi');
    expect(result?.volunteerDuties).toEqual(['Kahvio klo 13:30-15:00']);
    expect(mockSession.destroy).toHaveBeenCalled();
  });

  it('should reason over existing events to update an existing match when context is provided', async () => {
    const mockDecisionResponse = JSON.stringify({
      action: 'update_existing',
      targetEventId: 'ev-simo-101',
      detectedPlayerName: 'Simo',
      changesSummary: 'Aikaistetaan kokoontumista klo 13:30 ja lisätään Maijan kahviovuoro',
      extractedEvent: {
        title: 'PPJ/Laru sin vs FC Honka',
        eventType: 'match',
        sport: 'football',
        homeTeam: 'PPJ/Laru sin',
        awayTeam: 'FC Honka',
        isHomeMatch: true,
        dateStr: '2026-08-29',
        kickoffTime: '14:45',
        warmupTime: '13:30',
        venueHint: 'Ruukinlahden tekonurmi',
        volunteerDuties: ['Maija kahviossa klo 13:15-15:30'],
        confidenceScore: 0.98
      }
    });

    const mockSession = {
      prompt: vi.fn().mockResolvedValue(mockDecisionResponse),
      destroy: vi.fn()
    };

    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession)
        }
      }
    };

    const context: LlmContextGuide = {
      knownProfiles: [
        { id: 'p1', playerName: 'Simo', sport: 'football', teamName: 'PPJ Laru 2013' },
        { id: 'p2', playerName: 'Lilli', sport: 'cheerleading', teamName: 'HAC Juniorit' }
      ],
      upcomingEvents: [
        {
          id: 'ev-simo-101',
          profileId: 'p1',
          playerName: 'Simo',
          title: 'PPJ/Laru sin vs FC Honka',
          dateStr: '2026-08-29',
          startTime: '14:45',
          warmupTime: '14:00',
          venueName: 'Ruukinlahden tekonurmi',
          homeTeam: 'PPJ/Laru sin',
          awayTeam: 'FC Honka'
        }
      ]
    };

    const decision = await reasonWithGeminiNano(
      'Hei Simon huomiseen peliin muutos: kokoontuminen aikaistuu klo 13.30 ja Maija hoitaa kahvion.',
      context,
      'Simo'
    );

    expect(decision).toBeDefined();
    expect(decision?.action).toBe('update_existing');
    expect(decision?.targetEventId).toBe('ev-simo-101');
    expect(decision?.detectedPlayerName).toBe('Simo');
    expect(decision?.changesSummary).toContain('Maija');
    expect(decision?.extractedEvent.warmupTime).toBe('13:30');
    expect(decision?.extractedEvent.volunteerDuties).toEqual(['Maija kahviossa klo 13:15-15:30']);
  });

  it('should use fast deterministic NLP for high-confidence messages without calling LLM', async () => {
    const mockCreate = vi.fn();
    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: mockCreate
        }
      }
    };

    const text = 'Peli: HJK vs Honka lauantaina 24.8.2026 klo 15.00 Bubu kentällä. Kokoontuminen 14.15.';
    const res = await parseSportsMessageHybrid(text, 'Eero');

    expect(res.engineUsed).toBe('fast_nlp');
    expect(res.confidence).toBeGreaterThanOrEqual(0.80);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should escalate to Gemini Nano when fast NLP confidence is low and Gemini Nano is available', async () => {
    const mockPromptResponse = JSON.stringify({
      action: 'create_new',
      detectedPlayerName: 'Lilli',
      changesSummary: 'Uusi peli Espoossa',
      extractedEvent: {
        title: 'Peli Espoossa',
        eventType: 'match',
        sport: 'football',
        homeTeam: 'Oma joukkue',
        awayTeam: 'Espoo',
        isHomeMatch: false,
        dateStr: '2026-10-05',
        kickoffTime: '18:00',
        warmupTime: '17:30',
        endTime: '19:30',
        venueHint: 'Espoonlahden urheilupuisto',
        kitColor: 'Musta',
        volunteerDuties: [],
        confidenceScore: 0.95
      }
    });

    const mockSession = {
      prompt: vi.fn().mockResolvedValue(mockPromptResponse),
      destroy: vi.fn()
    };

    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession)
        }
      }
    };

    const messyText = 'Peli ensi viikolla Espoossa, ottakaa mustat paidat ja nappikset.';
    const res = await parseSportsMessageHybrid(messyText, 'Lilli');

    expect(res.engineUsed).toBe('chrome_gemini_nano');
    expect(res.enrichedByLlm).toBe(true);
    expect(res.result.dateStr).toBe('2026-10-05');
    expect(res.result.kickoffTime).toBe('18:00');
  });

  it('should fallback to fast NLP if Gemini Nano fails or throws', async () => {
    (global as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockRejectedValue(new Error('Model busy or failed'))
        }
      }
    };

    const text = 'Jalkapallo harkat huomenna klo 17-18 Väiskillä.';
    const res = await parseSportsMessageHybrid(text, 'Lilli');

    expect(res.engineUsed).toBe('fast_nlp');
    expect(res.result).toBeDefined();
  });
});
