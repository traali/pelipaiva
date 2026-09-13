import React from 'react';
import { CloudRain, Wind, AlertTriangle, Radio, ShieldAlert } from 'lucide-react';
import { WeatherCondition } from '../types/matchday';

interface MatchdayCardWeatherBadgeProps {
  weather: WeatherCondition;
  onOpenRadar?: () => void;
  indoor?: boolean;
  className?: string;
}

export const MatchdayCardWeatherBadge: React.FC<MatchdayCardWeatherBadgeProps> = ({
  weather,
  onOpenRadar,
  indoor = false,
  className = '',
}) => {
  const {
    temperatureC,
    feelsLikeC,
    windSpeedMs,
    windGustMs,
    precipitationMmh,
    turfCondition,
    turfConditionLabelFi,
    windAdvisoryBadge,
    rainOnsetLabel,
    isCacheFallback,
    lightningSafety,
  } = weather;

  const turfClass =
    turfCondition === 'frozen'
      ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30'
      : turfCondition === 'slick'
      ? 'bg-sky-950/40 text-sky-300 border-sky-500/30'
      : turfCondition === 'snowy'
      ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30'
      : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30';

  const turfLabel =
    turfConditionLabelFi ||
    (turfCondition === 'frozen'
      ? 'Jäätynyt tekonurmi'
      : turfCondition === 'slick'
      ? 'Liukas tekonurmi'
      : 'Kuiva tekonurmi');

  const hasLightningAlert =
    lightningSafety &&
    (lightningSafety.status === 'danger' || lightningSafety.status === 'watch');

  if (indoor) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-elevated/70 p-3 flex flex-col gap-1.5 select-none shadow-xs ${className}`}
        aria-label="Sää sisähallille"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-base text-text-primary tracking-tight font-tabular">
              {temperatureC.toFixed(0)}°C
            </span>
            <span className="text-[11px] text-text-muted">tuntuu {feelsLikeC.toFixed(0)}°</span>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-surface-base text-text-secondary border-border-subtle">
            Sisähalli
          </span>
        </div>
        {hasLightningAlert && (
          <span className="text-red-400 font-bold flex items-center gap-1 text-[11px]">
            <ShieldAlert className="w-3 h-3" />
            {lightningSafety?.status === 'danger'
              ? `Salama ${lightningSafety.nearestStrikeKm ?? '?'} km — 30/30`
              : `Salamoita lähellä (${lightningSafety?.nearestStrikeKm ?? '?'} km)`}
          </span>
        )}
        {precipitationMmh > 0.2 && !hasLightningAlert && (
          <span className="text-[11px] text-sky-300">Sade kyydillä {precipitationMmh.toFixed(1)} mm/h</span>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onOpenRadar}
      className={`relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-elevated/70 p-3.5 flex flex-col gap-2.5 cursor-pointer transition-all duration-200 hover:border-pitch/50 hover:bg-surface-elevated active:scale-[0.99] select-none shadow-xs group ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenRadar?.();
        }
      }}
      aria-label="Avaa sadetutka"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-extrabold text-base md:text-lg text-text-primary tracking-tight font-tabular">
            {temperatureC.toFixed(1)}°C
          </span>
          <span className="text-xs text-text-muted">
            (tuntuu {feelsLikeC.toFixed(1)}°C)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${turfClass}`}>
            {turfLabel}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-pitch group-hover:underline ml-1">
            <Radio className="w-3.5 h-3.5 text-pitch animate-pulse" />
            <span className="hidden sm:inline">Tutka</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <Wind className="w-3.5 h-3.5 text-text-muted" />
          <span>
            {windSpeedMs.toFixed(1)} m/s
            {windGustMs && windGustMs > windSpeedMs ? ` (puuskat ${windGustMs.toFixed(1)})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CloudRain className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-tabular font-medium">{precipitationMmh.toFixed(1)} mm/h</span>
        </div>
      </div>

      {(rainOnsetLabel || windAdvisoryBadge || hasLightningAlert || isCacheFallback) && (
        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-border-subtle/50 text-[11px]">
          {hasLightningAlert && (
            <span className="text-red-400 font-bold flex items-center gap-1 bg-red-950/30 px-2 py-0.5 rounded border border-red-500/30">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              {lightningSafety?.status === 'danger'
                ? `Salama ${lightningSafety.nearestStrikeKm ?? '?'} km — keskeytä ulkopeli`
                : `Salamoita ${lightningSafety?.nearestStrikeKm ?? '?'} km päässä`}
            </span>
          )}
          {rainOnsetLabel && <span className="text-sky-300 font-semibold">{rainOnsetLabel}</span>}
          {windAdvisoryBadge && (
            <span className="text-amber-300 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              {windAdvisoryBadge}
            </span>
          )}
          {isCacheFallback && (
            <span className="text-[10px] text-text-muted bg-surface-base px-1.5 py-0.5 rounded border border-border-subtle ml-auto">
              Välimuisti
            </span>
          )}
        </div>
      )}
    </div>
  );
};
