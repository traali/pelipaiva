import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  ShieldCheck,
  Zap,
  Sparkles,
  Info,
  CheckCircle2,
  QrCode,
  Tv,
  PlusCircle
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import type { SportType } from '../types/matchday';

interface OnboardingWizardProps {
  onStartDemo: () => void;
  onOpenImportModal: (initialSport?: SportType, initialTeamUrl?: string, initialTeamName?: string) => void;
  onOpenFamilyShare: () => void;
  onOpenSmartImport?: () => void;
  onQuickAddTeam: (playerName: string, teamName: string, sport: SportType, url: string) => Promise<void>;
}

type GuidePlatform = 'nimenhuuto' | 'myclub' | 'jopox' | 'torneopal';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onStartDemo,
  onOpenImportModal,
  onOpenFamilyShare,
  onOpenSmartImport,
  onQuickAddTeam
}) => {
  const [activeGuide, setActiveGuide] = useState<GuidePlatform>('nimenhuuto');
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState('Maija');

  const handleQuickAdd = async (name: string, team: string, sport: SportType, url: string) => {
    setIsAddingQuick(true);
    try {
      await onQuickAddTeam(name.trim() || 'Maija', team, sport, url);
    } finally {
      setIsAddingQuick(false);
    }
  };

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
            Ei käyttäjätilejä, ei pilvipalveluita. Kaikki ottelut, kenttäsää, FMI-salamavahti, pysäköinti ja varustesuositus yhdessä paikassa.
          </p>
        </div>

        {/* PRIMARY ACTION: Choose Sport / Quick Start */}
        <div className="liquid-glass rounded-3xl p-6 md:p-8 mb-8 border border-pitch/30 shadow-xl shadow-pitch/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-black text-text-primary flex items-center gap-2">
                <span>1. Aloita lisäämällä ensimmäinen joukkueesi</span>
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Valitse lajisi pika-asetuksella tai syötä oma kalenterilinkkisi:
              </p>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-pitch/10 text-pitch font-bold text-xs">
              100% Yksityinen
            </div>
          </div>

          {/* Player Assignment Bar */}
          <div className="mb-5 p-3.5 rounded-2xl bg-surface-elevated/80 border border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <span>👤 Kenelle lapselle / pelaajalle joukkue liitetään?</span>
              </label>
              <p className="text-[11px] text-text-muted">
                Voit lisätä useita eri joukkueita ja lajeja samalle lapselle.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={selectedPlayerName}
                onChange={(e) => setSelectedPlayerName(e.target.value)}
                placeholder="Pelaajan nimi"
                className="px-3 py-1.5 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-bold focus:outline-none focus:border-pitch w-32"
              />
              <div className="flex items-center gap-1">
                {['Maija', 'Eemil', 'Ville'].map((quickName) => (
                  <button
                    key={quickName}
                    type="button"
                    onClick={() => setSelectedPlayerName(quickName)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-all ${
                      selectedPlayerName === quickName
                        ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                        : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                    }`}
                  >
                    {quickName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {/* Football Option */}
            <div className="p-4 rounded-2xl bg-surface-elevated/90 border border-border-subtle hover:border-pitch transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-text-primary mb-1">
                  <span className="text-lg">⚽</span>
                  <span>Jalkapallo</span>
                </div>
                <p className="text-[11px] text-text-muted mb-3">
                  Palloliitto Tulospalvelu & iCal
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  disabled={isAddingQuick}
                  onClick={() =>
                    handleQuickAdd(
                      selectedPlayerName,
                      'Palloliitto 185085',
                      'football',
                      'https://tulospalvelu.palloliitto.fi/team/185085/info'
                    )
                  }
                  className="w-full py-2 px-2.5 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Valitse tiimi (185085)</span>
                </button>
                <button
                  onClick={() =>
                    onOpenImportModal('football', 'https://tulospalvelu.palloliitto.fi/team/185085/info', 'Jalkapallojoukkue')
                  }
                  className="w-full py-1.5 px-2 rounded-lg bg-surface text-text-secondary hover:text-text-primary text-[11px] font-medium border border-border-subtle cursor-pointer text-center"
                >
                  Muu Palloliitto / iCal...
                </button>
              </div>
            </div>

            {/* Floorball Option */}
            <div className="p-4 rounded-2xl bg-surface-elevated/90 border border-border-subtle hover:border-pitch transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-text-primary mb-1">
                  <span className="text-lg">🏑</span>
                  <span>Salibandy</span>
                </div>
                <p className="text-[11px] text-text-muted mb-3">
                  Salibandyliitto Tulospalvelu
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  disabled={isAddingQuick}
                  onClick={() =>
                    handleQuickAdd(
                      selectedPlayerName,
                      'Salibandy 25301',
                      'floorball',
                      'https://tulospalvelu.salibandy.fi/team/25301/info'
                    )
                  }
                  className="w-full py-2 px-2.5 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Valitse tiimi (25301)</span>
                </button>
                <button
                  onClick={() =>
                    onOpenImportModal('floorball', 'https://tulospalvelu.salibandy.fi/team/25301/info', 'Salibandyjoukkue')
                  }
                  className="w-full py-1.5 px-2 rounded-lg bg-surface text-text-secondary hover:text-text-primary text-[11px] font-medium border border-border-subtle cursor-pointer text-center"
                >
                  Muu Salibandyliitto...
                </button>
              </div>
            </div>

            {/* Basketball Option */}
            <div className="p-4 rounded-2xl bg-surface-elevated/90 border border-border-subtle hover:border-pitch transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-text-primary mb-1">
                  <span className="text-lg">🏀</span>
                  <span>Koripallo</span>
                </div>
                <p className="text-[11px] text-text-muted mb-3">
                  Basket.fi Tulospalvelu
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  disabled={isAddingQuick}
                  onClick={() =>
                    handleQuickAdd(
                      selectedPlayerName,
                      'Basket.fi 5756346',
                      'basketball',
                      'https://tulospalvelu.basket.fi/team/5756346/info'
                    )
                  }
                  className="w-full py-2 px-2.5 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Valitse tiimi (5756346)</span>
                </button>
                <button
                  onClick={() =>
                    onOpenImportModal('basketball', 'https://tulospalvelu.basket.fi/team/5756346/info', 'Koripallojoukkue')
                  }
                  className="w-full py-1.5 px-2 rounded-lg bg-surface text-text-secondary hover:text-text-primary text-[11px] font-medium border border-border-subtle cursor-pointer text-center"
                >
                  Muu Basket.fi...
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Actions: Smart Import, Custom .ics or QR Family Share */}
          <div className="flex flex-col gap-2.5 pt-4 border-t border-border-subtle">
            {onOpenSmartImport && (
              <button
                type="button"
                onClick={onOpenSmartImport}
                className="w-full py-3 px-4 rounded-xl bg-pitch/15 border border-pitch/30 text-pitch font-bold text-xs hover:bg-pitch hover:text-text-inverse flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>✨ Äly-tuonti: Liitä WhatsApp-viesti, Excel tai kuvakaappaus</span>
              </button>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={() => onOpenImportModal()}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-bold text-xs hover:border-pitch flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-pitch" />
                <span>Syötä Nimenhuuto / MyClub / Jopox -linkki</span>
              </button>

              <button
                onClick={onOpenFamilyShare}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-bold text-xs hover:border-pitch flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-whistle" />
                <span>Skannaa toisen vanhemman QR-koodi</span>
              </button>
            </div>
          </div>
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
                  <span>MyClub iCal-linkin kopiointi:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Avaa MyClub selaimessa tai sovelluksessa ja mene <strong>Omat tapahtumat / Kalenteri</strong>.</li>
                  <li>Klikkaa <strong>"Synkronoi kalenteri"</strong> tai kalenterikuvaketta.</li>
                  <li>Valitse <strong>"Tilaa henkilökohtainen iCal-syöte"</strong> ja kopioi osoite.</li>
                </ol>
              </div>
            )}

            {activeGuide === 'jopox' && (
              <div className="flex flex-col gap-2.5">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-pitch" />
                  <span>Jopox iCal-linkin kopiointi:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Mene seuran Jopox Pukukoppi -näkymään.</li>
                  <li>Valitse kalenterisivulta <strong>"Vie tapahtumat kalenteriin"</strong>.</li>
                  <li>Kopioi generoitu <code>.ics</code> URL-linkki.</li>
                </ol>
              </div>
            )}

            {activeGuide === 'torneopal' && (
              <div className="flex flex-col gap-2.5">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-pitch" />
                  <span>Palloliitto / Salibandy / Torneopal joukkuesivu:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Avaa lajiliittosi tulospalvelu (esim. tulospalvelu.palloliitto.fi tai tulospalvelu.salibandy.fi).</li>
                  <li>Hae lapsesi tai joukkueesi nimellä ja avaa <strong>joukkuesivu</strong>.</li>
                  <li>Kopioi selaimen osoitepalkin URL (esim. <code>https://tulospalvelu.palloliitto.fi/team/185085/info</code>).</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Demo Fallback Option */}
        <div className="text-center mb-6">
          <p className="text-xs text-text-muted mb-2">Haluatko vain tutustua sovellukseen ennen tietojen syöttämistä?</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={springTactile.snappy}
            onClick={onStartDemo}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-elevated border border-border-subtle text-text-secondary hover:text-text-primary font-medium text-xs hover:border-border-strong cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-whistle" />
            <span>Kokeile esimerkkidatalla (HJK T13 Demo)</span>
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
