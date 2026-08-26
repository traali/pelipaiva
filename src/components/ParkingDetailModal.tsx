import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Car,
  MapPin,
  Navigation,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Compass,
  Zap,
  Ban,
  FileWarning,
  CheckCircle2,
  Ticket,
  Flame,
  Info
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'map' | 'spots' | 'signs' | 'fines'>('map');

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
            className="liquid-glass relative w-full max-w-xl rounded-3xl p-5 md:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto flex flex-col gap-4"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Pysäköintiopas & Kartta</h3>
                  <p className="text-xs text-text-muted truncate max-w-[260px]">{venueName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Parking Ease Status Banner */}
            <div className={`flex items-center justify-between p-3 rounded-2xl border ${statusColor}`}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{scoreLabel}</span>
                <span className="text-xs font-tabular opacity-80">(Indeksi: {parking.easeScoreValue}/100)</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-base/50">
                {parking.lotName}
              </span>
            </div>

            {/* Navigation Tabs (Kartta, Ruudut, Liikennemerkit, Sakkoriski) */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-elevated/70 border border-border-subtle overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'map'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Kartta & Opas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('spots')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'spots'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Ruudut ({parking.spots?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('signs')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'signs'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Liikennemerkit</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fines')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'fines'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileWarning className="w-3.5 h-3.5 text-whistle" />
                <span>Sakkoriski</span>
              </button>
            </div>

            {/* TAB 1: KARTTA & YLEISKUVA */}
            {activeTab === 'map' && (
              <div className="flex flex-col gap-4">
                {/* Embedded Interactive OSM Map */}
                <div className="relative h-48 md:h-56 w-full rounded-2xl overflow-hidden border border-border-subtle bg-surface-elevated">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="p-3.5 rounded-2xl bg-surface-elevated/40 border border-border-subtle">
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
              </div>
            )}

            {/* TAB 2: RUUDUT & P-ALUEET (Missä ovat ruudut) */}
            {activeTab === 'spots' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">
                  Kentän pysäköintiruutujen ja alueiden tyypit, rajoitukset ja kävelymatkat kentän pääportille:
                </p>

                <div className="flex flex-col gap-2.5">
                  {parking.spots && parking.spots.length > 0 ? (
                    parking.spots.map((spot) => (
                      <div
                        key={spot.id}
                        className={`p-3.5 rounded-2xl border flex flex-col gap-1.5 transition-all ${
                          spot.type === 'no_parking'
                            ? 'bg-stoppage/10 border-stoppage/30'
                            : spot.isRecommended
                            ? 'bg-pitch/10 border-pitch/40'
                            : 'bg-surface-elevated/70 border-border-subtle'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {spot.type === 'no_parking' ? (
                              <Ban className="w-4 h-4 text-stoppage shrink-0" />
                            ) : spot.type === 'ev' ? (
                              <Zap className="w-4 h-4 text-pitch shrink-0" />
                            ) : spot.type === 'accessible' ? (
                              <span className="text-base shrink-0">♿</span>
                            ) : (
                              <Car className="w-4 h-4 text-pitch shrink-0" />
                            )}
                            <span className="text-xs font-bold text-text-primary truncate">
                              {spot.name}
                            </span>
                          </div>

                          {spot.isRecommended && (
                            <span className="px-2 py-0.5 rounded-full bg-pitch/20 text-pitch text-[10px] font-black shrink-0">
                              ⭐ Suositeltu
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-text-secondary">
                          <span>{spot.restrictionText}</span>
                          {spot.capacityEstimated && (
                            <span className="font-tabular font-semibold">
                              ~{spot.capacityEstimated} ruutua
                            </span>
                          )}
                        </div>

                        {spot.type !== 'no_parking' && (
                          <div className="flex items-center gap-3 pt-1 border-t border-border-subtle/40 text-[11px] text-text-muted">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-pitch" />
                              <span>{spot.walkingTimeMinutes} min kävely</span>
                            </span>
                            {spot.discRequired && (
                              <span className="flex items-center gap-1 text-whistle font-semibold">
                                <Clock className="w-3 h-3" />
                                <span>Kiekko ({spot.maxHours}h)</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-2xl bg-surface-elevated text-xs text-text-muted text-center">
                      Ei erillisiä ruututietoja tälle kentälle.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: LIIKENNEMERKIT (Missä ovat liikennemerkit ja säännöt) */}
            {activeTab === 'signs' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">
                  Alueella voimassa olevat viralliset tieliikennemerkit ja vyöhykemaksut:
                </p>

                <div className="flex flex-col gap-2.5">
                  {parking.trafficSigns && parking.trafficSigns.length > 0 ? (
                    parking.trafficSigns.map((sign, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-surface-elevated/80 border border-border-subtle flex items-start gap-3"
                      >
                        <div className="p-2 rounded-xl bg-surface border border-border-subtle shrink-0">
                          {sign.iconType === 'no_parking' ? (
                            <Ban className="w-5 h-5 text-stoppage" />
                          ) : sign.iconType === 'payment' ? (
                            <Ticket className="w-5 h-5 text-pitch" />
                          ) : sign.iconType === 'ev' ? (
                            <Zap className="w-5 h-5 text-pitch" />
                          ) : (
                            <Clock className="w-5 h-5 text-whistle" />
                          )}
                        </div>

                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.2 rounded bg-surface text-[10px] font-black font-mono text-text-secondary border border-border-subtle">
                              {sign.code}
                            </span>
                            <span className="text-xs font-bold text-text-primary">
                              {sign.name}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {sign.description}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-2xl bg-surface-elevated text-xs text-text-muted text-center">
                      Ei liikennemerkkitietoja.
                    </div>
                  )}

                  {parking.easyParkZoneCode && (
                    <div className="p-3 rounded-2xl bg-surface border border-border-subtle flex items-center justify-between text-xs">
                      <span className="font-bold text-text-primary">📱 EasyPark / ParkMan aluekoodi:</span>
                      <span className="font-mono font-black text-pitch px-2 py-0.5 rounded bg-pitch/15">
                        {parking.easyParkZoneCode}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: SAKKORISKI & VALVONTA (Miten tulee sakkoja & vältä ne) */}
            {activeTab === 'fines' && (
              <div className="flex flex-col gap-3.5">
                {/* Fine Risk Score Card */}
                {parking.fineRisk && (
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between ${
                      parking.fineRisk.riskLevel === 'high'
                        ? 'bg-stoppage/15 border-stoppage/40'
                        : parking.fineRisk.riskLevel === 'moderate'
                        ? 'bg-whistle/15 border-whistle/40'
                        : 'bg-pitch/15 border-pitch/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="text-sm font-black">{parking.fineRisk.riskLabel}</div>
                        <div className="text-xs opacity-90">{parking.fineRisk.fineType}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black font-tabular">{parking.fineRisk.standardFineAmountEur} €</div>
                      <div className="text-[10px] opacity-80 uppercase tracking-wider font-bold">Virhemaksu</div>
                    </div>
                  </div>
                )}

                {/* Critical Pitfalls (Miten tulee sakkoja) */}
                {parking.fineRisk?.criticalPitfalls && (
                  <div className="p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-whistle">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Yleisimmät syyt sakolle tällä kentällä:</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-text-secondary pl-1">
                      {parking.fineRisk.criticalPitfalls.map((pitfall, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-stoppage font-black">✕</span>
                          <span>{pitfall}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prevention Checklist */}
                {parking.fineRisk?.preventionChecklist && (
                  <div className="p-3.5 rounded-2xl bg-pitch/10 border border-pitch/30 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-pitch">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Vältä sakot näin:</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-text-primary pl-1">
                      {parking.fineRisk.preventionChecklist.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-pitch shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Actions Footer */}
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

