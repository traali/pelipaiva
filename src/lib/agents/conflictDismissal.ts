import { useState, useEffect, useCallback } from 'react';
import type { FamilyConflict } from './types';

const STORAGE_KEY = 'pelipaiva_dismissed_conflicts';
const EVENT_NAME = 'pelipaiva_conflict_dismissal_changed';

export function getDismissedConflictKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function computeConflictKeys(conflict: FamilyConflict | { id: string; eventAId?: string; eventBId?: string; message?: string }): string[] {
  const keys: string[] = [];
  if (conflict.id) keys.push(conflict.id);
  if (conflict.eventAId && conflict.eventBId) {
    keys.push(`${conflict.eventAId}-${conflict.eventBId}`);
    keys.push(`${conflict.eventBId}-${conflict.eventAId}`);
    keys.push(`c-${conflict.eventAId}-${conflict.eventBId}`);
    keys.push(`c-${conflict.eventBId}-${conflict.eventAId}`);
  }
  if (conflict.message) {
    keys.push(conflict.message.trim());
  }
  return keys;
}

export function dismissConflict(conflictOrId: FamilyConflict | string): void {
  try {
    const set = getDismissedConflictKeys();
    if (typeof conflictOrId === 'string') {
      set.add(conflictOrId);
    } else {
      const keys = computeConflictKeys(conflictOrId);
      for (const k of keys) {
        set.add(k);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error('Failed to dismiss conflict', err);
  }
}

export function restoreConflict(conflictOrId: FamilyConflict | string): void {
  try {
    const set = getDismissedConflictKeys();
    if (typeof conflictOrId === 'string') {
      set.delete(conflictOrId);
    } else {
      const keys = computeConflictKeys(conflictOrId);
      for (const k of keys) {
        set.delete(k);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error('Failed to restore conflict', err);
  }
}

export function restoreAllConflicts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error('Failed to clear dismissed conflicts', err);
  }
}

export function isConflictDismissed(conflict: FamilyConflict | string, dismissedKeys?: Set<string>): boolean {
  const set = dismissedKeys || getDismissedConflictKeys();
  if (typeof conflict === 'string') {
    return set.has(conflict);
  }
  const keys = computeConflictKeys(conflict);
  return keys.some((k) => set.has(k));
}

export function useDismissedConflicts() {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => getDismissedConflictKeys());

  useEffect(() => {
    const handler = () => {
      setDismissedKeys(getDismissedConflictKeys());
    };
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const dismiss = useCallback((conflictOrId: FamilyConflict | string) => {
    dismissConflict(conflictOrId);
  }, []);

  const restore = useCallback((conflictOrId: FamilyConflict | string) => {
    restoreConflict(conflictOrId);
  }, []);

  const restoreAll = useCallback(() => {
    restoreAllConflicts();
  }, []);

  const isDismissed = useCallback((c: FamilyConflict | string) => {
    return isConflictDismissed(c, dismissedKeys);
  }, [dismissedKeys]);

  return { dismissedKeys, dismiss, restore, restoreAll, isDismissed };
}

export interface ConsolidatedConflictGroup {
  id: string;
  conflicts: FamilyConflict[];
  severity: 'critical' | 'warn' | 'info';
  maxOverlap: number;
  maxTravel: number;
  childA: string;
  childB: string;
  isSameChild: boolean;
  title: string;
  message: string;
  suggestedFix: string;
  subItems: Array<{ overlap: number; venueA: string; venueB: string; travel: number }>;
}

export function groupActiveConflicts(conflicts: FamilyConflict[]): ConsolidatedConflictGroup[] {
  if (!conflicts || conflicts.length === 0) return [];

  // Group by counterpart child and venue pair
  const groupsMap = new Map<string, FamilyConflict[]>();
  for (const c of conflicts) {
    const isSameChild = c.childA.toLowerCase() === c.childB.toLowerCase();
    const key = isSameChild
      ? `same-${c.childA.toLowerCase()}`
      : `pair-${c.childA.toLowerCase()}-${c.childB.toLowerCase()}`;
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(c);
  }

  const result: ConsolidatedConflictGroup[] = [];
  for (const [key, groupList] of groupsMap.entries()) {
    if (groupList.length === 1) {
      const c = groupList[0]!;
      result.push({
        id: c.id,
        conflicts: [c],
        severity: c.severity,
        maxOverlap: c.overlapMinutes,
        maxTravel: c.travelMinutesEstimate,
        childA: c.childA,
        childB: c.childB,
        isSameChild: c.childA.toLowerCase() === c.childB.toLowerCase(),
        title: c.severity === 'info'
          ? 'Omatoiminen siirtymä'
          : c.overlapMinutes > 0
            ? `Päällekkäisyys (${c.overlapMinutes} min)`
            : 'Tiukka siirtymä / Ajoaika',
        message: c.message,
        suggestedFix: c.suggestedFix,
        subItems: []
      });
    } else {
      const isSameChild = groupList[0]!.childA.toLowerCase() === groupList[0]!.childB.toLowerCase();
      const maxOverlap = Math.max(...groupList.map((c) => c.overlapMinutes));
      const maxTravel = Math.max(...groupList.map((c) => c.travelMinutesEstimate));
      const hasCritical = groupList.some((c) => c.severity === 'critical');
      const childName = groupList[0]!.childA;

      const subItems = groupList.map((c) => ({
        overlap: c.overlapMinutes,
        venueA: c.venueA,
        venueB: c.venueB,
        travel: c.travelMinutesEstimate
      }));

      const hasOverlap = maxOverlap > 0;
      const title = isSameChild
        ? hasOverlap
          ? `Päällekkäisyys: ${groupList.length} päällekkäistä peliaikaa (max ${maxOverlap} min)`
          : `Tiukka siirtymä: ${groupList.length} peräkkäistä tapahtumaa`
        : hasOverlap
          ? `Päällekkäisyys: ${groupList.length} aikatauluristeystä (${groupList[0]!.childA} & ${groupList[0]!.childB})`
          : `Tiukka siirtymä: ${groupList.length} tapahtumaa (${groupList[0]!.childA} & ${groupList[0]!.childB})`;

      const message = isSameChild
        ? hasOverlap
          ? `${childName} on merkitty ${groupList.length} päällekkäiseen tapahtumaan samana päivänä.`
          : `${childName} on merkitty ${groupList.length} peräkkäiseen tapahtumaan samana päivänä. Tarkista siirtymäajat.`
        : hasOverlap
          ? `${groupList[0]!.childA} ja ${groupList[0]!.childB} pelaavat samaan aikaan ${groupList.length} ottelussa.`
          : `${groupList[0]!.childA} ja ${groupList[0]!.childB} siirtyvät eri kentille samana päivänä.`;

      const suggestedFix = isSameChild
        ? hasOverlap
          ? `Ilmoita valmentajille valinta mihin tapahtumiin ${childName} osallistuu.`
          : `Tarkista että siirtymäaika kenttien välillä riittää.`
        : 'Sovi kuskijako ja kyydit etukäteen turnauspäivälle.';

      result.push({
        id: `group-${key}`,
        conflicts: groupList,
        severity: hasCritical ? 'critical' : 'warn',
        maxOverlap,
        maxTravel,
        childA: groupList[0]!.childA,
        childB: groupList[0]!.childB,
        isSameChild,
        title,
        message,
        suggestedFix,
        subItems
      });
    }
  }

  return result;
}
