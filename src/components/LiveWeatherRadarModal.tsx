import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Radio,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Info,
  MapPin
} from 'lucide-react';
import { Coordinates } from '../types/matchday';
import {
  RadarSatelliteLayer,
  WEATHER_IMAGERY_LAYERS,
  buildImageryUrl,
  getImageryLoopTimestamps
} from '../lib/weather/radarSatelliteEngine';
import { springTactile } from '../lib/motion/springs';

interface LiveWeatherRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: Coordinates;
  venueName: string;
}

export const LiveWeatherRadarModal: React.FC<LiveWeatherRadarModalProps> = ({
  isOpen,
  onClose,
  coordinates,
  venueName
}) => {
  const [selectedLayer, setSelectedLayer] = useState<RadarSatelliteLayer>('fmi_rain_radar');
  const [frames, setFrames] = useState(getImageryLoopTimestamps());
  const [currentFrameIndex, setCurrentFrameIndex] = useState(frames.length - 1);
  const [isPlaying, setIsPlaying] = useState(true);

  // Refresh timestamps every 60s — only while the modal is actually open
  // (M-24/V48: the interval previously ran for every mounted card, forever).
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setFrames(getImageryLoopTimestamps());
    }, 60000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Animation Loop Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && isOpen) {
      interval = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
      }, 900);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isOpen, frames.length]);

  if (!isOpen) return null;

  const currentFrame = frames[currentFrameIndex] || frames[frames.length - 1] || { label: 'Nyt', date: new Date() };
  const layerInfo = WEATHER_IMAGERY_LAYERS[selectedLayer];
  const imageUrl = buildImageryUrl(selectedLayer, coordinates, currentFrame.date);

  // OSM base map for backdrop
  const delta = 0.45;
  const minLat = coordinates.lat - delta;
  const maxLat = coordinates.lat + delta;
  const minLng = coordinates.lng - (delta * 1.8);
  const maxLng = coordinates.lng + (delta * 1.8);
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-canvas/85 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          transition={springTactile.gentle}
          className="liquid-glass relative w-full max-w-2xl rounded-3xl p-5 md:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-radar/15 text-radar">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>Live Sääkuva & Tutka</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pitch/15 text-pitch border border-pitch/30">
                    Tuore data ({layerInfo.refreshIntervalMinutes} min)
                  </span>
                </h3>
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-pitch" />
                  <span className="truncate max-w-[260px]">{venueName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Layer Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {(
              [
                { id: 'fmi_rain_radar', label: '🌧️ FMI Sadetutka' },
                { id: 'eumetsat_fog', label: '🛰️ EUMETSAT Sumu & Pilvi' },
                { id: 'eumetsat_natural', label: '☁️ EUMETSAT Luonnollinen' },
                { id: 'fmi_lightning', label: '⚡ FMI Salamatutka' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedLayer(tab.id);
                  setCurrentFrameIndex(frames.length - 1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
                  selectedLayer === tab.id
                    ? 'bg-radar text-text-inverse border-radar shadow-sm shadow-radar/20 font-bold'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Visual Display Canvas */}
          <div className="relative h-64 md:h-80 w-full rounded-2xl overflow-hidden border border-border-subtle bg-surface-elevated mb-4">
            {/* OpenStreetMap Base Map */}
            <iframe
              title="Tutkakartta"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={osmEmbedUrl}
              className="w-full h-full filter contrast-[0.95] dark:invert dark:hue-rotate-180 opacity-60 pointer-events-none"
            />

            {/* Live Weather Overlay Image */}
            <img
              src={imageUrl}
              alt={layerInfo.title}
              key={`${selectedLayer}-${currentFrameIndex}`}
              className="absolute inset-0 w-full h-full object-cover mix-blend-multiply dark:mix-blend-screen transition-opacity duration-200"
              onError={(e) => {
                // Fallback styling for demo / test
                e.currentTarget.style.opacity = '0.7';
              }}
            />

            {/* Pitch Target Crosshair */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                <div className="h-6 w-6 rounded-full border-2 border-pitch bg-pitch/30 animate-ping absolute -inset-0" />
                <div className="h-6 w-6 rounded-full border-2 border-pitch bg-pitch/60 flex items-center justify-center text-[10px] text-text-inverse font-bold shadow-lg">
                  ⚽
                </div>
              </div>
            </div>

            {/* Active Timestamp Badge */}
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-canvas/90 backdrop-blur-md border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-radar animate-pulse" />
              <span className="font-tabular font-bold">
                {currentFrame.date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[10px] text-text-muted">({currentFrame.label})</span>
            </div>

            {/* Provider Attribution Pill */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-canvas/90 backdrop-blur-md border border-border-subtle text-[10px] text-text-secondary font-medium">
              {layerInfo.provider}
            </div>
          </div>

          {/* Time Scrubber & Playback Controls */}
          <div className="p-3 rounded-2xl bg-surface-elevated/70 border border-border-subtle mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-xl bg-pitch text-text-inverse shadow-sm shadow-pitch/25 hover:brightness-110 cursor-pointer"
                title={isPlaying ? 'Pysäytä animaatio' : 'Toista animaatio'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setCurrentFrameIndex(frames.length - 1)}
                className="p-2 rounded-xl bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
                title="Siirry uusimpaan kuvaan"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Frame Step Indicator Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto justify-center">
              {frames.map((frame, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentFrameIndex(idx);
                    setIsPlaying(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-tabular transition-all cursor-pointer ${
                    currentFrameIndex === idx
                      ? 'bg-radar text-text-inverse font-bold shadow-sm'
                      : 'bg-surface-elevated text-text-muted hover:text-text-primary border border-border-subtle'
                  }`}
                >
                  {frame.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layer Description & Legend */}
          <div className="p-3.5 rounded-2xl bg-surface-elevated/40 border border-border-subtle text-xs text-text-secondary flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-text-primary">
              <Info className="w-4 h-4 text-radar shrink-0" />
              <span>{layerInfo.description}</span>
            </div>
            <div className="text-[11px] text-text-muted bg-surface-base/60 p-2 rounded-xl border border-border-subtle">
              <strong>Selite:</strong> {layerInfo.legendText}
            </div>
          </div>

          {/* Footer Action */}
          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-pitch" />
              Päivittyy automaattisesti 5 minuutin välein
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-bold hover:border-pitch cursor-pointer"
            >
              Sulje
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
