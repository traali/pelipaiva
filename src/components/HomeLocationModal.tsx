import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Home,
  MapPin,
  Navigation,
  CheckCircle2,
  Bike,
  Footprints,
  Car,
  Search,
  Loader2,
  Sparkles
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { HomeLocation } from '../types/matchday';
import {
  POPULAR_HOME_PRESETS,
  DEFAULT_HOME_LOCATION,
  geocodeAddress,
  getCurrentGpsLocation
} from '../lib/storage/homeLocation';

interface HomeLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHome: HomeLocation;
  onSaveHome: (home: HomeLocation) => Promise<void> | void;
}

export const HomeLocationModal: React.FC<HomeLocationModalProps> = ({
  isOpen,
  onClose,
  currentHome,
  onSaveHome
}) => {
  const [name, setName] = useState(currentHome.name || 'Kotiosoite');
  const [address, setAddress] = useState(currentHome.address || '');
  const [coords, setCoords] = useState(currentHome.coordinates || DEFAULT_HOME_LOCATION.coordinates);
  const [maxWalk, setMaxWalk] = useState(currentHome.maxWalkingDistanceKm ?? 1.5);
  const [maxBike, setMaxBike] = useState(currentHome.maxCyclingDistanceKm ?? 5.0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setName(currentHome.name || 'Kotiosoite');
      setAddress(currentHome.address || '');
      setCoords(currentHome.coordinates || DEFAULT_HOME_LOCATION.coordinates);
      setMaxWalk(currentHome.maxWalkingDistanceKm ?? 1.5);
      setMaxBike(currentHome.maxCyclingDistanceKm ?? 5.0);
      setSearchQuery('');
      setSaveSuccess(false);
      setErrorMessage('');
    }
  }, [isOpen, currentHome]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelectPreset = (preset: (typeof POPULAR_HOME_PRESETS)[number]) => {
    setName(preset.name);
    setAddress(preset.address);
    setCoords(preset.coordinates);
    setErrorMessage('');
  };

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setIsGeocoding(true);
    setErrorMessage('');
    try {
      const hit = await geocodeAddress(searchQuery.trim());
      if (hit) {
        setCoords(hit);
        setAddress(searchQuery.trim());
        setName(searchQuery.trim().split(',')[0] || 'Koti');
        setSearchQuery('');
      } else {
        setErrorMessage('Osoitetta ei löytynyt kartalta. Kokeile tarkempaa katuosoitetta tai valitse alue alta.');
      }
    } catch {
      setErrorMessage('Osoitehaku epäonnistui.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseGps = async () => {
    setIsGpsLoading(true);
    setErrorMessage('');
    try {
      const gps = await getCurrentGpsLocation();
      if (gps) {
        setCoords(gps);
        setName('Nykyinen sijainti (GPS)');
        setAddress(`${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`);
      } else {
        setErrorMessage('GPS-sijaintia ei saatu. Varmista että olet sallinut selaimen sijaintiluvan.');
      }
    } catch {
      setErrorMessage('GPS-paikannus epäonnistui.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleSave = async () => {
    const updated: HomeLocation = {
      name: name.trim() || 'Kotiosoite',
      address: address.trim() || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      coordinates: coords,
      maxWalkingDistanceKm: maxWalk,
      maxCyclingDistanceKm: maxBike,
      defaultTransitMode: 'auto',
      updatedAt: new Date().toISOString()
    };

    try {
      await onSaveHome(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Tallennus epäonnistui');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-location-title"
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          transition={springTactile.gentle}
          className="liquid-glass relative w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto flex flex-col gap-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h3 id="home-location-title" className="text-base font-black text-text-primary">
                  Perheen kotiosoite & kulkumuodot
                </h3>
                <p className="text-xs text-text-muted">
                  Kaikki pelit eivät vaadi autoa — lähikentille kävellen tai pyörällä
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface-elevated text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Selection Card */}
          <div className="p-3.5 rounded-2xl bg-surface-elevated border border-pitch/40 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-pitch text-text-inverse shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-text-primary truncate">{name}</div>
                <div className="text-[11px] text-text-secondary truncate">{address || 'Koordinaatit asetettu'}</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-pitch/15 text-pitch text-[10px] font-bold shrink-0">
              Valittu
            </span>
          </div>

          {/* Address Search & GPS */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-pitch" />
              <span>Hae katuosoitetta tai kaupunginosaa:</span>
            </label>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAddress();
                  }
                }}
                placeholder="esim. Isokaari 1 Helsinki tai Mannerheimintie"
                className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-medium focus:outline-none focus:border-pitch"
              />
              <button
                type="button"
                onClick={handleSearchAddress}
                disabled={!searchQuery.trim() || isGeocoding}
                className="px-3.5 py-2 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0 shadow-xs"
              >
                {isGeocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Hae</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              <button
                type="button"
                onClick={handleUseGps}
                disabled={isGpsLoading}
                className="px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong hover:border-pitch text-text-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {isGpsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-pitch" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-pitch" />
                )}
                <span>📍 Käytä nykyistä sijaintia (GPS)</span>
              </button>
            </div>
          </div>

          {/* Quick Regional Presets */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-muted">
              Pikavalinnat alueille:
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {POPULAR_HOME_PRESETS.map((p) => {
                const isSelected = name === p.name || address === p.address;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-pitch text-text-inverse border-pitch shadow-xs'
                        : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-strong'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Transport Limits (Walk & Bike ranges) */}
          <div className="p-3.5 rounded-2xl bg-surface-elevated/80 border border-border-subtle flex flex-col gap-3">
            <div className="text-xs font-black text-text-primary flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pitch" />
              <span>Omatoimisen kulkemisen etäisyysrajat:</span>
            </div>

            {/* Walking Limit */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text-secondary flex items-center gap-1">
                  <Footprints className="w-3.5 h-3.5 text-pitch" />
                  <span>Kävelyetäisyys (enintään):</span>
                </span>
                <span className="font-black text-pitch">{maxWalk.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[0.8, 1.2, 1.5, 2.0, 2.5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxWalk(val)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      maxWalk === val
                        ? 'bg-pitch text-text-inverse border-pitch'
                        : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                    }`}
                  >
                    {val} km
                  </button>
                ))}
              </div>
            </div>

            {/* Cycling Limit */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text-secondary flex items-center gap-1">
                  <Bike className="w-3.5 h-3.5 text-pitch" />
                  <span>Pyöräilyetäisyys (enintään):</span>
                </span>
                <span className="font-black text-pitch">{maxBike.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[3.0, 4.0, 5.0, 6.5, 8.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxBike(val)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      maxBike === val
                        ? 'bg-pitch text-text-inverse border-pitch'
                        : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                    }`}
                  >
                    {val} km
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-text-muted flex items-start gap-1.5 pt-1 border-t border-border-subtle/60">
              <Car className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
              <span>
                Yli {maxBike.toFixed(1)} km matkat ja rankkasateet ohjataan automaattisesti autokyyteihin.
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Save Success */}
          {saveSuccess && (
            <div className="p-2.5 rounded-xl bg-pitch/20 border border-pitch text-pitch text-xs font-bold flex items-center gap-1.5 animate-bounce">
              <CheckCircle2 className="w-4 h-4" />
              <span>Kotiosoite tallennettu onnistuneesti!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-surface-elevated border border-border-strong text-text-secondary hover:text-text-primary text-xs font-bold cursor-pointer"
            >
              Peruuta
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 rounded-xl bg-pitch text-text-inverse text-xs font-black hover:brightness-110 cursor-pointer shadow-md shadow-pitch/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tallenna kotiosoite</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
