import React from 'react';
import { motion } from 'motion/react';
import { Clock, MapPin, Navigation, Shirt, AlertTriangle, Share2 } from 'lucide-react';
import { MatchdayEvent } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { NappisvahtiPill } from './NappisvahtiPill';
import { ParkingEaseBadge } from './ParkingEaseBadge';
import { RainRadarCurve } from './RainRadarCurve';

interface MatchdayCardProps {
  event: MatchdayEvent;
  onNavigateToVenue?: () => void;
}

export const MatchdayCard: React.FC<MatchdayCardProps> = ({ event, onNavigateToVenue }) => {
  const isLive =
    new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const formattedKickoff = new Date(event.startTime).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const formattedWarmup = new Date(event.warmupTime).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleShareWhatsApp = () => {
    if (event.briefing?.postMatchWhatsAppTemplate) {
      const text = encodeURIComponent(event.briefing.postMatchWhatsAppTemplate);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  return (
    <motion.div
      layout
      whileTap={{ scale: 0.99 }}
      transition={springTactile.squishy}
      className="liquid-glass relative overflow-hidden rounded-3xl p-5 md:p-6 transition-colors"
    >
      {/* Background Ambience Glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pitch/10 blur-3xl" />

      {/* Conflict Warning Banner if Siblings Overlap */}
      {event.briefing?.conflictWarning && (
        <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-whistle/15 border border-whistle/30 text-whistle text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{event.briefing.conflictWarning}</span>
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-pitch/15 text-pitch border border-pitch/25">
            {event.sport === 'football'
              ? '⚽ Jalkapallo'
              : event.sport === 'floorball'
              ? '🏑 Salibandy'
              : event.sport === 'basketball'
              ? '🏀 Koripallo'
              : '🏅 Ottelu'}
          </span>
          {event.volunteerDuty && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-whistle/15 text-whistle border border-whistle/25">
              {event.volunteerDuty}
            </span>
          )}
        </div>

        {/* Live or Kickoff Info */}
        {isLive ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stoppage/15 text-stoppage border border-stoppage/30 text-xs font-bold animate-pulse">
            <span className="h-2 w-2 rounded-full bg-stoppage" />
            KÄYNNISSÄ
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-text-secondary text-xs md:text-sm font-medium font-tabular">
            <Clock className="w-3.5 h-3.5 text-pitch" />
            <span>Alkulämpö klo {formattedWarmup} • Kickoff klo {formattedKickoff}</span>
          </div>
        )}
      </div>

      {/* Matchup Header */}
      <div className="mb-5">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-text-primary flex items-baseline gap-2">
          <span>{event.homeTeam}</span>
          <span className="text-text-muted font-normal text-sm">vs</span>
          <span>{event.awayTeam || 'Vastustaja'}</span>
        </h2>
        <div className="flex items-center gap-2 mt-1.5 text-xs md:text-sm text-text-secondary">
          <MapPin className="w-4 h-4 text-text-muted shrink-0" />
          <span className="truncate">{event.venue.name}</span>
          <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-md bg-surface-elevated text-text-muted border border-border-subtle shrink-0">
            {event.venue.isIndoor ? 'Sisähalli' : event.venue.surface.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Weather Rain Curve */}
      {event.weather && (
        <div className="mb-4">
          <RainRadarCurve weather={event.weather} isOutdoor={!event.venue.isIndoor} />
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
        {event.parking && <ParkingEaseBadge parking={event.parking} />}
      </div>

      {/* Packing Advice & Spectator Note */}
      {event.briefing && (
        <div className="mb-4 p-3 rounded-2xl bg-surface-elevated/40 border border-border-subtle/60 text-xs text-text-secondary flex flex-col gap-1">
          <div className="font-semibold text-text-primary">🎒 Varustesuositus & Katsomo-opas:</div>
          <div>{event.briefing.gearAndPackingAdvice.clothing} {event.briefing.gearAndPackingAdvice.spectatorGear}</div>
        </div>
      )}

      {/* Footer Action Bar */}
      <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          <Shirt className="w-4 h-4 text-pitch" />
          <span>{event.briefing?.gearAndPackingAdvice.kitRecommendation || 'Ykköspeliasu'}</span>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={springTactile.snappy}
            onClick={handleShareWhatsApp}
            title="Jaa WhatsAppiin"
            className="p-2 rounded-xl bg-surface-elevated border border-border-strong text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={springTactile.snappy}
            onClick={
              onNavigateToVenue ||
              (() => {
                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${event.venue.coordinates.lat},${event.venue.coordinates.lng}`;
                window.open(mapsUrl, '_blank');
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pitch text-text-inverse font-semibold text-xs shadow-md shadow-pitch/20 hover:brightness-110 active:brightness-95 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Navigoi kentälle</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
