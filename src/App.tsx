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
import { CalendarPlus, RefreshCw, Smartphone, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import { springTactile } from './lib/motion/springs';

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
DESCRIPTION:Toimitsijavuoro (Kirjuri/Kello).
END:VEVENT
END:VCALENDAR`;

export const App: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string>('all');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Check URL params for ?ambient=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ambient') === 'true' || window.location.pathname === '/ambient') {
        setIsAmbientMode(true);
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

  // Filter events by selected profile
  const filteredEvents = rawEvents.filter((e) => {
    if (activeProfileId === 'all') return true;
    return e.profileId === activeProfileId;
  });

  const handleImportCalendar = async (
    playerName: string,
    teamName: string,
    sport: SportType,
    icsUrl: string
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
      calendarUrl: icsUrl,
      colorHex: '#10b981'
    });

    try {
      // Use Cloudflare Worker streaming proxy to bypass CORS
      const proxyUrl = 'https://pelipaiva-edge.sakkoja.workers.dev/api/proxy/ics';
      const target = `${proxyUrl}?url=${encodeURIComponent(icsUrl)}`;
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
    } catch (err) {
      console.warn('Calendar fetch error:', err);
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

  if (isAmbientMode) {
    return <AmbientView events={filteredEvents} />;
  }

  // If no profiles exist yet, show the Interactive Onboarding Wizard
  if (profiles.length === 0) {
    return (
      <>
        <OnboardingWizard
          onStartDemo={handleStartDemo}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />
        <CalendarImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportCalendar}
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
              onClick={() => setIsAmbientMode(!isAmbientMode)}
              title="Google Nest Ambient -näkymä"
              className="p-2 rounded-full bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
            >
              <Tv className="w-4 h-4" />
            </motion.button>

            <ThemeToggle />
          </div>
        </div>
      </header>

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
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={springTactile.snappy}
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs font-semibold cursor-pointer hover:border-pitch"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-pitch" />
            <span className="hidden sm:inline">Tuo .ics-syöte</span>
          </motion.button>
        </div>

        {/* Bento Grid Match Cards */}
        {filteredEvents.length > 0 ? (
          <div className="flex flex-col gap-4">
            {filteredEvents.map((event) => (
              <MatchdayCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4 rounded-3xl bg-surface-elevated/40 border border-border-subtle">
            <Smartphone className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <h3 className="text-base font-bold text-text-primary">Ei otteluita kalenterissa</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1 mb-4">
              Tuo joukkueesi Nimenhuuto-, MyClub- tai Jopox-kalenterin .ics-osoite nähdäksesi ottelut.
            </p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-pitch text-text-inverse font-bold text-xs shadow-md shadow-pitch/20 cursor-pointer"
            >
              Lisää ensimmäinen kalenteri
            </button>
          </div>
        )}
      </main>

      {/* Calendar Import Modal */}
      <CalendarImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportCalendar}
      />
    </div>
  );
};
export default App;
