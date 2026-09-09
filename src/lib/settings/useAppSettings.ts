import { useState, useCallback } from 'react';

export interface AppAiSettings {
  showConflictWarnings: boolean;
  showScheduleAdvisories: boolean;
  showCopilotAssistant: boolean;
  showTacticalScout: boolean;
  showSmartGearAdvice: boolean;
}

const STORAGE_KEYS = {
  conflicts: 'pelipaiva_show_conflict_warnings',
  advisories: 'pelipaiva_show_schedule_advisories',
  copilot: 'pelipaiva_show_copilot',
  scout: 'pelipaiva_show_tactical_scout',
  gear: 'pelipaiva_show_gear_advice',
} as const;

function readStorageBool(key: string, defaultValue = false): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val === 'true';
  } catch {
    return defaultValue;
  }
}

function writeStorageBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage quota or disabled storage
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppAiSettings>(() => ({
    showConflictWarnings: readStorageBool(STORAGE_KEYS.conflicts, false),
    showScheduleAdvisories: readStorageBool(STORAGE_KEYS.advisories, false),
    showCopilotAssistant: readStorageBool(STORAGE_KEYS.copilot, false),
    showTacticalScout: readStorageBool(STORAGE_KEYS.scout, false),
    showSmartGearAdvice: readStorageBool(STORAGE_KEYS.gear, false),
  }));

  const updateSetting = useCallback((key: keyof AppAiSettings, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      const storageKey =
        key === 'showConflictWarnings'
          ? STORAGE_KEYS.conflicts
          : key === 'showScheduleAdvisories'
          ? STORAGE_KEYS.advisories
          : key === 'showCopilotAssistant'
          ? STORAGE_KEYS.copilot
          : key === 'showTacticalScout'
          ? STORAGE_KEYS.scout
          : STORAGE_KEYS.gear;
      writeStorageBool(storageKey, value);
      return next;
    });
  }, []);

  const toggleConflictWarnings = useCallback(() => {
    updateSetting('showConflictWarnings', !settings.showConflictWarnings);
  }, [settings.showConflictWarnings, updateSetting]);

  const toggleScheduleAdvisories = useCallback(() => {
    updateSetting('showScheduleAdvisories', !settings.showScheduleAdvisories);
  }, [settings.showScheduleAdvisories, updateSetting]);

  const toggleCopilotAssistant = useCallback(() => {
    updateSetting('showCopilotAssistant', !settings.showCopilotAssistant);
  }, [settings.showCopilotAssistant, updateSetting]);

  const toggleTacticalScout = useCallback(() => {
    updateSetting('showTacticalScout', !settings.showTacticalScout);
  }, [settings.showTacticalScout, updateSetting]);

  const toggleSmartGearAdvice = useCallback(() => {
    updateSetting('showSmartGearAdvice', !settings.showSmartGearAdvice);
  }, [settings.showSmartGearAdvice, updateSetting]);

  return {
    settings,
    updateSetting,
    toggleConflictWarnings,
    toggleScheduleAdvisories,
    toggleCopilotAssistant,
    toggleTacticalScout,
    toggleSmartGearAdvice,
  };
}
