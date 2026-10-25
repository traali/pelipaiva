import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  notificationStore,
  notifyFetchError,
  notifyWarning,
  notifySuccess,
  notifyInfo,
  dismissNotification
} from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    notificationStore.clear();
    vi.useRealTimers();
  });

  it('pushes and dismisses notifications', () => {
    const id = notifySuccess('Testi', 'Onnistui');
    expect(id).toBeTruthy();
    expect(notificationStore.getSnapshot()).toHaveLength(1);
    expect(notificationStore.getSnapshot()[0]!.title).toBe('Testi');

    dismissNotification(id);
    expect(notificationStore.getSnapshot()).toHaveLength(0);
  });

  it('deduplicates identical notifications within cooldown period', () => {
    const id1 = notifyFetchError({
      title: 'Virhe',
      message: 'Palvelin ei vastaa',
      source: 'Torneopal'
    });
    const id2 = notifyFetchError({
      title: 'Virhe',
      message: 'Palvelin ei vastaa',
      source: 'Torneopal'
    });

    expect(id1).toBeTruthy();
    expect(id2).toBe(''); // suppressed
    expect(notificationStore.getSnapshot()).toHaveLength(1);
  });

  it('stores retry actions correctly', async () => {
    const retryFn = vi.fn().mockResolvedValue(true);
    notifyFetchError({
      title: 'Haku epäonnistui',
      message: 'Verkkovirhe',
      retryAction: retryFn
    });

    const notif = notificationStore.getSnapshot()[0];
    expect(notif?.retryAction).toBeDefined();
    await notif?.retryAction?.();
    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  it('pushes warning and info notifications with appropriate metadata', () => {
    const warnId = notifyWarning('Varoitus', 'Tarkista kenttä', 'Geokooderi');
    expect(warnId).toBeTruthy();

    const infoId = notifyInfo('Huomio', 'Ottelu alkaa pian', 'Aikataulu');
    expect(infoId).toBeTruthy();

    const snapshot = notificationStore.getSnapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0]?.type).toBe('info');
    expect(snapshot[0]?.source).toBe('Aikataulu');
    expect(snapshot[1]?.type).toBe('warning');
    expect(snapshot[1]?.source).toBe('Geokooderi');
  });
});
