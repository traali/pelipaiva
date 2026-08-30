import { ExtractedSportsEvent, parseFreeformSportsMessage } from './messageParserNLP';
import { SportType, EventType } from '../../types/matchday';
import { isOnDeviceLlmEnabled, getOnDeviceLlmChoice } from './onDeviceLlmPrefs';
import type { NeuralEngineId } from './onDeviceLlm';
export type { NeuralEngineId };

export interface ChromeAiCapabilities {
  isSupported: boolean;
  status: 'readily' | 'after-download' | 'no';
  modelName?: string;
}

export interface HybridParseResult {
  result: ExtractedSportsEvent;
  engineUsed: 'fast_nlp' | NeuralEngineId;
  confidence: number;
  enrichedByLlm?: boolean;
}

export interface LlmContextGuide {
  knownProfiles?: Array<{
    id: string;
    playerName: string;
    sport: string;
    teamName: string;
  }>;
  upcomingEvents?: Array<{
    id: string;
    profileId: string;
    playerName: string;
    title: string;
    dateStr: string;
    startTime: string;
    warmupTime?: string;
    venueName?: string;
    homeTeam: string;
    awayTeam: string;
  }>;
}

export interface LlmReasoningDecision {
  action: 'update_existing' | 'create_new';
  targetEventId?: string;
  detectedPlayerName?: string;
  changesSummary: string;
  extractedEvent: ExtractedSportsEvent;
  confidenceScore: number;
  engineUsed: 'fast_nlp' | NeuralEngineId;
}

type PromptSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

type LanguageModelHandle =
  | {
      kind: 'prompt';
      availability: (opts?: unknown) => Promise<string>;
      create: (opts?: Record<string, unknown>) => Promise<PromptSession>;
    }
  | {
      kind: 'legacy';
      capabilities: () => Promise<{ available?: string }>;
      create: (opts?: Record<string, unknown>) => Promise<PromptSession>;
    };

function getLanguageModelHandle(): LanguageModelHandle | null {
  const g = globalThis as Record<string, any>;
  const promptApi = g.LanguageModel || g.window?.LanguageModel;
  if (promptApi && typeof promptApi.create === 'function' && typeof promptApi.availability === 'function') {
    return { kind: 'prompt', availability: promptApi.availability.bind(promptApi), create: promptApi.create.bind(promptApi) };
  }

  const legacy = g.window?.ai?.languageModel || g.ai?.languageModel;
  if (legacy && typeof legacy.create === 'function') {
    return {
      kind: 'legacy',
      capabilities: typeof legacy.capabilities === 'function'
        ? legacy.capabilities.bind(legacy)
        : async () => ({ available: 'readily' }),
      create: legacy.create.bind(legacy)
    };
  }
  return null;
}

function mapAvailability(raw?: string): ChromeAiCapabilities['status'] {
  if (raw === 'available' || raw === 'readily') return 'readily';
  if (raw === 'downloadable' || raw === 'downloading' || raw === 'after-download') return 'after-download';
  return 'no';
}

/**
 * Chrome 148+ Prompt API is `LanguageModel`. `window.ai.languageModel` is obsolete.
 * iPhone Safari: unavailable — deterministic NLP stays the engine.
 */
export async function checkChromeAiCapabilities(): Promise<ChromeAiCapabilities> {
  const handle = getLanguageModelHandle();
  if (!handle) {
    return { isSupported: false, status: 'no' };
  }

  try {
    const raw =
      handle.kind === 'prompt'
        ? await handle.availability({
            expectedInputs: [{ type: 'text' }],
            expectedOutputs: [{ type: 'text' }]
          })
        : (await handle.capabilities()).available;
    const status = mapAvailability(raw);
    return {
      isSupported: status !== 'no',
      status,
      modelName: status === 'no' ? undefined : 'Gemini Nano'
    };
  } catch {
    return { isSupported: false, status: 'no' };
  }
}

export async function createBuiltInLanguageSession(systemPrompt: string): Promise<PromptSession | null> {
  const handle = getLanguageModelHandle();
  if (!handle) return null;
  const caps = await checkChromeAiCapabilities();
  if (!caps.isSupported || caps.status !== 'readily') return null;

  if (handle.kind === 'prompt') {
    return handle.create({
      initialPrompts: [{ role: 'system', content: systemPrompt }],
      expectedInputs: [{ type: 'text' }],
      expectedOutputs: [{ type: 'text' }],
      outputLanguage: 'en',
      expectedInputLanguages: ['fi', 'en']
    });
  }
  return handle.create({ systemPrompt, temperature: 0.1 });
}

/**
 * Generates the system prompt tailored with family roster and calendar context.
 */
export function buildContextAwareSystemPrompt(context?: LlmContextGuide): string {
  let prompt = `Olet Pelipäivän älykäs tekoälyassistentti suomalaisille urheiluperheille.
Tehtäväsi on analysoida käyttäjän syöttämä viesti (WhatsApp, Wilma, MyClub, sähköposti), vertailla sitä perheen olemassa oleviin tapahtumiin ja palauttaa VAIN validi JSON-objekti ilman markdown-muotoilua.

OHJEET PÄÄTTELYYN:
1. KENELLE (Kohdehenkilö):
   - Selvitä kenen perheen lapsen/pelaajan tapahtumasta on kyse (esim. "Simon peli", "Lillille", "Eeron harkat").
   - Jos nimeä ei mainita, valitse todennäköisin pelaaja lajin tai joukkueen perusteella.

2. ONKO TAPAHTUMA JO OLEMASSA VAI UUSI:
   - Jos viesti viittaa selvästi johonkin alla listatuista olemassa olevista tapahtumista (esim. ajan muutos, paikan muutos, ottelun lopputulos, talkoovuoro, kyytijärjestely tai peruutus), aseta action = "update_existing" ja targetEventId kyseisen tapahtuman ID:ksi.
   - Jos viesti kertoo kokonaan uudesta tapahtumasta, aseta action = "create_new".

3. TIETOJEN PURKU:
   - Päivämäärä (YYYY-MM-DD), aloitusaika (HH:MM), kokoontumisaika (HH:MM), loppuaika (HH:MM)
   - Paikka (kenttä, halli, koulu), peliasun väri (esim. Sininen / Valkoinen)
   - Talkoovuorot (esim. Kahviovuoro, Toimitsijavuoro)
   - Tulos (esim. "4-2") tai peruutustieto.
   - Älä keksity kellonaikaa. Jos viestissä ei ole kelloa, jätä kickoffTime tyhjäksi.

JSON-SKEEMA:
{
  "action": "update_existing" | "create_new",
  "targetEventId": string (vain jos action on "update_existing"),
  "detectedPlayerName": string,
  "changesSummary": string (lyhyt suomenkielinen tiivistelmä mitä muutetaan tai lisätään),
  "extractedEvent": {
    "title": string,
    "eventType": "match" | "training" | "tournament" | "meeting" | "school" | "other",
    "sport": "football" | "floorball" | "ice_hockey" | "basketball" | "volleyball" | "cheerleading" | "handball" | "ringette" | "futsal" | "pesapallo" | "school" | "other",
    "homeTeam": string,
    "awayTeam": string,
    "isHomeMatch": boolean,
    "dateStr": string (YYYY-MM-DD),
    "kickoffTime": string (HH:MM),
    "warmupTime": string (HH:MM),
    "endTime": string (HH:MM),
    "venueHint": string,
    "kitColor": string,
    "volunteerDuties": string[],
    "confidenceScore": number (0.0 - 1.0)
  }
}`;

  if (context?.knownProfiles && context.knownProfiles.length > 0) {
    prompt += `\n\nPERHEEN REKISTERÖIDYT PELAAJAT:\n` +
      context.knownProfiles.map((p) => `- ${p.playerName} (Laji: ${p.sport}, Joukkue: ${p.teamName})`).join('\n');
  }

  if (context?.upcomingEvents && context.upcomingEvents.length > 0) {
    prompt += `\n\nLÄHIAJAN OLEMASSA OLEVAT KALENTERITAPAHTUMAT:\n` +
      context.upcomingEvents.map((e) => `- ID: "${e.id}" | Pelaaja: ${e.playerName} | Pvm: ${e.dateStr} | Klo: ${e.startTime} (Kokoontuminen: ${e.warmupTime || '-'}) | ${e.title} @ ${e.venueName || 'Kenttä'}`).join('\n');
  }

  return prompt;
}

export function parseLlmSportsJson(
  rawResponse: string,
  text: string,
  defaultPlayerName: string,
  engineUsed: NeuralEngineId
): LlmReasoningDecision | null {
  if (!rawResponse || typeof rawResponse !== 'string') return null;
  const cleanJson = rawResponse
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleanJson);
  const ev = parsed.extractedEvent || {};

  const extractedEvent: ExtractedSportsEvent = {
    title: ev.title || 'Urheilutapahtuma',
    eventType: (ev.eventType as EventType) || 'match',
    sport: (ev.sport as SportType) || 'football',
    homeTeam: ev.homeTeam || 'Oma joukkue',
    awayTeam: ev.awayTeam || '',
    isHomeMatch: Boolean(ev.isHomeMatch),
    dateStr: ev.dateStr || '',
    kickoffTime: ev.kickoffTime || '',
    warmupTime: ev.warmupTime || '',
    endTime: ev.endTime || '',
    venueHint: ev.venueHint || '',
    kitColor: ev.kitColor || undefined,
    volunteerDuties: Array.isArray(ev.volunteerDuties) ? ev.volunteerDuties : [],
    rawNotes: text.trim(),
    confidenceScore: typeof ev.confidenceScore === 'number' ? ev.confidenceScore : 0.95
  };

  return {
    action: parsed.action === 'update_existing' ? 'update_existing' : 'create_new',
    targetEventId: parsed.targetEventId || undefined,
    detectedPlayerName: parsed.detectedPlayerName || defaultPlayerName,
    changesSummary: parsed.changesSummary || 'Päivitetään tapahtuman tiedot',
    extractedEvent,
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.95,
    engineUsed
  };
}

/**
 * Deep semantic reasoning with the browser's on-device Prompt API.
 */
export async function reasonWithGeminiNano(
  text: string,
  context?: LlmContextGuide,
  defaultPlayerName = 'Pelaaja'
): Promise<LlmReasoningDecision | null> {
  try {
    const systemPrompt = buildContextAwareSystemPrompt(context);
    const session = await createBuiltInLanguageSession(systemPrompt);
    if (!session) return null;

    const rawResponse = await session.prompt(
      `Analysoi seuraava viesti ja palauta JSON-vastaus. Oletuspelaaja on "${defaultPlayerName}":\n\n${text}`
    );

    session.destroy?.();
    return parseLlmSportsJson(rawResponse, text, defaultPlayerName, 'chrome_gemini_nano');
  } catch (err) {
    console.warn('[CHROME_BUILTIN_AI] Gemini Nano reasoning error:', err);
    return null;
  }
}

/**
 * Parses freeform text using the browser's on-device language model (simple extraction).
 */
export async function parseWithGeminiNano(
  text: string,
  defaultPlayerName = 'Pelaaja'
): Promise<ExtractedSportsEvent | null> {
  const res = await reasonWithGeminiNano(text, undefined, defaultPlayerName);
  return res ? res.extractedEvent : null;
}

/**
 * Progressive Multi-Tier Hybrid Parser:
 * 1. Fast deterministic NLP runs in <1ms.
 * 2. If confidence >= 0.80, returns immediately.
 * 3. Neural net only if the user opted in AND a local model is ready.
 */
export async function parseSportsMessageHybrid(
  text: string,
  defaultPlayerName = 'Pelaaja',
  context?: LlmContextGuide
): Promise<HybridParseResult> {
  const fastResult = parseFreeformSportsMessage(text, defaultPlayerName);

  if (fastResult.confidenceScore >= 0.80) {
    return {
      result: fastResult,
      engineUsed: 'fast_nlp',
      confidence: fastResult.confidenceScore
    };
  }

  if (!isOnDeviceLlmEnabled()) {
    return {
      result: fastResult,
      engineUsed: 'fast_nlp',
      confidence: fastResult.confidenceScore
    };
  }

  const choice = getOnDeviceLlmChoice();
  const caps = await checkChromeAiCapabilities();
  if (choice === 'chrome' && caps.isSupported && caps.status === 'readily') {
    const nanoResult = await reasonWithGeminiNano(text, context, defaultPlayerName);
    if (nanoResult && nanoResult.confidenceScore > fastResult.confidenceScore) {
      return {
        result: nanoResult.extractedEvent,
        engineUsed: 'chrome_gemini_nano',
        confidence: nanoResult.confidenceScore,
        enrichedByLlm: true
      };
    }
  }

  try {
    const { createOnDeviceLanguageSession } = await import('./onDeviceLlm');
    const boxed = await createOnDeviceLanguageSession(buildContextAwareSystemPrompt(context));
    if (boxed && boxed.engine !== 'chrome_gemini_nano') {
      const raw = await boxed.session.prompt(
        `Analysoi seuraava viesti ja palauta JSON-vastaus. Oletuspelaaja on "${defaultPlayerName}":\n\n${text}`
      );
      boxed.session.destroy?.();
      const parsed = parseLlmSportsJson(raw, text, defaultPlayerName, boxed.engine);
      if (parsed && parsed.confidenceScore > fastResult.confidenceScore) {
        return {
          result: parsed.extractedEvent,
          engineUsed: boxed.engine,
          confidence: parsed.confidenceScore,
          enrichedByLlm: true
        };
      }
    }
  } catch {
    /* native path optional */
  }

  return {
    result: fastResult,
    engineUsed: 'fast_nlp',
    confidence: fastResult.confidenceScore
  };
}
