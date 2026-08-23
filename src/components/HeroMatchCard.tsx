import React, { useState } from 'react';
import { AlertTriangle, MapPin, Navigation, Thermometer } from 'lucide-react';
import { motion } from 'motion/react';
import type { MatchdayEvent, PlayerProfile } from '../types/matchday';
import type { FamilyConflict, SportKitPlan } from '../lib/agents';
import { calculateDepartureCountdown } from '../lib/ai/deterministicReasoner';
import { sportLabelFi } from '../lib/sport/sportMeta';
import { springTactile } from '../lib/motion/springs';
import { KitChecklist } from './KitChecklist';
import { NappisvahtiPill } from './NappisvahtiPill';
import { ParkingEaseBadge } from './ParkingEaseBadge';
import { SportGlyph } from './SportGlyph';

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
  const dateLabel = new Date(event.startTime).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  });
  const related = conflicts.filter((c) => c.eventAId === event.id || c.eventBId === event.id);
  const isLive =
    new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const temp = event.weather?.isForecastLongRange ? undefined : event.weather?.temperatureC;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${event.venue.coordinates.lat},${event.venue.coordinates.lng}`;

  return (
    <article className="liquid-glass relative mb-4 overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: profile?.colorHex || 'var(--nv-pitch-primary)' }}
      />
      <div className="p-4 pl-5 md:p-5 md:pl-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
          {profile && (
            <span className="inline-flex items-center gap-1.5 text-text-primary">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: profile.colorHex }}
              />
              {profile.playerName}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <SportGlyph sport={event.sport} className="h-3.5 w-3.5" />
            {sportLabelFi(event.sport)}
          </span>
          <span>
            {dateLabel} · {event.isTraining ? 'Treenit' : 'Alkulämpö'} {kickoff}
          </span>
          {isLive && (
            <span className="font-semibold uppercase tracking-wide text-stoppage">Käynnissä</span>
          )}
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-text-primary md:text-2xl">
          {event.isTraining ? event.title : `${event.homeTeam} vs ${event.awayTeam || '—'}`}
        </h2>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="truncate">{event.venue.name}</span>
          <span className="text-xs text-text-muted">
            {event.venue.isIndoor ? 'Sisähalli' : 'Ulkokenttä'}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Lähde kotoa
            </div>
            <div className="font-tabular text-4xl font-semibold leading-none text-floodlight md:text-5xl">
              {departureTime}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {countdownMinutes > 0
                ? `${countdownMinutes} min lähtöön`
                : isLive
                  ? 'Peli käynnissä'
                  : 'Lähtöaika mennyt'}
            </div>
          </div>
          {temp !== undefined && (
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Thermometer className="h-4 w-4 text-radar" />
              <span className="font-tabular font-semibold text-text-primary">{temp}°</span>
            </div>
          )}
        </div>

        {related.map((c) => (
          <div
            key={c.id}
            className="mt-3 flex items-start gap-2 rounded-md border border-whistle/30 bg-whistle/10 p-2.5 text-xs text-whistle"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {c.message} {c.suggestedFix}
            </span>
          </div>
        ))}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {event.briefing && (
            <NappisvahtiPill
              footwear={event.briefing.gearAndPackingAdvice.footwear}
              reason={event.briefing.gearAndPackingAdvice.footwearReason}
            />
          )}
          {event.parking && (
            <ParkingEaseBadge parking={event.parking} venueName={event.venue.name} />
          )}
        </div>

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
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-pitch px-4 text-sm font-semibold text-text-inverse"
          >
            <Navigation className="h-4 w-4" />
            Navigoi paikalle
          </motion.button>
          {kit && (
            <button
              type="button"
              onClick={() => setShowKit((v) => !v)}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong bg-surface-elevated px-4 text-sm font-medium text-text-primary"
            >
              {showKit ? 'Piilota kassi' : 'Kassi'}
            </button>
          )}
        </div>

        {showKit && kit && (
          <div className="mt-3">
            <KitChecklist plan={kit} compact />
          </div>
        )}
      </div>
    </article>
  );
};
