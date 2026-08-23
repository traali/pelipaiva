import React, { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureStoragePersistence } from './lib/storage/db';
import { MatchdayCard } from './components/MatchdayCard';
import { MultiProfileHeader } from './components/MultiProfileHeader';
import { AmbientView } from './components/AmbientView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { parseICSFeed } from './lib/calendar/icsParser';
import { generateMatchdayBriefing } from './lib/ai/deterministicReasoner';
import { calculateParkingEase } from './lib/parking/parkingEaseEngine';
import { fetchFmiMatchWeather } from './lib/weather/fmiWeatherEngine';
import { MatchdayEvent, SportType } from './types/matchday';
import { LayoutList, Calendar as CalendarIcon, TableProperties } from 'lucide-react';
import { FamilyShareModal } from './components/FamilyShareModal';
import { SmartImportModal } from './components/SmartImportModal';
import { FamilyLogisticsModal } from './components/FamilyLogisticsModal';
import { AskCopilotModal } from './components/AskCopilotModal';
import { FamilyManageModal } from './components/FamilyManageModal';
import { QuickDropInBar } from './components/QuickDropInBar';
import { TimelineCalendarView } from './components/TimelineCalendarView';
import { MatchStatsModal } from './components/MatchStatsModal';
import { unpackSharePayload } from './lib/sync/familyShare';
import { MissionControlHUD } from './components/MissionControlHUD';
import { DifficultDayAlert } from './components/DifficultDayAlert';
import { WeekendStrip } from './components/WeekendStrip';
import { HeroMatchCard } from './components/HeroMatchCard';
import { TalkooBoard } from './components/TalkooBoard';
import { TournamentWeekendPanel } from './components/TournamentWeekendPanel';
import { runMissionControlGraph } from './lib/agents';
import {
  parseAssociationUrl,
  generateOrResolveMatchStats
} from './lib/stats/statsEngine';
import { ingestOfficialForProfile } from './lib/clubs/ingestOfficial';
import { resolveSportsVenue } from './lib/geo/sportsGeocoder';
import { EXTRA_PROFILES, buildWeekendShowcaseEvents } from './lib/matchday/seedWeekendExtras';
import { pickNextTeamColor, colorFromNameHint, swatchForHex } from './lib/sport/teamColors';
import { exampleTournamentFromUrl } from './lib/clubs/exampleTournaments';
import { searchPopularClubs } from './lib/clubs/popularClubsCatalog';
import { findExistingTeamProfile, generateStableProfileId } from './lib/clubs/attachTeam';
import { syncFamilyRosterCycle, hydrateRosterProfiles } from './lib/sync/familyCloud';

export const App: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string>('all');
  const [isSmartImportOpen, setIsSmartImportOpen] = useState<boolean>(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState<boolean>(false);
  const [isAskCopilotOpen, setIsAskCopilotOpen] = useState<boolean>(false);
  const [isFamilyShareOpen, setIsFamilyShareOpen] = useState<boolean>(false);
  const [isFamilyManageOpen, setIsFamilyManageOpen] = useState<boolean>(false);
  const [selectedStatsEvent, setSelectedStatsEvent] = useState<MatchdayEvent | null>(null);
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(false);
  const [isOnboardingActive, setIsOnboardingActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pelipaiva_onboarding_done') !== 'true';
    }
    return true;
  });
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'timeline' | 'calendar'>('cards');
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

    // 30s interval
    syncTimer = setInterval(runBackgroundSync, 30000);

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
          await syncFamilyRosterCycle(perheCode, db);
          window.history.replaceState({}, document.title, window.location.pathname);
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
            // Clean up URL query param
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

  const isDemoActive = profiles.some(
    (p) =>
      p.id.startsWith('profile-ppj-') ||
      p.id.startsWith('profile-topola-') ||
      p.id.startsWith('profile-kw-') ||
      p.id === 'profile-hjk-demo'
  );
  const needsDemoRefresh =
    isDemoActive &&
    !isSeeding &&
    eventsQuery !== undefined &&
    !rawEvents.some((e) => e.id === 'demo-elt-aada-1');

  // Seed family demo: PPJ league sides + Helsinki Cup / Espoo Liikkuu / KW Memorial
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

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0] || '2026-08-21';
    const tmrw = new Date(now.getTime() + 86400000);
    const tmrwStr = tmrw.toISOString().split('T')[0] || '2026-08-22';
    const dayAfter = new Date(now.getTime() + 172800000);
    const dayAfterStr = dayAfter.toISOString().split('T')[0] || '2026-08-23';

    const demoEventsConfig = [
      {
        profileId: 'profile-ppj-185085',
        title: 'PPJ/Laru sin vs KäPa',
        homeTeam: 'PPJ/Laru sin',
        awayTeam: 'KäPa',
        sport: 'football' as SportType,
        venueName: 'Väinämöisen kenttä (Väiski)',
        startTime: `${todayStr}T16:30:00+03:00`,
        endTime: `${todayStr}T18:00:00+03:00`,
        warmupTime: `${todayStr}T15:45:00+03:00`,
        duty: 'Kahviovuoro klo 16:00 - 18:00'
      },
      {
        profileId: 'profile-ppj-185083',
        title: 'PPJ/Laru mus vs FC Honka',
        homeTeam: 'PPJ/Laru mus',
        awayTeam: 'FC Honka',
        sport: 'football' as SportType,
        venueName: 'Tapiolan Urheilupuisto TN 2',
        startTime: `${tmrwStr}T14:30:00+03:00`,
        endTime: `${tmrwStr}T16:00:00+03:00`,
        warmupTime: `${tmrwStr}T13:45:00+03:00`
      },
      {
        profileId: 'profile-ppj-185086',
        title: 'PPJ/Laru oran vs VJS',
        homeTeam: 'PPJ/Laru oran',
        awayTeam: 'VJS',
        sport: 'football' as SportType,
        venueName: 'Puotilan Tekonurmi (Bubu)',
        startTime: `${dayAfterStr}T15:00:00+03:00`,
        endTime: `${dayAfterStr}T16:30:00+03:00`,
        warmupTime: `${dayAfterStr}T14:15:00+03:00`
      }
    ];

    for (let i = 0; i < demoEventsConfig.length; i++) {
      const cfg = demoEventsConfig[i]!;
      const venue = await resolveSportsVenue(cfg.venueName);
      const weather = await fetchFmiMatchWeather(venue.coordinates, cfg.startTime, cfg.endTime);
      const parking = calculateParkingEase(venue.name, venue.coordinates, new Date(cfg.startTime));
      const stats = generateOrResolveMatchStats(cfg.homeTeam, cfg.awayTeam, cfg.sport);

      const ev: MatchdayEvent = {
        id: `demo-event-${i + 1}`,
        profileId: cfg.profileId,
        sport: cfg.sport,
        eventType: 'match',
        isTraining: false,
        title: cfg.title,
        homeTeam: cfg.homeTeam,
        awayTeam: cfg.awayTeam,
        isHomeMatch: true,
        startTime: cfg.startTime,
        endTime: cfg.endTime,
        warmupTime: cfg.warmupTime,
        venue,
        volunteerDuty: cfg.duty,
        weather,
        parking,
        stats,
        reconciliationStatus: 'auto_matched',
        confidenceScore: 0.95
      };
      ev.briefing = generateMatchdayBriefing(ev, [ev]);
      await db.events.put(ev);
    }
    for (const extra of buildWeekendShowcaseEvents()) {
      await db.events.put(extra);
    }
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (needsDemoRefresh && !isSeeding) {
      void handleStartDemo();
    }
  }, [needsDemoRefresh, isSeeding]);

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

  // Scoped profiles and events for Mission Control HUD & Hero Match Card
  const activeProfiles = useMemo(() => {
    if (activeProfileId === 'all') return profiles;
    if (activeProfileId.startsWith('player:')) {
      const pName = activeProfileId.replace('player:', '').toLowerCase();
      return profiles.filter((p) => (p.playerName || '').toLowerCase() === pName);
    }
    return profiles.filter((p) => p.id === activeProfileId);
  }, [profiles, activeProfileId]);

  const snapshot = useMemo(
    () =>
      runMissionControlGraph(
        filteredEvents,
        activeProfiles,
        new Date()
      ),
    [filteredEvents, activeProfiles]
  );

  const otherCardsEvents = useMemo(
    () => filteredEvents.filter((e) => e.id !== snapshot.nextEvent?.id),
    [filteredEvents, snapshot.nextEvent?.id]
  );

  const eventsGroupedByDay = useMemo(() => {
    const map = new Map<string, { dateStr: string; label: string; events: MatchdayEvent[] }>();
    for (const ev of otherCardsEvents) {
      const d = new Date(ev.startTime);
      const key = d.toISOString().split('T')[0] || '';
      if (!map.has(key)) {
        const fiLabel = d.toLocaleDateString('fi-FI', {
          weekday: 'long',
          day: 'numeric',
          month: 'numeric'
        });
        const capitalized = fiLabel.charAt(0).toUpperCase() + fiLabel.slice(1);
        map.set(key, { dateStr: key, label: capitalized, events: [] });
      }
      map.get(key)!.events.push(ev);
    }
    return Array.from(map.values());
  }, [otherCardsEvents]);

  const handleImportCalendar = async (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string,
    colorHex?: string
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

    const reused = findExistingTeamProfile(existing, playerName, url);
    const profileId = reused?.id || generateStableProfileId(playerName, url);

    if (reused) {
      await db.profiles.update(profileId, {
        teamName: teamName || reused.teamName,
        sport,
        primaryColor: swatch.label,
        calendarUrl: url,
        colorHex: swatch.hex
      });
    } else {
      await db.profiles.add({
        id: profileId,
        playerName,
        teamName,
        sport,
        primaryColor: swatch.label,
        calendarUrl: url,
        colorHex: swatch.hex
      });
    }

    try {
      const parsedAssoc = parseAssociationUrl(url);
      const cup = exampleTournamentFromUrl(url);
      let importedCount = 0;

      if (parsedAssoc || cup) {
        const result = await ingestOfficialForProfile({
          profileId,
          url,
          playerName,
          teamName,
          sport,
          dbInstance: db
        });
        importedCount = result.importedCount;
      } else {
        // Standard iCal feed from Nimenhuuto, MyClub, Jopox
        const proxyUrl = 'https://pelipaiva-edge.sakkoja.workers.dev/api/proxy/ics';
        const target = `${proxyUrl}?url=${encodeURIComponent(url)}`;
        const res = await fetch(target);
        if (!res.ok) {
          throw new Error(`Kalenterin haku epäonnistui (HTTP ${res.status})`);
        }
        const text = await res.text();
        const parsed = await parseICSFeed(text, profileId, sport);
        for (const ev of parsed) {
          const weather = await fetchFmiMatchWeather(ev.venue.coordinates, ev.startTime, ev.endTime);
          const parking = calculateParkingEase(ev.venue.name, ev.venue.coordinates, new Date(ev.startTime));
          const fullEv: MatchdayEvent = { ...ev, weather, parking };
          fullEv.briefing = generateMatchdayBriefing(fullEv, parsed);
          await db.events.put(fullEv);
        }
        importedCount = parsed.length;
      }

      // Background Family Cloud Sync if active
      const syncRecord = await db.syncState.get('family');
      if (syncRecord && syncRecord.syncKey) {
        await db.syncState.put({ ...syncRecord, pendingUpload: true });
        syncFamilyRosterCycle(syncRecord.syncKey, db).catch((e) =>
          console.warn('[FAMILY_CLOUD] Background sync after add failed:', e)
        );
      }

      if (importedCount === 0 && !cup) {
        return {
          success: false,
          count: 0,
          error: 'Otteluita ei löytynyt annetusta linkistä. Tarkista osoite tai kokeile toista tuontitapaa.'
        };
      }

      return { success: true, count: importedCount };
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

  const activePlayerName = activeProfileId.startsWith('player:')
    ? activeProfileId.replace('player:', '')
    : profiles.find((p) => p.id === activeProfileId)?.playerName;

  const handleRefreshAll = async () => {
    setIsSyncing(true);
    try {
      for (const ev of rawEvents) {
        const weather = await fetchFmiMatchWeather(ev.venue.coordinates, ev.startTime, ev.endTime);
        const parking = calculateParkingEase(ev.venue.name, ev.venue.coordinates, new Date(ev.startTime));
        const updated: MatchdayEvent = { ...ev, weather, parking };
        updated.briefing = generateMatchdayBriefing(updated, rawEvents);
        await db.events.put(updated);
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
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

  // If no profiles exist yet or onboarding is explicitly in progress, show the Interactive Onboarding Wizard
  if (profiles.length === 0 || isOnboardingActive) {
    return (
      <>
        <OnboardingWizard
          onStartDemo={() => {
            localStorage.setItem('pelipaiva_onboarding_done', 'true');
            setIsOnboardingActive(false);
            handleStartDemo();
          }}
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
        />
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
        <FamilyShareModal
          isOpen={isFamilyShareOpen}
          onClose={() => setIsFamilyShareOpen(false)}
          profiles={profiles}
          onDataImported={() => setActiveProfileId('all')}
        />
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
              <div className="mb-4 rounded-2xl border border-border-subtle bg-surface-elevated/40 overflow-hidden">
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
                      <WeekendStrip days={snapshot.days} weekendLabel={snapshot.weekendLabel} />
                    )}
                    <TalkooBoard talkoo={snapshot.talkoo} />
                    <TournamentWeekendPanel blocks={snapshot.tournaments} />
                  </div>
                )}
              </div>
            )}

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
              /* Cards Feed with Sticky Day Dividers */
              <div className="flex flex-col gap-6 pb-4">
                {eventsGroupedByDay.map((dayGroup) => (
                  <div key={dayGroup.dateStr} className="flex flex-col gap-3">
                    {/* Day Section Header */}
                    <div className="py-2 px-3 rounded-2xl bg-surface-elevated/90 backdrop-blur-md border border-border-subtle flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-pitch/15 text-pitch">
                          <CalendarIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black tracking-wide text-text-primary">
                          {dayGroup.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-secondary border border-border-subtle">
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
                            conflicts={snapshot.conflicts}
                            onResolveMismatch={handleResolveMismatch}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center my-4">
                <CalendarIcon className="mx-auto mb-2.5 h-8 w-8 text-text-muted" />
                <h3 className="text-sm font-bold text-text-primary">Ei otteluita valitulla suodatuksella</h3>
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
              onNavigate={(ev) =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${ev.venue.coordinates.lat},${ev.venue.coordinates.lng}`,
                  '_blank'
                )
              }
            />
          </div>
        )}
      </main>

      {/* Unified Smart Multi-Tab Importer (Federation URL, Cups, WhatsApp, Excel, OCR) */}
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
        onOpenImportForPlayer={(playerName) => {
          setIsFamilyManageOpen(false);
          openAddTeam(playerName);
        }}
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
            if (!selectedStatsEvent.stats) {
              updates.stats = generateOrResolveMatchStats(
                selectedStatsEvent.homeTeam,
                selectedStatsEvent.awayTeam,
                selectedStatsEvent.sport
              );
            }
            await db.events.update(selectedStatsEvent.id, updates).catch(console.warn);
            setSelectedStatsEvent((prev) => (prev ? { ...prev, ...updates } : null));
          }}
        />
      )}
    </div>
  );
};
export default App;
