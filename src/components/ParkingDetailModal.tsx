import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Car, MapPin, Navigation, Clock, AlertTriangle, ShieldCheck, Compass } from 'lucide-react';
import { ParkingInfo } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { calculateParkingDiscTime } from '../lib/parking/parkingEaseEngine';

interface ParkingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  parking: ParkingInfo;
  venueName: string;
}

export const ParkingDetailModal: React.FC<ParkingDetailModalProps> = ({
  isOpen,
  onClose,
  parking,
  venueName
}) => {
  if (!parking) return null;

  const isTight = parking.easeScore === 'tight';
  const isModerate = parking.easeScore === 'moderate';

  const statusColor = isTight
    ? 'text-stoppage bg-stoppage/15 border-stoppage/30'
    : isModerate
    ? 'text-whistle bg-whistle/15 border-whistle/30'
    : 'text-pitch bg-pitch/15 border-pitch/30';

  const scoreLabel = isTight
    ? '🔴 Ahdas pysäköinti'
    : isModerate
    ? '🟡 Kohtalainen pysäköinti'
    : '🟢 Helppo pysäköidä';

  const discTime = calculateParkingDiscTime(new Date());
  const lat = parking.coordinates.lat;
  const lng = parking.coordinates.lng;

  // OpenStreetMap Bounding Box for embedded interactive map
  const delta = 0.004;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const openAppleMaps = () => {
    window.open(`https://maps.apple.com/?daddr=${lat},${lng}`, '_blank');
  };

  const openWaze = () => {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-lg rounded-3xl p-5 md:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Pysäköintiopas & Kartta</h3>
                  <p className="text-xs text-text-muted truncate max-w-[240px]">{venueName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Parking Ease Status Pill */}
            <div className={`flex items-center justify-between p-3 rounded-2xl border mb-4 ${statusColor}`}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{scoreLabel}</span>
                <span className="text-xs font-tabular opacity-80">(Indeksi: {parking.easeScoreValue}/100)</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-base/50">
                {parking.lotName}
              </span>
            </div>

            {/* Embedded Interactive OSM Map */}
            <div className="relative h-48 md:h-56 w-full rounded-2xl overflow-hidden border border-border-subtle mb-4 bg-surface-elevated">
              <iframe
                title="Pysäköintikartta"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={osmEmbedUrl}
                className="w-full h-full filter contrast-[0.95] dark:invert dark:hue-rotate-180"
              />
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-canvas/90 backdrop-blur-md border border-border-subtle text-[10px] text-text-secondary flex items-center gap-1 font-mono">
                <Compass className="w-3 h-3 text-pitch" />
                <span>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
              </div>
            </div>

            {/* Walking Distance & Kiekkokello Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Walking Distance Card */}
              <div className="p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary mb-1">
                  <MapPin className="w-4 h-4 text-pitch" />
                  <span>Kävelyetäisyys kentälle</span>
                </div>
                <div className="text-2xl font-black text-text-primary font-tabular">
                  {parking.walkingTimeMinutes} min
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Noin {parking.walkingDistanceMeters} metriä pääportille
                </div>
              </div>

              {/* Kiekkokello Card */}
              <div className="p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary mb-1">
                  <Clock className="w-4 h-4 text-whistle" />
                  <span>Kiekkokello (Tieliikennelaki)</span>
                </div>
                <div className="text-2xl font-black text-whistle font-tabular">
                  klo {discTime}
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  {parking.feeZone}
                </div>
              </div>
            </div>

            {/* Warnings & Notes */}
            {parking.warnings && parking.warnings.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-surface-elevated/40 border border-border-subtle mb-4">
                <div className="text-xs font-bold text-text-primary mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-whistle" />
                  <span>Huomioitavaa pysäköinnissä:</span>
                </div>
                <ul className="list-disc list-inside text-xs text-text-secondary space-y-1">
                  {parking.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Navigation Actions */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-text-muted flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-pitch" />
                <span>1-napin navigointi:</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openAppleMaps}
                  className="px-3 py-2 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold hover:border-pitch cursor-pointer"
                >
                  Apple Maps
                </button>
                <button
                  onClick={openWaze}
                  className="px-3 py-2 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold hover:border-pitch cursor-pointer"
                >
                  Waze
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={openGoogleMaps}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pitch text-text-inverse text-xs font-bold shadow-md shadow-pitch/20 hover:brightness-110 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
