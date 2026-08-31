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
