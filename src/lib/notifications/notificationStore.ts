/**
 * Unified In-App Notification Store for Pelipäivä
 * Follows Nova Design Protocol: reactive, non-blocking, accessible status alerts.
 */

export type NotificationType = 'fetch_error' | 'warning' | 'info' | 'success' | 'offline';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  source?: string;
  retryAction?: () => void | Promise<void>;
  retryLabel?: string;
  timestamp: number;
  autoDismissMs?: number;
}

type Listener = (notifications: AppNotification[]) => void;

class NotificationStore {
  private notifications: AppNotification[] = [];
  private listeners = new Set<Listener>();
  private recentSignatures = new Map<string, number>(); // signature -> timestamp for deduplication

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const copy = [...this.notifications];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }

  push(options: Omit<AppNotification, 'id' | 'timestamp'>): string {
    const signature = `${options.type}:${options.source || ''}:${options.message}`;
    const now = Date.now();
    const lastTime = this.recentSignatures.get(signature);

    // Suppress duplicate notification if sent within 10 seconds
    if (lastTime && now - lastTime < 10000) {
      return '';
    }
    this.recentSignatures.set(signature, now);

    const id = `notif_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const autoDismissMs =
      options.autoDismissMs !== undefined
        ? options.autoDismissMs
        : options.type === 'fetch_error' || options.type === 'warning'
        ? 10000
        : 6000;

    const notification: AppNotification = {
      ...options,
      id,
      timestamp: now,
      autoDismissMs
    };

    // Keep max 5 active notifications to avoid screen clutter
    this.notifications = [notification, ...this.notifications.slice(0, 4)];
    this.notifyListeners();

    if (autoDismissMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, autoDismissMs);
    }

    return id;
  }

  dismiss(id: string): void {
    const prevLen = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (this.notifications.length !== prevLen) {
      this.notifyListeners();
    }
  }

  clear(): void {
    this.notifications = [];
    this.notifyListeners();
  }

  getSnapshot(): AppNotification[] {
    return this.notifications;
  }
}

export const notificationStore = new NotificationStore();

// Convenience helper functions
export function notifyFetchError(options: {
  title?: string;
  message: string;
  source?: string;
  retryAction?: () => void | Promise<void>;
  retryLabel?: string;
}): string {
  return notificationStore.push({
    type: 'fetch_error',
    title: options.title || 'Tietojen haku epäonnistui',
    message: options.message,
    source: options.source,
    retryAction: options.retryAction,
    retryLabel: options.retryLabel || 'Yritä uudelleen',
    autoDismissMs: 12000
  });
}

export function notifyWarning(title: string, message: string, source?: string): string {
  return notificationStore.push({
    type: 'warning',
    title,
    message,
    source,
    autoDismissMs: 8000
  });
}

export function notifySuccess(title: string, message: string): string {
  return notificationStore.push({
    type: 'success',
    title,
    message,
    autoDismissMs: 5000
  });
}

export function notifyInfo(title: string, message: string, source?: string): string {
  return notificationStore.push({
    type: 'info',
    title,
    message,
    source,
    autoDismissMs: 6000
  });
}

export function dismissNotification(id: string): void {
  notificationStore.dismiss(id);
}
