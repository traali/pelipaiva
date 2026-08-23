import React, { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureStoragePersistence } from './lib/storage/db';
import { MatchdayCard } from './components/MatchdayCard';
import { MultiProfileHeader } from './components/MultiProfileHeader';
import { CalendarImportModal } from './components/CalendarImportModal';
import { AmbientView } from './components/AmbientView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { parseICSFeed } from './lib/calendar/icsParser';
import { generateMatchdayBriefing } from './lib/ai/deterministicReasoner';
import { calculateParkingEase } from './lib/parking/parkingEaseEngine';
import { fetchFmiMatchWeather } from './lib/weather/fmiWeatherEngine';
import { MatchdayEvent, SportType } from './types/matchday';
import { Sparkles, Smartphone } from 'lucide-react';
import { FamilyShareModal } from './components/FamilyShareModal';
import { SmartImportModal } from './components/SmartImportModal';
import { FamilyLogisticsModal } from './components/FamilyLogisticsModal';
import { AskCopilotModal } from './components/AskCopilotModal';
import { FamilyManageModal } from './components/FamilyManageModal';
import { QuickDropInBar } from './components/QuickDropInBar';
import { unpackSharePayload } from './lib/sync/familyShare';
import { MissionControlHUD } from './components/MissionControlHUD';
import { WeekendStrip } from './components/WeekendStrip';
import { HeroMatchCard } from './components/HeroMatchCard';
import { TalkooBoard } from './components/TalkooBoard';
import { TournamentWeekendPanel } from './components/TournamentWeekendPanel';
import { runMissionControlGraph } from './lib/agents';
import {
  parseAssociationUrl,
  extractOfficialTeamData,
  generateOrResolveMatchStats
} from './lib/stats/statsEngine';
import { resolveSportsVenue } from './lib/geo/sportsGeocoder';
import { EXTRA_PROFILES, buildWeekendShowcaseEvents } from './lib/matchday/seedWeekendExtras';
import { pickNextTeamColor, colorFromNameHint, swatchForHex } from './lib/sport/teamColors';
import { exampleTournamentFromUrl, isCupName, mergeOfficialWithCupFallback, isUglyTeamName } from './lib/clubs/exampleTournaments';
import { searchPopularClubs } from './lib/clubs/popularClubsCatalog';
import { findExistingTeamProfile, generateStableProfileId } from './lib/clubs/attachTeam';
import { syncFamilyRosterCycle, hydrateRosterProfiles } from './lib/sync/familyCloud';

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

      // Handle ?perhe=SAIMA-4 deep link join
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
    if (!needsDemoRefresh || isSeeding) return;
    void handleStartDemo();
  }, [needsDemoRefresh, isSeeding]);

  const handleClearData = async () => {
    await db.profiles.clear();
    await db.events.clear();
    setActiveProfileId('all');
    setIsOnboardingActive(true);
  };

  // Filter events by selected profile or player group
  const filteredEvents = [...rawEvents]
    .filter((e) => {
      if (activeProfileId === 'all') return true;
      if (activeProfileId.startsWith('player:')) {
        const pName = activeProfileId.replace('player:', '').toLowerCase();
        const profile = profiles.find((p) => p.id === e.profileId);
        return (profile?.playerName || '').toLowerCase() === pName;
      }
      return e.profileId === activeProfileId;
    })
    .sort((a, b) => {
      const now = Date.now() - 2 * 3600 * 1000;
      const aT = new Date(a.startTime).getTime();
      const bT = new Date(b.startTime).getTime();
      const aUp = aT >= now;
      const bUp = bT >= now;
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return aUp ? aT - bT : bT - aT;
    });

  const snapshot = useMemo(
    () => runMissionControlGraph(rawEvents, profiles, new Date()),
    [rawEvents, profiles]
  );

  const handleImportCalendar = async (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string,
    colorHex?: string
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
      let officialData: Awaited<ReturnType<typeof extractOfficialTeamData>> | null = null;
      if (parsedAssoc) {
        try {
          officialData = await extractOfficialTeamData(parsedAssoc, {
            customTeamName: cup?.teamName || teamName,
            fallbackToSynthetic: false
          });
        } catch (err) {
          console.warn('Official fetch failed, using cup fallback if any', err);
        }
      }

      officialData = mergeOfficialWithCupFallback(cup, officialData);

      if (officialData && officialData.fixtures.length > 0) {
        for (const fix of officialData.fixtures) {
          await db.officialFixtures.put(fix);
        }

        const resolvedName =
          officialData.teamName && !isUglyTeamName(officialData.teamName)
            ? officialData.teamName
            : cup?.teamName || teamName;

        await db.profiles.update(profileId, {
          teamName: resolvedName,
          teamId: parsedAssoc?.teamId || cup?.teamId,
          associationType: parsedAssoc?.association,
          associationUrl: url
        });

        const eventsToInsert: MatchdayEvent[] = [];
        const cupish = Boolean(cup) || isCupName(officialData.leagueName);
        const fixtures = cupish
          ? officialData.fixtures.filter((f) => f.status !== 'cancelled')
          : officialData.fixtures;
        for (const fixture of fixtures) {
          const venue = await resolveSportsVenue(fixture.venueName, {
            lat: fixture.venueLat,
            lng: fixture.venueLng,
            city: fixture.venueCity
          });
          const startTime = fixture.startTime || new Date().toISOString();
          const endTime =
            fixture.endTime || new Date(new Date(startTime).getTime() + 90 * 60 * 1000).toISOString();
          const warmupTime = new Date(new Date(startTime).getTime() - 45 * 60 * 1000).toISOString();

          const isHome =
            fixture.isHome ??
            (fixture.homeTeam.toLowerCase().includes((resolvedName || teamName).toLowerCase()) ||
              fixture.homeTeam.toLowerCase().includes(playerName.toLowerCase()));

          const thisCup = cupish || isCupName(fixture.leagueName);
          const matchEvent: MatchdayEvent = {
            id: `fixture-${profileId}-${fixture.id}`,
            profileId,
            title: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            eventType: thisCup ? 'tournament' : 'match',
            isTraining: false,
            sport: officialData.sport || parsedAssoc?.sport || sport,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            isHomeMatch: isHome,
            startTime,
            endTime,
            warmupTime,
            tournamentName: thisCup ? fixture.leagueName || officialData.leagueName : undefined,
            venue,
            officialFixtureId: fixture.id,
            reconciliationStatus: 'auto_matched',
            confidenceScore: 1.0,
            stats: thisCup ? undefined : generateOrResolveMatchStats(fixture.homeTeam, fixture.awayTeam, officialData.sport)
          };

          const weather = await fetchFmiMatchWeather(venue.coordinates, startTime, endTime);
          const parking = calculateParkingEase(venue.name, venue.coordinates, new Date(startTime));
          matchEvent.weather = weather;
          matchEvent.parking = parking;
          matchEvent.briefing = generateMatchdayBriefing(matchEvent, [matchEvent]);
          eventsToInsert.push(matchEvent);
        }

        for (const ev of eventsToInsert) {
          await db.events.put(ev);
        }
      } else if (!parsedAssoc) {
        // Standard iCal feed from Nimenhuuto, MyClub, Jopox
        const proxyUrl = 'https://pelipaiva-edge.sakkoja.workers.dev/api/proxy/ics';
        const target = `${proxyUrl}?url=${encodeURIComponent(url)}`;
        const res = await fetch(target);
        const text = await res.text();
        const parsed = await parseICSFeed(text, profileId, sport);
        for (const ev of parsed) {
          const weather = await fetchFmiMatchWeather(ev.venue.coordinates, ev.startTime, ev.endTime);
          const parking = calculateParkingEase(ev.venue.name, ev.venue.coordinates, new Date(ev.startTime));
          const fullEv: MatchdayEvent = { ...ev, weather, parking };
          fullEv.briefing = generateMatchdayBriefing(fullEv, parsed);
          await db.events.put(fullEv);
        }
      }

      // Background Family Cloud Sync if active
      const syncRecord = await db.syncState.get('family');
      if (syncRecord && syncRecord.syncKey) {
        syncFamilyRosterCycle(syncRecord.syncKey, db).catch((e) =>
          console.warn('[FAMILY_CLOUD] Background sync after add failed:', e)
        );
      }
    } catch (err) {
      console.warn('Team / Calendar fetch error:', err);
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
            setIsImportModalOpen(true);
          }}
          onOpenFamilyShare={() => setIsFamilyShareOpen(true)}
          onOpenSmartImport={() => setIsSmartImportOpen(true)}
          onQuickAddTeam={async (playerName, teamName, sport, url) => {
            await handleImportCalendar(playerName, teamName, sport, url);
          }}
        />
        <SmartImportModal
          isOpen={isSmartImportOpen}
          onClose={() => setIsSmartImportOpen(false)}
          existingPlayers={Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)))}
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

      <main className="mx-auto max-w-5xl px-4 pt-4">
        <div className="mb-4">
          <MultiProfileHeader
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSelectProfile={(id) => setActiveProfileId(id)}
            onAddProfile={() => openAddTeam(activePlayerName)}
            onOpenFamilyManage={() => setIsFamilyManageOpen(true)}
          />
        </div>

        {snapshot.days.length > 0 && (
          <WeekendStrip days={snapshot.days} weekendLabel={snapshot.weekendLabel} />
        )}

        {snapshot.conflicts.length > 0 && (
          <button
            type="button"
            onClick={() => setIsLogisticsOpen(true)}
            className="mb-4 flex min-h-11 w-full items-start gap-2 rounded-xl border border-whistle/35 bg-whistle/12 px-3 py-3 text-left"
          >
            <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-whistle">
              Ristiriita
            </span>
            <span className="text-sm text-text-primary">{snapshot.conflicts[0]?.message}</span>
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
          <div className="flex flex-col gap-3 pb-8">
            {filteredEvents
              .filter((e) => e.id !== snapshot.nextEvent?.id)
              .map((event) => {
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
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        existingPlayers={Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)))}
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
    </div>
  );
};
export default App;
