import React, { useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import type { TournamentBlock } from '../lib/agents';
import { formatFiTime } from '../lib/agents';
import { getContrastTextColor } from '../lib/sport/teamColors';

interface TournamentWeekendPanelProps {
  blocks: TournamentBlock[];
  onNavigate?: (coordinates: { lat: number; lng: number }) => void;
}

export const TournamentWeekendPanel: React.FC<TournamentWeekendPanelProps> = ({ blocks, onNavigate }) => {
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(() => {
    // Expand by default so user sees all games going forward
    const init: Record<string, boolean> = {};
    for (const b of blocks) {
      init[b.id] = true;
    }
    return init;
  });

  if (blocks.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedBlocks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const uniqueTournamentNames = new Set(blocks.map((b) => b.name));
  const badgeLabel =
    uniqueTournamentNames.size === blocks.length
      ? `${blocks.length} ${blocks.length === 1 ? 'turnauspäivä' : 'turnauspäivää'}`
      : `${uniqueTournamentNames.size} turnausta (${blocks.length} turnauspäivää)`;

  return (
    <section aria-label="Turnauspäivät ja -aikataulut" className="mb-4 rounded-2xl border border-border-subtle bg-surface-elevated p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-pitch/15 text-pitch">
            <Trophy className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold text-text-primary">Turnaukset & otteluohjelma</h2>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-secondary border border-border-subtle">
          {badgeLabel}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {blocks.map((b) => {
          const isExpanded = expandedBlocks[b.id] ?? true;
          const matches = b.matches || [];
          const dayLabel = new Date(b.firstKickoff).toLocaleDateString('fi-FI', {
            weekday: 'short',
            day: 'numeric',
            month: 'numeric',
            timeZone: 'Europe/Helsinki'
          });

          return (
            <div
              key={b.id}
              className="rounded-xl border border-border-strong bg-surface p-3.5 flex flex-col gap-3 relative overflow-hidden"
            >
              {/* Left Color Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ background: b.colorHex }}
                aria-hidden
              />

              {/* Tournament Summary Header */}
              <div className="pl-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs"
                      style={{
                        backgroundColor: b.colorHex,
                        color: getContrastTextColor(b.colorHex)
                      }}
                    >
                      {b.childName}
                    </span>
                    <span className="text-[11px] font-semibold text-text-muted capitalize">
                      {dayLabel}
                    </span>
                    <h3 className="text-sm font-bold text-text-primary truncate">
                      {b.name}
                    </h3>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary flex-wrap">
                    <span className="font-semibold text-text-primary">
                      {b.matchCount} peliä ({formatFiTime(b.firstKickoff)}–{formatFiTime(b.lastEnd)})
                    </span>
                    <span>• {b.venueName}</span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="text-[11px] font-bold text-floodlight flex items-center gap-1">
                      🚗 Lähde klo {b.leaveBy}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      ({b.packingNote})
                    </span>
                  </div>
                </div>

                {matches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(b.id)}
                    aria-label={isExpanded ? 'Piilota ottelut' : 'Näytä kaikki turnauksen ottelut'}
                    className="p-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-text-secondary hover:text-text-primary cursor-pointer transition-all shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* ALL TOURNAMENT MATCHES LIST */}
              {isExpanded && matches.length > 0 && (
                <div className="pl-1.5 pt-2 border-t border-border-subtle flex flex-col gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                    <span>Turnauksen kaikki ottelut:</span>
                    <span>{matches.length} kpl</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {matches.map((m, idx) => {
                      const start = new Date(m.startTime);
                      const end = new Date(m.endTime);
                      const dayLabel = start.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });
                      const timeStr = `${start.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })}–${end.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })}`;
                      const isPast = end.getTime() < Date.now();
                      const isCurrent = start.getTime() <= Date.now() && Date.now() <= end.getTime();

                      return (
                        <div
                          key={m.id || idx}
                          className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 transition-all ${
                            isCurrent
                              ? 'border-pitch bg-pitch/10 text-text-primary font-bold shadow-xs ring-1 ring-pitch/30'
                              : isPast
                                ? 'border-border-subtle bg-surface-elevated/40 text-text-muted opacity-80'
                                : 'border-border-subtle bg-surface-elevated text-text-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-pitch">
                                {dayLabel}
                              </span>
                              {m.matchNumber && (
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-text-muted">
                                  #{m.matchNumber}
                                </span>
                              )}
                              {m.stage && (
                                <span className="text-[10px] font-bold text-text-secondary">
                                  • {m.stage}
                                </span>
                              )}
                              <span className="font-mono text-[11px] font-bold text-text-primary">
                                klo {timeStr}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCurrent && (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stoppage text-text-inverse animate-pulse">
                                  Nyt
                                </span>
                              )}
                              {m.score ? (
                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-pitch/15 text-pitch border border-pitch/25">
                                  {m.score}
                                </span>
                              ) : isPast ? (
                                <span className="text-[9px] font-medium text-text-muted">
                                  Päättynyt
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="font-bold text-text-primary text-[13px] truncate">
                              {m.title}
                            </span>

                            {isPast || m.score ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface border border-border-strong text-text-primary font-mono font-black text-xs shrink-0 shadow-2xs">
                                {m.score ? `Tulos: ${m.score}` : 'Päättynyt'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Navigoi kentälle ${m.venue.name}`}
                                onClick={() => {
                                  if (onNavigate) {
                                    onNavigate(m.venue?.coordinates || { lat: 60.1872, lng: 24.9248 });
                                  } else {
                                    const coords = m.parking?.coordinates || m.venue?.coordinates;
                                    const destination =
                                      coords?.lat != null && coords?.lng != null
                                        ? `${coords.lat},${coords.lng}`
                                        : encodeURIComponent(m.venue?.name || 'Kenttä');
                                    window.open(
                                      `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
                                      '_blank'
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-pitch/15 text-pitch hover:bg-pitch hover:text-text-inverse transition-all cursor-pointer text-[11px] font-bold shrink-0"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>{m.venue.name.includes('Kenttä') ? m.venue.name.split('(')[1]?.replace(')', '') || 'Kenttä' : 'Reitti'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
