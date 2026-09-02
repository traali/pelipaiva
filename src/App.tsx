import React, { lazy, Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteOfficialTeamData, ensureStoragePersistence, clearAllDatabaseData } from './lib/storage/db';
import { MatchdayCard } from './components/MatchdayCard';
import { MultiProfileHeader } from './components/MultiProfileHeader';
import { AmbientView } from './components/AmbientView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MatchdayEvent, SportType, PlayerProfile, HomeLocation } from './types/matchday';
import { LayoutList, Calendar as CalendarIcon, TableProperties, History as HistoryIcon, Trophy } from 'lucide-react';
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
import { helsinkiDateISO } from './lib/agents/time';
import { pickNextTeamColor, colorFromNameHint, swatchForHex } from './lib/sport/teamColors';
import { exampleTournamentFromUrl } from './lib/clubs/exampleTournaments';
import { searchPopularClubs } from './lib/clubs/popularClubsCatalog';
import { findExistingTeamProfile, generateStableProfileId } from './lib/clubs/attachTeam';
import { syncFamilyRosterCycle, hydrateRosterProfiles, syncManualEvents } from './lib/sync/familyCloud';
import { DEFAULT_HOME_LOCATION, saveHomeLocation } from './lib/storage/homeLocation';
import { calculateTeamSimilarity } from './lib/reconciliation/teamNameMatcher';
import { resolveTransitPlan } from './lib/geo/transitEngine';
import { resolveSportsVenue } from './lib/geo/sportsGeocoder';
import { useDismissedConflicts } from './lib/agents/conflictDismissal';

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
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'in' | 'out'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<
    'all' | 'tournaments' | 'matches' | 'trainings' | 'other'
  >('all');
  const [importDefaults, setImportDefaults] = useState<{
    sport?: SportType;
    url?: string;
    name?: string;
    playerName?: string;
    colorHex?: string;
    squadFilters?: string[];
    profileId?: string;
  }>({});
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);

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
        await syncManualEvents(sync.syncKey, db);
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
      const isAmbientRequest =
        params.get('ambient') === 'true' ||
        params.get('nest') === 'true' ||
        params.get('display') === 'true' ||
        window.location.pathname === '/ambient';

      if (isAmbientRequest) {
        setIsAmbientMode(true);
      }

      // Handle ?perhe=PERHE-2 deep link join
      const perheCode = params.get('perhe');
      if (perheCode) {
        (async () => {
          const res = await syncFamilyRosterCycle(perheCode, db);
          if (res.success) {
            await syncManualEvents(perheCode, db);
            localStorage.setItem('pelipaiva_onboarding_done', 'true');
            setIsOnboardingActive(false);
            if (isAmbientRequest) {
              setIsAmbientMode(true);
            } else {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
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

  // Self-healing sport and indoor venue harmonization for multi-sport child profiles
  useEffect(() => {
    (async () => {
      try {
        const allProfiles = await db.profiles.toArray();
        const allEvents = await db.events.toArray();
        const officialSportByPlayer = new Map<string, SportType>();
        for (const p of allProfiles) {
          if ((p.associationUrl || p.teamId) && p.sport && p.sport !== 'football') {
            officialSportByPlayer.set(p.playerName.trim().toLowerCase(), p.sport);
          }
        }

        for (const p of allProfiles) {
          const pUpdates: Partial<PlayerProfile> = {};
          if (/ppj|pallo-pojat|hjk|futis|jalkapallo|palloliitto/i.test(`${p.teamName} ${p.calendarUrl || ''} ${p.associationUrl || ''}`) && p.sport !== 'football') {
            pUpdates.sport = 'football';
          } else if (/indians|salibandy|säbä|sähly|oilers|ervii/i.test(`${p.teamName} ${p.calendarUrl || ''} ${p.associationUrl || ''}`) && p.sport !== 'floorball') {
            pUpdates.sport = 'floorball';
          } else if (/basket|topola|koris|hnmky/i.test(`${p.teamName} ${p.calendarUrl || ''} ${p.associationUrl || ''}`) && p.sport !== 'basketball') {
            pUpdates.sport = 'basketball';
          } else if (/lentopallo|puma|lp viesti/i.test(`${p.teamName} ${p.calendarUrl || ''} ${p.associationUrl || ''}`) && p.sport !== 'volleyball') {
            pUpdates.sport = 'volleyball';
          }

          // Clean up corrupted calendarUrl (e.g. literal team string like "PPJ/Laru mus" or association page)
          if (p.calendarUrl) {
            const rawCal = p.calendarUrl.trim();
            if (!rawCal.startsWith('http://') && !rawCal.startsWith('https://') && !rawCal.startsWith('webcal://')) {
              pUpdates.calendarUrl = undefined;
            } else if (
              rawCal.includes('tulospalvelu.') ||
              rawCal.includes('basket.fi') ||
              rawCal.includes('torneopal.fi')
            ) {
              if (!p.associationUrl) {
                pUpdates.associationUrl = rawCal;
              }
              pUpdates.calendarUrl = undefined;
            }
          }

          if (Object.keys(pUpdates).length > 0) {
            await db.profiles.update(p.id, pUpdates);
          }
        }

        for (const ev of allEvents) {
          const profile = allProfiles.find((p) => p.id === ev.profileId);
          const playerName = profile?.playerName?.trim().toLowerCase() || '';
          const targetSport = officialSportByPlayer.get(playerName);
          const isLyk = /yhteiskoulu|lyk/i.test(ev.venue?.name || '');
          const isSchoolGym = /lukio|yhteiskoulu|lyk|myk|phyk|syk|tyk/i.test(ev.venue?.name || '');

          const isFootballContext =
            /ppj|pallo-pojat|hjk|futis|jalkapallo|palloliitto|pyrkkä|ruukinlahti|bollis/i.test(
              `${ev.title} ${ev.notes || ''} ${profile?.teamName || ''}`
            ) ||
            (profile?.sport === 'football' && !/indians|salibandy|säbä|sähly|topola|basket/i.test(ev.title));

          const isFloorballContext =
            !isFootballContext &&
            (profile?.sport === 'floorball' ||
            /indians|salibandy|säbä|sähly|oilers|ervii/i.test(
              `${ev.title} ${ev.notes || ''} ${ev.profileId || ''} ${profile?.calendarUrl || ''}`
            ));

          const isBasketballContext =
            !isFootballContext &&
            (targetSport === 'basketball' ||
            profile?.sport === 'basketball' ||
            isLyk ||
            /basket|topola|koris|hnmky/i.test(
              `${ev.title} ${ev.notes || ''} ${ev.profileId || ''} ${profile?.calendarUrl || ''}`
            ));

          let needsUpdate = false;
          const updates: Partial<MatchdayEvent> = {};

          if (isFootballContext && ev.sport !== 'football') {
            updates.sport = 'football';
            needsUpdate = true;
          } else if (isFloorballContext && ev.sport !== 'floorball') {
            updates.sport = 'floorball';
            needsUpdate = true;
          } else if (isBasketballContext && ev.sport !== 'basketball') {
            updates.sport = 'basketball';
            needsUpdate = true;
          }

          // Check if venue is Pyrkkä or Lauttasaaren urheilupuisto
          const isPyrkka = /pyrkkä|lauttasaaren urheilupuisto|lahnalahdentie/i.test(
            `${ev.venue?.name || ''} ${ev.venue?.normalizedName || ''}`
          );
          if (
            isPyrkka &&
            (Math.abs((ev.venue?.coordinates?.lat || 0) - 60.16357) > 0.001 ||
              Math.abs((ev.venue?.coordinates?.lng || 0) - 24.86750) > 0.001)
          ) {
            updates.venue = {
              ...ev.venue,
              name: 'Lauttasaaren urheilupuisto "Pyrkkä"',
              normalizedName: 'lauttasaaren urheilupuisto pyrkkä',
              coordinates: { lat: 60.16357, lng: 24.86750 },
              isIndoor: false,
              surface: 'artificial_turf_3g',
              hasFloodlights: true
            };
            needsUpdate = true;
          }

          if (isSchoolGym && (!ev.venue.isIndoor || ev.venue.surface === 'artificial_turf_3g')) {
            updates.venue = {
              ...(updates.venue || ev.venue),
              name: (updates.venue?.name || ev.venue.name).includes('LYK')
                ? (updates.venue?.name || ev.venue.name)
                : isLyk
                ? `${(updates.venue?.name || ev.venue.name)} (LYK)`
                : (updates.venue?.name || ev.venue.name),
              isIndoor: true,
              surface: 'indoor_parquet'
            };
            needsUpdate = true;
          }

          if (needsUpdate) {
            await db.events.update(ev.id, updates);
          }
        }

        // Reconcile and merge any unlinked calendar matches with bare official fixtures on the same day
        const freshEvents = await db.events.toArray();
        const calEvents = freshEvents.filter((e) => !e.id.startsWith('fixture-') && !e.isTraining && !e.officialFixtureId);
        const fixEvents = freshEvents.filter((e) => e.id.startsWith('fixture-'));

        for (const cal of calEvents) {
          const calDate = new Date(cal.startTime);
          for (const fix of fixEvents) {
            const fixDate = new Date(fix.startTime);
            const diffMins = Math.abs(fixDate.getTime() - calDate.getTime()) / 60000;
            if (diffMins <= 180 && calDate.toDateString() === fixDate.toDateString()) {
              const sim = calculateTeamSimilarity(cal.homeTeam || cal.title, fix.homeTeam);
              if (sim >= 0.70) {
                const enriched: MatchdayEvent = {
                  ...cal,
                  homeTeam: fix.homeTeam,
                  awayTeam: fix.awayTeam,
                  title: `${fix.homeTeam} vs ${fix.awayTeam}`,
                  officialFixtureId: fix.officialFixtureId || fix.id.replace(/^fixture-[^-]+-/, ''),
                  reconciliationStatus: 'auto_matched',
                  score: fix.score || cal.score,
                  tournamentName: fix.tournamentName || cal.tournamentName
                };
                await db.events.put(enriched);
                await db.events.delete(fix.id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[SELF_HEAL] Sport harmonization error:', err);
      }
    })();
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

  // Reconcile and stitch calendar events with bare fixtures across all profiles
  const allStitchedEvents = useMemo(() => {
    const rawAll = rawEvents.filter((e) => !e.isHidden).map((e) => ({ ...e }));

    // Find all linked officialFixtureIds on enriched calendar events
    const enrichedFixtureIds = new Set<string>();
    const bareFixtureIdsToDelete = new Set<string>();

    for (const e of rawAll) {
      if (e.officialFixtureId && !e.id.startsWith('fixture-')) {
        enrichedFixtureIds.add(e.officialFixtureId);
      }
    }

    const calendarMatches = rawAll.filter((e) => !e.id.startsWith('fixture-') && !e.isTraining);
    const bareFixtures = rawAll.filter((e) => e.id.startsWith('fixture-'));

    // Dynamic stitch for same-day matches matching squad/club
    for (const cal of calendarMatches) {
      const calDate = new Date(cal.startTime);
      for (const fix of bareFixtures) {
        if (bareFixtureIdsToDelete.has(fix.id)) continue;
        const fixDate = new Date(fix.startTime);
        const diffMins = Math.abs(fixDate.getTime() - calDate.getTime()) / 60000;
        if (diffMins <= 180 && calDate.toDateString() === fixDate.toDateString()) {
          const sim = calculateTeamSimilarity(cal.homeTeam || cal.title, fix.homeTeam);
          if (sim >= 0.70) {
            cal.homeTeam = fix.homeTeam;
            cal.awayTeam = fix.awayTeam;
            cal.title = `${fix.homeTeam} vs ${fix.awayTeam}`;
            cal.officialFixtureId = fix.officialFixtureId || fix.id.replace(/^fixture-[^-]+-/, '');
            cal.reconciliationStatus = 'auto_matched';
            cal.score = fix.score || cal.score;
            cal.tournamentName = fix.tournamentName || cal.tournamentName;

            // Venue mismatch: Torneopal wins, but flag for the UI banner
            const calVenueName = cal.venue?.name || '';
            const fixVenueName = fix.venue?.name || '';
            const venuesDiffer = fixVenueName && calVenueName
              && fixVenueName.toLowerCase() !== calVenueName.toLowerCase()
              && (fix.venue?.normalizedName || fixVenueName.toLowerCase()) !== (cal.venue?.normalizedName || calVenueName.toLowerCase());
            if (venuesDiffer) {
              cal.mismatchFlags = {
                ...cal.mismatchFlags,
                venueMismatch: true,
                calendarVenueName: calVenueName,
                officialVenueName: fixVenueName
              };
              // Adopt Torneopal venue as authoritative
              cal.venue = fix.venue;
            }

            if (cal.officialFixtureId) {
              enrichedFixtureIds.add(cal.officialFixtureId);
            }
            bareFixtureIdsToDelete.add(fix.id);
          }
        }
      }
    }

    // Suppress bare fixture duplicates if an enriched calendar event already represents it
    const deduplicated = rawAll.filter((e) => {
      if (e.id.startsWith('fixture-')) {
        if (e.officialFixtureId && enrichedFixtureIds.has(e.officialFixtureId)) {
          return false;
        }
        if (bareFixtureIdsToDelete.has(e.id)) {
          return false;
        }
      }
      return true;
    });

    return deduplicated.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [rawEvents]);

  // Filter stitched events by selected profile or player group
  const filteredEvents = useMemo(() => {
    return allStitchedEvents.filter((e) => {
      if (activeProfileId === 'all') return true;
      if (activeProfileId.startsWith('player:')) {
        const pName = activeProfileId.replace('player:', '').toLowerCase();
        const profile = profiles.find((p) => p.id === e.profileId);
        return (profile?.playerName || '').toLowerCase() === pName;
      }
      return e.profileId === activeProfileId;
    });
  }, [allStitchedEvents, activeProfileId, profiles]);

  const [clockTick, setClockTick] = useState(0);

  // Re-run the mission-control graph once a minute so departure countdowns
  // track the wall clock instead of freezing at last data change (M-40/V62).
  useEffect(() => {
    const t = setInterval(() => setClockTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const stickyFilterRef = useRef<HTMLDivElement>(null);

  // Measure the sticky filter bar height dynamically so day headers stick right beneath it
  useEffect(() => {
    const el = stickyFilterRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.offsetHeight;
      document.documentElement.style.setProperty('--sticky-filter-height', `${h}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const snapshot = useMemo(
    () => runMissionControlGraph(allStitchedEvents, profiles, new Date(), arrivalRules, homeLocation),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clockTick intentionally restarts the graph each minute
    [allStitchedEvents, profiles, arrivalRules, clockTick, homeLocation]
  );

  const { isDismissed, dismiss: dismissConflict } = useDismissedConflicts();
  const unDismissedConflicts = useMemo(
    () => snapshot.conflicts.filter((c) => !isDismissed(c)),
    [snapshot.conflicts, isDismissed]
  );

  const isTournamentEvent = (e: MatchdayEvent): boolean => {
    if (e.isTournament || e.tournamentName) return true;
    const text = `${e.title} ${e.notes || ''} ${e.roundInfo || ''}`;
    return /turnaus|tournament|cup\b|memorial/i.test(text);
  };

  const isMatchEvent = (e: MatchdayEvent): boolean => {
    if (isTournamentEvent(e)) return false;
    if (e.isTraining || e.eventType === 'training' || e.eventType === 'meeting') return false;
    if (e.officialFixtureId || e.id.startsWith('fixture-')) return true;
    if (e.homeTeam && e.awayTeam && e.homeTeam !== e.awayTeam) return true;
    const text = `${e.title} ${e.notes || ''}`;
    return /sarjapeli|piirisarja|ottelu|vs\b|peli\b/i.test(text);
  };

  const isTrainingEvent = (e: MatchdayEvent): boolean => {
    if (isTournamentEvent(e)) return false;
    if (e.isTraining || e.eventType === 'training') return true;
    const text = `${e.title} ${e.notes || ''}`;
    return /treeni|harjoitus|harjoitukset|fysiikka|lajitreeni|lajiharjoitus/i.test(text);
  };

  const isOtherEvent = (e: MatchdayEvent): boolean => {
    return !isTournamentEvent(e) && !isMatchEvent(e) && !isTrainingEvent(e);
  };

  const filterCounts = useMemo(() => {
    let tournaments = 0;
    let matches = 0;
    let trainings = 0;
    let other = 0;
    let attending = 0;
    let out = 0;

    for (const e of filteredEvents) {
      if (e.attendanceStatus === 'out') {
        out++;
      } else {
        attending++;
      }

      if (isTournamentEvent(e)) tournaments++;
      else if (isMatchEvent(e)) matches++;
      else if (isTrainingEvent(e)) trainings++;
      else other++;
    }

    return {
      all: filteredEvents.length,
      attending,
      out,
      tournaments,
      matches,
      trainings,
      other
    };
  }, [filteredEvents]);

  const categoryFilteredEvents = useMemo(() => {
    return filteredEvents.filter((e) => {
      // 1. Attendance axis
      if (attendanceFilter === 'in' && e.attendanceStatus === 'out') return false;
      if (attendanceFilter === 'out' && e.attendanceStatus !== 'out') return false;

      // 2. Event type axis
      if (eventTypeFilter === 'tournaments' && !isTournamentEvent(e)) return false;
      if (eventTypeFilter === 'matches' && !isMatchEvent(e)) return false;
      if (eventTypeFilter === 'trainings' && !isTrainingEvent(e)) return false;
      if (eventTypeFilter === 'other' && !isOtherEvent(e)) return false;

      return true;
    });
  }, [filteredEvents, attendanceFilter, eventTypeFilter]);

  const nowMs = Date.now();
  const pastEvents = useMemo(
    () => categoryFilteredEvents.filter((e) => new Date(e.endTime).getTime() < nowMs - 60 * 60 * 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryFilteredEvents, clockTick]
  );
  const upcomingEvents = useMemo(
    () => categoryFilteredEvents.filter((e) => new Date(e.endTime).getTime() >= nowMs - 60 * 60 * 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryFilteredEvents, clockTick]
  );

  const displayCardsEvents = useMemo(() => {
    if (showPastEvents) {
      return categoryFilteredEvents;
    }
    return upcomingEvents;
  }, [showPastEvents, upcomingEvents, categoryFilteredEvents]);

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
    squadFilters?: string[],
    editingProfileId?: string
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    const existing = await db.profiles.toArray();
    const resolvedSport: SportType = sport || 'football';

    const cup = exampleTournamentFromUrl(url);
    const club = searchPopularClubs(teamName).find((c) => c.sport === resolvedSport);
    const named = colorFromNameHint(`${teamName} ${url}`);
    const swatch = colorHex
      ? swatchForHex(colorHex)
      : cup
        ? { hex: cup.colorHex, label: cup.primaryColor }
        : named ||
          (club
            ? { hex: club.colorHex, label: club.primaryColor }
            : pickNextTeamColor(existing.map((p) => p.colorHex)));

    const existingToEdit = editingProfileId
      ? existing.find((p) => p.id === editingProfileId)
      : undefined;

    const reused = existingToEdit || findExistingTeamProfile(existing, playerName, url, resolvedSport);
    const profileId = reused?.id || generateStableProfileId(playerName, url);

    if (reused) {
      await db.events.where('profileId').equals(profileId).delete();
      await db.profiles.update(profileId, {
        playerName,
        teamName: teamName || reused.teamName,
        sport: resolvedSport,
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
        sport: resolvedSport,
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
        sport: resolvedSport,
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
      profileId: profile.id,
      playerName: profile.playerName,
      name: profile.teamName,
      sport: profile.sport,
      url: profile.calendarUrl || profile.associationUrl || '',
      colorHex: profile.colorHex,
      squadFilters: profile.squadFilters
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
      // 1. Fetch latest data for all profiles from external feeds in parallel with 4s timeout
      const fetchTasks = profiles.map(async (p) => {
        const url = p.associationUrl || p.calendarUrl;
        if (!url) return;
        try {
          await Promise.race([
            ingestSourceForProfile({
              profileId: p.id,
              playerName: p.playerName,
              teamName: p.teamName,
              sport: p.sport,
              url,
              includeWeather: true
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Feed timeout')), 4000))
          ]);
        } catch (e) {
          console.warn('[REFRESH TIMEOUT / ERROR]', p.teamName, e);
        }
      });

      await Promise.allSettled(fetchTasks);

      // 2. Re-evaluate sport, re-resolve venue coordinates & recalculate transit for ALL stored events
      const allEvents = await db.events.toArray();
      const allProfiles = await db.profiles.toArray();
      const profMap = new Map(allProfiles.map((p) => [p.id, p]));

      for (const ev of allEvents) {
        const prof = profMap.get(ev.profileId);
        let updated = false;
        const updates: Partial<MatchdayEvent> = {};

        // Sync event sport to profile sport if profile sport changed
        if (prof?.sport && ev.sport !== prof.sport) {
          updates.sport = prof.sport;
          updated = true;
        }

        // Re-resolve venue with latest geocoding and aliases (e.g. Ruukinlahden tekonurmi)
        let currentVenue = ev.venue;
        if (ev.venue?.name) {
          const freshVenue = await resolveSportsVenue(ev.venue.name);
          if (
            freshVenue.coordinates.lat !== ev.venue.coordinates?.lat ||
            freshVenue.coordinates.lng !== ev.venue.coordinates?.lng ||
            freshVenue.name !== ev.venue.name
          ) {
            currentVenue = freshVenue;
            updates.venue = freshVenue;
            updated = true;
          }
        }

        // Recalculate transit (distance & walk/bike/drive minutes from home)
        if (homeLocation && currentVenue?.coordinates) {
          const freshTransit = resolveTransitPlan(homeLocation, currentVenue.coordinates, ev.weather);
          updates.transit = freshTransit;
          updated = true;
        }

        if (updated) {
          await db.events.update(ev.id, updates);
        }
      }

      // 3. Clean up ghost/bare fixtures if merged
      const freshEvents = await db.events.toArray();
      const calEvents = freshEvents.filter((e) => !e.id.startsWith('fixture-') && !e.isTraining && !e.officialFixtureId);
      const fixEvents = freshEvents.filter((e) => e.id.startsWith('fixture-'));

      for (const cal of calEvents) {
        const calDate = cal.startTime.split('T')[0];
        const match = fixEvents.find((f) => {
          const fDate = f.startTime.split('T')[0];
          return f.profileId === cal.profileId && fDate === calDate;
        });
        if (match) {
          await db.events.update(cal.id, {
            officialFixtureId: match.id,
            reconciliationStatus: 'auto_matched'
          });
          await db.events.delete(match.id);
        }
      }
    } catch (err) {
      console.error('[REFRESH ERROR]', err);
    } finally {
      setIsSyncing(false);
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
      const officialIso = ev.mismatchFlags.officialStartTimeIso;
      const officialVenue = ev.mismatchFlags.officialVenueName;
      // Only fall back to keep_calendar if there's genuinely nothing to apply.
      // A venue-only mismatch has officialVenue but no officialIso — that is valid.
      if (!officialIso && !officialVenue) {
        return handleResolveMismatch(eventId, 'keep_calendar');
      }
      const updated: MatchdayEvent = {
        ...ev,
        startTime: officialIso || ev.startTime,
        venue: officialVenue
          ? { ...ev.venue, name: officialVenue }
          : ev.venue,
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
      const calendarVenue = ev.mismatchFlags?.calendarVenueName;
      const updated: MatchdayEvent = {
        ...ev,
        venue: calendarVenue ? { ...ev.venue, name: calendarVenue } : ev.venue,
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
        homeLocation={homeLocation}
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

  // Only the wizard itself, not "zero profiles". Local-only parents can
  // finish onboarding without a team and still reach Perhe / tekoäly.
  if (isOnboardingActive) {
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
          initialColorHex={importDefaults.colorHex}
          initialSquadFilters={importDefaults.squadFilters}
          editingProfileId={importDefaults.profileId}
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
        {/* Sticky Profile Filter & View Mode Switcher Header (Compact 2-Row Layout) */}
        <div
          ref={stickyFilterRef}
          className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-canvas/95 backdrop-blur-md border-b border-border-subtle/50 mb-3 flex flex-col gap-2 shadow-xs"
        >
          {/* Row 1: Profile Carousel + View Mode Switcher */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <MultiProfileHeader
                profiles={profiles}
                activeProfileId={activeProfileId}
                onSelectProfile={(id) => setActiveProfileId(id)}
                onAddProfile={() => openAddTeam(activePlayerName)}
              />
            </div>

            {/* View Mode Switcher: Cards vs Timeline vs Calendar */}
            <div
              role="tablist"
              aria-label="Näkymän valitsin"
              className="flex items-center rounded-xl bg-surface-elevated p-1 border border-border-subtle shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'cards'}
                onClick={() => setViewMode('cards')}
                title="Korttinäkymä"
                className={`touch-target min-h-[44px] px-2.5 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-pitch ${
                  viewMode === 'cards'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <LayoutList className="w-4 h-4" />
                <span>Kortit</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'timeline'}
                onClick={() => setViewMode('timeline')}
                title="Tiivis aikajana"
                className={`touch-target min-h-[44px] px-2.5 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-pitch ${
                  viewMode === 'timeline'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <TableProperties className="w-4 h-4" />
                <span>Tiivis</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'calendar'}
                onClick={() => setViewMode('calendar')}
                title="Kalenteriruudukko"
                className={`touch-target min-h-[44px] px-2.5 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-pitch ${
                  viewMode === 'calendar'
                    ? 'bg-pitch text-text-inverse shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Kalenteri</span>
              </button>
            </div>
          </div>

          {/* Row 2: Combined Single Horizontal Filter Ribbon (Attendance + Event Types) */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 text-xs">
            {/* Attendance Filter Chips */}
            <button
              type="button"
              onClick={() => setAttendanceFilter('all')}
              className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                attendanceFilter === 'all'
                  ? 'bg-pitch text-text-inverse shadow-xs'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle'
              }`}
            >
              Kaikki ({filterCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setAttendanceFilter(attendanceFilter === 'in' ? 'all' : 'in')}
              className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                attendanceFilter === 'in'
                  ? 'bg-pitch text-text-inverse shadow-xs'
                  : 'bg-surface-elevated text-text-secondary hover:text-pitch border border-border-subtle'
              }`}
              title="Näytä vain tapahtumat joihin osallistutaan (IN)"
            >
              <span>🟢 Osallistuu</span>
              <span className="text-[10px] opacity-80">({filterCounts.attending})</span>
            </button>
            {(filterCounts.out > 0 || attendanceFilter === 'out') && (
              <button
                type="button"
                onClick={() => setAttendanceFilter(attendanceFilter === 'out' ? 'all' : 'out')}
                className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  attendanceFilter === 'out'
                    ? 'bg-stoppage text-text-inverse shadow-xs'
                    : 'bg-stoppage/15 text-stoppage border border-stoppage/40 hover:bg-stoppage/25'
                }`}
                title="Näytä vain tapahtumat mihin ei osallistuta (Poisjäännit / OUT)"
              >
                <span>⛔ Pois</span>
                <span className="text-[10px] opacity-80">({filterCounts.out})</span>
              </button>
            )}

            {/* Separator between attendance and event types */}
            <div className="h-5 w-[1px] bg-border-subtle shrink-0 mx-0.5" aria-hidden="true" />

            {/* Event Type Filter Chips */}
            {filterCounts.tournaments > 0 && (
              <button
                type="button"
                onClick={() => setEventTypeFilter(eventTypeFilter === 'tournaments' ? 'all' : 'tournaments')}
                className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  eventTypeFilter === 'tournaments'
                    ? 'bg-gold/30 text-gold border border-gold shadow-xs'
                    : 'bg-surface-elevated text-text-muted hover:text-gold border border-border-subtle'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-gold" />
                <span>Turnaukset</span>
                <span className="text-[10px] opacity-80">({filterCounts.tournaments})</span>
              </button>
            )}

            {filterCounts.matches > 0 && (
              <button
                type="button"
                onClick={() => setEventTypeFilter(eventTypeFilter === 'matches' ? 'all' : 'matches')}
                className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  eventTypeFilter === 'matches'
                    ? 'bg-pitch/25 text-pitch border border-pitch/40 shadow-xs'
                    : 'bg-surface-elevated text-text-muted hover:text-pitch border border-border-subtle'
                }`}
              >
                <span>⚽ Sarjapelit</span>
                <span className="text-[10px] opacity-80">({filterCounts.matches})</span>
              </button>
            )}

            {filterCounts.trainings > 0 && (
              <button
                type="button"
                onClick={() => setEventTypeFilter(eventTypeFilter === 'trainings' ? 'all' : 'trainings')}
                className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  eventTypeFilter === 'trainings'
                    ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40 shadow-xs'
                    : 'bg-surface-elevated text-text-muted hover:text-blue-400 border border-border-subtle'
                }`}
              >
                <span>🏃 Treenit</span>
                <span className="text-[10px] opacity-80">({filterCounts.trainings})</span>
              </button>
            )}

            {filterCounts.other > 0 && (
              <button
                type="button"
                onClick={() => setEventTypeFilter(eventTypeFilter === 'other' ? 'all' : 'other')}
                className={`touch-target min-h-[44px] px-3 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  eventTypeFilter === 'other'
                    ? 'bg-purple-500/25 text-purple-400 border border-purple-500/40 shadow-xs'
                    : 'bg-surface-elevated text-text-muted hover:text-purple-400 border border-border-subtle'
                }`}
              >
                <span>📚 Muut</span>
                <span className="text-[10px] opacity-80">({filterCounts.other})</span>
              </button>
            )}
          </div>
        </div>

        {unDismissedConflicts.length > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border border-whistle/40 bg-whistle/15 px-3.5 py-3 shadow-xs">
            <button
              type="button"
              onClick={() => setIsLogisticsOpen(true)}
              aria-label={`Logistiikkaristiriita: ${unDismissedConflicts[0]?.message}. Avaa kuskijako.`}
              className="flex min-h-[44px] flex-1 items-start gap-2.5 text-left cursor-pointer hover:brightness-105 transition-all focus-visible:ring-2 focus-visible:ring-whistle"
            >
              <span className="mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-whistle text-text-inverse shrink-0">
                Ristiriita
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary leading-snug">
                  {unDismissedConflicts[0]?.message}
                </div>
                <div className="text-xs font-bold text-whistle mt-1 flex items-center gap-1">
                  <span>🚗 Avaa kuskijako & kimppakyydit ➔</span>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => unDismissedConflicts[0] && dismissConflict(unDismissedConflicts[0])}
              className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-surface-elevated text-text-secondary hover:text-pitch hover:border-pitch/40 border border-border-subtle text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 flex items-center gap-1"
              title="Merkitse tämä huomio hoidetuksi ja piilota se"
            >
              <span>✓</span>
              <span>Kuittaa hoidetuksi</span>
            </button>
          </div>
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
              onEventCreated={() => setActiveProfileId('all')}
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

            {categoryFilteredEvents.length > 0 ? (
              /* Cards Feed with Structured Day Containers */
              <div className="flex flex-col gap-6 pb-4">
                {eventsGroupedByDay.map((dayGroup) => (
                  <section
                    key={dayGroup.dateStr}
                    className="rounded-3xl border border-border-strong/70 bg-surface/60 backdrop-blur-sm p-3.5 sm:p-4.5 flex flex-col gap-3.5 shadow-sm"
                  >
                    {/* Day Section Header (Sticky inside the Day Container) */}
                    <div className="sticky top-[var(--sticky-filter-height,112px)] z-10 -mx-3.5 -mt-3.5 px-3.5 pt-3.5 pb-2.5 sm:-mx-4.5 sm:-mt-4.5 sm:px-4.5 sm:pt-4.5 bg-surface/95 backdrop-blur-md border-b border-border-subtle rounded-t-3xl flex items-center justify-between shadow-xs transition-all">
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
                              allEvents={allStitchedEvents}
                              profile={snapshot.nextPlayer || profile}
                              kit={snapshot.kitByEventId[event.id]}
                              conflicts={snapshot.conflicts}
                              homeLocation={homeLocation}
                              onOpenHomeModal={() => setIsHomeLocationOpen(true)}
                              onNavigate={() => {
                                  const isApprox = event.venue?.isApproximateLocation;
                                  const coords = event.parking?.coordinates || (!isApprox ? event.venue?.coordinates : undefined);
                                  const hasValidCoords = coords && (coords.lat !== 0 || coords.lng !== 0);
                                  const destination =
                                    hasValidCoords
                                      ? `${coords.lat},${coords.lng}`
                                      : encodeURIComponent(event.venue?.name || 'Kenttä');
                                  window.open(
                                    `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  );
                                }}
                              onOpenStats={() => setSelectedStatsEvent(event)}
                              onResolveMismatch={handleResolveMismatch}
                              onEventUpdated={handleEventUpdated}
                              onEventMerged={handleEventUpdated}
                              onEventDeleted={async (deletedId) => {
                                await db.events.delete(deletedId);
                              }}
                              onEventHidden={async (hiddenId) => {
                                await db.events.update(hiddenId, { isHidden: true });
                              }}
                            />
                          );
                        }

                        return (
                          <MatchdayCard
                            key={event.id}
                            event={event}
                            allEvents={allStitchedEvents}
                            playerName={profile?.playerName}
                            colorHex={profile?.colorHex}
                            profile={profile}
                            compact
                            conflicts={snapshot.conflicts}
                            homeLocation={homeLocation}
                            onOpenHomeModal={() => setIsHomeLocationOpen(true)}
                            onResolveMismatch={handleResolveMismatch}
                            onEventUpdated={handleEventUpdated}
                            onEventMerged={handleEventUpdated}
                            onEventDeleted={async (deletedId) => {
                              await db.events.delete(deletedId);
                            }}
                            onEventHidden={async (hiddenId) => {
                              await db.events.update(hiddenId, { isHidden: true });
                            }}
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
              events={categoryFilteredEvents}
              profiles={profiles}
              viewMode={viewMode}
              conflicts={snapshot.conflicts}
              onSelectEvent={(ev) => setSelectedStatsEvent(ev)}
              onClearFilter={() => setActiveProfileId('all')}
              onNavigate={(ev) => {
                const isApprox = ev.venue?.isApproximateLocation;
                const coords = ev.parking?.coordinates || (!isApprox ? ev.venue?.coordinates : undefined);
                const hasValidCoords = coords && (coords.lat !== 0 || coords.lng !== 0);
                const destination =
                  hasValidCoords
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
        initialColorHex={importDefaults.colorHex}
        initialSquadFilters={importDefaults.squadFilters}
        editingProfileId={importDefaults.profileId}
        onImportClassic={handleImportCalendar}
      />

      {/* Family Logistics & Carpooling Modal */}
      <FamilyLogisticsModal
        isOpen={isLogisticsOpen}
        onClose={() => setIsLogisticsOpen(false)}
        events={allStitchedEvents}
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
          // Recalculate transit & venue coordinates immediately for all events
          const all = await db.events.toArray();
          for (const ev of all) {
            let currentVenue = ev.venue;
            if (ev.venue?.name) {
              const freshVenue = await resolveSportsVenue(ev.venue.name);
              currentVenue = freshVenue;
            }
            if (currentVenue?.coordinates) {
              const freshTransit = resolveTransitPlan(h, currentVenue.coordinates, ev.weather);
              await db.events.update(ev.id, { venue: currentVenue, transit: freshTransit });
            }
          }
        }}
      />

      {/* Natural Language Q&A Modal */}
      <AskCopilotModal
        isOpen={isAskCopilotOpen}
        onClose={() => setIsAskCopilotOpen(false)}
        events={allStitchedEvents}
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
        onDataImported={() => setActiveProfileId('all')}
      />

      {/* Live Family Calendar Subscription Modal (webcal://) */}
      <FamilyCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        events={allStitchedEvents}
        profiles={profiles}
      />

      {/* Global Interactive Match Stats Modal (for Timeline & Calendar selections) */}
      {selectedStatsEvent && !selectedStatsEvent.isTraining && (
        <MatchStatsModal
          isOpen={true}
          onClose={() => setSelectedStatsEvent(null)}
          stats={selectedStatsEvent.stats}
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
