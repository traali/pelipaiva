import React, { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteOfficialTeamData, ensureStoragePersistence } from './lib/storage/db';
import { MatchdayCard } from './components/MatchdayCard';
import { MultiProfileHeader } from './components/MultiProfileHeader';
import { CalendarImportModal } from './components/CalendarImportModal';
import { AmbientView } from './components/AmbientView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MatchdayEvent, SportType, PlayerProfile } from './types/matchday';
import { Sparkles, Smartphone, LayoutList, Calendar as CalendarIcon, TableProperties, History as HistoryIcon } from 'lucide-react';
import { QuickDropInBar } from './components/QuickDropInBar';
import { TimelineCalendarView } from './components/TimelineCalendarView';
import { unpackSharePayload } from './lib/sync/familyShare';
import { MissionControlHUD } from './components/MissionControlHUD';
import { DemoBanner } from './components/DemoBanner';
import { WeekendStrip } from './components/WeekendStrip';
import { HeroMatchCard } from './components/HeroMatchCard';
import { TalkooBoard } from './components/TalkooBoard';
import { TournamentWeekendPanel } from './components/TournamentWeekendPanel';
import { runMissionControlGraph } from './lib/agents';
import { ingestSourceForProfile } from './lib/clubs/ingestOfficial';
import { helsinkiDateISO } from './lib/agents/time';
import { EXTRA_PROFILES } from './lib/matchday/seedWeekendExtras';
import { pickNextTeamColor, colorFromNameHint, swatchForHex } from './lib/sport/teamColors';
import { exampleTournamentFromUrl } from './lib/clubs/exampleTournaments';
import { searchPopularClubs } from './lib/clubs/popularClubsCatalog';
import { findExistingTeamProfile, generateStableProfileId } from './lib/clubs/attachTeam';
import { syncFamilyRosterCycle, hydrateRosterProfiles } from './lib/sync/familyCloud';

const SmartImportModal = lazy(() =>
  import('./components/SmartImportModal').then((m) => ({ default: m.SmartImportModal }))
);
const FamilyLogisticsModal = lazy(() =>
  import('./components/FamilyLogisticsModal').then((m) => ({ default: m.FamilyLogisticsModal }))
);
const AskCopilotModal = lazy(() =>
  import('./components/AskCopilotModal').then((m) => ({ default: m.AskCopilotModal }))
);
const FamilyShareModal = lazy(() =>
  import('./components/FamilyShareModal').then((m) => ({ default: m.FamilyShareModal }))
);
const FamilyManageModal = lazy(() =>
  import('./components/FamilyManageModal').then((m) => ({ default: m.FamilyManageModal }))
);

export const App: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string>('all');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState<boolean>(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState<boolean>(false);
  const [isAskCopilotOpen, setIsAskCopilotOpen] = useState<boolean>(false);
  const [isFamilyShareOpen, setIsFamilyShareOpen] = useState<boolean>(false);
  const [isFamilyManageOpen, setIsFamilyManageOpen] = useState<boolean>(false);
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
  const [isOnboardingActive, setIsOnboardingActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pelipaiva_onboarding_done') !== 'true';
    }
    return true;
  });
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'timeline' | 'calendar'>('cards');
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);
  const [importDefaults, setImportDefaults] = useState<{
    sport?: SportType;
    url?: string;
    name?: string;
    playerName?: string;
  }>({});
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Listen to network status changes & background family sync
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background Family Cloud Sync Loop (every 30s while document is visible)
  useEffect(() => {
    let syncTimer: any;
    const runBackgroundSync = async () => {
      if (document.hidden || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      const sync = await db.syncState.get('family');
      if (sync && sync.syncKey) {
        await syncFamilyRosterCycle(sync.syncKey, db);
      }
    };

    // Initial sync
    runBackgroundSync();

  // 30s interval → 3 min so one phone stays under Worker GET:20 / 15 min
    syncTimer = setInterval(runBackgroundSync, 180000);

    const handleVisibility = () => {
      if (!document.hidden) {
        runBackgroundSync();
      }
    };

    const handleOnlineSync = () => {
      setIsOffline(false);
      runBackgroundSync();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnlineSync);

    return () => {
      clearInterval(syncTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnlineSync);
    };
  }, []);

  // Check URL params for ?perhe=, ?share= or ?ambient=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ambient') === 'true' || window.location.pathname === '/ambient') {
        setIsAmbientMode(true);
      }

      // Handle ?perhe=PERHE-2 deep link join
      const perheCode = params.get('perhe');
      if (perheCode) {
        (async () => {
          const res = await syncFamilyRosterCycle(perheCode, db);
          if (res.success) {
            localStorage.setItem('pelipaiva_onboarding_done', 'true');
            setIsOnboardingActive(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })();
      }

      // Handle family share link payload
      const shareData = params.get('share');
      if (shareData) {
        const unpacked = unpackSharePayload(shareData);
        if (unpacked.length > 0) {
          (async () => {
            for (const profile of unpacked) {
              await db.profiles.put(profile);
            }
            await hydrateRosterProfiles(unpacked, db);
            localStorage.setItem('pelipaiva_onboarding_done', 'true');
            setIsOnboardingActive(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          })();
        }
      }
    }
  }, []);

  // Request persistent storage on startup
  useEffect(() => {
    ensureStoragePersistence();
  }, []);

  // Dexie Reactive Live Queries
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) || [];
  const eventsQuery = useLiveQuery(() => db.events.toArray(), []);
  const rawEvents = eventsQuery || [];
  const arrivalRules = useLiveQuery(() => db.arrivalRules.toArray(), []) || [];

  const isDemoActive =
    profiles.length > 0 &&
    profiles.every(
      (p) =>
        p.id.startsWith('profile-ppj-') ||
        p.id.startsWith('profile-topola-') ||
        p.id.startsWith('profile-kw-') ||
        p.id === 'profile-hjk-demo'
    );
  // Seed family demo from live tulospalvelu — no invented KäPa/Honka cards.
  const handleStartDemo = async () => {
    setIsSeeding(true);
    try {
    await db.profiles.clear();
    await db.events.clear();

    const defaultProfiles = [
      {
        id: 'profile-ppj-185085',
        playerName: 'Simo',
        teamName: 'PPJ/Laru sin',
        sport: 'football' as SportType,
        primaryColor: 'sininen',
        secondaryColor: 'valkoinen',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
        associationUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
        associationType: 'palloliitto' as const,
        teamId: '185085',
        colorHex: '#3b82f6'
      },
      {
        id: 'profile-ppj-185083',
        playerName: 'Eemil',
        teamName: 'PPJ/Laru mus',
        sport: 'football' as SportType,
        primaryColor: 'valkoinen',
        secondaryColor: 'sininen',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
        associationUrl: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
        associationType: 'palloliitto' as const,
        teamId: '185083',
        colorHex: '#64748b'
      },
      {
        id: 'profile-ppj-185086',
        playerName: 'Ville',
        teamName: 'PPJ/Laru oran',
        sport: 'football' as SportType,
        primaryColor: 'oranssi',
        secondaryColor: 'musta',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
        associationUrl: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
        associationType: 'palloliitto' as const,
        teamId: '185086',
        colorHex: '#f97316'
      }
    ];

    for (const p of defaultProfiles) {
      await db.profiles.add(p);
    }
    for (const p of EXTRA_PROFILES) {
      await db.profiles.add(p);
    }

    const seeded = [...defaultProfiles, ...EXTRA_PROFILES];
    const ingested: number[] = [];
    for (let i = 0; i < seeded.length; i += 2) {
      const chunk = seeded.slice(i, i + 2);
      const part = await Promise.all(
        chunk.map((p) =>
          ingestSourceForProfile({
            profileId: p.id,
            playerName: p.playerName,
            teamName: p.teamName,
            sport: p.sport,
            url: p.associationUrl || p.calendarUrl,
            includeWeather: false
          }).catch((e) => {
            console.warn('[DEMO_INGEST]', p.teamName, e);
            return 0;
          })
        )
      );
      ingested.push(...part);
    }
    const total = ingested.reduce((a, b) => a + b, 0);
    if (total === 0) {
      await db.profiles.clear();
      await db.events.clear();
      return false;
    }
    return true;
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearData = async () => {
    await db.profiles.clear();
    await db.events.clear();
    setActiveProfileId('all');
    setIsOnboardingActive(true);
  };

  // Filter events by selected profile or player group
  const filteredEvents = useMemo(() => {
    return [...rawEvents]
      .filter((e) => {
        if (activeProfileId === 'all') return true;
        if (activeProfileId.startsWith('player:')) {
          const pName = activeProfileId.replace('player:', '').toLowerCase();
          const profile = profiles.find((p) => p.id === e.profileId);
          return (profile?.playerName || '').toLowerCase() === pName;
        }
        return e.profileId === activeProfileId;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [rawEvents, activeProfileId, profiles]);

  const nowMs = Date.now();
  // Events are active/upcoming until 30 minutes after end time
  const upcomingEvents = useMemo(
    () => filteredEvents.filter((e) => new Date(e.endTime).getTime() >= nowMs - 30 * 60 * 1000),
    [filteredEvents, nowMs]
  );
  const pastEvents = useMemo(
    () => filteredEvents.filter((e) => new Date(e.endTime).getTime() < nowMs - 30 * 60 * 1000),
    [filteredEvents, nowMs]
  );

  // By default, only show upcoming events unless user explicitly asks for history/past
  const displayEvents = useMemo(
    () => (showPastEvents ? filteredEvents : upcomingEvents),
    [showPastEvents, filteredEvents, upcomingEvents]
  );

  const snapshot = useMemo(
    () => runMissionControlGraph(rawEvents, profiles, new Date(), arrivalRules),
    [rawEvents, profiles, arrivalRules]
  );

  const otherEvents = useMemo(
    () => displayEvents.filter((e) => e.id !== snapshot.nextEvent?.id),
    [displayEvents, snapshot.nextEvent?.id]
  );

  const eventsGroupedByDay = useMemo(() => {
    const map = new Map<string, { dateStr: string; label: string; events: MatchdayEvent[] }>();
    for (const ev of otherEvents) {
      const d = new Date(ev.startTime);
      const key = helsinkiDateISO(d);
      if (!map.has(key)) {
        const fiLabel = d.toLocaleDateString('fi-FI', {
          weekday: 'long',
          day: 'numeric',
          month: 'numeric',
          timeZone: 'Europe/Helsinki'
        });
        const capitalized = fiLabel.charAt(0).toUpperCase() + fiLabel.slice(1);
        map.set(key, { dateStr: key, label: capitalized, events: [] });
      }
      map.get(key)!.events.push(ev);
    }
    return Array.from(map.values());
  }, [otherEvents]);

  const handleImportCalendar = async (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string,
    colorHex?: string,
    squadFilters?: string[]
  ) => {
    const existing = await db.profiles.toArray();
    const cup = exampleTournamentFromUrl(url);
    const club = searchPopularClubs(teamName).find((c) => c.sport === sport);
    const named = colorFromNameHint(`${teamName} ${url}`);
    const swatch = colorHex
      ? swatchForHex(colorHex)
      : cup
        ? { hex: cup.colorHex, label: cup.primaryColor }
        : named ||
          (club
            ? { hex: club.colorHex, label: club.primaryColor }
            : pickNextTeamColor(existing.map((p) => p.colorHex)));

    const reused = findExistingTeamProfile(existing, playerName, url);
    const profileId = reused?.id || generateStableProfileId(playerName, url);

    if (reused) {
      await db.profiles.update(profileId, {
        teamName: teamName || reused.teamName,
        sport,
        primaryColor: swatch.label,
        calendarUrl: url,
        colorHex: swatch.hex,
        squadFilters
      });
    } else {
      await db.profiles.add({
        id: profileId,
        playerName,
        teamName,
        sport,
        primaryColor: swatch.label,
        calendarUrl: url,
        colorHex: swatch.hex,
        squadFilters
      });
    }

    try {
      const imported = await ingestSourceForProfile({
        profileId,
        playerName,
        teamName: cup?.teamName || teamName,
        sport,
        url,
        includeWeather: true,
        squadFilters
      });

      if (imported === 0) {
        if (!reused) {
          await db.profiles.delete(profileId);
        }
        throw new Error('Otteluita ei löytynyt tästä osoitteesta');
      }

      const syncRecord = await db.syncState.get('family');
      if (syncRecord && syncRecord.syncKey) {
        await db.syncState.put({ ...syncRecord, pendingUpload: true });
        syncFamilyRosterCycle(syncRecord.syncKey, db).catch((e) =>
          console.warn('[FAMILY_CLOUD] Background sync after add failed:', e)
        );
      }
    } catch (err) {
      console.warn('Team / Calendar fetch error:', err);
      throw err;
    }
  };

  const playerNames = Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)));

  const closeImport = () => {
    setIsImportModalOpen(false);
    setImportDefaults({});
  };

  const openAddTeam = (playerName?: string) => {
    setImportDefaults({ playerName });
    setIsImportModalOpen(true);
  };

  const openEditProfile = (profile: PlayerProfile) => {
    setImportDefaults({
      playerName: profile.playerName,
      name: profile.teamName,
      sport: profile.sport,
      url: profile.calendarUrl || profile.associationUrl || ''
    });
    setIsFamilyManageOpen(false);
    setIsImportModalOpen(true);
  };

  const activePlayerName = activeProfileId.startsWith('player:')
    ? activeProfileId.replace('player:', '')
    : profiles.find((p) => p.id === activeProfileId)?.playerName;

  const handleRefreshAll = async () => {
    setIsSyncing(true);
    try {
      for (const p of profiles) {
        const url = p.associationUrl || p.calendarUrl;
        if (!url) continue;
        await ingestSourceForProfile({
          profileId: p.id,
          playerName: p.playerName,
          teamName: p.teamName,
          sport: p.sport,
          url,
          includeWeather: true
        }).catch((e) => console.warn('[REFRESH]', p.teamName, e));
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  const handleRemoveImportedTeam = async (playerName: string, url?: string) => {
    const hit = profiles.find(
      (p) =>
        p.playerName === playerName &&
        (!url || p.calendarUrl === url || p.associationUrl === url)
    );
    if (!hit) return;
    await db.events.where('profileId').equals(hit.id).delete();
    await db.profiles.delete(hit.id);
    if (hit.teamId) {
      await deleteOfficialTeamData(hit.teamId);
    }
    const sync = await db.syncState.get('family');
    if (sync && sync.syncKey) {
      const key = `pelipaiva_tombstones_${sync.syncKey}`;
      const existingStr = localStorage.getItem(key);
      const list: Array<{ id: string; deletedAt: string }> = existingStr ? JSON.parse(existingStr) : [];
      list.push({ id: hit.id, deletedAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
      await db.syncState.update('family', { pendingUpload: true });
    }
  };

  const handleResolveMismatch = async (
    eventId: string,
    decision: 'use_official' | 'keep_calendar' | 'unlink'
  ) => {
    const ev = rawEvents.find((e) => e.id === eventId);
    if (!ev) return;

    if (decision === 'use_official' && ev.mismatchFlags) {
      const updated: MatchdayEvent = {
        ...ev,
        startTime: ev.mismatchFlags.officialStartTime || ev.startTime,
        venue: {
          ...ev.venue,
          name: ev.mismatchFlags.officialVenueName || ev.venue.name
        },
        mismatchFlags: undefined,
        reconciliationStatus: 'manual_matched',
        userOverride: {
          action: 'adopt_official',
          appliedAt: new Date().toISOString(),
          notes: 'Päivitetty liiton tietoon'
        }
      };
      await db.events.put(updated);
    } else if (decision === 'keep_calendar') {
      const updated: MatchdayEvent = {
        ...ev,
        mismatchFlags: undefined,
        reconciliationStatus: 'manual_matched',
        userOverride: {
          action: 'keep_calendar',
          appliedAt: new Date().toISOString(),
          notes: 'Säilytetty omat kalenteritiedot'
        }
      };
      await db.events.put(updated);
    }
  };

  if (isAmbientMode) {
    return <AmbientView events={filteredEvents} profiles={profiles} />;
  }

  if (isSeeding) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 text-center text-text-primary">
        <p className="text-sm font-semibold text-pitch">Haetaan otteluita tulospalvelusta…</p>
      </div>
    );
  }

  // If no profiles exist yet or onboarding is explicitly in progress, show the Interactive Onboarding Wizard
  if (profiles.length === 0 || isOnboardingActive) {
    return (
      <>
        <OnboardingWizard
          onStartDemo={async () => {
            const ok = await handleStartDemo();
            if (ok) {
              localStorage.setItem('pelipaiva_onboarding_done', 'true');
              setIsOnboardingActive(false);
            }
          }}
          onFinishOnboarding={() => {
            localStorage.setItem('pelipaiva_onboarding_done', 'true');
            setIsOnboardingActive(false);
          }}
          existingProfilesCount={profiles.length}
          onOpenImportModal={(sport, url, name) => {
            setImportDefaults({ sport, url, name });
            setIsImportModalOpen(true);
          }}
          onOpenFamilyShare={() => setIsFamilyShareOpen(true)}
          onOpenSmartImport={() => setIsSmartImportOpen(true)}
          onQuickAddTeam={async (playerName, teamName, sport, url) => {
            await handleImportCalendar(playerName, teamName, sport, url);
          }}
          onRemoveTeam={handleRemoveImportedTeam}
        />
        <Suspense fallback={null}>
        <SmartImportModal
          isOpen={isSmartImportOpen}
          onClose={() => setIsSmartImportOpen(false)}
          existingPlayers={playerNames}
          onImportClassic={handleImportCalendar}
        />
        <CalendarImportModal
          isOpen={isImportModalOpen}
          onClose={closeImport}
          onImport={handleImportCalendar}
          initialSport={importDefaults.sport}
          initialTeamUrl={importDefaults.url}
          initialTeamName={importDefaults.name}
          initialPlayerName={importDefaults.playerName}
          existingPlayers={playerNames}
        />
        <FamilyShareModal
          isOpen={isFamilyShareOpen}
          onClose={() => setIsFamilyShareOpen(false)}
          profiles={profiles}
          onDataImported={() => setActiveProfileId('all')}
        />
        </Suspense>
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas pb-[max(2rem,env(safe-area-inset-bottom))] text-text-primary">
      <MissionControlHUD
        snapshot={snapshot}
        isOffline={isOffline}
        isSyncing={isSyncing}
        isDemo={isDemoActive}
        onRefresh={handleRefreshAll}
        onShare={() => setIsFamilyShareOpen(true)}
        onAmbient={() => setIsAmbientMode(true)}
        onLogistics={() => setIsLogisticsOpen(true)}
        onImport={() => setIsSmartImportOpen(true)}
        onAsk={() => setIsAskCopilotOpen(true)}
        onClear={handleClearData}
      />

      <main className="mx-auto max-w-5xl px-4 pt-2">
        {isDemoActive && (
          <DemoBanner
            onOpenImport={() => setIsSmartImportOpen(true)}
            onClearDemo={handleClearData}
          />
        )}
        {/* Sticky Profile Filter & View Mode Switcher Header */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-canvas/90 backdrop-blur-md border-b border-border-subtle/50 mb-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-xs">
          <div className="flex-1 min-w-0">
            <MultiProfileHeader
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSelectProfile={(id) => setActiveProfileId(id)}
              onAddProfile={() => openAddTeam(activePlayerName)}
              onOpenFamilyManage={() => setIsFamilyManageOpen(true)}
            />
          </div>

          {/* View Mode Switcher: Cards vs Timeline vs Calendar */}
          <div
            role="tablist"
            aria-label="Näkymän valitsin"
            className="flex rounded-xl bg-surface-elevated p-1 border border-border-subtle shrink-0 self-end sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
              title="Korttinäkymä"
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-pitch ${
                viewMode === 'cards'
                  ? 'bg-pitch text-text-inverse shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Kortit</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'timeline'}
              onClick={() => setViewMode('timeline')}
              title="Tiivis aikajana"
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-pitch ${
                viewMode === 'timeline'
                  ? 'bg-pitch text-text-inverse shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Tiivis</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'calendar'}
              onClick={() => setViewMode('calendar')}
              title="Kalenteriruudukko"
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-pitch ${
                viewMode === 'calendar'
                  ? 'bg-pitch text-text-inverse shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Kalenteri</span>
            </button>
          </div>
        </div>

        {snapshot.days.length > 0 && (
          <WeekendStrip days={snapshot.days} weekendLabel={snapshot.weekendLabel} />
        )}

        {snapshot.conflicts.length > 0 && (
          <button
            type="button"
            onClick={() => setIsLogisticsOpen(true)}
            aria-label={`Logistiikkaristiriita: ${snapshot.conflicts[0]?.message}. Avaa kuskijako.`}
            className="mb-4 flex min-h-[48px] w-full items-start gap-2.5 rounded-2xl border border-whistle/40 bg-whistle/15 px-3.5 py-3 text-left cursor-pointer hover:brightness-105 transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-whistle"
          >
            <span className="mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-whistle text-text-inverse shrink-0">
              Ristiriita
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text-primary leading-snug">
                {snapshot.conflicts[0]?.message}
              </div>
              <div className="text-xs font-bold text-whistle mt-1 flex items-center gap-1">
                <span>🚗 Avaa kuskijako & kimppakyydit ➔</span>
              </div>
            </div>
          </button>
        )}

        <TalkooBoard talkoo={snapshot.talkoo} />
        <TournamentWeekendPanel blocks={snapshot.tournaments} />

        {snapshot.nextEvent && (
          <div className="mb-4">
            <HeroMatchCard
              event={snapshot.nextEvent}
              profile={snapshot.nextPlayer}
              kit={snapshot.kitByEventId[snapshot.nextEvent.id]}
              conflicts={snapshot.conflicts}
              onNavigate={() => {
                const ev = snapshot.nextEvent;
                if (!ev) return;
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${ev.venue.coordinates.lat},${ev.venue.coordinates.lng}`,
                  '_blank'
                );
              }}
            />
          </div>
        )}

        <QuickDropInBar
          existingPlayers={Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)))}
          activeProfilePlayerName={
            activeProfileId.startsWith('player:')
              ? activeProfileId.replace('player:', '')
              : profiles.find((p) => p.id === activeProfileId)?.playerName
          }
          onEventCreated={() => {}}
        />

        {filteredEvents.length > 0 ? (
          <>
            {otherEvents.length === 0 && !snapshot.nextEvent ? (
              <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center my-4">
                <CalendarIcon className="mx-auto mb-2.5 h-8 w-8 text-text-muted" />
                <h3 className="text-sm font-bold text-text-primary">Kaikki tämän päivän ottelut on pelattu</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Ei tulevia otteluita tälle päivälle. Voit tarkastella aiemmin pelattuja otteluita alta.
                </p>
              </div>
            ) : viewMode === 'cards' ? (
              /* Cards Feed with Sticky Day Dividers */
              <div className="flex flex-col gap-6 pb-4">
                {eventsGroupedByDay.map((dayGroup) => (
                  <div key={dayGroup.dateStr} className="flex flex-col gap-3">
                    {/* Sticky Day Section Header */}
                    <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-canvas/95 backdrop-blur-md border-y border-border-subtle/80 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-pitch/15 text-pitch">
                          <CalendarIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black tracking-wide text-text-primary">
                          {dayGroup.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border-subtle">
                        {dayGroup.events.length} {dayGroup.events.length === 1 ? 'ottelu' : 'ottelua'}
                      </span>
                    </div>

                    {/* Day's Match Cards */}
                    <div className="flex flex-col gap-3">
                      {dayGroup.events.map((event) => {
                        const profile = profiles.find((p) => p.id === event.profileId);
                        return (
                          <MatchdayCard
                            key={event.id}
                            event={event}
                            playerName={profile?.playerName}
                            colorHex={profile?.colorHex}
                            compact
                            onResolveMismatch={handleResolveMismatch}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Compact Timeline or Calendar Grid View */
              <div className="pb-4">
                <TimelineCalendarView
                  events={otherEvents}
                  profiles={profiles}
                  viewMode={viewMode}
                  onNavigate={(ev) =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${ev.venue.coordinates.lat},${ev.venue.coordinates.lng}`,
                      '_blank'
                    )
                  }
                />
              </div>
            )}

            {/* Past Events Collapsible Toggle */}
            {pastEvents.length > 0 && (
              <div className="pt-2 pb-10 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPastEvents((v) => !v)}
                  aria-expanded={showPastEvents}
                  className="inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-2xl border border-border-strong bg-surface-elevated text-xs font-bold text-text-secondary hover:text-text-primary hover:border-pitch transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-pitch"
                >
                  <HistoryIcon className="w-4 h-4 text-text-muted" />
                  <span>
                    {showPastEvents
                      ? `Piilota aiemmat / menneet ottelut (${pastEvents.length})`
                      : `Näytä aiemmat / menneet ottelut (${pastEvents.length})`}
                  </span>
                </button>
                {!showPastEvents && (
                  <span className="text-[11px] text-text-muted">
                    {pastEvents.length} aiempaa ottelua piilotettu selkeyden vuoksi
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-16 text-center">
            <Smartphone className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <h3 className="text-base font-semibold text-text-primary">Ei otteluita kalenterissa</h3>
            <p className="mx-auto mt-1 mb-4 max-w-sm text-sm text-text-secondary">
              Tuo joukkueesi kalenteri tai liitä valmentajan WhatsApp-viesti.
            </p>
            <button
              type="button"
              onClick={() => setIsSmartImportOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-pitch px-4 text-sm font-semibold text-text-inverse"
            >
              <Sparkles className="h-4 w-4" />
              Tuo ottelut
            </button>
          </div>
        )}
      </main>

      {/* Smart Multi-Tab AI Importer (WhatsApp, Excel, Sheets, OCR) */}
      <Suspense fallback={null}>
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        existingPlayers={playerNames}
        onImportClassic={handleImportCalendar}
      />

      {/* Family Logistics & Carpooling Modal */}
      <FamilyLogisticsModal
        isOpen={isLogisticsOpen}
        onClose={() => setIsLogisticsOpen(false)}
        events={rawEvents}
        profiles={profiles}
      />

      {/* Natural Language Q&A Modal */}
      <AskCopilotModal
        isOpen={isAskCopilotOpen}
        onClose={() => setIsAskCopilotOpen(false)}
        events={rawEvents}
        profiles={profiles}
      />

      {/* Calendar Import Modal */}
      <CalendarImportModal
        isOpen={isImportModalOpen}
        onClose={closeImport}
        onImport={handleImportCalendar}
        existingPlayers={playerNames}
        initialSport={importDefaults.sport}
        initialTeamUrl={importDefaults.url}
        initialTeamName={importDefaults.name}
        initialPlayerName={importDefaults.playerName}
      />

      {/* Family Management & Child Roster Modal */}
      <FamilyManageModal
        isOpen={isFamilyManageOpen}
        onClose={() => setIsFamilyManageOpen(false)}
        profiles={profiles}
        onOpenImportForPlayer={(playerName) => {
          setIsFamilyManageOpen(false);
          openAddTeam(playerName);
        }}
        onEditProfile={(profile) => openEditProfile(profile)}
        onOpenFamilyShare={() => {
          setIsFamilyManageOpen(false);
          setIsFamilyShareOpen(true);
        }}
        onOpenOnboardingWizard={() => {
          localStorage.removeItem('pelipaiva_onboarding_done');
          setIsOnboardingActive(true);
          setIsFamilyManageOpen(false);
        }}
      />

      {/* Zero-Auth Family Share & Backup Modal */}
      <FamilyShareModal
        isOpen={isFamilyShareOpen}
        onClose={() => setIsFamilyShareOpen(false)}
        profiles={profiles}
        onDataImported={() => {}}
      />
      </Suspense>
    </div>
  );
};
export default App;
