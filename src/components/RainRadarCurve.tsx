import React from 'react';
import { WeatherCondition } from '../types/matchday';
import { CloudRain, Wind, Thermometer } from 'lucide-react';

interface RainRadarCurveProps {
  weather: WeatherCondition;
  isOutdoor: boolean;
}

export const RainRadarCurve: React.FC<RainRadarCurveProps> = ({ weather, isOutdoor }) => {
  if (!isOutdoor) {
    return (
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-surface-elevated text-pitch">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-text-primary">Sisäilmasto</div>
            <div className="text-[11px] text-text-secondary">Vakioitu hallilämpötila ~18-20°C</div>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-pitch/10 text-pitch font-medium border border-pitch/20">
          Kuiva alusta
        </span>
      </div>
    );
  }

  const rainPoints = weather.rainTimeline || [];

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-radar" />
          <span className="text-xs font-semibold text-text-primary">FMI Sadetutka & Mikroilmasto</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-tabular">
          <span className="flex items-center gap-1 text-text-primary font-bold">
            <Thermometer className="w-3.5 h-3.5 text-pitch" />
            {weather.temperatureC}°C
            <span className="text-text-muted font-normal text-[10px]">
              (Tuntuu {weather.feelsLikeC}°C)
            </span>
          </span>
          <span className="flex items-center gap-1 text-text-secondary">
            <Wind className="w-3.5 h-3.5 text-text-muted" />
            {weather.windSpeedMs} m/s
          </span>
        </div>
      </div>

      {/* Rain Curve Visualizer (SVG) */}
      <div className="relative h-14 w-full flex items-end justify-between gap-2 pt-2 border-b border-border-subtle/40">
        {rainPoints.map((pt, idx) => {
          const heightPercent = Math.min(100, Math.max(15, pt.precipitationMmh * 35));
          const timeLabel = new Date(pt.time).toLocaleTimeString('fi-FI', {
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
              <span className="text-[9px] text-radar font-bold font-tabular">
                {pt.precipitationMmh > 0 ? `${pt.precipitationMmh} mm` : '0 mm'}
              </span>
              <div
                style={{ height: `${heightPercent}%` }}
                className={`w-full rounded-t-md transition-all ${
                  pt.precipitationMmh > 0.5
                    ? 'bg-radar shadow-sm shadow-radar/30'
                    : 'bg-surface-elevated border border-border-subtle'
                }`}
              />
              <span className="text-[9px] text-text-muted font-tabular">{timeLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-secondary mt-2.5">
        <span>Sateen todennäköisyys: {weather.rainProbabilityPercent}%</span>
        <span
          className={`font-semibold capitalize ${
            weather.turfCondition === 'frozen'
              ? 'text-whistle'
              : weather.turfCondition === 'slick'
              ? 'text-radar'
              : 'text-pitch'
          }`}
        >
          Kentän pinta: {weather.turfCondition === 'frozen' ? 'Jäässä / Kova' : weather.turfCondition === 'slick' ? 'Liukas / Märkä' : 'Kuiva / Optimaalinen'}
        </span>
      </div>
    </div>
  );
};
