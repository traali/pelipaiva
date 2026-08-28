import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  MapPin,
  Navigation,
  Thermometer,
  ShieldCheck,
  CloudRain,
  Trophy,
  ChevronRight,
  Swords,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';
import type { MatchdayEvent, PlayerProfile, FullMatchStats } from '../types/matchday';
import type { FamilyConflict, SportKitPlan } from '../lib/agents';
import { calculateDepartureCountdown } from '../lib/ai/deterministicReasoner';
import { sportLabelFi } from '../lib/sport/sportMeta';
import { springTactile } from '../lib/motion/springs';
import { KitChecklist } from './KitChecklist';
import { ParkingEaseBadge } from './ParkingEaseBadge';
import { SportGlyph } from './SportGlyph';
import { getContrastTextColor } from '../lib/sport/teamColors';
import { generateOrResolveMatchStats } from '../lib/stats/statsEngine';
import { resolveEventSourceInfo } from '../lib/events/eventSourceResolver';
import { EventChatModal } from './EventChatModal';
import { EventMergeModal } from './EventMergeModal';
import { MoreHorizontal } from 'lucide-react';

interface HeroMatchCardProps {
  event: MatchdayEvent;
  allEvents?: MatchdayEvent[];
  profile?: PlayerProfile;
  kit?: SportKitPlan;
  conflicts: FamilyConflict[];
  onNavigate?: () => void;
  onOpenStats?: () => void;
  onEventUpdated?: (updatedEvent: MatchdayEvent) => void;
  onEventMerged?: (mergedTarget: MatchdayEvent, deletedId: string) => void;
  onEventDeleted?: (deletedId: string) => void;
  onEventHidden?: (hiddenId: string) => void;
}

export const HeroMatchCard: React.FC<HeroMatchCardProps> = ({
  event,
  allEvents = [],
  profile,
  kit,
  conflicts,
  onNavigate,
  onOpenStats,
  onEventUpdated,
  onEventMerged,
  onEventDeleted,
  onEventHidden
}) => {
  const [showKit, setShowKit] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  const stats: FullMatchStats | null = useMemo(() => {
    if (event.isTraining) return null;
    return generateOrResolveMatchStats(
      event.homeTeam || 'Oma joukkue',
      event.awayTeam || 'Vastustaja',
      event.sport || 'football'
    );
  }, [event.homeTeam, event.awayTeam, event.sport, event.isTraining]);

  const sourceInfo = resolveEventSourceInfo(event, profile);

  // Respect the child's configured arrival rules — the bare call ignored them (M-41/V49).
  const { departureTime, countdownMinutes, transitPlan } = calculateDepartureCountdown(
    event,
    profile?.arrivalRules
  );
  
  const kickoff = new Date(event.startTime).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki'
  });
  
  const warmup = event.warmupTime
    ? new Date(event.warmupTime).toLocaleTimeString('fi-FI', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Helsinki'
      })
    : kickoff;

  const dateLabel = new Date(event.startTime).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Helsinki'
  });
  
  const related = conflicts.filter((c) => c.eventAId === event.id || c.eventBId === event.id);
  const isLive =
    new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const temp = event.weather?.isForecastLongRange ? undefined : event.weather?.temperatureC;
  const isWetOrCold = event.weather && (event.weather.precipitationMmh > 0.2 || (temp !== undefined && temp <= 3));

  // Prioritize parking coordinates for driving navigation over pitch center
  const targetCoords = event.parking?.coordinates || event.venue?.coordinates;
  const destination =
    targetCoords?.lat != null && targetCoords?.lng != null
      ? `${targetCoords.lat},${targetCoords.lng}`
      : encodeURIComponent(event.venue?.name || 'Kenttä');
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  const jerseyColor = kit?.kitColors?.primary || profile?.colorHex || '#3b82f6';
  const jerseyText = event.isHomeMatch === false ? 'Vieraspaita (+ varapaita)' : 'Kotipeliasu (ykkönen)';

  const transitEmoji =
    transitPlan?.mode === 'walk'
      ? '🚶 Kävely'
      : transitPlan?.mode === 'bicycle'
      ? '🚴 Pyörä'
      : transitPlan?.mode === 'transit'
      ? '🚌 Bussi'
      : '🚗 Lähde';

  return (
    <article className="liquid-glass relative mb-4 overflow-hidden rounded-2xl border border-border-subtle shadow-card">
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: profile?.colorHex || 'var(--nv-pitch-primary)' }}
      />
      <div className="p-4 pl-5 md:p-5 md:pl-6">
        {/* Top Meta: Profile, Sport, Date, and Data Source Provenance */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-text-secondary">
          <div className="flex flex-wrap items-center gap-2">
            {profile && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-xs"
                style={{
                  backgroundColor: profile.colorHex || '#3b82f6',
                  color: getContrastTextColor(profile.colorHex)
                }}
              >
                <span>👤</span>
                <span>{profile.playerName}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
              <SportGlyph sport={event.sport} className="h-3.5 w-3.5" />
              <span>{sportLabelFi(event.sport)}</span>
            </span>
            <span className="text-text-muted">
              {dateLabel}
            </span>

            {/* Transit Mode Badge */}
            {transitPlan && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  transitPlan.isSelfTransit
                    ? 'bg-pitch/15 text-pitch border-pitch/30'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle'
                }`}
                title={transitPlan.transitLabel}
              >
                <span>{transitPlan.transitLabel}</span>
              </span>
            )}

            {/* Data Source Provenance Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                sourceInfo.isCombined
                  ? 'bg-pitch/15 text-pitch border-pitch/30'
                  : 'bg-surface-elevated text-text-secondary border-border-subtle'
              }`}
              title={sourceInfo.tooltipDetails}
            >
              <span>{sourceInfo.badgeText}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] bg-stoppage/20 text-stoppage border border-stoppage/30 animate-pulse">
                ● Käynnissä
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsMergeOpen(true)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated text-xs transition-colors cursor-pointer flex items-center gap-1"
              title="Hallitse tapahtumaa (Yhdistä / Piilota / Poista)"
              aria-label="Hallitse tapahtumaa"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Match / Training Title */}
        <h2 className="text-xl font-bold tracking-tight text-text-primary md:text-2xl break-words">
          {event.isTraining ? event.title : `${event.homeTeam} vs ${event.awayTeam || '—'}`}
        </h2>
        {(event.tournamentName || event.stage || event.matchNumber || event.score) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
            {event.tournamentName && (
              <span className="rounded-md bg-surface-elevated px-1.5 py-0.5">{event.tournamentName}</span>
            )}
            {event.stage && <span>{event.stage}</span>}
            {event.matchNumber && <span>#{event.matchNumber}</span>}
            {event.score && (
              <span className="font-tabular font-black text-text-primary">{event.score}</span>
            )}
          </div>
        )}
        
        {/* Venue Info */}
        <div className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="truncate font-medium">{event.venue.name}</span>
          <span className="text-xs text-text-muted">
            • {event.venue.isIndoor ? 'Sisähalli' : 'Ulkokenttä'}
          </span>
        </div>

        {/* 3-PHASE TIMING STEPPER (Lähde kotoa -> Paikalla/Alkulämpö -> Kickoff) */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 p-3 rounded-xl bg-surface-elevated/80 border border-border-subtle text-center">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-floodlight flex items-center gap-1">
              {transitEmoji}
            </span>
            <span className="font-tabular text-xl sm:text-2xl font-black text-floodlight mt-0.5">
              {departureTime}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">
              {countdownMinutes > 0
                ? `${countdownMinutes} min`
                : isLive
                  ? 'Käynnissä'
                  : 'Menty'}
            </span>
          </div>

          <div className="flex flex-col items-center border-x border-border-subtle/70 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pitch flex items-center gap-1">
              ⏱️ Paikalla
            </span>
            <span className="font-tabular text-xl sm:text-2xl font-black text-text-primary mt-0.5">
              {warmup}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">
              Alkulämpö
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
              ⏱️ Aloitus
            </span>
            <span className="font-tabular text-xl sm:text-2xl font-black text-text-primary mt-0.5">
              {kickoff}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">
              Ottelu
            </span>
          </div>
        </div>

        {/* Weather alert if wet or cold */}
        {(temp !== undefined || isWetOrCold) && (
          <div className="mt-3 flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-surface-elevated/60 border border-border-subtle/50 text-text-secondary">
            <div className="flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5 text-radar" />
              <span className="font-tabular font-bold text-text-primary">
                {temp !== undefined ? `${temp}°C` : 'Sääennuste'}
              </span>
              {event.venue.isIndoor ? (
                <span className="text-text-muted">(Sisähalli)</span>
              ) : (
                <span className="text-text-muted">
                  {event.weather?.precipitationMmh && event.weather.precipitationMmh > 0
                    ? `• Sade ${event.weather.precipitationMmh.toFixed(1)} mm/h`
                    : '• Pouta'}
                </span>
              )}
            </div>

            {isWetOrCold && !event.venue.isIndoor && (
              <span className="text-[10px] font-bold text-radar flex items-center gap-1">
                <CloudRain className="w-3 h-3" />
                <span>Kylmä/liukas kenttä</span>
              </span>
            )}
          </div>
        )}

        {/* Conflicts Alert */}
        {related.map((c) => (
          <div
            key={c.id}
            className="mt-3 flex items-start gap-2 rounded-xl border border-whistle/30 bg-whistle/10 p-3 text-xs text-whistle"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="font-medium leading-snug">
              {c.message} {c.suggestedFix}
            </span>
          </div>
        ))}

        {/* Interactive League Standings, Goals, Form & H2H Comparison */}
        {!event.isTraining && (
          <div className="mt-3.5 p-3 sm:p-3.5 rounded-2xl bg-surface-elevated/90 border border-border-strong/70 flex flex-col gap-2.5">
            {/* Standings & Stats Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle/70">
              <div className="flex items-center gap-1.5 text-xs font-bold text-pitch">
                <Trophy className="w-3.5 h-3.5" />
                <span>Sarjatilastot & ennakko</span>
              </div>
              {onOpenStats && (
                <button
                  type="button"
                  onClick={onOpenStats}
                  className="text-[11px] font-bold text-pitch hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Avaa tilastot</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {stats && (
              <div className="flex flex-col gap-2.5">
                {/* Team Standings Comparison Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Home Team */}
                  <div className="p-2.5 rounded-xl bg-surface border border-border-subtle flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-text-primary truncate">
                        {stats.homeStanding.rank}. {event.homeTeam}
                      </span>
                      <span className="font-black text-pitch px-1.5 py-0.5 rounded bg-pitch/15 text-[11px]">
                        {stats.homeStanding.points}p
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary flex items-center justify-between">
                      <span>Saldo: {stats.homeStanding.won}V · {stats.homeStanding.drawn}T · {stats.homeStanding.lost}H</span>
                      <span className="font-tabular">Maalit: {stats.homeStanding.goalsFor}–{stats.homeStanding.goalsAgainst}</span>
                    </div>
                    {stats.homeStanding.form && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-text-muted">Kunto:</span>
                        <div className="flex items-center gap-1">
                          {stats.homeStanding.form.slice(-5).map((f, idx) => (
                            <span
                              key={idx}
                              className={`px-1 py-0.5 rounded text-[9px] font-black ${
                                f === 'W' ? 'bg-pitch text-text-inverse' : f === 'D' ? 'bg-whistle text-text-inverse' : 'bg-stoppage text-text-inverse'
                              }`}
                            >
                              {f === 'W' ? 'V' : f === 'D' ? 'T' : 'H'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="p-2.5 rounded-xl bg-surface border border-border-subtle flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-text-primary truncate">
                        {stats.awayStanding.rank}. {event.awayTeam || 'Vastustaja'}
                      </span>
                      <span className="font-black text-text-secondary px-1.5 py-0.5 rounded bg-surface-elevated text-[11px]">
                        {stats.awayStanding.points}p
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary flex items-center justify-between">
                      <span>Saldo: {stats.awayStanding.won}V · {stats.awayStanding.drawn}T · {stats.awayStanding.lost}H</span>
                      <span className="font-tabular">Maalit: {stats.awayStanding.goalsFor}–{stats.awayStanding.goalsAgainst}</span>
                    </div>
                    {stats.awayStanding.form && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-text-muted">Kunto:</span>
                        <div className="flex items-center gap-1">
                          {stats.awayStanding.form.slice(-5).map((f, idx) => (
                            <span
                              key={idx}
                              className={`px-1 py-0.5 rounded text-[9px] font-black ${
                                f === 'W' ? 'bg-pitch text-text-inverse' : f === 'D' ? 'bg-whistle text-text-inverse' : 'bg-stoppage text-text-inverse'
                              }`}
                            >
                              {f === 'W' ? 'V' : f === 'D' ? 'T' : 'H'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Head-to-Head & Common Opponents Preview */}
                {(stats.headToHeadHistory?.length > 0 || stats.commonOpponents?.length > 0) && (
                  <div className="pt-1.5 border-t border-border-subtle/50 flex flex-col gap-1.5 text-[11px]">
                    {stats.headToHeadHistory?.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-text-muted flex items-center gap-1">
                          <Swords className="w-3 h-3 text-pitch" />
                          <span>Aiemmat keskinäiset:</span>
                        </span>
                        {stats.headToHeadHistory.slice(0, 3).map((h2h, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-surface text-text-primary border border-border-subtle font-medium"
                          >
                            {h2h.date ? new Date(h2h.date).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' }) : ''} ({h2h.homeScore}–{h2h.awayScore})
                          </span>
                        ))}
                      </div>
                    )}

                    {stats.commonOpponents && stats.commonOpponents.length > 0 && stats.commonOpponents[0] && (
                      <div className="text-text-muted flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold">Sama vastustaja:</span>
                        <span>
                          {stats.commonOpponents[0].opponentName} (Oma: {stats.commonOpponents[0].homeResult.score} · Vastustaja: {stats.commonOpponents[0].awayResult.score})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ALWAYS VISIBLE GEAR GLANCE TWIN-PILL (Jersey + Shoes) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Jersey Pill */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-elevated border border-border-subtle">
            <span
              className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-xs"
              style={{ backgroundColor: jerseyColor }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Pelipaita</div>
              <div className="text-xs font-bold text-text-primary truncate">{jerseyText}</div>
            </div>
          </div>

          {/* Shoes Pill */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-elevated border border-border-subtle">
            <ShieldCheck className="w-4 h-4 text-pitch shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Nappisvahti</div>
              <div className="text-xs font-bold text-text-primary truncate">
                {(() => {
                  const fw = event.briefing?.gearAndPackingAdvice.footwear;
                  if (fw === 'AG_ARTIFICIAL_GRASS') return 'Tekonurmikengät (AG)';
                  if (fw === 'FG_FIRM_GROUND') return 'Nappikset (FG)';
                  if (fw === 'SG_SOFT_GROUND') return 'Rautatapit (SG)';
                  if (fw === 'TF_TURF_SHOES') return 'Turf-kengät (TF)';
                  if (fw === 'INDOOR_NON_MARKING') return 'Sisäpelikengät';
                  return event.venue.isIndoor ? 'Sisäpelikengät' : 'Tekonurmikengät (AG)';
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Badges (Parking info) */}
        {event.parking && (
          <div className="mt-2">
            <ParkingEaseBadge parking={event.parking} venueName={event.venue.name} />
          </div>
        )}

        {/* Action Buttons: 1-Tap Navigation to Parking & Kassi toggle */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={springTactile.snappy}
            onClick={
              onNavigate ||
              (() => {
                window.open(mapsUrl, '_blank', 'noopener,noreferrer');
              })
            }
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-pitch px-4 text-sm font-bold text-text-inverse hover:brightness-110 cursor-pointer shadow-sm shadow-pitch/20 transition-all"
          >
            <Navigation className="h-4 w-4" />
            <span>Navigoi parkkiin ({event.parking?.lotName || event.venue.name})</span>
          </motion.button>

          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-elevated px-3.5 text-sm font-semibold text-text-primary hover:border-pitch cursor-pointer transition-all"
            title="Päivitä tapahtuman tietoja chatin lailla"
          >
            <MessageSquare className="w-4 h-4 text-pitch" />
            <span>Viestit & Chat</span>
          </button>

          {kit && (
            <button
              type="button"
              aria-expanded={showKit}
              aria-controls={`kit-checklist-${event.id}`}
              onClick={() => setShowKit((v) => !v)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border-strong bg-surface-elevated px-4 text-sm font-semibold text-text-primary hover:border-pitch cursor-pointer transition-all"
            >
              {showKit ? 'Piilota kassi' : 'Varustekassi'}
            </button>
          )}
        </div>

        {showKit && kit && (
          <div id={`kit-checklist-${event.id}`} className="mt-3" role="region" aria-label="Varustelista">
            <KitChecklist plan={kit} eventId={event.id} compact />
          </div>
        )}

        {/* Event Chat / Direct Natural Language Update Modal */}
        <EventChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          event={event}
          allEvents={allEvents}
          profile={profile}
          onEventUpdated={(updated) => {
            onEventUpdated?.(updated);
          }}
        />

        {/* Event Management & Merge Modal (Yhdistä / Piilota / Poista) */}
        <EventMergeModal
          isOpen={isMergeOpen}
          onClose={() => setIsMergeOpen(false)}
          sourceEvent={event}
          allEvents={allEvents}
          onEventMerged={(merged, deletedId) => {
            onEventMerged?.(merged, deletedId);
          }}
          onEventDeleted={(deletedId) => {
            onEventDeleted?.(deletedId);
          }}
          onEventHidden={(hiddenId) => {
            onEventHidden?.(hiddenId);
          }}
        />
      </div>
    </article>
  );
};
