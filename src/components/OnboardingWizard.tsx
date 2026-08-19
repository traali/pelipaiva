import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  ShieldCheck,
  Zap,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowRight,
  Tv
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';

interface OnboardingWizardProps {
  onStartDemo: () => void;
  onOpenImportModal: () => void;
}

type GuidePlatform = 'nimenhuuto' | 'myclub' | 'jopox' | 'torneopal';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onStartDemo,
  onOpenImportModal
}) => {
  const [activeGuide, setActiveGuide] = useState<GuidePlatform>('nimenhuuto');

  return (
    <div className="min-h-screen bg-canvas text-text-primary px-4 py-8 md:py-12 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header Badge & Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springTactile.snappy}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pitch/15 text-pitch border border-pitch/30 text-xs font-bold uppercase tracking-wider mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suomalaisen urheiluperheen tilannekeskus</span>
          </motion.div>

          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={springTactile.squishy}
            className="text-3xl md:text-5xl font-black tracking-tight text-text-primary mb-3"
          >
            Tervetuloa <span className="text-pitch">Pelipäivään</span>
          </motion.h1>

          <p className="text-sm md:text-base text-text-secondary max-w-xl mx-auto">
            Kaikki ottelusi, reaaliaikainen kenttäsää, FMI-salamavahti, pysäköintivyöhykkeet ja
            Nappisvahti-varustesuositus yhdessä selkeässä näkymässä.
          </p>
        </div>

        {/* 3 Core Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
          <div className="p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col justify-between">
            <div className="flex items-center gap-2 text-pitch mb-2 font-bold text-sm">
              <Calendar className="w-4 h-4" />
              <span>Kaikki pelit 1-näkymässä</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Yhdistä koko perheen ottelut Nimenhuudosta, MyClubista tai Jopoxista ilman usean sovelluksen selailua.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col justify-between">
            <div className="flex items-center gap-2 text-radar mb-2 font-bold text-sm">
              <Zap className="w-4 h-4" />
              <span>Sää, Nappis & Parkki</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              FMI:n mikroilmastoennuste, 30/30-salamaturvallisuus, LIPAS-kenttäprofiilit ja Parkki-pysäköintiopas.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col justify-between">
            <div className="flex items-center gap-2 text-pitch mb-2 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Yksityinen & Paikallinen</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Ei käyttäjätilejä, ei salasanoja, ei pilvitietokantaa. Tiedot tallentuvat vain puhelimeesi.
            </p>
          </div>
        </div>

        {/* Step-by-Step Guide Section */}
        <div className="liquid-glass rounded-3xl p-5 md:p-7 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base md:text-lg font-bold text-text-primary">
                Mistä löydän joukkueeni kalenterilinkin?
              </h2>
              <p className="text-xs text-text-secondary">
                Valitse käyttämäsi palvelu nähdäksesi 30 sekunnin ohjeen:
              </p>
            </div>
            <Info className="w-5 h-5 text-text-muted shrink-0" />
          </div>

          {/* Platform Switcher Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
            {[
              { id: 'nimenhuuto', name: '🔵 Nimenhuuto' },
              { id: 'myclub', name: '🟢 MyClub' },
              { id: 'jopox', name: '🟠 Jopox' },
              { id: 'torneopal', name: '🔴 Torneopal' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveGuide(tab.id as GuidePlatform)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                  activeGuide === tab.id
                    ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Active Guide Content */}
          <div className="p-4 rounded-2xl bg-surface-elevated/50 border border-border-subtle/70 text-xs text-text-secondary">
            {activeGuide === 'nimenhuuto' && (
              <div className="flex flex-col gap-2.5">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-pitch" />
                  <span>Nimenhuuto.com iCal-linkin kopiointi:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Kirjaudu joukkueesi Nimenhuuto-sivulle puhelimella tai tietokoneella.</li>
                  <li>Mene välilehdelle <strong>"Kalenteri"</strong>.</li>
                  <li>
                    Sivun alalaidasta tai valikosta valitse <strong>"Tilaa kalenteri omaan kalenterisovellukseen"</strong>.
                  </li>
                  <li>
                    Kopioi <strong>iCal / .ics -osoite</strong> (alkaa <code className="px-1 py-0.5 rounded bg-surface-elevated text-pitch font-mono">https://nimenhuuto.com/calendar/ical/...</code>).
                  </li>
                </ol>
              </div>
            )}

            {activeGuide === 'myclub' && (
              <div className="flex flex-col gap-2.5">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-pitch" />
                  <span>MyClub kalenterisynkronointi:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Kirjaudu MyClub-tilillesi selaimessa.</li>
                  <li>Avaa yläkulman valikosta <strong>"Omat tiedot"</strong> tai <strong>"Asetukset"</strong>.</li>
                  <li>Etsi kohta <strong>"Kalenterisynkronointi"</strong>.</li>
                  <li>Kopioi henkilökohtainen <strong>iCal-tilausosoite</strong>.</li>
                </ol>
              </div>
            )}

            {activeGuide === 'jopox' && (
              <div className="flex flex-col gap-2.5">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-pitch" />
                  <span>Jopox Pukukoppi iCal-syöte:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Avaa Jopox Pukukoppi -sivusto.</li>
                  <li>Siirry kohtaan <strong>"Kalenteri"</strong>.</li>
                  <li>Klikkaa <strong>"Tilaa kalenteri"</strong> tai iCal-kuvaketta.</li>
                  <li>Kopioi generoitu <code>.ics</code>-osoite.</li>
                </ol>
              </div>
            )}

            {activeGuide === 'torneopal' && (
              <div className="flex flex-col gap-2.5">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-pitch" />
                  <span>Torneopal / Turnaus-kalenteri:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Etsi turnauksen viralliselta tulossivulta joukkueesi otteluohjelma.</li>
                  <li>Klikkaa <strong>"Tilaa otteluohjelma kalenteriin (iCal)"</strong>.</li>
                  <li>Kopioi suora linkki.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Action Choice Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={springTactile.snappy}
            onClick={onOpenImportModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-pitch text-text-inverse font-bold text-sm shadow-xl shadow-pitch/25 hover:brightness-110 active:brightness-95 cursor-pointer"
          >
            <span>Syötä oma kalenteri</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={springTactile.snappy}
            onClick={onStartDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary font-bold text-sm hover:border-pitch cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-whistle" />
            <span>Kokeile esimerkkidatalla (1-klikkaus)</span>
          </motion.button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-text-muted pt-6 border-t border-border-subtle max-w-3xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Pelipäivä • 100% Local-First & GDPR Compliant</span>
        <span className="flex items-center gap-1">
          <Tv className="w-3.5 h-3.5 text-pitch" />
          Tukee Google Nest Hub -keittiönäyttöä
        </span>
      </footer>
    </div>
  );
};
