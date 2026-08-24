import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ShieldCheck, Thermometer } from 'lucide-react';
import type { MatchdayEvent, PlayerProfile } from '../types/matchday';
import { calculateDepartureCountdown } from '../lib/ai/deterministicReasoner';
import { runMissionControlGraph } from '../lib/agents';
import { sportLabelFi } from '../lib/sport/sportMeta';
import { SportGlyph } from './SportGlyph';

interface AmbientViewProps {
  events: MatchdayEvent[];
  profiles?: PlayerProfile[];
  onExit?: () => void;
}

const IDLE_MS = 90_000;

export const AmbientView: React.FC<AmbientViewProps> = ({ events, profiles = [], onExit }) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [cursor, setCursor] = useState(0);
  const [dim, setDim] = useState(false);
  const dimRef = useRef(false);
  const armIdleRef = useRef<() => void>(() => {});

  const snapshot = useMemo(
    () => runMissionControlGraph(events, profiles, new Date()),
    [events, profiles]
  );

  const cycle = useMemo(() => {
    const upcoming = events.filter((e) => new Date(e.endTime).getTime() >= Date.now() - 30 * 60000);
    return upcoming.length > 0 ? upcoming : events.slice(0, 3);
  }, [events]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' }));
      setDateStr(
        now.toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Helsinki' })
      );
    };
    tick();
    const clock = setInterval(tick, 30_000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (cycle.length < 2) return;
    const rot = setInterval(() => setCursor((c) => (c + 1) % cycle.length), 12_000);
    return () => clearInterval(rot);
  }, [cycle.length]);

  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        dimRef.current = true;
        setDim(true);
      }, IDLE_MS);
    };
    armIdleRef.current = arm;
    arm();
    const onActivity = () => {
      if (dimRef.current) return;
      arm();
    };
    window.addEventListener('pointermove', onActivity);
    return () => {
      clearTimeout(idle);
      window.removeEventListener('pointermove', onActivity);
    };
  }, []);

  const wakeScreen = () => {
    dimRef.current = false;
    setDim(false);
    armIdleRef.current();
  };

  const handleSurfaceClick = () => {
    if (dimRef.current) {
      wakeScreen();
      return;
    }
    onExit?.();
  };

  const shown = cycle[cursor] || snapshot.nextEvent;
  const profile = shown ? profiles.find((p) => p.id === shown.profileId) : undefined;
  const depart = shown ? calculateDepartureCountdown(shown, profile?.arrivalRules) : undefined;
  const temp = shown?.weather?.isForecastLongRange ? undefined : shown?.weather?.temperatureC;

  return (
    <div
      className={`flex min-h-dvh w-full flex-col justify-between bg-canvas px-6 py-8 text-text-primary md:px-16 md:py-12 ${
        dim ? 'opacity-70' : ''
      }`}
      onClick={handleSurfaceClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onExit?.();
      }}
      role="presentation"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-tabular text-5xl font-semibold tracking-tight md:text-7xl lg:text-8xl">
            {timeStr}
          </div>
          <div className="mt-1 text-base capitalize text-radar md:text-xl">{dateStr}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-pitch">
            Pelipäivä
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExit?.();
            }}
            className="min-h-11 rounded-md border border-border-strong bg-surface-elevated px-3 text-xs font-semibold uppercase tracking-wide text-text-primary"
          >
            Poistu
          </button>
        </div>
      </div>

      {shown ? (
        <div className="my-auto py-8">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium text-text-secondary md:text-lg">
            {profile && (
              <span className="inline-flex items-center gap-2 text-text-primary">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: profile.colorHex }}
                />
                {profile.playerName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <SportGlyph sport={shown.sport} className="h-5 w-5" />
              {sportLabelFi(shown.sport)}
            </span>
            <span>
              {shown.isTraining ? 'Treenit' : 'Alkulämpö'}{' '}
              {new Date(shown.startTime).toLocaleTimeString('fi-FI', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Helsinki'
              })}
            </span>
          </div>

          <h1 className="max-w-5xl text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
            {shown.isTraining ? shown.title : `${shown.homeTeam} vs ${shown.awayTeam || '—'}`}
          </h1>

          <div className="mt-4 flex items-center gap-3 text-xl text-text-secondary md:text-3xl">
            <MapPin className="h-7 w-7 text-radar" />
            <span>{shown.venue.name}</span>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border-subtle bg-surface-elevated p-5">
              <div className="text-sm font-medium uppercase tracking-wide text-text-muted">
                Lähde kotoa
              </div>
              <div className="mt-1 font-tabular text-4xl font-semibold text-floodlight md:text-5xl">
                {depart?.departureTime || '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-elevated p-5">
              <div className="text-sm font-medium uppercase tracking-wide text-text-muted">Sää</div>
              <div className="mt-1 flex items-center gap-2 font-tabular text-4xl font-semibold md:text-5xl">
                <Thermometer className="h-8 w-8 text-radar" />
                {temp !== undefined ? `${temp}°` : '—'}
              </div>
              <div className="mt-1 text-sm text-text-muted">
                {shown.venue.isIndoor ? 'Sisähalli' : 'Ulkokenttä'}
              </div>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-elevated p-5">
              <div className="text-sm font-medium uppercase tracking-wide text-text-muted">
                Kengät
              </div>
              <div className="mt-1 flex items-center gap-2 text-2xl font-semibold md:text-3xl">
                <ShieldCheck className="h-7 w-7 text-pitch" />
                {snapshot.kitByEventId[shown.id]?.footwearLabel || 'Katso kassi'}
              </div>
            </div>
          </div>

          {snapshot.conflicts.length > 0 && (
            <p className="mt-6 text-lg text-whistle md:text-2xl">{snapshot.conflicts[0]?.message}</p>
          )}
        </div>
      ) : (
        <div className="my-auto">
          <h1 className="text-4xl font-semibold md:text-6xl">Ei seuraavaa peliä</h1>
          <p className="mt-3 text-xl text-text-muted">Nauti vapaasta.</p>
        </div>
      )}

      <p className="text-sm text-text-muted">{snapshot.ambientLine}</p>
    </div>
  );
};
