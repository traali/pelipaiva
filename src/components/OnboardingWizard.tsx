import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Trash2,
  ArrowRight,
  UserPlus,
  Sparkles,
  Link,
  Plus,
  User,
  Users,
  Smartphone,
  Link2,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { EXAMPLE_TOURNAMENTS } from '../lib/clubs/exampleTournaments';
import type { SportType } from '../types/matchday';
import { db } from '../lib/storage/db';
import { syncFamilyRosterCycle, hydrateRosterProfiles, normalizeFamilyCode } from '../lib/sync/familyCloud';

interface AddedSource {
  id: string;
  playerName: string;
  sourceType: 'torneopal' | 'ics' | 'text';
  name: string;
  sport: SportType;
  url?: string;
}

interface OnboardingWizardProps {
  onOpenImportModal?: (initialSport?: SportType, initialTeamUrl?: string, initialTeamName?: string) => void;
  onOpenFamilyShare?: () => void;
  onOpenSmartImport?: () => void;
  onQuickAddTeam: (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string
  ) => Promise<{ success: boolean; error?: string } | void>;
  onRemoveTeam?: (playerName: string, url?: string) => Promise<void>;
  onFinishOnboarding?: () => void;
  existingProfilesCount?: number;
}

const PRESET_TORNEOPAL_TEAMS: Array<{
  name: string;
  teamName: string;
  sport: SportType;
  url: string;
  association: string;
  colorHex: string;
}> = [
  {
    name: 'PPJ/Laru sin · P13 Kolmonen',
    teamName: 'PPJ/Laru sin',
    sport: 'football',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    association: 'Palloliitto',
    colorHex: '#3b82f6'
  },
  {
    name: 'PPJ/Laru mus · P13 Vitonen',
    teamName: 'PPJ/Laru mus',
    sport: 'football',
    url: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
    association: 'Palloliitto',
    colorHex: '#64748b'
  },
  {
    name: 'PPJ/Laru oran · P13 Vitonen',
    teamName: 'PPJ/Laru oran',
    sport: 'football',
    url: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
    association: 'Palloliitto',
    colorHex: '#f97316'
  },
  {
    name: 'Salibandy · Tulospalvelu (tiimi 25301)',
    teamName: 'ErVi Salibandy',
    sport: 'floorball',
    url: 'https://tulospalvelu.salibandy.fi/team/25301/info',
    association: 'Salibandy.fi',
    colorHex: '#0284c7'
  },
  {
    name: 'Lentopallo · Tulospalvelu (tiimi 57672)',
    teamName: 'PuMa Lentopallo',
    sport: 'volleyball',
    url: 'https://tulospalvelu.lentopallo.fi/team/57672/info',
    association: 'Lentopallo.fi',
    colorHex: '#8b5cf6'
  },
  {
    name: 'Koripallo · Tulospalvelu (tiimi 5756346)',
    teamName: 'Koripallojoukkue',
    sport: 'basketball',
    url: 'https://tulospalvelu.basket.fi/team/5756346/info',
    association: 'Basket.fi',
    colorHex: '#f59e0b'
  },
  ...EXAMPLE_TOURNAMENTS.map((cup) => ({
    name: `${cup.name} · ${cup.teamName}`,
    teamName: cup.teamName,
    sport: cup.sport,
    url: cup.url,
    association: cup.name,
    colorHex: cup.colorHex
  }))
];

type OnboardingMode = 'choice' | 'local' | 'family_create' | 'family_join';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onOpenSmartImport,
  onQuickAddTeam,
  onRemoveTeam,
  onFinishOnboarding,
  existingProfilesCount = 0
}) => {
  // Mode selection state: choice (initial) vs local vs family_create vs family_join
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('choice');
  const [familyCodeInput, setFamilyCodeInput] = useState<string>('');

  // Wizard state: active player being configured
  const [activePlayerName, setActivePlayerName] = useState<string>('');
  const [nameInputDraft, setNameInputDraft] = useState<string>('');
  const [isNamingStep, setIsNamingStep] = useState<boolean>(true);

  // All added sources across family
  const [addedSources, setAddedSources] = useState<AddedSource[]>([]);

  // Custom .ics state
  const [customIcsUrl, setCustomIcsUrl] = useState('');
  const [customSport, setCustomSport] = useState<SportType>('football');
  const [showCustomIcsInput, setShowCustomIcsInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Group added sources by player name
  const playerGroups = React.useMemo(() => {
    const map = new Map<string, AddedSource[]>();
    for (const src of addedSources) {
      if (!map.has(src.playerName)) map.set(src.playerName, []);
      map.get(src.playerName)!.push(src);
    }
    return Array.from(map.entries());
  }, [addedSources]);

  const currentPlayerSources = addedSources.filter(
    (s) => s.playerName.toLowerCase() === activePlayerName.trim().toLowerCase()
  );

  const handleConfirmPlayerName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInputDraft.trim();
    if (!trimmed) return;
    setErrorMessage('');
    setActivePlayerName(trimmed);
    setIsNamingStep(false);
  };

  const handleAddPresetTorneopal = async (team: (typeof PRESET_TORNEOPAL_TEAMS)[0]) => {
    if (!activePlayerName) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await onQuickAddTeam(activePlayerName, team.name, team.sport, team.url);
      if (res && res.success === false) {
        setErrorMessage(res.error || 'Otteluiden haku epäonnistui. Tarkista verkko.');
        return;
      }
      setAddedSources((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          playerName: activePlayerName,
          sourceType: 'torneopal',
          name: team.name,
          sport: team.sport,
          url: team.url
        }
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lisäys epäonnistui');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomIcs = async () => {
    if (!activePlayerName) return;
    const trimmedUrl = customIcsUrl.trim();
    if (!trimmedUrl) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await onQuickAddTeam(activePlayerName, `${activePlayerName}:n joukkue`, customSport, trimmedUrl);
      if (res && res.success === false) {
        setErrorMessage(res.error || 'Kalenterin nouto epäonnistui. Tarkista linkki.');
        return;
      }
      setAddedSources((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          playerName: activePlayerName,
          sourceType: 'ics',
          name: `${activePlayerName}:n joukkue`,
          sport: customSport,
          url: trimmedUrl
        }
      ]);
      setCustomIcsUrl('');
      setShowCustomIcsInput(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lisäys epäonnistui');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSource = async (sourceId: string, playerName: string, url?: string) => {
    try {
      if (onRemoveTeam) {
        await onRemoveTeam(playerName, url);
      }
      setAddedSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Poisto epäonnistui');
    }
  };

  const handleAddNewPlayer = () => {
    setNameInputDraft('');
    setActivePlayerName('');
    setIsNamingStep(true);
    setShowCustomIcsInput(false);
    setErrorMessage('');
  };

  const handleSwitchToExistingPlayer = (playerName: string) => {
    setActivePlayerName(playerName);
    setNameInputDraft(playerName);
    setIsNamingStep(false);
    setShowCustomIcsInput(false);
  };

  // Join Family Flow
  const handleJoinFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeFamilyCode(familyCodeInput);
    if (!cleanCode) {
      setErrorMessage('Syötä perhekoodi (esim. PERHE-1 tai PERHE-2)');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      await db.syncState.put({
        key: 'family',
        syncKey: cleanCode,
        lastSyncedAt: new Date().toISOString()
      });

      const syncRes = await syncFamilyRosterCycle(cleanCode, db);
      if (!syncRes.success) {
        setErrorMessage(syncRes.error || 'Perheen haku epäonnistui. Tarkista koodi.');
        return;
      }

      const profiles = await db.profiles.toArray();
      await hydrateRosterProfiles(profiles, db);

      localStorage.setItem('pelipaiva_onboarding_done', 'true');
      onFinishOnboarding?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Liittyminen epäonnistui');
    } finally {
      setIsLoading(false);
    }
  };

  // Create Family Key Flow
  const handleCreateFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeFamilyCode(familyCodeInput);
    if (!cleanCode) {
      setErrorMessage('Syötä myönnetty perheavain (esim. PERHE-1 tai PERHE-2)');
      return;
    }

    await db.syncState.put({
      key: 'family',
      syncKey: cleanCode,
      lastSyncedAt: new Date().toISOString()
    });

    setOnboardingMode('local');
    setIsNamingStep(true);
  };

  const totalSourcesCount = addedSources.length || existingProfilesCount;

  return (
    <div className="min-h-screen bg-canvas text-text-primary px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:py-10 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full space-y-4">
        {/* Top App Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-pitch text-text-inverse flex items-center justify-center font-black text-sm shadow-sm shadow-pitch/20">
              FD
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-text-primary">
                FamDay
              </h1>
              <p className="text-[11px] text-text-muted">
                Perheen arjen ja pelipäivien hermokeskus
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SCREEN 1: 3-WAY ONBOARDING CHOICE (Lokaali / Perhe / Liity)   */}
        {/* ============================================================== */}
        {onboardingMode === 'choice' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springTactile.gentle}
            className="liquid-glass rounded-3xl p-6 border border-border-strong shadow-xl space-y-5"
          >
            <div>
              <h2 className="text-base font-bold text-text-primary mb-1">
                Miten haluat käyttää FamDayta?
              </h2>
              <p className="text-xs text-text-muted">
                Valitse perheellesi sopiva käyttötapa. Voit muuttaa asetusta myöhemmin milloin vain.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Option 1: Local Device Only */}
              <button
                type="button"
                onClick={() => setOnboardingMode('local')}
                className="p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle hover:border-pitch hover:bg-surface-base flex items-start gap-3.5 text-left cursor-pointer transition-all group"
              >
                <div className="p-2.5 rounded-xl bg-pitch/15 text-pitch group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-primary">Vain tämä laite (Lokaali)</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-base text-text-secondary border border-border-subtle">
                      Yksityinen
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Tiedot tallentuvat vain tähän puhelimeen ja selaimeen. Ei pilvitallennusta, toimii heti ilman avaimia.
                  </p>
                </div>
              </button>

              {/* Option 2: Family Sync & Live Calendar (Create) */}
              <button
                type="button"
                onClick={() => setOnboardingMode('family_create')}
                className="p-4 rounded-2xl bg-pitch/10 border border-pitch/40 hover:border-pitch hover:bg-pitch/15 flex items-start gap-3.5 text-left cursor-pointer transition-all group"
              >
                <div className="p-2.5 rounded-xl bg-pitch text-text-inverse group-hover:scale-105 transition-transform shrink-0 mt-0.5 shadow-sm shadow-pitch/20">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-primary">Luo perhe (Pilvisynkronointi)</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pitch text-text-inverse">
                      Suositus ⭐
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Synkronoi pelit, kuskiringit ja Wilman perheen puhelimiin ja elävään Apple/Google-kalenteriin. Vaatii perheavaimen.
                  </p>
                </div>
              </button>

              {/* Option 3: Join Existing Family */}
              <button
                type="button"
                onClick={() => setOnboardingMode('family_join')}
                className="p-4 rounded-2xl bg-surface-elevated/70 border border-border-subtle hover:border-pitch hover:bg-surface-base flex items-start gap-3.5 text-left cursor-pointer transition-all group"
              >
                <div className="p-2.5 rounded-xl bg-surface-base border border-border-strong text-text-primary group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                  <Link2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-primary">Liity perheeseen</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-base text-text-secondary border border-border-subtle">
                      Valmis koodi
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Onko toinen vanhempi jo luonut perheen? Syötä perhekoodi (esim. PERHE-2) ja lataa koko kalenteri heti.
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 2: ENTER FAMILY KEY (CREATE)                             */}
        {/* ============================================================== */}
        {onboardingMode === 'family_create' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-3xl p-6 border border-border-strong shadow-xl space-y-4"
          >
            <button
              type="button"
              onClick={() => setOnboardingMode('choice')}
              className="text-xs font-bold text-text-muted hover:text-text-primary flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Takaisin valintaan</span>
            </button>

            <div>
              <h2 className="text-base font-bold text-text-primary mb-1">
                Määritä perheavain
              </h2>
              <p className="text-xs text-text-muted">
                Syötä myönnetty perheavain (esim. <code className="font-mono font-bold text-pitch">PERHE-1</code> tai <code className="font-mono font-bold text-pitch">PERHE-2</code>):
              </p>
            </div>

            <form onSubmit={handleCreateFamilySubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  autoFocus
                  value={familyCodeInput}
                  onChange={(e) => setFamilyCodeInput(e.target.value.toUpperCase())}
                  placeholder="esim. PERHE-1"
                  className="w-full px-4 py-3 rounded-2xl bg-surface-base border border-border-strong text-sm font-mono font-bold text-text-primary tracking-wider uppercase focus-visible:ring-2 focus-visible:ring-pitch"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-radar/15 border border-radar/30 text-radar text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-sm shadow-pitch/20 transition-all"
              >
                <span>Tallenna ja jatka joukkueisiin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 3: JOIN EXISTING FAMILY (ENTER CODE & HYDRATE)          */}
        {/* ============================================================== */}
        {onboardingMode === 'family_join' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-3xl p-6 border border-border-strong shadow-xl space-y-4"
          >
            <button
              type="button"
              onClick={() => setOnboardingMode('choice')}
              className="text-xs font-bold text-text-muted hover:text-text-primary flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Takaisin valintaan</span>
            </button>

            <div>
              <h2 className="text-base font-bold text-text-primary mb-1">
                Liity olemassa olevaan perheeseen
              </h2>
              <p className="text-xs text-text-muted">
                Syötä toiselta vanhemmalta saatu perhekoodi:
              </p>
            </div>

            <form onSubmit={handleJoinFamilySubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  autoFocus
                  value={familyCodeInput}
                  onChange={(e) => setFamilyCodeInput(e.target.value.toUpperCase())}
                  placeholder="esim. PERHE-2"
                  className="w-full px-4 py-3 rounded-2xl bg-surface-base border border-border-strong text-sm font-mono font-bold text-text-primary tracking-wider uppercase focus-visible:ring-2 focus-visible:ring-pitch"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-radar/15 border border-radar/30 text-radar text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-sm shadow-pitch/20 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Ladataan perheen otteluita...</span>
                  </>
                ) : (
                  <>
                    <span>Liity ja lataa kalenteri</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 4: LOCAL / STANDARD SETUP (PLAYER & SQUAD CONFIGURATION) */}
        {/* ============================================================== */}
        {onboardingMode === 'local' && (
          <>
            {/* FAMILY ROSTER SUMMARY (if players already added) */}
            {playerGroups.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-surface-elevated/90 border border-pitch/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-pitch">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Perheen kokoonpano ({totalSourcesCount} joukkuetta):</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddNewPlayer}
                    className="text-[11px] text-pitch hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Lisää pelaaja</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {playerGroups.map(([name, sources]) => {
                    const isActive = !isNamingStep && activePlayerName.toLowerCase() === name.toLowerCase();
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleSwitchToExistingPlayer(name)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                            : 'bg-surface text-text-secondary border-border-strong hover:text-text-primary'
                        }`}
                      >
                        <span>{name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isActive ? 'bg-white/25 text-white' : 'bg-pitch/15 text-pitch'
                        }`}>
                          {sources.length} {sources.length === 1 ? 'lähde' : 'lähdettä'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MAIN STEP CARD */}
            <div className="liquid-glass rounded-3xl p-5 border border-border-strong shadow-xl space-y-5">
              {/* STEP 1: ADD / NAME PLAYER */}
              {isNamingStep ? (
                <form onSubmit={handleConfirmPlayerName} className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-1.5 mb-2">
                      <UserPlus className="w-4 h-4 text-pitch" />
                      <span>1. Lisää pelaaja / lapsi:</span>
                    </label>
                    <p className="text-xs text-text-muted mb-3">
                      Kirjoita lapsen tai pelaajan etunimi aloittaaksesi:
                    </p>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={nameInputDraft}
                        onChange={(e) => setNameInputDraft(e.target.value)}
                        placeholder="Esim. Simo, Eemil, Aada..."
                        className="flex-1 px-4 py-3 rounded-2xl bg-surface-base border border-border-strong text-sm font-bold text-text-primary focus-visible:ring-2 focus-visible:ring-pitch"
                      />
                      <button
                        type="submit"
                        disabled={!nameInputDraft.trim()}
                        className="py-3 px-5 rounded-2xl bg-pitch text-text-inverse font-bold text-xs flex items-center gap-1.5 hover:brightness-110 disabled:opacity-40 cursor-pointer shadow-sm shadow-pitch/20 transition-all shrink-0"
                      >
                        <span>Jatka</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* STEP 2: SELECT PRESET OR ADD TEAMS FOR ACTIVE PLAYER */
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-xl bg-pitch/20 text-pitch flex items-center justify-center font-black text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text-primary">
                          Pelaaja: <span className="text-pitch">{activePlayerName}</span>
                        </div>
                        <div className="text-[10px] text-text-muted">
                          {currentPlayerSources.length} joukkuetta liitettynä
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNamingStep(true)}
                      className="text-[11px] text-text-muted hover:text-text-primary font-semibold underline cursor-pointer"
                    >
                      Vaihda nimeä
                    </button>
                  </div>

                  {/* Added sources list for active player */}
                  {currentPlayerSources.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        Liitetyt joukkueet & kalenterit:
                      </div>
                      <div className="space-y-1.5">
                        {currentPlayerSources.map((src) => (
                          <div
                            key={src.id}
                            className="p-2.5 rounded-xl bg-surface-elevated/70 border border-pitch/30 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-pitch shrink-0" />
                              <span className="font-bold text-text-primary truncate">{src.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSource(src.id, src.playerName, src.url)}
                              className="p-1 rounded text-text-muted hover:text-radar cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PRESET QUICK ATTACH BUTTONS */}
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-pitch" />
                      <span>Valitse joukkue tai turnaus suoraan listasta:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESET_TORNEOPAL_TEAMS.map((team) => {
                        const isAdded = currentPlayerSources.some(
                          (s) => s.url === team.url
                        );
                        return (
                          <button
                            key={team.url}
                            type="button"
                            disabled={isAdded || isLoading}
                            onClick={() => handleAddPresetTorneopal(team)}
                            className={`p-3 rounded-2xl border text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                              isAdded
                                ? 'bg-pitch/15 border-pitch/40 text-pitch opacity-80 cursor-default'
                                : 'bg-surface-elevated hover:bg-surface-base border-border-subtle text-text-primary hover:border-pitch/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: team.colorHex }}
                              />
                              <span className="truncate">{team.name}</span>
                            </div>
                            {isAdded ? (
                              <CheckCircle2 className="w-4 h-4 text-pitch shrink-0" />
                            ) : (
                              <Plus className="w-4 h-4 text-text-muted shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CUSTOM ICS LINK OR SMART IMPORT */}
                  <div className="pt-2 border-t border-border-subtle flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowCustomIcsInput((v) => !v)}
                        className="text-xs font-bold text-pitch hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Link className="w-3.5 h-3.5" />
                        <span>{showCustomIcsInput ? 'Piilota oma .ics -linkki' : '+ Lisää oma MyClub / Nimenhuuto .ics'}</span>
                      </button>

                      {onOpenSmartImport && (
                        <button
                          type="button"
                          onClick={onOpenSmartImport}
                          className="text-xs font-bold text-text-secondary hover:text-text-primary underline cursor-pointer"
                        >
                          Tekoälytuonti ➔
                        </button>
                      )}
                    </div>

                    {showCustomIcsInput && (
                      <div className="p-3 rounded-2xl bg-surface-base border border-border-strong space-y-2 mt-1">
                        <input
                          type="url"
                          value={customIcsUrl}
                          onChange={(e) => setCustomIcsUrl(e.target.value)}
                          placeholder="https://nimenhuuto.com/team.ics"
                          className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-subtle text-xs text-text-primary font-mono focus-visible:ring-2 focus-visible:ring-pitch"
                        />
                        <div className="flex items-center justify-between">
                          <select
                            value={customSport}
                            onChange={(e) => setCustomSport(e.target.value as SportType)}
                            className="px-2.5 py-1.5 rounded-xl bg-surface-elevated border border-border-subtle text-xs font-bold text-text-primary"
                          >
                            <option value="football">Jalkapallo</option>
                            <option value="floorball">Salibandy</option>
                            <option value="basketball">Koripallo</option>
                            <option value="volleyball">Lentopallo</option>
                            <option value="icehockey">Jääkiekko</option>
                          </select>

                          <button
                            type="button"
                            disabled={!customIcsUrl.trim() || isLoading}
                            onClick={handleAddCustomIcs}
                            className="px-3.5 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 disabled:opacity-40 cursor-pointer"
                          >
                            Lisää kalenteri
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-radar/15 border border-radar/30 text-radar text-xs font-semibold">
                      {errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* FOOTER BAR: FINISH / START APP BUTTON */}
      {onboardingMode === 'local' && (
        <div className="max-w-xl mx-auto w-full pt-4">
          <button
            type="button"
            onClick={onFinishOnboarding}
            className="w-full py-3.5 rounded-2xl bg-pitch text-text-inverse font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-lg shadow-pitch/25 transition-all"
          >
            <span>Siirry FamDay-ottelukeskukseen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
