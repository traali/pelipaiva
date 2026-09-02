import React from "react";
import { Plus, Search, Filter, RefreshCw, Loader2, Save } from "lucide-react";
import type { SportType } from "../../../types/matchday";
import { searchPopularClubs, type ClubPreset } from "../../../lib/clubs/popularClubsCatalog";
import type { ExampleTournament } from "../../../lib/clubs/exampleTournaments";
import { TeamColorPicker } from "../../TeamColorPicker";

export interface ClassicUrlImportTabProps {
  isEditing: boolean;
  exampleTournaments: ExampleTournament[];
  handleSelectCupPreset: (cup: ExampleTournament) => void;
  clubSearchQuery: string;
  setClubSearchQuery: (val: string) => void;
  clubMatches: ClubPreset[];
  setClubMatches: (val: ClubPreset[]) => void;
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
  exampleTournaments,
  handleSelectCupPreset,
  clubSearchQuery,
  setClubSearchQuery,
  clubMatches,
  setClubMatches,
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
        <>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-text-secondary">
              Valmiit turnaukset (1-napin liitos):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {exampleTournaments.map((cup) => (
                <button
                  key={cup.id}
                  type="button"
                  onClick={() => handleSelectCupPreset(cup)}
                  className="flex items-center gap-2 p-2 rounded-xl border border-border-subtle bg-surface-elevated text-left hover:border-pitch cursor-pointer transition-all"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: cup.colorHex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-text-primary">{cup.name}</div>
                    <div className="truncate text-[10px] text-text-muted">{cup.teamName}</div>
                  </div>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-pitch" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-pitch" />
              <span>Pikahaku seuroista (HJK, Honka, ErVi, TOPOLA...):</span>
            </label>
            <input
              type="text"
              value={clubSearchQuery}
              placeholder="Kirjoita seuran nimi..."
              onChange={(e) => {
                const q = e.target.value;
                setClubSearchQuery(q);
                setClubMatches(q.trim().length > 1 ? searchPopularClubs(q).slice(0, 5) : []);
              }}
              className="w-full rounded-xl border border-pitch/30 bg-pitch/10 px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none"
            />
            {clubMatches.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1" role="listbox" aria-label="Seuraehdotukset">
                {clubMatches.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      setClassicTeamName(club.name);
                      setSelectedSport(club.sport);
                      setClassicUrl(club.sampleTeamUrl);
                      setColorHex(club.colorHex);
                      setClubMatches([]);
                      setClubSearchQuery("");
                    }}
                    className="flex items-center justify-between p-2 rounded-xl bg-surface border border-border-subtle hover:border-pitch text-left text-xs cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: club.colorHex }} />
                      <span className="font-bold text-text-primary">{club.name}</span>
                      <span className="text-[10px] text-text-muted">({club.city})</span>
                    </div>
                    <span className="text-[10px] font-bold text-pitch">Valitse</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <form onSubmit={handleClassicSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">
            Joukkueen tai kalenterin URL / iCal-osoite:
          </label>
          <input
            type="text"
            required
            value={classicUrl}
            placeholder="https://tulospalvelu.palloliitto.fi/team/12345/fixture tai .ics-linkki"
            onChange={(e) => setClassicUrl(e.target.value)}
            className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">
            Joukkueen nimi kalenterissa:
          </label>
          <input
            type="text"
            value={classicTeamName}
            placeholder="Esim. HJK Sininen"
            onChange={(e) => setClassicTeamName(e.target.value)}
            className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">
            Joukkueen väri
          </label>
          <TeamColorPicker value={colorHex} onChange={(hex) => setColorHex(hex)} />
        </div>

        {/\.ics|webcal:|nimenhuuto\.com|myclub\.fi|jopox\.fi/i.test(classicUrl) && (
          <div className="p-3.5 rounded-2xl bg-surface border border-pitch/30 flex flex-col gap-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-pitch" />
                <span>
                  {discoveredCategories.length > 0
                    ? `Tunnistetut tapahtumaluokat (${discoveredCategories.length}):`
                    : "Kalenterin tapahtumaluokat:"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => scanIcsCategories(classicUrl)}
                disabled={isScanningCategories}
                className="text-xs font-bold text-pitch hover:underline flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pitch/10 cursor-pointer disabled:opacity-50 transition-colors"
              >
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
                <p className="text-[11px] text-text-muted">
                  Valitse mitä haluat mukaan (vihreä = mukana, yliviivattu = jätetään pois):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {discoveredCategories.map((cat) => {
                    const isExcluded = excludedCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          setExcludedCategories((prev) =>
                            prev.includes(cat.name)
                              ? prev.filter((c) => c !== cat.name)
                              : [...prev, cat.name]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isExcluded
                            ? "bg-surface-elevated text-text-muted line-through border border-dashed border-border-strong opacity-60"
                            : "bg-pitch/15 text-pitch border border-pitch/30 hover:bg-pitch/25"
                        }`}
                      >
                        <span>{isExcluded ? "✕" : "✓"}</span>
                        <span>{cat.name}</span>
                        <span className="text-[10px] opacity-75">({cat.count})</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-text-muted">
                Paina <strong>"Hae luokat uudelleen"</strong> lukeaksesi MyClub / Nimenhuuto -tapahtumaluokat (treenit, pelit, peliryhmät) ja valitaksesi mitä haluat mukaan.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-2 py-3 px-4 rounded-xl bg-pitch text-text-inverse font-black text-xs flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-md shadow-pitch/25 disabled:opacity-50 transition-all"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isEditing ? (
            <Save className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>
            {isSaving
              ? isEditing
                ? "Tallennetaan muutoksia…"
                : "Haetaan otteluita…"
              : isEditing
              ? `Tallenna muutokset · ${selectedPlayer}`
              : `Tuo joukkue · ${selectedPlayer}`}
          </span>
        </button>
      </form>
    </div>
  );
};
