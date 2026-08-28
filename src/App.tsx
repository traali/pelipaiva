import React, { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteOfficialTeamData, ensureStoragePersistence, clearAllDatabaseData } from './lib/storage/db';
import { MatchdayCard } from './components/MatchdayCard';
import { MultiProfileHeader } from './components/MultiProfileHeader';
import { AmbientView } from './components/AmbientView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MatchdayEvent, SportType, PlayerProfile, HomeLocation } from './types/matchday';
import { LayoutList, Calendar as CalendarIcon, TableProperties, History as HistoryIcon } from 'lucide-react';
import { QuickDropInBar } from './components/QuickDropInBar';
import { TimelineCalendarView } from './components/TimelineCalendarView';
import { MatchStatsModal } from './components/MatchStatsModal';
import { unpackSharePayload } from './lib/sync/familyShare';
import { MissionControlHUD } from './components/MissionControlHUD';
import { DifficultDayAlert } from './components/DifficultDayAlert';
import { DemoBanner } from './components/DemoBanner';
import { WeekendStrip } from './components/WeekendStrip';
import { HeroMatchCard } from './components/HeroMatchCard';
import { TalkooBoard } from './components/TalkooBoard';
import { TournamentWeekendPanel } from './components/TournamentWeekendPanel';
import { runMissionControlGraph } from './lib/agents';
import { ingestSourceForProfile } from './lib/clubs/ingestOfficial';
import { generateOrResolveMatchStats } from './lib/stats/statsEngine';
import { helsinkiDateISO } from './lib/agents/time';
import { pickNextTeamColor, colorFromNameHint, swatchForHex } from './lib/sport/teamColors';
import { exampleTournamentFromUrl } from './lib/clubs/exampleTournaments';
import { searchPopularClubs } from './lib/clubs/popularClubsCatalog';
import { findExistingTeamProfile, generateStableProfileId } from './lib/clubs/attachTeam';
import { syncFamilyRosterCycle, hydrateRosterProfiles } from './lib/sync/familyCloud';
import { DEFAULT_HOME_LOCATION, saveHomeLocation } from './lib/storage/homeLocation';

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
const FamilyCalendarModal = lazy(() =>
  import('./components/FamilyCalendarModal').then((m) => ({ default: m.FamilyCalendarModal }))
);
const HomeLocationModal = lazy(() =>
  import('./components/HomeLocationModal').then((m) => ({ default: m.HomeLocationModal }))
);

export const App: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string>('all');
  const [isSmartImportOpen, setIsSmartImportOpen] = useState<boolean>(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState<boolean>(false);
  const [isHomeLocationOpen, setIsHomeLocationOpen] = useState<boolean>(false);
  const [isAskCopilotOpen, setIsAskCopilotOpen] = useState<boolean>(false);
  const [isFamilyShareOpen, setIsFamilyShareOpen] = useState<boolean>(false);
  const [isFamilyManageOpen, setIsFamilyManageOpen] = useState<boolean>(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [selectedStatsEvent, setSelectedStatsEvent] = useState<MatchdayEvent | null>(null);
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(false);
  const [isOnboardingActive, setIsOnboardingActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pelipaiva_onboarding_done') !== 'true';
    }
    return true;
  });
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
          } else {
            // FAMILY_CODES_OPS §7 mandates these client messages; the code
            // stays in the URL so a fix/retry is possible (M-28).
            const msg =
              res.error === 'unknown_family'
                ? 'Koodi ei ole voimassa. Tarkista koodi perheeltä.'
                : res.error === 'rate_limited'
                ? 'Liian monta yritystä — odota hetki ja yritä uudelleen.'
                : 'Verkkovirhe — tarkista yhteys ja yritä uudelleen.';
            window.alert(`Perheeseen liittyminen epäonnistui: ${msg}`);
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
  const homeSync = useLiveQuery(() => db.syncState.get('home_location'), []);

  const homeLocation: HomeLocation = useMemo(() => {
    if (homeSync && homeSync.syncKey) {
      try {
        const parsed = JSON.parse(homeSync.syncKey);
        if (parsed && parsed.coordinates && typeof parsed.coordinates.lat === 'number') {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem('pelipaiva_home_location');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.coordinates && typeof parsed.coordinates.lat === 'number') {
            return parsed;
          }
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_HOME_LOCATION;
  }, [homeSync]);

  const isDemoActive =
    profiles.length > 0 &&
    profiles.every(
      (p) =>
        p.id.startsWith('profile-ppj-') ||
        p.id.startsWith('profile-topola-') ||
        p.id.startsWith('profile-kw-') ||
        p.id === 'profile-hjk-demo'
    );

  const handleClearData = async () => {
    if (!window.confirm('Haluatko varmasti tyhjentää kaikki tiedot?')) return;
    await clearAllDatabaseData();
    setActiveProfileId('all');
    setIsOnboardingActive(true);
  };

  const handleEventUpdated = async (updated: MatchdayEvent) => {
    await db.events.put(updated).catch(console.warn);
    if (selectedStatsEvent?.id === updated.id) {
      setSelectedStatsEvent(updated);
    }
  };

  // Filter events by selected profile or player group and deduplicate reconciled events
  const filteredEvents = useMemo(() => {
    const rawFiltered = [...rawEvents]
      .filter((e) => {
        if (e.isHidden) return false;
        if (activeProfileId === 'all') return true;
        if (activeProfileId.startsWith('player:')) {
          const pName = activeProfileId.replace('player:', '').toLowerCase();
          const profile = profiles.find((p) => p.id === e.profileId);
          return (profile?.playerName || '').toLowerCase() === pName;
        }
        return e.profileId === activeProfileId;
      });

    // Find all linked officialFixtureIds on enriched calendar events
    const enrichedFixtureIds = new Set<string>();
    for (const e of rawFiltered) {
      if (e.officialFixtureId && !e.id.startsWith('fixture-')) {
        enrichedFixtureIds.add(e.officialFixtureId);
      }
    }

    // Suppress bare fixture duplicates if an enriched calendar event already represents it
    const deduplicated = rawFiltered.filter((e) => {
      if (e.id.startsWith('fixture-') && e.officialFixtureId && enrichedFixtureIds.has(e.officialFixtureId)) {
        return false;
      }
      return true;
    });

    return deduplicated.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [rawEvents, activeProfileId, profiles]);

  const [clockTick, setClockTick] = useState(0);

  // Re-run the mission-control graph once a minute so departure countdowns
  // track the wall clock instead of freezing at last data change (M-40/V62).
  useEffect(() => {
    const t = setInterval(() => setClockTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const snapshot = useMemo(
    () => runMissionControlGraph(rawEvents, profiles, new Date(), arrivalRules, homeLocation),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clockTick intentionally restarts the graph each minute
    [rawEvents, profiles, arrivalRules, clockTick, homeLocation]
  );

  const nowMs = Date.now();
  const pastEvents = useMemo(
    () => filteredEvents.filter((e) => new Date(e.endTime).getTime() < nowMs - 60 * 60 * 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredEvents, clockTick]
  );
  const upcomingEvents = useMemo(
    () => filteredEvents.filter((e) => new Date(e.endTime).getTime() >= nowMs - 60 * 60 * 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredEvents, clockTick]
  );

  const displayCardsEvents = useMemo(() => {
    if (showPastEvents) {
      return filteredEvents;
    }
    return upcomingEvents;
  }, [showPastEvents, upcomingEvents, filteredEvents]);

  const eventsGroupedByDay = useMemo(() => {
    const map = new Map<string, { dateStr: string; label: string; events: MatchdayEvent[] }>();
    for (const ev of displayCardsEvents) {
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
  }, [displayCardsEvents]);

  const handleImportCalendar = async (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string,
    colorHex?: string,
    squadFilters?: string[]
  ): Promise<{ success: boolean; count: number; error?: string }> => {
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

    const reused = findExistingTeamProfile(existing, playerName, url, sport);
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

      // Background Family Cloud Sync if active
      const syncRecord = await db.syncState.get('family');
      if (syncRecord && syncRecord.syncKey) {
        await db.syncState.put({ ...syncRecord, pendingUpload: true });
        syncFamilyRosterCycle(syncRecord.syncKey, db).catch((e) =>
          console.warn('[FAMILY_CLOUD] Background sync after add failed:', e)
        );
      }

      return { success: true, count: imported };
    } catch (err: any) {
      console.warn('Team / Calendar fetch error:', err);
      return {
        success: false,
        count: 0,
        error: err?.message || 'Kalenterin nouto epäonnistui. Tarkista verkko tai linkki.'
      };
    }
  };

  const playerNames = Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)));

  const openAddTeam = (playerName?: string) => {
    setImportDefaults({ playerName });
    setIsSmartImportOpen(true);
  };

  const openEditProfile = (profile: PlayerProfile) => {
    setImportDefaults({
      playerName: profile.playerName,
      name: profile.teamName,
      sport: profile.sport,
      url: profile.calendarUrl || profile.associationUrl || ''
    });
    setIsFamilyManageOpen(false);
    setIsSmartImportOpen(true);
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
      // Adopt only from machine-readable official data — never from a display
      // string, and never stamp the override when nothing was adopted (M-42/V59).
      const officialIso = ev.mismatchFlags.officialStartTimeIso;
      if (!officialIso) {
        return handleResolveMismatch(eventId, 'keep_calendar');
      }
      const updated: MatchdayEvent = {
        ...ev,
        startTime: officialIso,
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
    return (
      <AmbientView
        events={filteredEvents}
        profiles={profiles}
        onExit={() => {
          setIsAmbientMode(false);
          // Strip a deep-linked ambient param so reload doesn't re-trap (M-29).
          if (typeof window !== 'undefined' && (window.location.search.includes('ambient') || window.location.pathname === '/ambient')) {
            window.history.replaceState({}, document.title, '/');
          }
        }}
      />
    );
  }

  // If no profiles exist yet or onboarding is explicitly in progress, show the Interactive Onboarding Wizard
  if (profiles.length === 0 || isOnboardingActive) {
    return (
      <>
        <OnboardingWizard
          onFinishOnboarding={() => {
            localStorage.setItem('pelipaiva_onboarding_done', 'true');
            setIsOnboardingActive(false);
          }}
          existingProfilesCount={profiles.length}
          onOpenImportModal={(sport, url, name) => {
            setImportDefaults({ sport, url, name });
            setIsSmartImportOpen(true);
          }}
          onOpenFamilyShare={() => setIsFamilyShareOpen(true)}
          onOpenSmartImport={() => setIsSmartImportOpen(true)}
          onQuickAddTeam={async (playerName, teamName, sport, url) => {
            return await handleImportCalendar(playerName, teamName, sport, url);
          }}
          onRemoveTeam={handleRemoveImportedTeam}
        />
        <Suspense fallback={null}>
        <SmartImportModal
          isOpen={isSmartImportOpen}
          onClose={() => {
            setIsSmartImportOpen(false);
            setImportDefaults({});
          }}
          existingPlayers={playerNames}
          onImportClassic={handleImportCalendar}
          initialSport={importDefaults.sport}
          initialTeamUrl={importDefaults.url}
          initialTeamName={importDefaults.name}
          initialPlayerName={importDefaults.playerName}
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
        onOpenHomeLocation={() => setIsHomeLocationOpen(true)}
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
              onOpenCalendarSubscribe={() => setIsCalendarModalOpen(true)}
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

        {viewMode === 'cards' ? (
          <>
            {/* Quick Drop-In Bar & Photo OCR at Top */}
            <QuickDropInBar
              existingPlayers={Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)))}
              activeProfilePlayerName={
                activeProfileId.startsWith('player:')
                  ? activeProfileId.replace('player:', '')
                  : profiles.find((p) => p.id === activeProfileId)?.playerName
              }
              onEventCreated={() => {}}
            />

            {snapshot.difficultDays && snapshot.difficultDays.length > 0 && (
              <DifficultDayAlert
                warnings={snapshot.difficultDays}
                onOpenLogistics={() => setIsLogisticsOpen(true)}
              />
            )}

            {/* Collapsible Weekend Overview & Volunteer Duties */}
            {(snapshot.days.some((d) => d.events.length > 0) ||
              snapshot.talkoo.shifts.length > 0 ||
              snapshot.tournaments.length > 0) && (
              <div className="mb-5 rounded-2xl border border-border-subtle bg-surface-elevated/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsOverviewExpanded((v) => !v)}
                  aria-expanded={isOverviewExpanded}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-pitch" />
                    <span>Viikonlopun tilannekuva & talkoot</span>
                    {snapshot.talkoo.shifts.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-whistle/20 text-whistle text-[10px] font-black">
                        ☕ Talkoovuoro
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-pitch">
                    {isOverviewExpanded ? 'Piilota ▲' : 'Avaa viikonloppuraportti ▼'}
                  </span>
                </button>

                {isOverviewExpanded && (
                  <div className="p-3 pt-1 border-t border-border-subtle/50 flex flex-col gap-3">
                    {snapshot.days.length > 0 && (
                      <WeekendStrip
                        days={snapshot.days}
                        weekendLabel={snapshot.weekendLabel}
                        onSelectEvent={(eventId) => {
                          // Wire the previously-dead strip buttons (M-44):
                          // select the event so it opens the stats modal.
                          const ev = rawEvents.find((e) => e.id === eventId);
                          if (ev && !ev.isTraining) setSelectedStatsEvent(ev);
                        }}
                      />
                    )}
                    <TalkooBoard talkoo={snapshot.talkoo} />
                    <TournamentWeekendPanel blocks={snapshot.tournaments} />
                  </div>
                )}
              </div>
            )}

            {filteredEvents.length > 0 ? (
              /* Cards Feed with Structured Day Containers */
              <div className="flex flex-col gap-6 pb-4">
                {eventsGroupedByDay.map((dayGroup) => (
                  <section
                    key={dayGroup.dateStr}
                    className="rounded-3xl border border-border-strong/70 bg-surface/60 backdrop-blur-sm p-3.5 sm:p-4.5 flex flex-col gap-3.5 shadow-sm"
                  >
                    {/* Day Section Header (Inside the Day Container) */}
                    <div className="pb-2.5 border-b border-border-subtle flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-pitch/15 text-pitch">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <h2 className="text-sm font-black tracking-wide text-text-primary">
                          {dayGroup.label}
                        </h2>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border-subtle">
                        {dayGroup.events.length} {dayGroup.events.length === 1 ? 'ottelu' : 'ottelua'}
                      </span>
                    </div>

                    {/* Day's Match Cards (Enclosed inside this Day Container) */}
                    <div className="flex flex-col gap-3">
                      {dayGroup.events.map((event) => {
                        const profile = profiles.find((p) => p.id === event.profileId);
                        const isFeaturedNext = event.id === snapshot.nextEvent?.id;

                        if (isFeaturedNext) {
                          return (
                            <HeroMatchCard
                              key={event.id}
                              event={event}
                              allEvents={rawEvents}
                              profile={snapshot.nextPlayer || profile}
                              kit={snapshot.kitByEventId[event.id]}
                              conflicts={snapshot.conflicts}
                              onNavigate={() => {
                                const coords = event.parking?.coordinates || event.venue?.coordinates;
                                const destination =
                                  coords?.lat != null && coords?.lng != null
                                    ? `${coords.lat},${coords.lng}`
                                    : encodeURIComponent(event.venue?.name || 'Kenttä');
                                window.open(
                                  `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
                                  '_blank',
                                  'noopener,noreferrer'
                                );
                              }}
                              onOpenStats={() => setSelectedStatsEvent(event)}
                              onEventUpdated={handleEventUpdated}
                            />
                          );
                        }

                        return (
                          <MatchdayCard
                            key={event.id}
                            event={event}
                            allEvents={rawEvents}
                            playerName={profile?.playerName}
                            colorHex={profile?.colorHex}
                            compact
                            conflicts={snapshot.conflicts}
                            onResolveMismatch={handleResolveMismatch}
                            onEventUpdated={handleEventUpdated}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
                {pastEvents.length > 0 && (
                  <div className="pt-2 pb-6 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPastEvents((v) => !v)}
                      aria-expanded={showPastEvents}
                      className="inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-2xl border border-border-strong bg-surface-elevated text-xs font-bold text-text-secondary hover:text-text-primary hover:border-pitch transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-pitch"
                    >
                      <HistoryIcon className="w-4 h-4 text-pitch" />
                      <span>
                        {showPastEvents
                          ? `Piilota aiemmat ottelut (${pastEvents.length})`
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
              </div>
            ) : (
              <div className="rounded-3xl border border-border-subtle bg-surface p-8 text-center my-4 flex flex-col items-center gap-3">
                <div className="p-3 rounded-2xl bg-surface-elevated text-text-muted">
                  <CalendarIcon className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-text-primary">Ei tulevia otteluita kalenterissa</h3>
                  <p className="text-xs text-text-muted max-w-sm">
                    Tulevia otteluita ei ole vielä julkaistu sarjajärjestelmässä tai kausi on päättynyt.
                  </p>
                </div>

                {pastEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPastEvents(true)}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-2xl border border-border-strong bg-surface-elevated text-xs font-bold text-pitch hover:border-pitch transition-all cursor-pointer shadow-xs"
                  >
                    <HistoryIcon className="w-4 h-4" />
                    <span>Katso menneet ottelut ({pastEvents.length} kpl)</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          /* Compact Timeline or Calendar Grid View */
          <div className="pb-4">
            <TimelineCalendarView
              events={filteredEvents}
              profiles={profiles}
              viewMode={viewMode}
              conflicts={snapshot.conflicts}
              onSelectEvent={(ev) => setSelectedStatsEvent(ev)}
              onClearFilter={() => setActiveProfileId('all')}
              onNavigate={(ev) => {
                const coords = ev.parking?.coordinates || ev.venue?.coordinates;
                const destination =
                  coords?.lat != null && coords?.lng != null
                    ? `${coords.lat},${coords.lng}`
                    : encodeURIComponent(ev.venue?.name || 'Kenttä');
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
                  '_blank',
                  'noopener,noreferrer'
                );
              }}
            />
          </div>
        )}
      </main>

      {/* Unified Smart Multi-Tab Importer (Federation URL, Cups, WhatsApp, Excel, OCR) */}
      <Suspense fallback={null}>
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => {
          setIsSmartImportOpen(false);
          setImportDefaults({});
        }}
        existingPlayers={playerNames}
        initialSport={importDefaults.sport}
        initialTeamUrl={importDefaults.url}
        initialTeamName={importDefaults.name}
        initialPlayerName={importDefaults.playerName}
        onImportClassic={handleImportCalendar}
      />

      {/* Family Logistics & Carpooling Modal */}
      <FamilyLogisticsModal
        isOpen={isLogisticsOpen}
        onClose={() => setIsLogisticsOpen(false)}
        events={rawEvents}
        profiles={profiles}
        homeLocation={homeLocation}
        onOpenHomeModal={() => {
          setIsLogisticsOpen(false);
          setIsHomeLocationOpen(true);
        }}
      />

      {/* Home Location & Active Transit Modal */}
      <HomeLocationModal
        isOpen={isHomeLocationOpen}
        onClose={() => setIsHomeLocationOpen(false)}
        currentHome={homeLocation}
        onSaveHome={async (h) => {
          await saveHomeLocation(h);
        }}
      />

      {/* Natural Language Q&A Modal */}
      <AskCopilotModal
        isOpen={isAskCopilotOpen}
        onClose={() => setIsAskCopilotOpen(false)}
        events={rawEvents}
        profiles={profiles}
      />

      {/* Family Management & Child Roster Modal */}
      <FamilyManageModal
        isOpen={isFamilyManageOpen}
        onClose={() => setIsFamilyManageOpen(false)}
        profiles={profiles}
        homeLocation={homeLocation}
        onOpenHomeLocation={() => {
          setIsFamilyManageOpen(false);
          setIsHomeLocationOpen(true);
        }}
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

      {/* Live Family Calendar Subscription Modal (webcal://) */}
      <FamilyCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        events={rawEvents}
        profiles={profiles}
      />

      {/* Global Interactive Match Stats Modal (for Timeline & Calendar selections) */}
      {selectedStatsEvent && !selectedStatsEvent.isTraining && (
        <MatchStatsModal
          isOpen={true}
          onClose={() => setSelectedStatsEvent(null)}
          stats={
            selectedStatsEvent.stats ||
            generateOrResolveMatchStats(
              selectedStatsEvent.homeTeam,
              selectedStatsEvent.awayTeam,
              selectedStatsEvent.sport
            )
          }
          homeTeam={selectedStatsEvent.homeTeam}
          awayTeam={selectedStatsEvent.awayTeam || 'Vastustaja'}
          playerName={profiles.find((p) => p.id === selectedStatsEvent.profileId)?.playerName}
          playerLog={selectedStatsEvent.playerLog}
          score={selectedStatsEvent.score}
          sport={selectedStatsEvent.sport}
          onSavePlayerLog={async (log, updatedScore) => {
            const updates: Partial<MatchdayEvent> = {
              playerLog: log,
              score: updatedScore || selectedStatsEvent.score
            };
            // Persist only the player's own log/score — never the synthetic
            // preview stats (M-05).
            await db.events.update(selectedStatsEvent.id, updates).catch(console.warn);
            setSelectedStatsEvent((prev) => (prev ? { ...prev, ...updates } : null));
          }}
        />
      )}
      </Suspense>
    </div>
  );
};
export default App;
