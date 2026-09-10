import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert, Radio, AlertTriangle, Play, Pause, ChevronLeft, ChevronRight, Wind, CloudRain } from 'lucide-react';
import { Coordinates, WeatherCondition } from '../types/matchday';

interface WeatherSatelliteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  venueCoords: Coordinates;
  venueName?: string;
  weather?: WeatherCondition;
}

type LayerId = 'fmi_rain_radar' | 'eumetsat_natural' | 'fmi_lightning';

export const WeatherSatelliteDrawer: React.FC<WeatherSatelliteDrawerProps> = ({
  isOpen,
  onClose,
  venueCoords,
  venueName = 'Pelipaikka',
  weather,
}) => {
  const [activeLayer, setActiveLayer] = useState<LayerId>('fmi_rain_radar');
  const [frameIndex, setFrameIndex] = useState<number>(4);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Compute 50km BBOX with 1.8 deltaLng aspect compensation for 60°N Finnish latitude
  const deltaLat = 50 / 111.32;
  const deltaLng = deltaLat * 1.8;
  const minLng = Math.round((venueCoords.lng - deltaLng) * 10000) / 10000;
  const minLat = Math.round((venueCoords.lat - deltaLat) * 10000) / 10000;
  const maxLng = Math.round((venueCoords.lng + deltaLng) * 10000) / 10000;
  const maxLat = Math.round((venueCoords.lat + deltaLat) * 10000) / 10000;
  const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;

  // Generate 6 radar timeline steps (past 50 min to current)
  const now = new Date();
  const frames = [50, 40, 30, 20, 10, 0].map((minsAgo) => {
    const d = new Date(now.getTime() - minsAgo * 60 * 1000);
    // Align to 5-minute intervals for FMI WMS
    const roundedMins = Math.floor(d.getUTCMinutes() / 5) * 5;
    d.setUTCMinutes(roundedMins, 0, 0);
    return {
      label: minsAgo === 0 ? 'Nyt' : `-${minsAgo} min`,
      timeIso: d.toISOString(),
    };
  });

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !isOpen) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, isOpen, frames.length]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fallbackFrame = { label: 'Nyt', timeIso: new Date().toISOString() };
  const currentFrame = frames[frameIndex] ?? frames[0] ?? fallbackFrame;
  const wmsUrl =
    activeLayer === 'fmi_rain_radar'
      ? `https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Radar:suomi_dbz_eureffin&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&WIDTH=768&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${encodeURIComponent(currentFrame.timeIso)}`
      : activeLayer === 'eumetsat_natural'
      ? `https://eumetview.eumetsat.int/geoserv/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=msg_fes:rgb_natural&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&WIDTH=768&HEIGHT=512&FORMAT=image/jpeg&TIME=${encodeURIComponent(currentFrame.timeIso)}`
      : `https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Observation:lightning&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&WIDTH=768&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${encodeURIComponent(currentFrame.timeIso)}`;

  const lightningAlert = weather?.lightningSafety;
  const isDanger = lightningAlert?.status === 'danger';
  const isWatch = lightningAlert?.status === 'watch';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Slide-over panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg h-full bg-surface-base border-l border-border-subtle shadow-2xl flex flex-col z-10 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Sää ja sadetutka: ${venueName}`}
        >
          {/* Header */}
          <div className="p-4 md:p-5 border-b border-border-subtle flex items-center justify-between bg-surface-elevated/80 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-text-primary leading-tight">
                  {venueName}
                </h2>
                <p className="text-xs text-text-muted">Ilmatieteen laitos (FMI) Sadetutka & Sää</p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Sulje sääikkuna"
              className="p-2 rounded-xl hover:bg-surface-base text-text-muted hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
            {/* Lightning Safety Warning Banner */}
            {isDanger && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <div className="font-extrabold text-sm text-red-300">SALAMAVAARA (30/30-sääntö)</div>
                  <div className="text-xs mt-1 text-red-200">
                    {lightningAlert?.alertMessage ||
                      'Salama havaittu alle 10 km säteellä kentästä. Keskeytä ulkopeli ja siirry sisätiloihin.'}
                  </div>
                </div>
              </div>
            )}

            {isWatch && (
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold">Ukkosvalmius: </span>
                  Salamointia havaittu 10–20 km etäisyydellä. Seuraa tutkakuvaa ja taivasta.
                </div>
              </div>
            )}

            {/* Weather Metrics Strip */}
            {weather && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-semibold text-text-muted">Lämpötila</span>
                  <span className="text-base font-extrabold text-text-primary font-tabular mt-0.5">
                    {weather.temperatureC.toFixed(1)}°C
                  </span>
                  <span className="text-[10px] text-text-muted">(tuntuu {weather.feelsLikeC.toFixed(1)}°)</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-semibold text-text-muted">Kentän pito</span>
                  <span className="text-xs font-bold text-text-primary mt-1">
                    {weather.turfConditionLabelFi || 'Kuiva tekonurmi'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-semibold text-text-muted">Tuuli</span>
                  <span className="text-base font-extrabold text-text-primary font-tabular mt-0.5 flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-text-muted" />
                    {weather.windSpeedMs.toFixed(1)} <span className="text-xs font-normal">m/s</span>
                  </span>
                  {weather.windGustMs > 0 && (
                    <span className="text-[10px] text-text-muted">puuskat {weather.windGustMs.toFixed(1)}</span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border-subtle flex flex-col">
                  <span className="text-[11px] font-semibold text-text-muted">Sadesumma</span>
                  <span className="text-base font-extrabold text-sky-400 font-tabular mt-0.5 flex items-center gap-1">
                    <CloudRain className="w-3.5 h-3.5" />
                    {weather.precipitationMmh.toFixed(1)} <span className="text-xs font-normal">mm/h</span>
                  </span>
                </div>
              </div>
            )}

            {/* Layer Selection Pills */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-elevated/50 border border-border-subtle">
              <button
                type="button"
                onClick={() => setActiveLayer('fmi_rain_radar')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLayer === 'fmi_rain_radar'
                    ? 'bg-pitch text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                🌧️ Sadetutka
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer('eumetsat_natural')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLayer === 'eumetsat_natural'
                    ? 'bg-pitch text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                🛰️ Satelliitti
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer('fmi_lightning')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLayer === 'fmi_lightning'
                    ? 'bg-pitch text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                ⚡ Salamaniskut
              </button>
            </div>

            {/* Interactive Radar Map Canvas */}
            <div className="relative rounded-2xl overflow-hidden border border-border-subtle aspect-4/3 bg-slate-950 flex items-center justify-center shadow-inner group">
              {/* Background Geographic Basemap Layer */}
              <div
                className="absolute inset-0 opacity-40 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://tile.openstreetmap.org/11/${Math.floor(((venueCoords.lng + 180) / 360) * Math.pow(2, 11))}/${Math.floor(((1 - Math.log(Math.tan((venueCoords.lat * Math.PI) / 180) + 1 / Math.cos((venueCoords.lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, 11))}.png')`,
                }}
              />

              {/* Dynamic WMS Overlay Tile */}
              <img
                src={wmsUrl}
                alt="FMI WMS Tutkakerros"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
                onError={(e) => {
                  // If WMS fails due to network, show graceful fallback badge
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              {/* Pitch Location Crosshair / Marker Pin */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10">
                <div className="relative flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-pitch/20 border-2 border-pitch animate-ping absolute" />
                  <div className="w-3.5 h-3.5 rounded-full bg-pitch border-2 border-white shadow-md relative" />
                </div>
                <div className="mt-1 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-bold text-white shadow-sm whitespace-nowrap border border-white/20">
                  {venueName}
                </div>
              </div>

              {/* 10km Safety Circle Legend in Corner */}
              <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] font-medium text-gray-300 border border-white/10 z-10">
                Säde: ~50 km • Keskipiste: Kenttä
              </div>

              {/* Current Frame Timestamp Badge */}
              <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-xs font-bold text-white border border-white/15 z-10 font-tabular">
                {currentFrame.label}
              </div>
            </div>

            {/* Radar Player Playback Controls */}
            <div className="p-3 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    aria-label={isPlaying ? 'Pysäytä animaatio' : 'Toista animaatio'}
                    className="p-2 rounded-xl bg-pitch text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setFrameIndex((prev) => (prev === 0 ? frames.length - 1 : prev - 1));
                    }}
                    aria-label="Edellinen ruutu"
                    className="p-2 rounded-xl hover:bg-surface-base text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setFrameIndex((prev) => (prev + 1) % frames.length);
                    }}
                    aria-label="Seuraava ruutu"
                    className="p-2 rounded-xl hover:bg-surface-base text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-semibold text-text-muted">
                  Kuva {frameIndex + 1} / {frames.length}
                </span>
              </div>

              {/* Timeline scrub dots */}
              <div className="flex items-center gap-1.5 w-full pt-1">
                {frames.map((frame, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setFrameIndex(idx);
                    }}
                    className={`flex-1 h-2 rounded-full transition-all cursor-pointer ${
                      idx === frameIndex ? 'bg-pitch scale-y-125' : 'bg-border-subtle hover:bg-text-muted'
                    }`}
                    title={frame.label}
                    aria-label={frame.label}
                  />
                ))}
              </div>
            </div>

            {/* Pro Advice & Safety Legend */}
            <div className="p-3.5 rounded-2xl bg-surface-elevated/40 border border-border-subtle/60 text-xs text-text-secondary space-y-1.5">
              <div className="font-bold text-text-primary flex items-center gap-1.5">
                <span>💡 Valmentajan & Katsomon Säätieto:</span>
              </div>
              <p className="leading-relaxed">
                {weather?.turfCondition === 'frozen'
                  ? 'Kenttä on jäinen tai kuurassa. Nappulakengät voivat olla vaarallisen liukkaat — suositellaan tekonurmiturffikenkiä (TF).'
                  : weather?.turfCondition === 'slick'
                  ? 'Märkä tekonurmi nopeuttaa pallon liukua. Maalivahdille suositellaan sadekäsineitä ja pelaajille pitosukkia.'
                  : 'Kuiva tekonurmi tarjoaa normaalin pidon ja vakaan pompun.'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
