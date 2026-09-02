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
  ChevronDown,
  ChevronUp,
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
import { resolveEventSourceInfo } from '../lib/events/eventSourceResolver';
import { EventChatModal } from './EventChatModal';
import { EventMergeModal } from './EventMergeModal';
import { EventInlineDropIn } from './EventInlineDropIn';
import { MoreHorizontal, FileText } from 'lucide-react';
import { db } from '../lib/storage/db';
import { useDismissedConflicts, groupActiveConflicts } from '../lib/agents/conflictDismissal';
import { recordAttendanceOverride } from '../lib/sync/familyCloud';

interface HeroMatchCardProps {
  event: MatchdayEvent;
  allEvents?: MatchdayEvent[];
  profile?: PlayerProfile;
  kit?: SportKitPlan;
  conflicts: FamilyConflict[];
  homeLocation?: import('../types/matchday').HomeLocation;
  onNavigate?: () => void;
  onOpenStats?: () => void;
  onOpenHomeModal?: () => void;
  onResolveMismatch?: (eventId: string, decision: 'use_official' | 'keep_calendar' | 'unlink') => void;
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
  homeLocation,
  onNavigate,
  onOpenStats,
  onOpenHomeModal,
  onResolveMismatch,
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
    return event.stats ?? null;
  }, [event.stats, event.isTraining]);

  const sourceInfo = resolveEventSourceInfo(event, profile);

  // Respect the child's configured arrival rules and family home location
  const { departureTime, countdownMinutes, transitPlan } = calculateDepartureCountdown(
    event,
    profile?.arrivalRules,
    homeLocation
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
  
  const { isDismissed, dismiss: dismissConflict, restore: restoreConflict } = useDismissedConflicts();
  const [showDismissedConflicts, setShowDismissedConflicts] = useState(false);
  const [isOutExpanded, setIsOutExpanded] = useState(false);

  const { activeConflicts, dismissedConflicts } = useMemo(() => {
    const related = conflicts?.filter((c) => c.eventAId === event.id || c.eventBId === event.id) || [];
    const unique = Array.from(
      new Map(related.map((c) => [`${c.message}-${c.suggestedFix}`, c])).values()
    );
    const active = unique.filter((c) => !isDismissed(c));
    const dismissed = unique.filter((c) => isDismissed(c));
    return {
      activeConflicts: active,
      dismissedConflicts: dismissed
    };
  }, [conflicts, event.id, isDismissed]);

  const consolidatedConflictGroups = useMemo(() => groupActiveConflicts(activeConflicts), [activeConflicts]);
  const isLive =
    new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const temp = event.weather?.isForecastLongRange ? undefined : event.weather?.temperatureC;
  const isWetOrCold = event.weather && (event.weather.precipitationMmh > 0.2 || (temp !== undefined && temp <= 3));

  // Prioritize parking coordinates for driving navigation over pitch center (only if verified)
  // Destination coordinates: walking/cycling goes directly to venue; car driving goes to parking lot
  const isApprox = event.venue?.isApproximateLocation;
  const isSelfTransit = transitPlan?.isSelfTransit;
  const targetCoords = isSelfTransit
    ? (!isApprox ? event.venue?.coordinates : undefined)
    : (event.parking?.coordinates || (!isApprox ? event.venue?.coordinates : undefined));
  const hasValidCoords = targetCoords && (targetCoords.lat !== 0 || targetCoords.lng !== 0);
  const destination =
    hasValidCoords
      ? `${targetCoords.lat},${targetCoords.lng}`
      : encodeURIComponent(event.venue?.name || 'Kenttä');
  const travelModeParam = transitPlan?.mode === 'walk' ? '&travelmode=walking' : transitPlan?.mode === 'bicycle' ? '&travelmode=bicycling' : '';
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}${travelModeParam}`;

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

  const isOut = event.attendanceStatus === 'out';

  const handleToggleAttendance = async (newStatus: 'in' | 'out') => {
    try {
      setIsOutExpanded(false);
      const updated: MatchdayEvent = {
        ...event,
        attendanceStatus: newStatus
      };
      const sync = await db.syncState.get('family').catch(() => null);
      await recordAttendanceOverride(sync?.syncKey || '', event.id, newStatus, db);
      onEventUpdated?.(updated);
    } catch (err) {
      console.error('Failed to toggle attendance', err);
    }
  };

  if (isOut && !isOutExpanded) {
    return (
      <article
        className="liquid-glass relative mb-4 overflow-hidden rounded-2xl border border-dashed border-border-strong/60 bg-surface/30 opacity-80 hover:opacity-100 transition-all p-3 pl-4 flex items-center justify-between gap-3 shadow-xs"
      >
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: profile?.colorHex || 'var(--nv-pitch-primary)' }}
        />
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
          <span className="text-xs font-black text-stoppage bg-stoppage/15 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
            <span>⛔</span>
            <span className="hidden sm:inline">{profile?.playerName || 'Pelaaja'} ei osallistu</span>
            <span className="sm:hidden">Poisjäänti</span>
          </span>

          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-text-muted line-through truncate block">
              {event.isTraining ? (event.title || 'Harjoitukset') : `${event.homeTeam} vs ${event.awayTeam || '—'}`}
            </span>
            <span className="text-[11px] text-text-muted/80 truncate block">
              klo {kickoff} • {event.venue?.name || 'Kenttä'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleToggleAttendance('in')}
            className="touch-target min-h-[44px] px-3.5 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold shadow-xs hover:brightness-110 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
            title="Merkitse pelaaja osallistuvaksi"
          >
            <span>↩️</span>
            <span>Osallistuu silti</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOutExpanded(true)}
            className="touch-target min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer transition-all"
            title="Näytä tapahtuman lisätiedot"
            aria-label="Näytä tapahtuman lisätiedot"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`liquid-glass relative mb-4 overflow-hidden rounded-2xl border transition-all ${
        isOut
          ? 'opacity-65 grayscale-20 border-dashed border-border-strong/70 bg-surface/40 hover:opacity-100'
          : 'border-border-subtle shadow-card'
      }`}
    >
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: profile?.colorHex || 'var(--nv-pitch-primary)' }}
      />
      <div className="p-4 pl-5 md:p-5 md:pl-6">
        {/* Top OUT Banner when event is marked as skipped */}
        {isOut && (
          <div className="mb-3.5 flex items-center justify-between gap-2 p-3 rounded-2xl bg-surface-elevated/90 border border-border-strong text-xs font-bold text-stoppage flex-wrap">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">⛔</span>
              <span className="truncate">{profile?.playerName || 'Pelaaja'} ei osallistu (Poisjäänti merkitty)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleAttendance('in')}
                className="touch-target min-h-[44px] px-3.5 py-1.5 rounded-xl bg-pitch text-text-inverse hover:brightness-110 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 shrink-0"
                title="Merkitse pelaaja osallistuvaksi"
              >
                <span>↩️</span>
                <span>Osallistuu silti</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOutExpanded(false)}
                className="touch-target min-h-[44px] px-3 py-1.5 rounded-xl bg-surface-elevated text-text-secondary hover:text-text-primary text-xs font-semibold border border-border-subtle cursor-pointer transition-all flex items-center gap-1"
                title="Pienennä kortti"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Pienennä</span>
              </button>
            </div>
          </div>
        )}

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
              <button
                type="button"
                onClick={onOpenHomeModal}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
                  transitPlan.isSelfTransit
                    ? 'bg-pitch/15 text-pitch border-pitch/30'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
                title={`${transitPlan.transitLabel} • Klikkaa muokataksesi kotiosoitetta tai kulkutapaa`}
                aria-label={`Kulkutapa: ${transitPlan.transitLabel}. Klikkaa muokataksesi kotiosoitetta.`}
              >
                <span>{transitPlan.transitLabel}</span>
              </button>
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

            {/* 1-Tap Attendance In/Out Button */}
            {!isOut ? (
              <button
                type="button"
                onClick={() => handleToggleAttendance('out')}
                className="touch-target min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-pitch/15 text-pitch hover:bg-stoppage/15 hover:text-stoppage hover:border-stoppage/40 border border-pitch/30 transition-all cursor-pointer hover:brightness-110 active:scale-95 group"
                title={`Pelaaja on tulossa. Klikkaa ilmoittaaksesi poisjäänti.`}
                aria-label={`Pelaaja osallistuu. Klikkaa ilmoittaaksesi poisjäänti.`}
              >
                <span className="h-2 w-2 rounded-full bg-pitch group-hover:bg-stoppage shrink-0" />
                <span className="group-hover:hidden">🟢 {profile?.playerName || 'Pelaaja'} osallistuu</span>
                <span className="hidden group-hover:inline">⛔ Ilmoita poisjäänti</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleAttendance('in')}
                className="touch-target min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-stoppage/15 text-stoppage hover:bg-pitch/15 hover:text-pitch hover:border-pitch/30 border border-stoppage/30 transition-all cursor-pointer hover:brightness-110 active:scale-95 group"
                title={`Poisjäänti merkitty. Klikkaa merkitäksesi osallistuvaksi.`}
                aria-label={`Poisjäänti merkitty. Klikkaa merkitäksesi osallistuvaksi.`}
              >
                <span className="h-2 w-2 rounded-full bg-stoppage group-hover:bg-pitch shrink-0" />
                <span className="group-hover:hidden">⛔ Poisjäänti (OUT)</span>
                <span className="hidden group-hover:inline">↩️ Osallistuu silti</span>
              </button>
            )}
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

        {/* Match / Training / School / Other Title */}
        <h2 className="text-xl font-bold tracking-tight text-text-primary md:text-2xl break-words">
          {event.isTraining || event.sport === 'school' || event.sport === 'other' || event.eventType === 'school' || event.eventType === 'meeting' || event.eventType === 'other' || !event.awayTeam
            ? event.title
            : `${event.homeTeam} vs ${event.awayTeam || '—'}`}
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
            • {event.venue.isIndoor ? 'Sisätila' : 'Ulkokenttä'}
          </span>
        </div>

        {/* Schedule / Venue Mismatch Warning Banner */}
        {!isOut && event.mismatchFlags && (event.mismatchFlags.timeMismatch || event.mismatchFlags.venueMismatch) && (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-whistle/10 border border-whistle/25 flex items-center gap-2 flex-wrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-whistle" />
            <span className="text-whistle text-[11px] font-semibold flex-1 min-w-0 truncate">
              {event.mismatchFlags.timeMismatch
                ? `Aikataulumuutos: ${event.mismatchFlags.calendarStartTime || ''} ➔ ${event.mismatchFlags.officialStartTime || ''}`
                : `Kenttämuutos: ${event.mismatchFlags.calendarVenueName || ''} ➔ ${event.mismatchFlags.officialVenueName || ''}`}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onResolveMismatch?.(event.id, 'use_official')}
                className="touch-target min-h-[44px] px-2.5 py-1 rounded-lg bg-pitch text-text-inverse text-[10px] font-bold hover:brightness-110 cursor-pointer"
              >
                Päivitä liiton tietoon
              </button>
              <button
                type="button"
                onClick={() => onResolveMismatch?.(event.id, 'keep_calendar')}
                className="touch-target min-h-[44px] px-2.5 py-1 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-[10px] font-medium border border-border-subtle cursor-pointer"
              >
                Säilytä oma
              </button>
            </div>
          </div>
        )}

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
              {event.sport === 'school' || event.sport === 'other' || event.eventType === 'school' || event.eventType === 'meeting' || event.eventType === 'other'
                ? 'Saapuminen'
                : event.isTraining
                ? 'Kokoontuminen'
                : 'Alkulämpö'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
              {event.sport === 'school' ? '🏫 Alkaa' : event.sport === 'other' ? '📌 Alkaa' : event.isTraining ? '🏃‍♂️ Treeni' : '⏱️ Aloitus'}
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

        {/* Conflicts Alert with Acknowledge / Dismiss Action (Consolidated) */}
        {!isOut && consolidatedConflictGroups.map((group) => (
          <div
            key={group.id}
            role="alert"
            className={`mt-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs ${
              group.severity === 'critical'
                ? 'bg-stoppage/15 border-stoppage/35 text-stoppage'
                : group.severity === 'info'
                ? 'bg-pitch/15 border-pitch/35 text-pitch'
                : 'bg-whistle/15 border-whistle/35 text-whistle'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${group.severity === 'info' ? 'text-pitch' : ''}`} />
              <div className="flex-1 min-w-0">
                <div className="font-extrabold flex items-center justify-between gap-1">
                  <span>{group.severity === 'info' ? group.title : `⚠️ ${group.title}`}</span>
                  {group.severity !== 'info' && group.maxTravel > 0 && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                      ~{group.maxTravel} min ajo
                    </span>
                  )}
                </div>
                <p className="mt-1 leading-snug font-medium text-text-primary dark:text-text-primary">
                  {group.message}
                </p>

                {/* Sub-items breakdown if multi-match */}
                {group.subItems.length > 0 && (
                  <div className="mt-2 pl-2 border-l-2 border-current/30 flex flex-col gap-1 text-[11px] font-medium text-text-secondary dark:text-text-secondary">
                    {group.subItems.map((sub, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                        <span>•</span>
                        <span className="font-bold">{sub.venueA !== sub.venueB ? `${sub.venueA} & ${sub.venueB}` : sub.venueA}</span>
                        <span>— päällekkäin {sub.overlap} min</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-1.5 text-[11px] font-bold opacity-90">
                  💡 {group.suggestedFix}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                for (const c of group.conflicts) {
                  dismissConflict(c);
                }
              }}
              className="touch-target min-h-[44px] self-end sm:self-center px-3 py-1.5 rounded-xl bg-surface-elevated text-text-secondary hover:text-pitch hover:border-pitch/40 border border-border-subtle text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 flex items-center gap-1.5"
              title="Merkitse kaikki tämän ryhmän huomiot hoidetuiksi"
            >
              <span>✓</span>
              <span>{group.conflicts.length > 1 ? 'Kuittaa kaikki hoidetuksi' : 'Kuittaa hoidetuksi'}</span>
            </button>
          </div>
        ))}

        {/* View Dismissed / Acknowledged Conflicts */}
        {!isOut && dismissedConflicts.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowDismissedConflicts(!showDismissedConflicts)}
              className="touch-target min-h-[44px] text-xs font-semibold text-text-muted hover:text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors py-1 self-start"
            >
              <span>👁️</span>
              <span>{showDismissedConflicts ? 'Piilota kuitatut huomiot' : `Näytä kuitatut huomiot (${dismissedConflicts.length})`}</span>
            </button>
            {showDismissedConflicts && (
              <div className="flex flex-col gap-2 pl-2.5 border-l-2 border-border-subtle">
                {dismissedConflicts.map((dc) => (
                  <div
                    key={dc.id}
                    className="p-2.5 rounded-xl bg-surface/60 border border-border-subtle text-xs text-text-muted flex items-center justify-between gap-3 flex-wrap"
                  >
                    <span className="line-through truncate flex-1 min-w-[200px]">{dc.message}</span>
                    <button
                      type="button"
                      onClick={() => restoreConflict(dc)}
                      className="touch-target min-h-[44px] px-3 py-1.5 rounded-xl bg-surface-elevated text-xs font-bold text-pitch hover:border-pitch/40 border border-border-subtle inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <span>↩️</span>
                      <span>Palauta huomio</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Secondary Badges (Parking info - compact when walking/cycling) */}
        {event.parking && (
          <div className="mt-2">
            <ParkingEaseBadge
              parking={event.parking}
              venueName={event.venue.name}
              compact={transitPlan?.isSelfTransit}
            />
          </div>
        )}

        {/* Applied Notes / Carpool / Volunteer / School Details */}
        {event.notes && (
          <div className="mt-3 p-3 rounded-2xl bg-surface-elevated/70 border border-border-subtle text-xs text-text-primary flex flex-col gap-1">
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
        <div className="mt-2">
          <EventInlineDropIn
            event={event}
            profile={profile}
            onEventUpdated={onEventUpdated}
          />
        </div>

        {/* Action Buttons: Navigation CTA (walk/bike/car) & Kassi toggle */}
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
            <span>
              {transitPlan?.mode === 'walk'
                ? `Kävele paikalle (${transitPlan.travelMinutes} min)`
                : transitPlan?.mode === 'bicycle'
                  ? `Pyöräile paikalle (${transitPlan.travelMinutes} min)`
                  : `Navigoi parkkiin (${event.parking?.lotName || event.venue.name})`}
            </span>
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
