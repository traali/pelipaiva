import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Check } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { db } from '../lib/storage/db';
import { VenueInfo } from '../types/matchday';

interface VenueCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVenue: VenueInfo;
  onSaved: (updatedVenue: VenueInfo) => void;
}

export const VenueCorrectionModal: React.FC<VenueCorrectionModalProps> = ({
  isOpen,
  onClose,
  currentVenue,
  onSaved
}) => {
  const [venueName, setVenueName] = useState(currentVenue.name);
  const [fieldNumber, setFieldNumber] = useState('');
  const [isIndoor, setIsIndoor] = useState(currentVenue.isIndoor);
  const [surface, setSurface] = useState(currentVenue.surface);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedQuery = currentVenue.name.toLowerCase().trim();
    const finalName = fieldNumber.trim() ? `${venueName.trim()} (${fieldNumber.trim()})` : venueName.trim();
    const updated: VenueInfo = {
      ...currentVenue,
      name: finalName,
      isIndoor,
      surface
    };

    // Save to local IndexedDB venuePins store
    await db.venuePins.put({
      normalizedQuery,
      venueName: updated.name,
      lat: updated.coordinates.lat,
      lng: updated.coordinates.lng,
      isIndoor: updated.isIndoor,
      surface: updated.surface,
      savedAt: new Date().toISOString()
    });

    setIsSaved(true);
    onSaved(updated);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
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
            className="liquid-glass relative w-full max-w-md rounded-3xl p-6 shadow-2xl z-10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Korjaa kentän tiedot</h3>
                  <p className="text-xs text-text-muted">Tallentuu pysyvästi omaan laitteeseesi</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Kentän virallinen nimi tai lempinimi *
                </label>
                <input
                  type="text"
                  required
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch"
                  placeholder="esim. Töölön Pallokenttä 6 TN (Bubu)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Kenttänumero / lohko (valinnainen)
                </label>
                <input
                  type="text"
                  value={fieldNumber}
                  onChange={(e) => setFieldNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch"
                  placeholder="esim. Kenttä 2 tai Lohko B"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Alusta</label>
                  <select
                    value={surface}
                    onChange={(e) => setSurface(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                  >
                    <option value="artificial_turf_3g">Tekonurmi (3G/4G)</option>
                    <option value="natural_grass">Luonnonnurmi</option>
                    <option value="indoor_parquet">Sisäparketti / Taraflex</option>
                    <option value="indoor_turf">Sisähalli tekonurmi</option>
                    <option value="sand">Hiekkakenttä</option>
                    <option value="ice">Jää</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Tila</label>
                  <select
                    value={isIndoor ? 'true' : 'false'}
                    onChange={(e) => setIsIndoor(e.target.value === 'true')}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                  >
                    <option value="false">Ulkokenttä</option>
                    <option value="true">Sisähalli / Halli</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 w-full py-2.5 px-4 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-pitch/20 hover:brightness-110 cursor-pointer"
              >
                {isSaved ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                <span>{isSaved ? 'Tallennettu laitteelle!' : 'Tallenna kentän korjaus'}</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
