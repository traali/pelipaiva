import React from "react";
import { Camera, Loader2, CheckCircle2 } from "lucide-react";
import type { ExtractedEventPreview } from "./MessageNlpImportTab";

export interface CameraOcrImportTabProps {
  handleImageOcr: (file: File) => void;
  isOcrProcessing: boolean;
  ocrStatus: string;
  ocrProgress: number;
  parseNotice: string | null;
  ocrExtractedEvents: ExtractedEventPreview[];
  handleSaveEvents: (events: any[]) => void;
  isSaving: boolean;
  selectedPlayer: string;
}

export const CameraOcrImportTab: React.FC<CameraOcrImportTabProps> = ({
  handleImageOcr,
  isOcrProcessing,
  ocrStatus,
  ocrProgress,
  parseNotice,
  ocrExtractedEvents,
  handleSaveEvents,
  isSaving,
  selectedPlayer,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-secondary">
        Lataa kuvakaappaus otteluohjelmasta tai kahviovuorolistasta:
      </p>

      <div className="p-6 rounded-2xl border-2 border-dashed border-border-strong hover:border-pitch transition-all flex flex-col items-center justify-center gap-2 text-center bg-surface-elevated/40">
        <Camera className="w-8 h-8 text-pitch" />
        <div className="text-xs font-bold text-text-primary">Valitse tai pudota kuva tähän</div>
        <p className="text-[11px] text-text-muted">PNG, JPG, WebP, Screenshot</p>
        <label className="mt-2 px-3 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 cursor-pointer">
          <span>Valitse kuvatiedosto</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageOcr(f);
            }}
            className="hidden"
          />
        </label>
      </div>

      <div aria-live="polite">
        {isOcrProcessing && (
          <div className="p-4 rounded-2xl bg-surface border border-pitch/30 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-pitch animate-spin shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-bold text-text-primary">{ocrStatus}</div>
              <div className="w-full bg-border-subtle h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-pitch h-full transition-all duration-300"
                  style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
        {!isOcrProcessing && parseNotice && (
          <p role="status" className="mt-3 p-2.5 rounded-xl bg-whistle/15 border border-whistle/40 text-[11px] font-semibold text-text-primary">
            {parseNotice}
          </p>
        )}

        {ocrExtractedEvents.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="text-xs font-bold text-text-primary">
              OCR tunnisti {ocrExtractedEvents.length} ottelua:
            </div>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
              {ocrExtractedEvents.map((ev, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-surface border border-border-subtle text-xs">
                  <span className="font-bold">{ev.dateStr} klo {ev.kickoffTime}</span>: {ev.title} @ {ev.venueHint}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSaveEvents(ocrExtractedEvents)}
              disabled={isSaving}
              className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tallenna {ocrExtractedEvents.length} ottelua ({selectedPlayer})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
