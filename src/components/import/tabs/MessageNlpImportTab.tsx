import React from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";

export interface ExtractedEventPreview {
  title: string;
  dateStr: string;
  kickoffTime: string;
  warmupTime: string;
  venueHint: string;
  volunteerDuties: string[];
  sport?: string;
  eventType?: string;
}

export interface MessageNlpImportTabProps {
  pastedMessage: string;
  setPastedMessage: (val: string) => void;
  handleParseMessage: () => void;
  parseNotice: string | null;
  extractedMessageEvents: ExtractedEventPreview[];
  handleSaveEvents: (events: any[]) => void;
  isSaving: boolean;
  selectedPlayer: string;
}

export const MessageNlpImportTab: React.FC<MessageNlpImportTabProps> = ({
  pastedMessage,
  setPastedMessage,
  handleParseMessage,
  parseNotice,
  extractedMessageEvents,
  handleSaveEvents,
  isSaving,
  selectedPlayer,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-secondary">
        Liitä valmentajan WhatsApp-viesti (tukee myös koko viikonlopun turnausviestejä):
      </p>
      <textarea
        rows={4}
        value={pastedMessage}
        onChange={(e) => setPastedMessage(e.target.value)}
        placeholder="Esim: Lauantaina 24.8. turnaus Väiskillä:&#10;klo 10:00 vs KäPa&#10;klo 13:00 vs Honka&#10;Mustat paidat päälle. Maijalla kahviovuoro klo 12-14."
        className="w-full p-3 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch resize-none"
      />

      <button
        type="button"
        onClick={handleParseMessage}
        disabled={!pastedMessage.trim()}
        className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer disabled:opacity-50 shadow-sm"
      >
        <Sparkles className="w-4 h-4" />
        <span>Jäsennä ottelutiedot tekoälyllä</span>
      </button>

      {parseNotice && (
        <p role="status" className="p-2.5 rounded-xl bg-whistle/15 border border-whistle/40 text-[11px] font-semibold text-text-primary">
          {parseNotice}
        </p>
      )}

      <div aria-live="polite">
        {extractedMessageEvents.length > 0 && (
          <div className="mt-3 p-4 rounded-2xl bg-surface border border-pitch/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-pitch flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Tunnistettu {extractedMessageEvents.length}{" "}
                  {extractedMessageEvents.length === 1 ? "tapahtuma" : "ottelua"}:
                </span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-pitch/15 text-pitch font-bold">
                {extractedMessageEvents[0]?.dateStr}
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {extractedMessageEvents.map((ev, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-surface-elevated border border-border-subtle text-xs">
                  <div className="font-bold text-text-primary">{ev.title}</div>
                  <div className="text-[11px] text-text-secondary mt-0.5">
                    📍 {ev.venueHint || (ev.sport === "school" ? "Koulu" : "Paikka ilmoitetaan")} • ⏰{" "}
                    {ev.sport === "school" ||
                    ev.sport === "other" ||
                    ev.eventType === "school" ||
                    ev.eventType === "meeting" ||
                    ev.eventType === "other"
                      ? `Klo ${ev.kickoffTime}`
                      : `Klo ${ev.kickoffTime} (Alkulämpö ${ev.warmupTime})`}
                  </div>
                  {ev.volunteerDuties.length > 0 && (
                    <div className="text-[11px] text-whistle font-semibold mt-0.5">
                      {ev.volunteerDuties.join(" • ")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSaveEvents(extractedMessageEvents)}
              disabled={isSaving}
              className="mt-1 py-2.5 px-3 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer shadow-md shadow-pitch/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Tallenna kaikki {extractedMessageEvents.length} ottelua ({selectedPlayer})
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
