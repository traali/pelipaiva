import { useState, useCallback } from "react";
import type { MatchdayEvent } from "../../types/matchday";

export interface SmartImportDefaults {
  playerName?: string;
  sport?: any;
  url?: string;
  name?: string;
  colorHex?: string;
  squadFilters?: string[];
  profileId?: string;
  initialTab?: "classic" | "message" | "table" | "ocr";
}

export type ActiveModal =
  | { type: "smartImport"; defaults?: SmartImportDefaults }
  | { type: "logistics" }
  | { type: "homeLocation" }
  | { type: "copilot" }
  | { type: "familyManage" }
  | { type: "familyShare" }
  | { type: "calendar" }
  | { type: "stats"; event: MatchdayEvent }
  | { type: "drawer"; sport: string; matchId: string; title: string }
  | null;

export function useModalStore() {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const openSmartImport = useCallback((defaults?: SmartImportDefaults) => {
    setActiveModal({ type: "smartImport", defaults });
  }, []);

  const openLogistics = useCallback(() => {
    setActiveModal({ type: "logistics" });
  }, []);

  const openHomeLocation = useCallback(() => {
    setActiveModal({ type: "homeLocation" });
  }, []);

  const openCopilot = useCallback(() => {
    setActiveModal({ type: "copilot" });
  }, []);

  const openFamilyManage = useCallback(() => {
    setActiveModal({ type: "familyManage" });
  }, []);

  const openFamilyShare = useCallback(() => {
    setActiveModal({ type: "familyShare" });
  }, []);

  const openCalendar = useCallback(() => {
    setActiveModal({ type: "calendar" });
  }, []);

  const openStats = useCallback((event: MatchdayEvent) => {
    setActiveModal({ type: "stats", event });
  }, []);

  const openDrawer = useCallback((sport: string, matchId: string, title: string) => {
    setActiveModal({ type: "drawer", sport, matchId, title });
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  return {
    activeModal,
    setActiveModal,
    openSmartImport,
    openLogistics,
    openHomeLocation,
    openCopilot,
    openFamilyManage,
    openFamilyShare,
    openCalendar,
    openStats,
    openDrawer,
    closeModal,
  };
}
