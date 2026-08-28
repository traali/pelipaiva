import { ExtractedSportsEvent, parseFreeformSportsMessage } from './messageParserNLP';
import { SportType, EventType } from '../../types/matchday';

export interface ChromeAiCapabilities {
  isSupported: boolean;
  status: 'readily' | 'after-download' | 'no';
  modelName?: string;
}

export interface HybridParseResult {
  result: ExtractedSportsEvent;
  engineUsed: 'fast_nlp' | 'chrome_gemini_nano';
  confidence: number;
  enrichedByLlm?: boolean;
}

/**
 * Checks if the browser provides built-in AI (e.g. Chrome's Gemini Nano via the W3C Prompt API).
 */
export async function checkChromeAiCapabilities(): Promise<ChromeAiCapabilities> {
  if (typeof window === 'undefined') {
    return { isSupported: false, status: 'no' };
  }

  const ai = (window as any).ai || (window as any).model;
  if (!ai?.languageModel) {
    return { isSupported: false, status: 'no' };
  }

  try {
    const caps = await ai.languageModel.capabilities();
    return {
      isSupported: caps.available !== 'no',
      status: caps.available,
      modelName: 'Gemini Nano'
    };
  } catch {
    return { isSupported: false, status: 'no' };
  }
}

const SYSTEM_PROMPT = `Olet suomalaisen junioriurheilun ja kouluelämän tapahtumien jäsennin.
Tehtäväsi on purkaa annetusta viestistä (WhatsApp, Wilma, MyClub, sähköposti) tapahtuman tiedot ja palauttaa VAIN validi JSON-objekti ilman markdown-muotoilua.

JSON-skeema:
{
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
}`;

/**
 * Parses freeform text using Google Chrome's built-in Gemini Nano model.
 */
export async function parseWithGeminiNano(
  text: string,
  defaultPlayerName = 'Pelaaja'
): Promise<ExtractedSportsEvent | null> {
  if (typeof window === 'undefined') return null;
  const ai = (window as any).ai;
  if (!ai?.languageModel) return null;

  try {
    const session = await ai.languageModel.create({
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.1
    });

    const rawResponse = await session.prompt(
      `Pura seuraava viesti JSON-muodossa. Oletuspelaaja on "${defaultPlayerName}":\n\n${text}`
    );

    session.destroy?.();

    if (!rawResponse || typeof rawResponse !== 'string') return null;

    // Clean any surrounding markdown code fences
    const cleanJson = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    return {
      title: parsed.title || 'Urheilutapahtuma',
      eventType: (parsed.eventType as EventType) || 'match',
      sport: (parsed.sport as SportType) || 'football',
      homeTeam: parsed.homeTeam || 'Oma joukkue',
      awayTeam: parsed.awayTeam || '',
      isHomeMatch: Boolean(parsed.isHomeMatch),
      dateStr: parsed.dateStr || '',
      kickoffTime: parsed.kickoffTime || '',
      warmupTime: parsed.warmupTime || '',
      endTime: parsed.endTime || '',
      venueHint: parsed.venueHint || '',
      kitColor: parsed.kitColor || undefined,
      volunteerDuties: Array.isArray(parsed.volunteerDuties) ? parsed.volunteerDuties : [],
      rawNotes: text.trim(),
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.95
    };
  } catch (err) {
    console.warn('[CHROME_BUILTIN_AI] Gemini Nano parse error:', err);
    return null;
  }
}

/**
 * Progressive Multi-Tier Hybrid Parser:
 * 1. Fast deterministic NLP runs in <1ms.
 * 2. If confidence >= 0.80, returns immediately.
 * 3. If confidence < 0.80 and Chrome Gemini Nano is available, escalates to Gemini Nano.
 */
export async function parseSportsMessageHybrid(
  text: string,
  defaultPlayerName = 'Pelaaja'
): Promise<HybridParseResult> {
  const fastResult = parseFreeformSportsMessage(text, defaultPlayerName);

  // If fast NLP is already confident, return instantly
  if (fastResult.confidenceScore >= 0.80) {
    return {
      result: fastResult,
      engineUsed: 'fast_nlp',
      confidence: fastResult.confidenceScore
    };
  }

  // Check if Chrome built-in AI is available
  const caps = await checkChromeAiCapabilities();
  if (caps.isSupported && caps.status === 'readily') {
    const nanoResult = await parseWithGeminiNano(text, defaultPlayerName);
    if (nanoResult && nanoResult.confidenceScore > fastResult.confidenceScore) {
      return {
        result: nanoResult,
        engineUsed: 'chrome_gemini_nano',
        confidence: nanoResult.confidenceScore,
        enrichedByLlm: true
      };
    }
  }

  return {
    result: fastResult,
    engineUsed: 'fast_nlp',
    confidence: fastResult.confidenceScore
  };
}
