import { createWorker } from 'tesseract.js';
import { ExtractedSportsEvent, parseFreeformSportsMessage } from './messageParserNLP';
import { parsePastedSpreadsheetText, ParsedTableResult } from './tableAndExcelParser';
import { SportType } from '../../types/matchday';

export interface OcrProgressCallback {
  (progress: { status: string; progress: number }): void;
}

/**
 * Performs on-device WebAssembly OCR on an image file (screenshot/photo).
 */
export async function extractTextFromImage(
  imageSource: File | Blob | string,
  onProgress?: OcrProgressCallback
): Promise<string> {
  const worker = await createWorker('eng+fin', 1, {
    logger: (m) => {
      if (onProgress && m.status && typeof m.progress === 'number') {
        onProgress({ status: m.status, progress: m.progress });
      }
    }
  });

  try {
    const ret = await worker.recognize(imageSource);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Parses an image screenshot of an Excel table or WhatsApp message into events.
 */
export async function parseScheduleImage(
  imageSource: File | Blob | string,
  sport: SportType = 'football',
  defaultPlayer = 'Maija',
  onProgress?: OcrProgressCallback
): Promise<{
  rawText: string;
  tableResult: ParsedTableResult;
  freeformEvents: ExtractedSportsEvent[];
}> {
  const text = await extractTextFromImage(imageSource, onProgress);

  // Try parsing as table first
  const tableResult = parsePastedSpreadsheetText(text, sport, defaultPlayer);

  // If table found events, return
  if (tableResult.events.length > 0) {
    return {
      rawText: text,
      tableResult,
      freeformEvents: tableResult.events
    };
  }

  // Fallback to freeform message parsing
  const singleEvent = parseFreeformSportsMessage(text, defaultPlayer);
  return {
    rawText: text,
    tableResult: {
      events: [singleEvent],
      headers: [],
      totalRows: 1,
      unrecognizedRows: 0
    },
    freeformEvents: [singleEvent]
  };
}
