import { useMemo, useState } from "react";
import type { MatchdayEvent, HomeLocation, PitchSurface, TransitPlan } from "../types/matchday";
import type { FamilyConflict } from "../lib/agents";
import { useDismissedConflicts, groupActiveConflicts } from "../lib/agents/conflictDismissal";
import { resolveTransitPlan } from "../lib/geo/transitEngine";
import { db } from "../lib/storage/db";
import { recordAttendanceOverride } from "../lib/sync/familyCloud";

export function surfaceLabel(surface: PitchSurface, indoor: boolean): string {
  if (indoor) return "Sisähalli";
  switch (surface) {
    case "artificial_turf_3g":
      return "Tekonurmi 3G";
    case "sand_artificial_turf":
      return "Hiekkatekonurmi";
    case "natural_grass":
      return "Luonnonnurmi";
    case "indoor_parquet":
      return "Parketti";
    case "indoor_synthetic":
      return "Sisäalusta";
    case "gravel":
      return "Hiekka";
    default:
      return "Kenttä";
  }
}

export interface UseMatchdayLogisticsOptions {
  event: MatchdayEvent;
  conflicts?: FamilyConflict[];
  homeLocation?: HomeLocation;
  currentScore?: string;
  onEventUpdated?: (updatedEvent: MatchdayEvent) => void;
}

export function useMatchdayLogistics({
  event,
  conflicts,
  homeLocation,
  currentScore,
  onEventUpdated,
}: UseMatchdayLogisticsOptions) {
  const { isDismissed, dismiss: dismissConflict, restore: restoreConflict } = useDismissedConflicts();
  const [showDismissedConflicts, setShowDismissedConflicts] = useState(false);
  const [isOutExpanded, setIsOutExpanded] = useState(false);

  // Active & Dismissed Conflicts
  const { activeConflicts, dismissedConflicts } = useMemo(() => {
    const raw = conflicts?.filter((c) => c.eventAId === event.id || c.eventBId === event.id) || [];
    const related = Array.from(
      new Map(raw.map((c) => [`${c.message}-${c.suggestedFix}`, c])).values()
    );
    const active = related.filter((c) => !isDismissed(c));
    const dismissed = related.filter((c) => isDismissed(c));
    return {
      activeConflicts: active,
      dismissedConflicts: dismissed,
    };
  }, [conflicts, event.id, isDismissed]);

  const consolidatedConflictGroups = useMemo(() => groupActiveConflicts(activeConflicts), [activeConflicts]);

  // Transit Plan
  const transitPlan: TransitPlan = useMemo(
    () => event.transit || resolveTransitPlan(homeLocation, event.venue?.coordinates, event.weather),
    [event.transit, homeLocation, event.venue?.coordinates, event.weather]
  );

  // Time & Status Calculations
  const isLive = new Date(event.startTime) <= new Date() && new Date() <= new Date(event.endTime);
  const isPast = new Date(event.endTime) <= new Date() || currentScore !== undefined;

  const formattedKickoff = new Date(event.startTime).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki",
  });

  const formattedWarmup = event.warmupTime
    ? new Date(event.warmupTime).toLocaleTimeString("fi-FI", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Helsinki",
      })
    : formattedKickoff;

  const dateLabel = new Date(event.startTime).toLocaleDateString("fi-FI", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Helsinki",
  });

  const isTraining = Boolean(event.isTraining || event.eventType === "training");
  const isSchool = Boolean(event.sport === "school" || event.eventType === "school");
  const isOther = Boolean(event.sport === "other" || event.eventType === "other" || event.eventType === "meeting");

  // Navigation URLs
  const isApprox = Boolean(event.venue?.isApproximateLocation);
  const isSelfTransit = Boolean(transitPlan?.isSelfTransit);
  const targetCoords = isSelfTransit
    ? (!isApprox ? event.venue?.coordinates : undefined)
    : (event.parking?.coordinates || (!isApprox ? event.venue?.coordinates : undefined));
  const hasValidCoords = Boolean(targetCoords && (targetCoords.lat !== 0 || targetCoords.lng !== 0));
  const destination = hasValidCoords
    ? `${targetCoords!.lat},${targetCoords!.lng}`
    : encodeURIComponent(event.venue?.name || "Kenttä");
  const travelModeParam =
    transitPlan?.mode === "walk"
      ? "&travelmode=walking"
      : transitPlan?.mode === "bicycle"
      ? "&travelmode=bicycling"
      : "";
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}${travelModeParam}`;

  const transitEmoji =
    transitPlan?.mode === "walk"
      ? "🚶 Kävely"
      : transitPlan?.mode === "bicycle"
      ? "🚴 Pyörä"
      : transitPlan?.mode === "transit"
      ? "🚌 Bussi"
      : "🚗 Lähde";

  // Attendance Toggle
  const isOut = event.attendanceStatus === "out";

  const handleToggleAttendance = async (newStatus: "in" | "out") => {
    try {
      setIsOutExpanded(false);
      const updated: MatchdayEvent = {
        ...event,
        attendanceStatus: newStatus,
      };
      const sync = await db.syncState.get("family").catch(() => null);
      await recordAttendanceOverride(sync?.syncKey || "", event.id, newStatus, db);
      onEventUpdated?.(updated);
    } catch (err) {
      console.error("Failed to toggle attendance", err);
    }
  };

  return {
    transitPlan,
    isLive,
    isPast,
    formattedKickoff,
    formattedWarmup,
    dateLabel,
    isTraining,
    isSchool,
    isOther,
    mapsUrl,
    destination,
    transitEmoji,
    isOut,
    isOutExpanded,
    setIsOutExpanded,
    handleToggleAttendance,
    activeConflicts,
    dismissedConflicts,
    consolidatedConflictGroups,
    dismissConflict,
    restoreConflict,
    showDismissedConflicts,
    setShowDismissedConflicts,
    surfaceLabel,
  };
}
