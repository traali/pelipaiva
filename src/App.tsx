import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureStoragePersistence } from './lib/storage/db';
import { MatchdayCard } from './components/MatchdayCard';
import { MultiProfileHeader } from './components/MultiProfileHeader';
import { ThemeToggle } from './components/ThemeToggle';
import { CalendarImportModal } from './components/CalendarImportModal';
import { AmbientView } from './components/AmbientView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { DemoBanner } from './components/DemoBanner';
import { parseICSFeed } from './lib/calendar/icsParser';
import { generateMatchdayBriefing } from './lib/ai/deterministicReasoner';
import { calculateParkingEase } from './lib/parking/parkingEaseEngine';
import { fetchFmiMatchWeather } from './lib/weather/fmiWeatherEngine';
import { MatchdayEvent, SportType } from './types/matchday';
import { CalendarPlus, RefreshCw, Smartphone, Tv, Share2, AlertTriangle, Trash2, Sparkles, Car, MessageSquarePlus } from 'lucide-react';
import { motion } from 'motion/react';
import { springTactile } from './lib/motion/springs';
import { FamilyShareModal } from './components/FamilyShareModal';
import { SmartImportModal } from './components/SmartImportModal';
import { FamilyLogisticsModal } from './components/FamilyLogisticsModal';
import { AskCopilotModal } from './components/AskCopilotModal';
import { QuickDropInBar } from './components/QuickDropInBar';
import { unpackSharePayload } from './lib/sync/familyShare';
import {
  parseAssociationUrl,
  extractOfficialTeamData,
  generateOrResolveMatchStats
} from './lib/stats/statsEngine';
import { resolveSportsVenue } from './lib/geo/sportsGeocoder';

const SAMPLE_INITIAL_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nimenhuuto.com//NONSGML Calendar//EN
BEGIN:VEVENT
UID:match-1@nimenhuuto.com
DTSTAMP:20260819T100000Z
DTSTART:20260820T150000Z
DTEND:20260820T163000Z
SUMMARY:HJK T13 vs EPS Valkoinen
LOCATION:Puotilan tekonurmi (Bubu)
DESCRIPTION:Kahviovuoro klo 14:30 - 16:00. Pelaajille mukaan ykköspeliasu.
END:VEVENT
BEGIN:VEVENT
UID:match-2@nimenhuuto.com
DTSTAMP:20260819T100000Z
DTSTART:20260820T173000Z
DTEND:20260820T190000Z
SUMMARY:ErVi P11 vs Oilers Black
LOCATION:Tapanilan Mosahalli
DESCRIPTION:Kirjuri/kello. Sisäpelivarustus.
END:VEVENT
END:VCALENDAR`;

export const App: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string>('all');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState<boolean>(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState<boolean>(false);
  const [isAskCopilotOpen, setIsAskCopilotOpen] = useState<boolean>(false);
  const [isFamilyShareOpen, setIsFamilyShareOpen] = useState<boolean>(false);
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
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

  const isDemoActive = profiles.some((p) => p.id === 'profile-hjk-demo');

  // Seed sample demo data
  const handleStartDemo = async () => {
    await db.profiles.clear();
    await db.events.clear();

    const defaultProfile = {
      id: 'profile-hjk-demo',
      playerName: 'Maija',
      teamName: 'HJK T13',
      sport: 'football' as SportType,
      primaryColor: 'sininen',
      secondaryColor: 'valkoinen',
      calendarUrl: 'https://nimenhuuto.com/demo',
      colorHex: '#059669'
    };
    await db.profiles.add(defaultProfile);

    const parsed = await parseICSFeed(SAMPLE_INITIAL_ICS, defaultProfile.id, 'football');

    for (const ev of parsed) {
      const weather = await fetchFmiMatchWeather(ev.venue.coordinates, ev.startTime, ev.endTime);
      const parking = calculateParkingEase(ev.venue.name, ev.venue.coordinates, new Date(ev.startTime));
      const withData: MatchdayEvent = {
        ...ev,
        weather,
        parking
      };
      withData.briefing = generateMatchdayBriefing(withData, parsed);
      await db.events.put(withData);
    }
  };

  const handleClearData = async () => {
    await db.profiles.clear();
    await db.events.clear();
    setActiveProfileId('all');
  };

  // Filter events by selected profile or player group
  const filteredEvents = rawEvents.filter((e) => {
    if (activeProfileId === 'all') return true;
    if (activeProfileId.startsWith('player:')) {
      const pName = activeProfileId.replace('player:', '').toLowerCase();
      const profile = profiles.find((p) => p.id === e.profileId);
      return (profile?.playerName || '').toLowerCase() === pName;
    }
    return e.profileId === activeProfileId;
  });

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
        const officialData = await extractOfficialTeamData(parsedAssoc);

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
    return <AmbientView events={filteredEvents} />;
  }

  // If no profiles exist yet, show the Interactive Onboarding Wizard
  if (profiles.length === 0) {
    return (
      <>
        <OnboardingWizard
          onStartDemo={handleStartDemo}
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
    <div className="min-h-screen bg-canvas text-text-primary transition-colors pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-pitch text-text-inverse flex items-center justify-center font-black text-sm shadow-md shadow-pitch/20">
              P
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-text-primary leading-tight">
                PELIPÄIVÄ
              </h1>
              <p className="text-[10px] text-text-muted font-medium">Matchday Hub • 100% Local</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={springTactile.snappy}
              onClick={handleRefreshAll}
              disabled={isSyncing}
              title="Päivitä sää ja kalenterit"
              className="p-2 rounded-full bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-pitch' : ''}`} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={springTactile.snappy}
              onClick={() => setIsFamilyShareOpen(true)}
              title="Perhejako & Varmuuskopio"
              className="p-2 rounded-full bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-pitch" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={springTactile.snappy}
              onClick={() => setIsAmbientMode(!isAmbientMode)}
              title="Google Nest Ambient -näkymä"
              className="p-2 rounded-full bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
            >
              <Tv className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={springTactile.snappy}
              onClick={handleClearData}
              title="Tyhjennä tiedot & Aloita alusta"
              className="p-2 rounded-full bg-surface-elevated text-text-muted hover:text-stoppage border border-border-subtle cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Offline / Degraded Mode Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-500 text-xs py-1.5 px-4 text-center font-semibold flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Offline-tila: Näytetään viimeisimmät tallennetut ottelutiedot laitteelta.</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-4">
        {/* Demo Mode Banner (if sample data is active) */}
        {isDemoActive && (
          <DemoBanner
            onOpenImport={() => setIsImportModalOpen(true)}
            onClearDemo={handleClearData}
          />
        )}

        {/* Multi-Profile Selector Bar */}
        <div className="mb-5">
          <MultiProfileHeader
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSelectProfile={(id) => setActiveProfileId(id)}
            onAddProfile={() => setIsImportModalOpen(true)}
          />
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-text-primary">
              Tulevat ottelut & harjoitukset
            </h2>
            <p className="text-xs text-text-secondary">
              Reaaliaikainen sää, pysäköinti ja Nappisvahti
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={() => setIsSmartImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pitch/15 border border-pitch/30 text-pitch text-xs font-bold cursor-pointer hover:bg-pitch hover:text-text-inverse transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Äly-tuonti</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={() => setIsLogisticsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold cursor-pointer hover:border-pitch"
            >
              <Car className="w-3.5 h-3.5 text-pitch" />
              <span className="hidden sm:inline">Kyytiapuri</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={() => setIsAskCopilotOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold cursor-pointer hover:border-pitch"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-pitch" />
              <span className="hidden sm:inline">Kysy Älyltä</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={() => setIsFamilyShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold cursor-pointer hover:border-pitch"
            >
              <Share2 className="w-3.5 h-3.5 text-pitch" />
              <span className="hidden sm:inline">Jaa perheelle</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold cursor-pointer hover:border-pitch"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-pitch" />
              <span className="hidden sm:inline">Tuo .ics</span>
            </motion.button>
          </div>
        </div>

        {/* General Drop-in Bar for WhatsApp, MyClub & freeform text */}
        <QuickDropInBar
          existingPlayers={Array.from(new Set(profiles.map((p) => p.playerName).filter(Boolean)))}
          activeProfilePlayerName={
            activeProfileId.startsWith('player:')
              ? activeProfileId.replace('player:', '')
              : profiles.find((p) => p.id === activeProfileId)?.playerName
          }
          onEventCreated={() => {}}
        />

        {/* Bento Grid Match Cards */}
        {filteredEvents.length > 0 ? (
          <div className="flex flex-col gap-4">
            {filteredEvents.map((event) => {
              const profile = profiles.find((p) => p.id === event.profileId);
              return (
                <MatchdayCard
                  key={event.id}
                  event={event}
                  playerName={profile?.playerName}
                  onResolveMismatch={handleResolveMismatch}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 px-4 rounded-3xl bg-surface-elevated/40 border border-border-subtle">
            <Smartphone className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <h3 className="text-base font-bold text-text-primary">Ei otteluita kalenterissa</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1 mb-4">
              Tuo joukkueesi kalenteri tai liitä valmentajan WhatsApp-viesti / Excel-taulukko.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsSmartImportOpen(true)}
                className="px-4 py-2 rounded-xl bg-pitch text-text-inverse font-bold text-xs shadow-md shadow-pitch/20 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Äly-tuonti (WhatsApp / Excel / Kuva)</span>
              </button>
            </div>
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
