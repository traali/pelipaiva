import React from "react";
import { Plus, Filter, RefreshCw, Loader2, Save } from "lucide-react";
import type { SportType } from "../../../types/matchday";
import { POPULAR_FINNISH_CLUBS } from "../../../lib/clubs/popularClubsCatalog";
import type { TasoClub, TasoTeam } from "../../../lib/api/tasoDirectory";
import { TeamColorPicker } from "../../TeamColorPicker";
import { TasoTeamSearch } from "../TasoTeamSearch";

/** Club colour preset only when TASO's club is unmistakably the same club (exact short name). */
function presetColorFor(club: TasoClub): string | undefined {
  const names = [club.abbreviation, club.name].map((n) => n.trim().toLowerCase()).filter(Boolean);
  const preset = POPULAR_FINNISH_CLUBS.find(
    (p) => p.sport === club.sport && names.includes(p.shortName.trim().toLowerCase())
  );
  return preset?.colorHex;
}

export interface ClassicUrlImportTabProps {
  isEditing: boolean;
  selectedSport: SportType;
  setClassicTeamName: (val: string) => void;
  setSelectedSport: (val: SportType) => void;
  setClassicUrl: (val: string) => void;
  setColorHex: (val: string) => void;
  classicUrl: string;
  classicTeamName: string;
  colorHex: string;
  discoveredCategories: { name: string; count: number }[];
  excludedCategories: string[];
  setExcludedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  isScanningCategories: boolean;
  scanIcsCategories: (url: string) => void;
  handleClassicSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  selectedPlayer: string;
}

export const ClassicUrlImportTab: React.FC<ClassicUrlImportTabProps> = ({
  isEditing,
  selectedSport,
  setClassicTeamName,
  setSelectedSport,
  setClassicUrl,
  setColorHex,
  classicUrl,
  classicTeamName,
  colorHex,
  discoveredCategories,
  excludedCategories,
  setExcludedCategories,
  isScanningCategories,
  scanIcsCategories,
  handleClassicSubmit,
  isSaving,
  selectedPlayer,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {!isEditing && (
        <TasoTeamSearch
          sport={selectedSport}
          onSportChange={setSelectedSport}
          selectedPlayer={selectedPlayer}
          onPickTeam={(team: TasoTeam, club: TasoClub) => {
            setSelectedSport(team.sport);
            setClassicTeamName(team.teamName);
            setClassicUrl(team.url);
            const preset = presetColorFor(club);
            if (preset) setColorHex(preset);
          }}
        />
      )}
      <form onSubmit={handleClassicSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">Joukkueen tai kalenterin URL / iCal-osoite:</label>
          <input type="text" required value={classicUrl} placeholder="https://tulospalvelu.palloliitto.fi/team/12345/fixture tai .ics-linkki" onChange={(e) => setClassicUrl(e.target.value)} className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">Joukkueen nimi kalenterissa:</label>
          <input type="text" value={classicTeamName} placeholder="Esim. HJK Sininen" onChange={(e) => setClassicTeamName(e.target.value)} className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">Joukkueen väri</label>
          <TeamColorPicker value={colorHex} onChange={(hex) => setColorHex(hex)} />
        </div>
        {/\.ics|webcal:|nimenhuuto\.com|myclub\.fi|jopox\.fi/i.test(classicUrl) && (
          <div className="p-3.5 rounded-2xl bg-surface border border-pitch/30 flex flex-col gap-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-pitch" />
                <span>{discoveredCategories.length > 0 ? `Tunnistetut tapahtumaluokat (${discoveredCategories.length}):` : "Kalenterin tapahtumaluokat:"}</span>
              </span>
              <button type="button" onClick={() => scanIcsCategories(classicUrl)} disabled={isScanningCategories} className="text-xs font-bold text-pitch hover:underline flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pitch/10 cursor-pointer disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningCategories ? "animate-spin" : ""}`} />
                <span>{isScanningCategories ? "Haetaan…" : "Hae luokat uudelleen"}</span>
              </button>
            </div>
            {isScanningCategories ? (
              <div className="py-2 flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pitch" />
                <span>Haetaan ja analysoidaan kalenterin tapahtumaluokat...</span>
              </div>
            ) : discoveredCategories.length > 0 ? (
              <>
                <p className="text-[11px] text-text-muted">Valitse mitä haluat mukaan (vihrea = mukana, yliviivattu = jätetään pois):</p>
                <div className="flex flex-wrap gap-1.5">
                  {discoveredCategories.map((cat) => {
                    const isExcluded = excludedCategories.includes(cat.name);
                    return (
                      <button key={cat.name} type="button" onClick={() => { setExcludedCategories((prev) => prev.includes(cat.name) ? prev.filter((c) => c !== cat.name) : [...prev, cat.name]); }} className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isExcluded ? "bg-surface-elevated text-text-muted line-through border border-dashed border-border-strong opacity-60" : "bg-pitch/15 text-pitch border border-pitch/30 hover:bg-pitch/25"}`}>
                        <span>{isExcluded ? "✕" : "✓"}</span>
                        <span>{cat.name}</span>
                        <span className="text-[10px] opacity-75">({cat.count})</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-text-muted">Paina <strong>"Hae luokat uudelleen"</strong> lukeaksesi MyClub / Nimenhuuto -tapahtumaluokat.</p>
            )}
          </div>
        )}
        <button type="submit" disabled={isSaving || !selectedPlayer.trim()} className="mt-2 py-3 px-4 rounded-xl bg-pitch text-text-inverse font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-md shadow-pitch/25 disabled:opacity-50 transition-all">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isSaving ? (isEditing ? "Tallennetaan muutoksia…" : "Haetaan otteluita…") : isEditing ? `Tallenna muutokset · ${selectedPlayer}` : selectedPlayer.trim() ? `Tuo joukkue · ${selectedPlayer}` : "Anna pelaajan nimi"}</span>
        </button>
      </form>
    </div>
  );
};
