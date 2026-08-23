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
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [importDefaults, setImportDefaults] = useState<{
    sport?: SportType;
    url?: string;
    name?: string;
  }>({});
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Listen to network status changes
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

  // Check URL params for ?share= or ?ambient=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ambient') === 'true' || window.location.pathname === '/ambient') {
        setIsAmbientMode(true);
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
  const rawEvents = useLiveQuery(() => db.events.toArray(), []) || [];

  const isDemoActive = profiles.some((p) => p.id.startsWith('profile-ppj-') || p.id === 'profile-hjk-demo');

  // Seed user default teams (PPJ 185085, 185083, 185086, Salibandy 25301, Basket 5756346)
  const handleStartDemo = async () => {
    await db.profiles.clear();
    await db.events.clear();

    const defaultProfiles = [
      {
        id: 'profile-ppj-185085',
        playerName: 'Maija',
        teamName: 'PPJ Laru Sininen (185085)',
        sport: 'football' as SportType,
        primaryColor: 'sininen',
        secondaryColor: 'valkoinen',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
        colorHex: '#3b82f6'
      },
      {
        id: 'profile-salibandy-25301',
        playerName: 'Maija',
        teamName: 'Salibandy (25301)',
        sport: 'floorball' as SportType,
        primaryColor: 'keltainen',
        secondaryColor: 'musta',
        calendarUrl: 'https://tulospalvelu.salibandy.fi/team/25301/info',
        colorHex: '#eab308'
      },
      {
        id: 'profile-ppj-185083',
        playerName: 'Eemil',
        teamName: 'PPJ Laru Valkoinen (185083)',
        sport: 'football' as SportType,
        primaryColor: 'valkoinen',
        secondaryColor: 'sininen',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
        colorHex: '#10b981'
      },
      {
        id: 'profile-basket-5756346',
        playerName: 'Eemil',
        teamName: 'Basket.fi (5756346)',
        sport: 'basketball' as SportType,
        primaryColor: 'punainen',
        secondaryColor: 'valkoinen',
        calendarUrl: 'https://tulospalvelu.basket.fi/team/5756346/info',
        colorHex: '#ef4444'
      },
      {
        id: 'profile-ppj-185086',
        playerName: 'Ville',
        teamName: 'PPJ Laru Oranssi (185086)',
        sport: 'football' as SportType,
        primaryColor: 'oranssi',
        secondaryColor: 'musta',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
        colorHex: '#f97316'
      }
    ];

    for (const p of defaultProfiles) {
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
        title: 'PPJ Laru Sin vs KäPa Barca',
        homeTeam: 'PPJ Laru Sin',
        awayTeam: 'KäPa Barca',
        sport: 'football' as SportType,
        venueName: 'Väinämöisen kenttä (Väiski)',
        startTime: `${todayStr}T16:30:00+03:00`,
        endTime: `${todayStr}T18:00:00+03:00`,
        warmupTime: `${todayStr}T15:45:00+03:00`,
        duty: '☕ Kahviovuoro klo 16:00 - 18:00 (Maija)'
      },
      {
        profileId: 'profile-salibandy-25301',
        title: 'ErVi vs Oilers Black',
        homeTeam: 'ErVi',
        awayTeam: 'Oilers Black',
        sport: 'floorball' as SportType,
        venueName: 'Tapanilan Mosahalli',
        startTime: `${todayStr}T18:00:00+03:00`,
        endTime: `${todayStr}T19:30:00+03:00`,
        warmupTime: `${todayStr}T17:15:00+03:00`,
        duty: '⏱️ Toimitsijavuoro (Kirjuri)'
      },
      {
        profileId: 'profile-ppj-185083',
        title: 'PPJ Laru Valk vs FC Honka',
        homeTeam: 'PPJ Laru Valk',
        awayTeam: 'FC Honka',
        sport: 'football' as SportType,
        venueName: 'Tapiolan Urheilupuisto TN 2',
        startTime: `${tmrwStr}T14:30:00+03:00`,
        endTime: `${tmrwStr}T16:00:00+03:00`,
        warmupTime: `${tmrwStr}T13:45:00+03:00`
      },
      {
        profileId: 'profile-basket-5756346',
        title: 'ToPo vs HNMKY',
        homeTeam: 'ToPo',
        awayTeam: 'HNMKY',
        sport: 'basketball' as SportType,
        venueName: 'Töölön Kisahalli (Kisis)',
        startTime: `${tmrwStr}T12:00:00+03:00`,
        endTime: `${tmrwStr}T13:30:00+03:00`,
        warmupTime: `${tmrwStr}T11:15:00+03:00`,
        duty: '⏱️ Kellomies'
      },
      {
        profileId: 'profile-ppj-185086',
        title: 'PPJ Laru Oranssi vs VJS',
        homeTeam: 'PPJ Laru Oranssi',
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
  };

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
    () => runMissionControlGraph(filteredEvents, profiles, new Date()),
    [filteredEvents, profiles]
  );

  const handleImportCalendar = async (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string
  ) => {
    // If we're currently on demo data, clean demo data first
    if (isDemoActive) {
      await db.profiles.clear();
      await db.events.clear();
    }

    const profileId = `profile-${Date.now()}`;
    await db.profiles.add({
      id: profileId,
      playerName,
      teamName,
      sport,
      primaryColor: 'punainen',
      calendarUrl: url,
      colorHex: '#10b981'
    });

    try {
      const parsedAssoc = parseAssociationUrl(url);

      if (parsedAssoc) {
        // Fetch fixtures directly from Torneopal / Palloliitto / Salibandy / Basket.fi
        const officialData = await extractOfficialTeamData(parsedAssoc, {
          customTeamName: teamName
        });

        // Store official fixtures in Dexie
        for (const fix of officialData.fixtures) {
          await db.officialFixtures.put(fix);
        }

        const eventsToInsert: MatchdayEvent[] = [];
        for (const fixture of officialData.fixtures) {
          const venue = await resolveSportsVenue(fixture.venueName);
          const startTime = fixture.startTime || new Date().toISOString();
          const endTime =
            fixture.endTime || new Date(new Date(startTime).getTime() + 90 * 60 * 1000).toISOString();
          const warmupTime = new Date(new Date(startTime).getTime() - 45 * 60 * 1000).toISOString();

          const isHome =
            fixture.isHome ??
            (fixture.homeTeam.toLowerCase().includes(teamName.toLowerCase()) ||
              fixture.homeTeam.toLowerCase().includes(playerName.toLowerCase()));

          const matchStats = generateOrResolveMatchStats(
            fixture.homeTeam,
            fixture.awayTeam,
            parsedAssoc.sport
          );

          const matchEvent: MatchdayEvent = {
            id: `fixture-${fixture.id || Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            profileId,
            title: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            eventType: 'match',
            isTraining: false,
            sport: parsedAssoc.sport,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            isHomeMatch: isHome,
            startTime,
            endTime,
            warmupTime,
            tournamentName: fixture.leagueName,
            venue,
            officialFixtureId: fixture.id,
            reconciliationStatus: 'auto_matched',
            confidenceScore: 1.0,
            stats: matchStats
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
      } else {
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
    } catch (err) {
      console.warn('Team / Calendar fetch error:', err);
    }
  };

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
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportCalendar}
          initialSport={importDefaults.sport}
          initialTeamUrl={importDefaults.url}
          initialTeamName={importDefaults.name}
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
            onAddProfile={() => setIsImportModalOpen(true)}
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
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportCalendar}
        existingPlayers={Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)))}
      />

      {/* Family Management & Child Roster Modal */}
      <FamilyManageModal
        isOpen={isFamilyManageOpen}
        onClose={() => setIsFamilyManageOpen(false)}
        profiles={profiles}
        onOpenImportForPlayer={(playerName) => {
          setIsFamilyManageOpen(false);
          setImportDefaults({ name: `${playerName}:n joukkue` });
          setIsImportModalOpen(true);
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
