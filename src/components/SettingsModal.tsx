import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sliders,
  AlertTriangle,
  Calendar,
  MessageSquarePlus,
  BrainCircuit,
  Shirt,
  Home,
  Share2,
  CalendarPlus,
  CheckCircle2,
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { ToggleSlider } from './ui/ToggleSlider';
import type { AppAiSettings } from '../lib/settings/useAppSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppAiSettings;
  onToggleSetting: (key: keyof AppAiSettings, value: boolean) => void;
  onOpenHomeLocation?: () => void;
  onOpenFamilyShare?: () => void;
  onOpenImport?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onToggleSetting,
  onOpenHomeLocation,
  onOpenFamilyShare,
  onOpenImport,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={springTactile.snappy}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border-strong bg-surface-base p-5 md:p-6 shadow-2xl z-10 scrollbar-thin"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 id="settings-modal-title" className="text-base font-black text-text-primary">
                  Asetukset & Älytoiminnot
                </h2>
                <p className="text-xs text-text-secondary">
                  Muokkaa ilmoituksia ja valinnaisia avustimia
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              aria-label="Sulje asetukset"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-5">
            {/* Human First Principle Banner */}
            <div className="p-3.5 rounded-2xl bg-surface-elevated/40 border border-border-subtle/80 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-pitch shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-text-primary block">
                  Ihmislähtöinen aikataulu ensin
                </span>
                <span className="text-text-secondary leading-relaxed mt-0.5 block">
                  Pelipäivä näyttää oletuksena vain selkeät ottelu- ja harjoitusajat ilman häiritseviä varoituksia. Voit kytkeä älykkäitä avustimia päälle tarpeesi mukaan.
                </span>
              </div>
            </div>

            {/* AI / Smart Assistant Sliders */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-muted px-1">
                Älykkäät apurit & ilmoitukset (Valinnaiset)
              </h3>

              <ToggleSlider
                id="toggle-conflicts"
                label="Päällekkäisyysvaroitukset"
                description="Ilmoita jos perheenjäsenten pelit menevät päällekkäin tai siirtymäaika kenttien välillä on liian tiukka."
                checked={settings.showConflictWarnings}
                onChange={(val) => onToggleSetting('showConflictWarnings', val)}
                icon={<AlertTriangle className="w-4 h-4" />}
              />

              <ToggleSlider
                id="toggle-advisories"
                label="Päivän tilannevaroitus"
                description="Näytä ruuhkaisina pelipäivinä automaattinen tilannekooste ja suositellut kuskitoimenpiteet."
                checked={settings.showScheduleAdvisories}
                onChange={(val) => onToggleSetting('showScheduleAdvisories', val)}
                icon={<Calendar className="w-4 h-4" />}
              />

              <ToggleSlider
                id="toggle-copilot"
                label="AI Aikatauluapuri (Kysy Pelipäivältä)"
                description="Avaa tekoälyavusteinen haku ja kalenteriassistentti valikossa vapaamuotoisia kysymyksiä varten."
                checked={settings.showCopilotAssistant}
                onChange={(val) => onToggleSetting('showCopilotAssistant', val)}
                icon={<MessageSquarePlus className="w-4 h-4" />}
              />

              <ToggleSlider
                id="toggle-tactical"
                label="Taktinen otteluennakko"
                description="Näytä ottelutilastoissa automaattinen vastustajan kuntokatsaus ja pelitapa-analyysi."
                checked={settings.showTacticalScout}
                onChange={(val) => onToggleSetting('showTacticalScout', val)}
                icon={<BrainCircuit className="w-4 h-4" />}
              />

              <ToggleSlider
                id="toggle-gear"
                label="Älykäs varusteopas"
                description="Näytä sääennusteen ja kenttäalustan mukainen kenkä- ja pukeutumissuositus ottelukortissa."
                checked={settings.showSmartGearAdvice}
                onChange={(val) => onToggleSetting('showSmartGearAdvice', val)}
                icon={<Shirt className="w-4 h-4" />}
              />
            </div>

            {/* Other Settings & Links */}
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-muted px-1">
                Logistiikka & Joukkueet
              </h3>

              {onOpenHomeLocation && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHomeLocation();
                  }}
                  className="w-full p-3 rounded-2xl bg-surface-elevated/50 hover:bg-surface-elevated border border-border-subtle flex items-center justify-between text-xs font-bold text-text-primary transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Home className="w-4 h-4 text-pitch" />
                    <span>Kotiosoite & Kulkuvälineet</span>
                  </div>
                  <span className="text-text-muted">➔</span>
                </button>
              )}

              {onOpenFamilyShare && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFamilyShare();
                  }}
                  className="w-full p-3 rounded-2xl bg-surface-elevated/50 hover:bg-surface-elevated border border-border-subtle flex items-center justify-between text-xs font-bold text-text-primary transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Share2 className="w-4 h-4 text-pitch" />
                    <span>Perhejako & Varmuuskopiot</span>
                  </div>
                  <span className="text-text-muted">➔</span>
                </button>
              )}

              {onOpenImport && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenImport();
                  }}
                  className="w-full p-3 rounded-2xl bg-surface-elevated/50 hover:bg-surface-elevated border border-border-subtle flex items-center justify-between text-xs font-bold text-text-primary transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarPlus className="w-4 h-4 text-pitch" />
                    <span>Tuo uusi joukkue tai kalenteri</span>
                  </div>
                  <span className="text-text-muted">➔</span>
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-border-subtle flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-pitch text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              Valmis
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
