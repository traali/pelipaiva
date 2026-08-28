import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  MapPin,
  Navigation,
  Shirt,
  AlertTriangle,
  Share2,
  BarChart3,
  ChevronRight,
  Trophy,
  Dumbbell,
  Star,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { MatchdayEvent, FullMatchStats, PlayerMatchLog } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { NappisvahtiPill } from './NappisvahtiPill';
import { ParkingEaseBadge } from './ParkingEaseBadge';
import { RainRadarCurve } from './RainRadarCurve';
import { MatchStatsModal } from './MatchStatsModal';
import { VenueCorrectionModal } from './VenueCorrectionModal';
import { EventChatModal } from './EventChatModal';
import { EventInlineDropIn } from './EventInlineDropIn';
import { Edit3, FileText } from 'lucide-react';
import type { PitchSurface } from '../types/matchday';
import type { FamilyConflict } from '../lib/agents';
import { getContrastTextColor } from '../lib/sport/teamColors';
import { generateOrResolveMatchStats } from '../lib/stats/statsEngine';
import { resolveEventSourceInfo } from '../lib/events/eventSourceResolver';
import { db } from '../lib/storage/db';

function surfaceLabel(surface: PitchSurface, indoor: boolean): string {
  if (indoor) return 'Sisähalli';
  switch (surface) {
    case 'artificial_turf_3g':
      return 'Tekonurmi 3G';
    case 'sand_artificial_turf':
      return 'Hiekkatekonurmi';
    case 'natural_grass':
      return 'Luonnonnurmi';
    case 'indoor_parquet':
      return 'Parketti';
    case 'indoor_synthetic':
      return 'Sisäalusta';
    case 'gravel':
      return 'Hiekka';
    default:
      return 'Kenttä';
  }
}

import { EventMergeModal } from './EventMergeModal';
import { MoreHorizontal } from 'lucide-react';

interface MatchdayCardProps {
  event: MatchdayEvent;
  allEvents?: MatchdayEvent[];
  playerName?: string;
  colorHex?: string;
  compact?: boolean;
  conflicts?: FamilyConflict[];
  onNavigateToVenue?: () => void;
  onResolveMismatch?: (eventId: string, decision: 'use_official' | 'keep_calendar' | 'unlink') => void;
  onEventUpdated?: (updatedEvent: MatchdayEvent) => void;
  onEventMerged?: (mergedTarget: MatchdayEvent, deletedId: string) => void;
  onEventDeleted?: (deletedId: string) => void;
  onEventHidden?: (hiddenId: string) => void;
}

export const MatchdayCard: React.FC<MatchdayCardProps> = ({
  event,
  allEvents = [],
  playerName,
  colorHex,
  compact = false,
  conflicts,
  onNavigateToVenue,
  onResolveMismatch,
  onEventUpdated,
  onEventMerged,
  onEventDeleted,
  onEventHidden
}) => {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [localVenue, setLocalVenue] = useState(event.venue);
  const [stats, setStats] = useState<FullMatchStats | undefined>(event.stats);
  const [playerLog, setPlayerLog] = useState<PlayerMatchLog | undefined>(event.playerLog);
  const [currentScore, setCurrentScore] = useState<string | undefined>(event.score);

  const relatedConflicts = conflicts?.filter((c) => c.eventAId === event.id || c.eventBId === event.id) || [];

  const venue = isVenueModalOpen ? localVenue : event.venue;
  const isLive =
    new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const isPast =
    new Date(event.endTime) <= new Date() || currentScore !== undefined;
  const formattedKickoff = new Date(event.startTime).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki'
  });
  const formattedWarmup = new Date(event.warmupTime).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki'
  });

  const isTraining = event.isTraining || event.eventType === 'training';
  const isSchool = event.sport === 'school' || event.eventType === 'school';
  const isOther = event.sport === 'other' || event.eventType === 'other' || event.eventType === 'meeting';

  const handleOpenStats = () => {
    let resolved = stats;
    if (!resolved && !isTraining && !isSchool && !isOther) {
      resolved = generateOrResolveMatchStats(event.homeTeam, event.awayTeam, event.sport);
      // Synthetic previews stay ephemeral: never persisted as if they were
      // federation data (M-05 / anti-synthetic constitution).
      setStats(resolved);
    }
    setIsStatsModalOpen(true);
  };

  const handleSavePlayerLog = async (log: PlayerMatchLog, updatedScore?: string) => {
    setPlayerLog(log);
    if (updatedScore) setCurrentScore(updatedScore);
    const updates: Partial<MatchdayEvent> = {
      playerLog: log,
      score: updatedScore || currentScore
    };
    if (stats) updates.stats = stats;
    await db.events.update(event.id, updates).catch(console.warn);
  };

  const getSportBadge = () => {
    switch (event.sport) {
      case 'school':
        return '🏫 Koulu';
      case 'other':
        return '📌 Muu meno';
      case 'volleyball':
        return '🏐 Lentopallo';
      case 'basketball':
        return '🏀 Koripallo';
      case 'floorball':
        return '🏑 Salibandy';
      case 'football':
        return '⚽ Jalkapallo';
      case 'icehockey':
        return '🏒 Jääkiekko';
      case 'futsal':
        return '👟 Futsal';
      default:
        return isSchool ? '🏫 Koulu' : isOther ? '📌 Muu meno' : isTraining ? '🏃‍♂️ Harjoitukset' : '🏅 Ottelu';
    }
  };

  const handleShareWhatsApp = () => {
    if (event.briefing?.postMatchWhatsAppTemplate) {
      const text = encodeURIComponent(event.briefing.postMatchWhatsAppTemplate);
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <motion.div
        layout
        whileTap={{ scale: 0.99 }}
        transition={springTactile.squishy}
        className={`liquid-glass relative overflow-hidden rounded-3xl transition-colors ${
          compact ? 'p-4 md:p-5' : 'p-5 md:p-6'
        }`}
      >
        {colorHex && (
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-1.5"
            style={{ backgroundColor: colorHex }}
          />
        )}
        {/* Background Ambience Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pitch/10 blur-3xl" />

        {/* Conflict Warning Banner */}
        {event.briefing?.conflictWarning && (
          <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-whistle/15 border border-whistle/30 text-whistle text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{event.briefing.conflictWarning}</span>
          </div>
        )}

        {/* Schedule / Venue Mismatch Warning & 1-Tap Resolution Banner */}
        {event.mismatchFlags && (event.mismatchFlags.timeMismatch || event.mismatchFlags.venueMismatch) && (
          <div className="mb-4 p-3.5 rounded-2xl bg-whistle/15 border border-whistle/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-whistle text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {event.mismatchFlags.timeMismatch
                  ? `Aikataulumuutos: Kalenteri ${event.mismatchFlags.calendarStartTime || ''} ➔ Liitto ${event.mismatchFlags.officialStartTime || ''} (${event.mismatchFlags.timeDiffMinutes || 0} min ero)`
                  : `Kenttämuutos: Kalenteri ${event.mismatchFlags.calendarVenueName || ''} ➔ Liitto ${event.mismatchFlags.officialVenueName || ''}`}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => onResolveMismatch?.(event.id, 'use_official')}
                className="px-2.5 py-1 rounded-lg bg-pitch text-text-inverse text-[11px] font-bold shadow-sm shadow-pitch/20 hover:brightness-110 cursor-pointer"
              >
                Päivitä liiton tietoon
              </button>
              <button
                type="button"
                onClick={() => onResolveMismatch?.(event.id, 'keep_calendar')}
                className="px-2.5 py-1 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-[11px] font-medium border border-border-subtle cursor-pointer"
              >
                Säilytä oma merkintä
              </button>
            </div>
          </div>
        )}

        {/* Lightning Danger Alert Banner */}
        {event.lightning && event.lightning.status === 'danger' && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-stoppage/20 border border-stoppage/40 text-stoppage text-xs font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{event.lightning.alertMessage}</span>
          </div>
        )}

        {/* Top Badges & Timers */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {playerName && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs"
                style={{
                  backgroundColor: colorHex || '#3b82f6',
                  color: getContrastTextColor(colorHex)
                }}
              >
                <span>👤</span>
                <span>{playerName}</span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                isTraining
                  ? 'bg-radar/15 text-radar border-radar/25'
                  : 'bg-pitch/15 text-pitch border border-pitch/25'
              }`}
            >
              {isTraining ? (
                <>
                  <Dumbbell className="w-3.5 h-3.5" />
                  <span>Harjoitus • {getSportBadge()}</span>
                </>
              ) : (
                getSportBadge()
              )}
            </span>

            {event.volunteerDuty && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-whistle/15 text-whistle border border-whistle/25">
                {event.volunteerDuty}
              </span>
            )}

            {/* Transit Mode Badge */}
            {event.transit && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  event.transit.isSelfTransit
                    ? 'bg-pitch/15 text-pitch border-pitch/30'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle'
                }`}
                title={event.transit.transitLabel}
              >
                <span>{event.transit.transitLabel}</span>
              </span>
            )}

            {/* Data Source Provenance Badge (Clickable to manage / merge / unmerge) */}
            {(() => {
              const sourceInfo = resolveEventSourceInfo(event);
              return (
                <button
                  type="button"
                  onClick={() => setIsMergeOpen(true)}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
                    sourceInfo.isCombined
                      ? 'bg-pitch/15 text-pitch border-pitch/30 hover:bg-pitch/25'
                      : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                  }`}
                  title={`${sourceInfo.tooltipDetails || ''} • Klikkaa hallitaksesi lähteitä tai yhdistääksesi`}
                  aria-label={`Tietolähde: ${sourceInfo.badgeText}. Klikkaa hallitaksesi yhdistämistä.`}
                >
                  <span>{sourceInfo.badgeText}</span>
                </button>
              );
            })()}
          </div>

          {/* Live or Kickoff Info & More Actions */}
          <div className="flex items-center gap-2">
            {isLive ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stoppage/15 text-stoppage border border-stoppage/30 text-xs font-bold animate-pulse">
                <span className="h-2 w-2 rounded-full bg-stoppage" />
                KÄYNNISSÄ
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-text-secondary text-xs md:text-sm font-medium font-tabular">
                <Clock className="w-3.5 h-3.5 text-pitch" />
                <span>
                  {isSchool || isOther
                    ? `Klo ${formattedKickoff}`
                    : isTraining
                    ? `Kokoontuminen klo ${formattedWarmup} • Treeni klo ${formattedKickoff}`
                    : `Alkulämpö klo ${formattedWarmup} · klo ${formattedKickoff}`}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsMergeOpen(true)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated text-xs transition-colors cursor-pointer"
              title="Hallitse tapahtumaa (Yhdistä / Piilota / Poista)"
              aria-label="Hallitse tapahtumaa"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Event Header (Matchup vs Training / School / Other Title) */}
        <div className="mb-4">
          {(event.tournamentName || event.stage || event.matchNumber) && (
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {event.tournamentName && (
                <span className="text-[11px] font-bold text-pitch flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{event.tournamentName}</span>
                </span>
              )}
              {event.stage && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pitch/10 text-pitch border border-pitch/20">
                  {event.stage}
                </span>
              )}
              {event.matchNumber && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                  #{event.matchNumber}
                </span>
              )}
            </div>
          )}

          {isTraining || isSchool || isOther || !event.awayTeam ? (
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-text-primary break-words">
              {event.title}
            </h2>
          ) : (
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg md:text-xl font-bold tracking-tight text-text-primary flex flex-wrap items-baseline gap-x-2 gap-y-0.5 break-words">
                <span className="break-words">{event.homeTeam}</span>
                {event.awayTeam && (
                  <>
                    <span className="text-text-muted font-normal text-sm select-none" aria-label="vastaan">vs</span>
                    <span className="break-words">{event.awayTeam}</span>
                  </>
                )}
                {currentScore && (
                  <span className="ml-1 font-mono text-sm font-black px-2 py-0.5 rounded-md bg-pitch/15 text-pitch border border-pitch/25">
                    {currentScore}
                  </span>
                )}
              </h2>

              {/* Personal Player Match Log Badge (if logged) */}
              {playerLog && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-whistle/15 text-whistle border border-whistle/30">
                    <Star className="w-3.5 h-3.5 fill-whistle text-whistle" />
                    <span>
                      {event.sport === 'basketball'
                        ? `${playerLog.points ?? 0} pistettä • ${playerLog.assists ?? 0} syöttöä`
                        : `${playerLog.goals ?? 0} maalia • ${playerLog.assists ?? 0} syöttöä`}
                      {playerLog.saves ? ` • ${playerLog.saves} torjuntaa` : ''}
                      {playerLog.starPlayerAward ? ' • 🏆 Tsemppari' : ''}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-xs md:text-sm text-text-secondary flex-wrap">
            <MapPin className="w-4 h-4 text-text-muted shrink-0" />
            <span className="truncate">
              {venue.name}
              {event.venue.isApproximateLocation && (
                <span className="ml-1 text-[10px] font-semibold text-text-muted">(sijainti arvioitu)</span>
              )}
            </span>
            <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-md bg-surface-elevated text-text-muted border border-border-subtle shrink-0">
              {surfaceLabel(venue.surface, venue.isIndoor)}
            </span>
            <button
              type="button"
              onClick={() => setIsVenueModalOpen(true)}
              aria-label={`Korjaa kentän tietoja: ${venue.name}`}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center -my-2 -mr-2 rounded-md text-text-muted hover:text-pitch hover:bg-surface-elevated cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Overlap & Driving Buffer Conflict Warning Banner */}
        {relatedConflicts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {relatedConflicts.map((c) => (
              <div
                key={c.id}
                role="alert"
                className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs ${
                  c.severity === 'critical'
                    ? 'bg-stoppage/15 border-stoppage/35 text-stoppage'
                    : 'bg-whistle/15 border-whistle/35 text-whistle'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold flex items-center justify-between gap-1">
                    <span>
                      {c.overlapMinutes > 0
                        ? `⚠️ Päällekkäisyys (${c.overlapMinutes} min)`
                        : '🚗 Tiukka siirtymä / Ajoaika'}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                      ~{c.travelMinutesEstimate} min ajo
                    </span>
                  </div>
                  <p className="mt-1 leading-snug font-medium text-text-primary dark:text-text-primary">
                    {c.message}
                  </p>
                  <p className="mt-1 text-[11px] font-bold opacity-90">
                    💡 {c.suggestedFix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modern Sports Stats & Match Report Strip (Interactive for all Matches & Past Games) */}
        {!isTraining && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.01 }}
            transition={springTactile.snappy}
            onClick={handleOpenStats}
            className={`w-full mb-4 p-3 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 text-left transition-all group ${
              isPast
                ? 'bg-surface-elevated/90 border-pitch/30 hover:border-pitch hover:bg-surface-elevated'
                : 'bg-surface-elevated/70 border-border-subtle hover:border-pitch/40'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-xl shrink-0 ${isPast ? 'bg-pitch/20 text-pitch' : 'bg-pitch/15 text-pitch'}`}>
                {isPast ? <BarChart3 className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-text-primary flex items-center gap-2">
                  {stats ? (
                    <>
                      <span>
                        {stats.homeStanding.rank}. {event.homeTeam} ({stats.homeStanding.points}p)
                      </span>
                      {event.awayTeam && (
                        <>
                          <span className="text-text-muted font-normal">vs</span>
                          <span>
                            {stats.awayStanding.rank}. {event.awayTeam} ({stats.awayStanding.points}p)
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span>{isPast ? 'Ottelutilastot & Kirjaa suoritus' : 'Avaa sarjatilastot & ennakko'}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-0.5 flex-wrap">
                  {stats ? (
                    <>
                      <span>
                        {stats.homeStanding.won}V–{stats.homeStanding.drawn}T–{stats.homeStanding.lost}H (Maalit {stats.homeStanding.goalsFor}–{stats.homeStanding.goalsAgainst})
                      </span>
                      {stats.homeStanding.form && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-muted">Kunto:</span>
                          <div className="flex items-center gap-0.5">
                            {stats.homeStanding.form.slice(-3).map((f, idx) => (
                              <span
                                key={idx}
                                className={`h-1.5 w-1.5 rounded-full ${
                                  f === 'W' ? 'bg-pitch' : f === 'D' ? 'bg-whistle' : 'bg-stoppage'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-pitch font-medium">
                      <Sparkles className="w-3 h-3" />
                      {isPast ? 'Päättynyt ottelu • Klikkaa tilastoihin' : 'Sarjataulukko & pelaajatilastot'}
                    </span>
                  )}
                  <span>•</span>
                  <span className="truncate text-pitch font-medium">
                    {isPast ? 'Kirjaa omat tilastot & raportti' : 'Avaa kokoonpanot'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-xs font-semibold text-pitch group-hover:translate-x-0.5 transition-transform">
              <BarChart3 className="w-4 h-4" />
              <ChevronRight className="w-4 h-4" />
            </div>
          </motion.button>
        )}

        {!compact && event.weather && (
          <div className="mb-4">
            <RainRadarCurve
              weather={event.weather}
              isOutdoor={!event.venue.isIndoor}
              coordinates={event.venue.coordinates}
              venueName={event.venue.name}
            />
          </div>
        )}

        {/* Bento Sub-Cards: Nappisvahti & Parking */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {event.briefing && (
            <NappisvahtiPill
              footwear={event.briefing.gearAndPackingAdvice.footwear}
              reason={event.briefing.gearAndPackingAdvice.footwearReason}
            />
          )}
          {event.parking && <ParkingEaseBadge parking={event.parking} venueName={event.venue.name} />}
        </div>

        {!compact && event.briefing && (
          <div className="mb-4 p-3 rounded-2xl bg-surface-elevated/40 border border-border-subtle/60 text-xs text-text-secondary flex flex-col gap-1">
            <div className="font-semibold text-text-primary">
              {isTraining ? '🎒 Treenivarusteet:' : '🎒 Varustesuositus & Katsomo-opas:'}
            </div>
            <div>
              {event.briefing.gearAndPackingAdvice.clothing}{' '}
              {event.briefing.gearAndPackingAdvice.spectatorGear}
            </div>
          </div>
        )}

        {/* Applied Notes / Carpool / Volunteer / School Details */}
        {event.notes && (
          <div className="mb-4 p-3 rounded-2xl bg-surface-elevated/70 border border-border-subtle text-xs text-text-primary flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-pitch text-[11px] uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>Tapahtuman lisätiedot & huomiot</span>
            </div>
            <div className="whitespace-pre-line text-xs font-medium text-text-secondary leading-relaxed">
              {event.notes}
            </div>
          </div>
        )}

        {/* Inline Fast Drop-In & Update Zone */}
        <EventInlineDropIn
          event={event}
          onEventUpdated={onEventUpdated}
          compact={compact}
        />

        {/* Footer Action Bar */}
        <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <Shirt className="w-4 h-4 text-pitch" />
            <span>
              {isTraining
                ? 'Treenivarusteet & Juomapullo'
                : event.briefing?.gearAndPackingAdvice.kitRecommendation || 'Ykköspeliasu'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={handleShareWhatsApp}
              aria-label="Jaa ottelun tiedot WhatsAppiin"
              title="Jaa WhatsAppiin"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-xl bg-surface-elevated border border-border-strong text-text-secondary hover:text-text-primary cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch transition-all"
            >
              <Share2 className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={() => setIsChatOpen(true)}
              aria-label="Päivitä tietoja chatin lailla"
              title="Päivitä chatin lailla"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-xl bg-surface-elevated border border-border-strong text-text-secondary hover:text-pitch cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch transition-all"
            >
              <MessageSquare className="w-4 h-4 text-pitch" />
            </motion.button>

            {isPast ? (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={springTactile.snappy}
                onClick={() => setIsStatsModalOpen(true)}
                aria-label="Avaa ottelutilastot ja tulos"
                className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-bold text-xs shadow-xs hover:border-pitch hover:text-pitch cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch transition-all"
              >
                <Trophy className="w-3.5 h-3.5 text-pitch" />
                <span>{currentScore ? `Tulos: ${currentScore}` : 'Katso tilastot & tulos'}</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={springTactile.snappy}
                onClick={
                  onNavigateToVenue ||
                  (() => {
                    const targetCoords = event.parking?.coordinates || event.venue?.coordinates;
                    const destination =
                      targetCoords?.lat != null && targetCoords?.lng != null
                        ? `${targetCoords.lat},${targetCoords.lng}`
                        : encodeURIComponent(event.venue?.name || 'Kenttä');
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                  })
                }
                aria-label={`Navigoi kohteeseen ${event.venue.name}`}
                className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2.5 rounded-xl bg-pitch text-text-inverse font-bold text-xs shadow-md shadow-pitch/20 hover:brightness-110 active:brightness-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch transition-all"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigoi paikalle</span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Interactive Full Match Stats Modal & Player Log */}
      {!isTraining && (
        <MatchStatsModal
          isOpen={isStatsModalOpen}
          onClose={() => setIsStatsModalOpen(false)}
          stats={stats || generateOrResolveMatchStats(event.homeTeam, event.awayTeam, event.sport)}
          homeTeam={event.homeTeam}
          awayTeam={event.awayTeam || 'Vastustaja'}
          playerName={playerName}
          playerLog={playerLog}
          score={currentScore}
          sport={event.sport}
          onSavePlayerLog={handleSavePlayerLog}
        />
      )}

      {/* Event Chat / Direct Natural Language Update Modal */}
      <EventChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        event={event}
        allEvents={allEvents}
        onEventUpdated={async (updated) => {
          if (updated.score) setCurrentScore(updated.score);
          if (updated.playerLog) setPlayerLog(updated.playerLog);
          if (updated.venue) setLocalVenue(updated.venue);
          await db.events.put(updated).catch(console.warn);
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

      {/* 1-Tap Venue Pin & Correction Modal */}
      <VenueCorrectionModal
        isOpen={isVenueModalOpen}
        onClose={() => setIsVenueModalOpen(false)}
        currentVenue={localVenue}
        eventId={event.id}
        onSaved={(updated) => setLocalVenue(updated)}
      />
    </>
  );
};
