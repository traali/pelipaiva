import React from "react";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import type { ExtractedEventPreview } from "./MessageNlpImportTab";

export interface SpreadsheetImportTabProps {
  pastedTableText: string;
  setPastedTableText: (val: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleParseTable: () => void;
  parseNotice: string | null;
  extractedTableEvents: ExtractedEventPreview[];
  handleSaveEvents: (events: any[]) => void;
  isSaving: boolean;
}

export const SpreadsheetImportTab: React.FC<SpreadsheetImportTabProps> = ({
  pastedTableText,
  setPastedTableText,
  handleFileUpload,
  handleParseTable,
  parseNotice,
  extractedTableEvents,
  handleSaveEvents,
  isSaving,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Kopioi taulukko Sheetsistä/Excelistä tai lataa tiedosto (.csv, .tsv, .txt):
        </p>
        <label className="px-2.5 py-1 rounded-lg bg-surface text-text-primary text-[11px] font-bold border border-border-strong hover:border-pitch cursor-pointer flex items-center gap-1">
          <Upload className="w-3 h-3" />
          <span>Lataa tiedosto</span>
          <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      <textarea
        rows={4}
        value={pastedTableText}
        onChange={(e) => setPastedTableText(e.target.value)}
        placeholder="Pvm&#9;Klo&#9;Ottelu&#9;Kenttä&#9;Kahviovuoro&#10;24.8.&#9;15:00&#9;HJK vs Honka&#9;Väiski&#9;Maija&#10;31.8.&#9;12:00&#9;EPS vs HJK&#9;Tapiola 2&#9;Eemil"
        className="w-full p-3 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch resize-none font-mono"
      />

      <button
        type="button"
        onClick={handleParseTable}
        disabled={!pastedTableText.trim()}
        className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer disabled:opacity-50"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span>Jäsennä taulukon ottelut</span>
      </button>

      {parseNotice && (
        <p role="status" className="p-2.5 rounded-xl bg-whistle/15 border border-whistle/40 text-[11px] font-semibold text-text-primary">
          {parseNotice}
        </p>
      )}

      <div aria-live="polite">
        {extractedTableEvents.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="text-xs font-bold text-text-primary">
              Löydetty {extractedTableEvents.length} ottelua:
            </div>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
              {extractedTableEvents.map((ev, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-surface border border-border-subtle text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold">{ev.dateStr} klo {ev.kickoffTime}</span>: {ev.title} @ {ev.venueHint}
                    {ev.volunteerDuties.length > 0 && (
                      <div className="text-[11px] text-whistle font-semibold">{ev.volunteerDuties.join(", ")}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSaveEvents(extractedTableEvents)}
              disabled={isSaving}
              className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tallenna kaikki {extractedTableEvents.length} ottelua</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
