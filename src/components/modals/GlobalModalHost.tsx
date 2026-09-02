import React, { Suspense, lazy } from "react";
import type { MatchdayEvent, PlayerProfile, HomeLocation } from "../../types/matchday";
import type { ActiveModal } from "../../lib/modals/useModalStore";
import { DEFAULT_HOME_LOCATION } from "../../lib/storage/homeLocation";
import { db } from "../../lib/storage/db";
import { resolveSportsVenue } from "../../lib/geo/sportsGeocoder";
import { resolveTransitPlan } from "../../lib/geo/transitEngine";

const SmartImportModal = lazy(() =>
  import("../SmartImportModal").then((m) => ({ default: m.SmartImportModal }))
);
const FamilyLogisticsModal = lazy(() =>
  import("../FamilyLogisticsModal").then((m) => ({ default: m.FamilyLogisticsModal }))
);
const HomeLocationModal = lazy(() =>
  import("../HomeLocationModal").then((m) => ({ default: m.HomeLocationModal }))
);
const AskCopilotModal = lazy(() =>
  import("../AskCopilotModal").then((m) => ({ default: m.AskCopilotModal }))
);
const FamilyManageModal = lazy(() =>
  import("../FamilyManageModal").then((m) => ({ default: m.FamilyManageModal }))
);
const FamilyShareModal = lazy(() =>
  import("../FamilyShareModal").then((m) => ({ default: m.FamilyShareModal }))
);
const FamilyCalendarModal = lazy(() =>
  import("../FamilyCalendarModal").then((m) => ({ default: m.FamilyCalendarModal }))
);
const MatchStatsModal = lazy(() =>
  import("../MatchStatsModal").then((m) => ({ default: m.MatchStatsModal }))
);
const SatelliteEmbedDrawer = lazy(() =>
  import("../SatelliteEmbedDrawer").then((m) => ({ default: m.SatelliteEmbedDrawer }))
);

export interface GlobalModalHostProps {
  activeModal: ActiveModal;
  onClose: () => void;
  allStitchedEvents: MatchdayEvent[];
  profiles: PlayerProfile[];
  homeLocation?: HomeLocation;
  saveHomeLocation: (home: HomeLocation) => Promise<any>;
  existingPlayers: string[];
  handleImportCalendar: (playerName: string, teamName: string, sport: any, url: string, colorHex?: string, squadFilters?: string[], editingProfileId?: string) => Promise<any>;
  openAddTeam: (playerName: string) => void;
  openEditProfile: (profile: PlayerProfile) => void;
  showConflictWarnings: boolean;
  toggleConflictWarnings: () => void;
  setIsOnboardingActive: (val: boolean) => void;
  setActiveProfileId: (val: string) => void;
  openHomeLocation: () => void;
  openFamilyShare: () => void;
}

export const GlobalModalHost: React.FC<GlobalModalHostProps> = ({
  activeModal,
  onClose,
  allStitchedEvents,
  profiles,
  homeLocation,
  saveHomeLocation,
  existingPlayers,
  handleImportCalendar,
  openAddTeam,
  openEditProfile,
  showConflictWarnings,
  toggleConflictWarnings,
  setIsOnboardingActive,
  setActiveProfileId,
  openHomeLocation,
  openFamilyShare,
}) => {
  return (
    <Suspense fallback={null}>
      {/* Smart Import Modal */}
      {activeModal?.type === "smartImport" && (
        <SmartImportModal
          isOpen={true}
          onClose={onClose}
          existingPlayers={existingPlayers}
          initialSport={activeModal.defaults?.sport}
          initialTab={activeModal.defaults?.initialTab || "classic"}
          initialTeamUrl={activeModal.defaults?.url}
          initialTeamName={activeModal.defaults?.name}
          initialPlayerName={activeModal.defaults?.playerName}
          initialColorHex={activeModal.defaults?.colorHex}
          initialSquadFilters={activeModal.defaults?.squadFilters}
          editingProfileId={activeModal.defaults?.profileId}
          onImportClassic={handleImportCalendar}
        />
      )}

      {/* Family Logistics & Carpooling Modal */}
      {activeModal?.type === "logistics" && (
        <FamilyLogisticsModal
          isOpen={true}
          onClose={onClose}
          events={allStitchedEvents}
          profiles={profiles}
          homeLocation={homeLocation}
          onOpenHomeModal={() => {
            onClose();
            openHomeLocation();
          }}
        />
      )}

      {/* Home Location Modal */}
      {activeModal?.type === "homeLocation" && (
        <HomeLocationModal
          isOpen={true}
          onClose={onClose}
          currentHome={homeLocation || DEFAULT_HOME_LOCATION}
          onSaveHome={async (h) => {
            await saveHomeLocation(h);
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
      )}

      {/* Copilot Natural Language Q&A Modal */}
      {activeModal?.type === "copilot" && (
        <AskCopilotModal
          isOpen={true}
          onClose={onClose}
          events={allStitchedEvents}
          profiles={profiles}
        />
      )}

      {/* Family Management Modal */}
      {activeModal?.type === "familyManage" && (
        <FamilyManageModal
          isOpen={true}
          onClose={onClose}
          profiles={profiles}
          homeLocation={homeLocation}
          showConflictWarnings={showConflictWarnings}
          onToggleConflictWarnings={toggleConflictWarnings}
          onOpenHomeLocation={() => {
            onClose();
            openHomeLocation();
          }}
          onOpenImportForPlayer={(playerName) => {
            onClose();
            openAddTeam(playerName);
          }}
          onEditProfile={(profile) => openEditProfile(profile)}
          onOpenFamilyShare={() => {
            onClose();
            openFamilyShare();
          }}
          onOpenOnboardingWizard={() => {
            localStorage.removeItem("pelipaiva_onboarding_done");
            setIsOnboardingActive(true);
            onClose();
          }}
        />
      )}

      {/* Family Share & Backup Modal */}
      {activeModal?.type === "familyShare" && (
        <FamilyShareModal
          isOpen={true}
          onClose={onClose}
          profiles={profiles}
          onDataImported={() => setActiveProfileId("all")}
        />
      )}

      {/* Calendar Subscription Modal */}
      {activeModal?.type === "calendar" && (
        <FamilyCalendarModal
          isOpen={true}
          onClose={onClose}
          events={allStitchedEvents}
          profiles={profiles}
        />
      )}

      {/* Stats Modal */}
      {activeModal?.type === "stats" && !activeModal.event.isTraining && (
        <MatchStatsModal
          isOpen={true}
          onClose={onClose}
          stats={activeModal.event.stats}
          homeTeam={activeModal.event.homeTeam}
          awayTeam={activeModal.event.awayTeam || "Vastustaja"}
          playerName={profiles.find((p) => p.id === activeModal.event.profileId)?.playerName}
          playerLog={activeModal.event.playerLog}
          score={activeModal.event.score}
          sport={activeModal.event.sport}
          onSavePlayerLog={async (log, updatedScore) => {
            const updates: Partial<MatchdayEvent> = {
              playerLog: log,
              score: updatedScore || activeModal.event.score,
            };
            await db.events.update(activeModal.event.id, updates).catch(console.warn);
          }}
        />
      )}

      {/* Satellite Slide-Over Embed Drawer */}
      {activeModal?.type === "drawer" && (
        <SatelliteEmbedDrawer
          isOpen={true}
          onClose={onClose}
          title={activeModal.title}
          embedUrl={
            activeModal.sport === "football-stats"
              ? `https://football-stats-agk.pages.dev/#/match/${encodeURIComponent(activeModal.matchId)}?embed=true`
              : activeModal.sport === "volleyball-stats"
              ? `https://volleyball-stats-7xq.pages.dev/match/${encodeURIComponent(activeModal.matchId)}?embed=true`
              : activeModal.sport === "basketball-stats"
              ? `https://basketball-stats-byu.pages.dev/match/${encodeURIComponent(activeModal.matchId)}?embed=true`
              : activeModal.sport === "parkkis"
              ? `https://parkkis.pages.dev/?embed=true`
              : `https://floorball-stats.pages.dev/match/${encodeURIComponent(activeModal.matchId)}?embed=true`
          }
          sourceRepo={activeModal.sport as any}
        />
      )}
    </Suspense>
  );
};
