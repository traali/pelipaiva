import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pelipaiva_dismissed_conflicts';
const EVENT_NAME = 'pelipaiva_conflict_dismissal_changed';

export function getDismissedConflictIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function dismissConflict(id: string): void {
  try {
    const set = getDismissedConflictIds();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error('Failed to dismiss conflict', err);
  }
}

export function restoreConflict(id: string): void {
  try {
    const set = getDismissedConflictIds();
    set.delete(id);
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

export function isConflictDismissed(id: string): boolean {
  return getDismissedConflictIds().has(id);
}

export function useDismissedConflicts() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedConflictIds());

  useEffect(() => {
    const handler = () => {
      setDismissedIds(getDismissedConflictIds());
    };
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    dismissConflict(id);
  }, []);

  const restore = useCallback((id: string) => {
    restoreConflict(id);
  }, []);

  const restoreAll = useCallback(() => {
    restoreAllConflicts();
  }, []);

  return { dismissedIds, dismiss, restore, restoreAll };
}
