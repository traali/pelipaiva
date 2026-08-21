import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  QrCode,
  PlusCircle,
  UserPlus
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import type { SportType } from '../types/matchday';

interface AddedTeamEntry {
  playerName: string;
  teamName: string;
  sport: SportType;
  url: string;
}

interface OnboardingWizardProps {
  onStartDemo: () => void;
  onOpenImportModal: (initialSport?: SportType, initialTeamUrl?: string, initialTeamName?: string) => void;
  onOpenFamilyShare: () => void;
  onOpenSmartImport?: () => void;
  onQuickAddTeam: (playerName: string, teamName: string, sport: SportType, url: string) => Promise<void>;
  onFinishOnboarding?: () => void;
  existingProfilesCount?: number;
}

type GuidePlatform = 'nimenhuuto' | 'myclub' | 'jopox' | 'torneopal';

const READY_TEAMS: Array<{
  name: string;
  sport: SportType;
  sportLabel: string;
  icon: string;
  url: string;
  badge: string;
}> = [
  {
    name: 'PPJ Laru Sininen (185085)',
    sport: 'football',
    sportLabel: 'Jalkapallo',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    badge: 'Palloliitto'
  },
  {
    name: 'PPJ Laru Valkoinen (185083)',
    sport: 'football',
    sportLabel: 'Jalkapallo',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
    badge: 'Palloliitto'
  },
  {
    name: 'PPJ Laru Oranssi (185086)',
    sport: 'football',
    sportLabel: 'Jalkapallo',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
    badge: 'Palloliitto'
  },
  {
    name: 'Salibandy (25301)',
    sport: 'floorball',
    sportLabel: 'Salibandy',
    icon: '🏑',
    url: 'https://tulospalvelu.salibandy.fi/team/25301/info',
    badge: 'Salibandyliitto'
  },
  {
    name: 'Basket.fi (5756346)',
    sport: 'basketball',
    sportLabel: 'Koripallo',
    icon: '🏀',
    url: 'https://tulospalvelu.basket.fi/team/5756346/info',
    badge: 'Basket.fi'
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onStartDemo,
  onOpenImportModal,
  onOpenFamilyShare,
  onOpenSmartImport,
  onQuickAddTeam,
  onFinishOnboarding,
  existingProfilesCount = 0
}) => {
  const [activeGuide, setActiveGuide] = useState<GuidePlatform>('nimenhuuto');
  const [selectedPlayerName, setSelectedPlayerName] = useState('Maija');
  const [addedTeams, setAddedTeams] = useState<AddedTeamEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [justAddedTeamName, setJustAddedTeamName] = useState<string | null>(null);

  const handleAddTeam = async (team: (typeof READY_TEAMS)[0]) => {
    setIsAdding(true);
    setJustAddedTeamName(team.name);
    try {
      await onQuickAddTeam(selectedPlayerName.trim() || 'Maija', team.name, team.sport, team.url);
      setAddedTeams((prev) => [
        ...prev,
        {
          playerName: selectedPlayerName.trim() || 'Maija',
          teamName: team.name,
          sport: team.sport,
          url: team.url
        }
      ]);
    } finally {
      setIsAdding(false);
      setTimeout(() => setJustAddedTeamName(null), 1500);
    }
  };

  const handleNextPlayer = (nextName: string) => {
    setSelectedPlayerName(nextName);
  };

  // Group added teams by player
  const playerSummary = addedTeams.reduce<Record<string, AddedTeamEntry[]>>((acc, curr) => {
    if (!acc[curr.playerName]) acc[curr.playerName] = [];
    acc[curr.playerName]!.push(curr);
    return acc;
  }, {});

  const currentChildTeams = addedTeams.filter(
    (t) => t.playerName.toLowerCase() === selectedPlayerName.toLowerCase()
  );

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

        {/* GUIDED STEP-BY-STEP ONBOARDING CARD */}
        <div className="liquid-glass rounded-3xl p-6 md:p-8 mb-8 border border-pitch/30 shadow-xl shadow-pitch/5">
          {/* STEP 1: Select/Add Player */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-pitch uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Valitse tai lisää pelaaja / lapsi</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated text-text-muted font-semibold">
                Vaihe 1/2
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-elevated/80 border border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-text-primary block">
                  👤 Kenelle lapselle / pelaajalle lisätään joukkueita?
                </label>
                <p className="text-[11px] text-text-muted">
                  Voit liittää useita lajeja ja joukkueita samalle lapselle.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={selectedPlayerName}
                  onChange={(e) => setSelectedPlayerName(e.target.value)}
                  placeholder="Kirjoita nimi"
                  className="px-3 py-1.5 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-bold focus:outline-none focus:border-pitch w-32"
                />
                <div className="flex items-center gap-1">
                  {['Maija', 'Eemil', 'Ville'].map((quickName) => (
                    <button
                      key={quickName}
                      type="button"
                      onClick={() => handleNextPlayer(quickName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
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
          </div>

          {/* STEP 2: Select Teams for this Player */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span>2. Valitse joukkueet pelaajalle: <span className="text-pitch">{selectedPlayerName}</span></span>
              </span>
              {currentChildTeams.length > 0 && (
                <span className="text-[11px] text-pitch font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{currentChildTeams.length} joukkuetta lisätty {selectedPlayerName}:lle</span>
                </span>
              )}
            </div>

            {/* Ready-made Team Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mb-4">
              {READY_TEAMS.map((team) => {
                const isAlreadyAdded = addedTeams.some(
                  (t) =>
                    t.playerName.toLowerCase() === selectedPlayerName.toLowerCase() &&
                    t.teamName === team.name
                );

                return (
                  <button
                    key={team.name}
                    type="button"
                    disabled={isAdding}
                    onClick={() => handleAddTeam(team)}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                      isAlreadyAdded
                        ? 'bg-pitch/15 border-pitch text-pitch'
                        : 'bg-surface-elevated/70 border-border-subtle hover:border-pitch text-text-primary hover:bg-surface-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{team.icon}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-muted font-bold">
                        {team.badge}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold line-clamp-1">{team.name}</div>
                      <div className="text-[11px] text-text-muted">{team.sportLabel}</div>
                    </div>

                    <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-bold">
                      {isAlreadyAdded ? (
                        <span className="text-pitch flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Lisätty!</span>
                        </span>
                      ) : justAddedTeamName === team.name ? (
                        <span className="text-pitch flex items-center gap-1 animate-pulse">
                          <span>Tallennetaan...</span>
                        </span>
                      ) : (
                        <span className="text-pitch flex items-center gap-1">
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Lisää {selectedPlayerName}:lle</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom URL or Smart Import for this child */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onOpenImportModal('football', '', `${selectedPlayerName}:n joukkue`)
                }
                className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-surface border border-border-strong hover:border-pitch text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-pitch" />
                <span>+ Syötä muu .ics-linkki (Nimenhuuto / MyClub / Jopox)</span>
              </button>

              {onOpenSmartImport && (
                <button
                  type="button"
                  onClick={onOpenSmartImport}
                  className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-pitch/15 border border-pitch/30 hover:bg-pitch hover:text-text-inverse text-pitch text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ Liitä WhatsApp-viesti tai Excel</span>
                </button>
              )}
            </div>
          </div>

          {/* STEP 3: Family Summary & Add Next Player / Finish */}
          {(Object.keys(playerSummary).length > 0 || existingProfilesCount > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-surface border border-pitch/40 mb-6 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-pitch uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Perheen kokoonpano valmiina:</span>
                </span>
                <span className="text-xs font-bold text-text-primary">
                  Yhteensä {addedTeams.length || existingProfilesCount} joukkuetta
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {Object.entries(playerSummary).map(([pName, teams]) => (
                  <div
                    key={pName}
                    className="p-2.5 rounded-xl bg-surface-elevated/80 border border-border-subtle flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-text-primary">👤 {pName}: </span>
                      <span className="text-text-secondary">
                        {teams.map((t) => t.teamName).join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Add Next Player OR Finish */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border-subtle">
                <div className="w-full sm:w-auto flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-text-muted shrink-0">Lisää seuraava:</span>
                  {['Maija', 'Eemil', 'Ville']
                    .filter((n) => !playerSummary[n])
                    .map((nextKid) => (
                      <button
                        key={nextKid}
                        type="button"
                        onClick={() => handleNextPlayer(nextKid)}
                        className="py-1.5 px-2.5 rounded-xl bg-surface-elevated border border-border-strong hover:border-pitch text-text-primary font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-pitch" />
                        <span>+ {nextKid}</span>
                      </button>
                    ))}
                </div>

                {onFinishOnboarding && (
                  <button
                    type="button"
                    onClick={onFinishOnboarding}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-pitch text-text-inverse font-black text-xs flex items-center justify-center gap-1.5 hover:brightness-110 shadow-md shadow-pitch/20 cursor-pointer"
                  >
                    <span>🚀 Valmis! Siirry Pelipäivään</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Quick Demo & Family Share Quick Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border-subtle">
            <button
              onClick={onStartDemo}
              className="text-xs font-bold text-text-secondary hover:text-pitch flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-pitch" />
              <span>⚡ Kokeile heti 5 oletusjoukkueen valmiilla esimerkkidatalla</span>
            </button>

            <button
              onClick={onOpenFamilyShare}
              className="text-xs font-semibold text-text-muted hover:text-text-primary flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-whistle" />
              <span>Skannaa toisen vanhemman QR-koodi</span>
            </button>
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
          <h3 className="text-base font-bold text-text-primary mb-2 flex items-center gap-2">
            <span>Miten löydän oman joukkueeni kalenterilinkin?</span>
          </h3>

          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto py-1">
            {(['nimenhuuto', 'myclub', 'jopox', 'torneopal'] as GuidePlatform[]).map((plat) => (
              <button
                key={plat}
                onClick={() => setActiveGuide(plat)}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold capitalize whitespace-nowrap cursor-pointer transition-all ${
                  activeGuide === plat
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {plat === 'torneopal' ? 'Palloliitto / Torneopal' : plat}
              </button>
            ))}
          </div>

          {activeGuide === 'nimenhuuto' && (
            <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
              <p>1. Kirjaudu Nimenhuutoon selaimella tai sovelluksessa.</p>
              <p>2. Siirry kohtaan <strong>Kalenteri</strong> ➔ <strong>Tilaa kalenteri / iCal</strong>.</p>
              <p>3. Kopioi linkki (alkaa <code className="text-pitch">webcal://</code> tai <code className="text-pitch">https://</code>) ja liitä se Pelipäivään.</p>
            </div>
          )}

          {activeGuide === 'myclub' && (
            <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
              <p>1. Avaa MyClub ja mene <strong>Omat tiedot</strong> tai <strong>Tapahtumat</strong> -sivulle.</p>
              <p>2. Etsi <strong>iCal-tilaus</strong> tai <strong>Kalenterisynkronointi</strong>.</p>
              <p>3. Kopioi henkilökohtainen .ics-osoitteesi ja liitä se Pelipäivään.</p>
            </div>
          )}

          {activeGuide === 'jopox' && (
            <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
              <p>1. Avaa Jopox Pukukoppi.</p>
              <p>2. Valitse <strong>Asetukset</strong> ➔ <strong>Kalenterin tilaus</strong>.</p>
              <p>3. Kopioi annettu URL-osoite ja liitä se Pelipäivään.</p>
            </div>
          )}

          {activeGuide === 'torneopal' && (
            <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
              <p>1. Avaa <strong>tulospalvelu.palloliitto.fi</strong>, <strong>tulospalvelu.salibandy.fi</strong> tai <strong>basket.fi</strong>.</p>
              <p>2. Etsi joukkueesi sivu (esim. <code className="text-pitch">.../team/185085/info</code>).</p>
              <p>3. Kopioi sivun osoite ja liitä se suoraan Pelipäivään.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center pt-8 border-t border-border-subtle">
        <p className="text-xs text-text-muted">
          Pelipäivä • 100% Paikallinen PWA • Ei mainoksia, ei seurantaa
        </p>
      </footer>
    </div>
  );
};
