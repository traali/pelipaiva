import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Car, AlertTriangle, CheckCircle2, Share2, Copy, MapPin, User, Home, Pencil } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { HomeLocation, MatchdayEvent, PlayerProfile } from '../types/matchday';
import { planFamilyLogistics } from '../lib/ai/localAiEngine';

interface FamilyLogisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
  homeLocation?: HomeLocation;
  onOpenHomeModal?: () => void;
}

export const FamilyLogisticsModal: React.FC<FamilyLogisticsModalProps> = ({
  isOpen,
  onClose,
  events,
  profiles,
  homeLocation,
  onOpenHomeModal
}) => {
  const [copied, setCopied] = useState(false);
  // Memoized: the mission graph is heavy and this modal re-renders on every
  // internal interaction while open (M-63/V63).
  const plan = useMemo(() => {
    if (!isOpen) {
      return {
        date: '',
        hasConflicts: false,
        conflictDetails: [] as string[],
        departureSchedule: [],
        summaryNarrative: '',
        whatsAppShareText: ''
      };
    }
    return planFamilyLogistics(events, profiles, undefined, homeLocation);
  }, [events, profiles, isOpen, homeLocation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plan.whatsAppShareText);
      setCopied(true);
    } catch {
      // Permission denied — leave silently non-copied rather than lie (M-08).
    }
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(plan.whatsAppShareText);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="family-logistics-title"
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-lg rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="family-logistics-title" className="text-lg font-black text-text-primary">Perheen Kyytiapuri</h3>
                  <p className="text-xs text-text-muted">
                    Pelipäivän logistiikka, siirtymiset ja kuskijako
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

            {/* Home Location Bar */}
            <div className="mb-3.5 p-2.5 rounded-2xl bg-surface-elevated border border-border-strong flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-pitch/15 text-pitch shrink-0">
                  <Home className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Lähtöpaikka:</span>
                  <span className="font-bold text-text-primary truncate block">
                    {homeLocation?.name || 'Lauttasaari'} <span className="font-normal text-text-secondary">({homeLocation?.address || 'Koti'})</span>
                  </span>
                </div>
              </div>
              {onOpenHomeModal && (
                <button
                  type="button"
                  onClick={onOpenHomeModal}
                  className="px-2.5 py-1 rounded-xl bg-surface border border-border-subtle hover:border-pitch text-pitch text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-all"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Muokkaa</span>
                </button>
              )}
            </div>

            {/* Conflict Warning Banner if needed */}
            {plan.hasConflicts && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-col gap-1.5 text-amber-500">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Päällekkäisyys havaittu perheen otteluissa!</span>
                </div>
                {plan.conflictDetails.map((c, i) => (
                  <p key={i} className="text-[11px] text-text-primary leading-relaxed pl-6">
                    {c}
                  </p>
                ))}
              </div>
            )}

            {/* Narrative Summary */}
            <div className="p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle mb-4 text-xs text-text-secondary leading-relaxed">
              {plan.summaryNarrative}
            </div>

            {/* Step-by-Step Departure Plan */}
            <div className="mb-5 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Aikataulu & Siirtymiset ({plan.date})
              </h4>

              {plan.departureSchedule.length > 0 ? (
                plan.departureSchedule.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface border border-border-strong flex items-start gap-3"
                  >
                    <div className="px-2 py-1 rounded-lg bg-pitch/15 text-pitch font-bold text-xs whitespace-nowrap">
                      klo {step.time}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                        <User className="w-3 h-3 text-pitch" />
                        <span>{step.childName}</span>
                        {step.driverRole && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            step.driverRole === 'oma-kyyti'
                              ? 'bg-pitch/20 text-pitch border border-pitch/30'
                              : 'bg-surface-elevated text-text-muted font-normal'
                          }`}>
                            {step.driverRole === 'oma-kyyti' ? 'Omatoiminen kulku' : `Kuski: ${step.driverRole}`}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5 font-medium">{step.action}</div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-radar" />
                        <span>{step.venueName}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-text-muted">
                  Ei otteluita valittuna päivänä.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Jaa perheen WhatsAppiin</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="py-2.5 px-4 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-bold flex items-center justify-center gap-2 hover:border-pitch cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-pitch" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopioitu!' : 'Kopioi'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
