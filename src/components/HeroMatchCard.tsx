import React, { useState } from 'react';
import { AlertTriangle, MapPin, Navigation, Thermometer, ShieldCheck, CloudRain } from 'lucide-react';
import { motion } from 'motion/react';
import type { MatchdayEvent, PlayerProfile } from '../types/matchday';
import type { FamilyConflict, SportKitPlan } from '../lib/agents';
import { calculateDepartureCountdown } from '../lib/ai/deterministicReasoner';
import { sportLabelFi } from '../lib/sport/sportMeta';
import { springTactile } from '../lib/motion/springs';
import { KitChecklist } from './KitChecklist';
import { ParkingEaseBadge } from './ParkingEaseBadge';
import { SportGlyph } from './SportGlyph';
import { getContrastTextColor } from '../lib/sport/teamColors';

interface HeroMatchCardProps {
  event: MatchdayEvent;
  profile?: PlayerProfile;
  kit?: SportKitPlan;
  conflicts: FamilyConflict[];
  onNavigate?: () => void;
}

export const HeroMatchCard: React.FC<HeroMatchCardProps> = ({
  event,
  profile,
  kit,
  conflicts,
  onNavigate
}) => {
  const [showKit, setShowKit] = useState(false);
  const { departureTime, countdownMinutes } = calculateDepartureCountdown(event);
  
  const kickoff = new Date(event.startTime).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const warmup = event.warmupTime
    ? new Date(event.warmupTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
    : kickoff;

  const dateLabel = new Date(event.startTime).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  });
  
  const related = conflicts.filter((c) => c.eventAId === event.id || c.eventBId === event.id);
  const isLive =
    new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const temp = event.weather?.isForecastLongRange ? undefined : event.weather?.temperatureC;
  const isWetOrCold = event.weather && (event.weather.precipitationMmh > 0.2 || (temp !== undefined && temp <= 3));

  // Prioritize parking coordinates for driving navigation over pitch center
  const targetCoords = event.parking?.coordinates || event.venue.coordinates;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetCoords.lat},${targetCoords.lng}`;

  const jerseyColor = kit?.kitColors?.primary || profile?.colorHex || '#3b82f6';
  const jerseyText = event.isHomeMatch === false ? 'Vieraspaita (+ varapaita)' : 'Kotipeliasu (ykkönen)';

  return (
    <article className="liquid-glass relative mb-4 overflow-hidden rounded-2xl border border-border-subtle shadow-card">
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: profile?.colorHex || 'var(--nv-pitch-primary)' }}
      />
      <div className="p-4 pl-5 md:p-5 md:pl-6">
        {/* Top Meta: Profile, Sport, Live status */}
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
          </div>

          {isLive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] bg-stoppage/20 text-stoppage border border-stoppage/30 animate-pulse">
              ● Käynnissä
            </span>
          )}
        </div>

        {/* Match / Training Title */}
        <h2 className="text-xl font-bold tracking-tight text-text-primary md:text-2xl break-words">
          {event.isTraining ? event.title : `${event.homeTeam} vs ${event.awayTeam || '—'}`}
        </h2>
        
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
              🚗 Lähde
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
              ⚽ Kickoff
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
                window.open(mapsUrl, '_blank');
              })
            }
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-pitch px-4 text-sm font-bold text-text-inverse hover:brightness-110 cursor-pointer shadow-sm shadow-pitch/20 transition-all"
          >
            <Navigation className="h-4 w-4" />
            <span>Navigoi parkkiin ({event.parking?.lotName || event.venue.name})</span>
          </motion.button>

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
      </div>
    </article>
  );
};
