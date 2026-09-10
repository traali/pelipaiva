import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
  Database
} from 'lucide-react';
import { springTactile } from '../../lib/motion/springs';
import {
  notificationStore,
  dismissNotification,
  type AppNotification
} from '../../lib/notifications/notificationStore';

export const NotificationToastContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    return notificationStore.subscribe((list) => {
      setNotifications(list);
    });
  }, []);

  const handleRetry = async (n: AppNotification) => {
    if (!n.retryAction) return;
    setRetryingId(n.id);
    try {
      await n.retryAction();
      dismissNotification(n.id);
    } catch (err) {
      console.warn('Retry action failed:', err);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="Ilmoitukset"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence>
        {notifications.map((n) => {
          const isError = n.type === 'fetch_error';
          const isWarning = n.type === 'warning';
          const isSuccess = n.type === 'success';

          const borderColor = isError
            ? 'border-stoppage/40'
            : isWarning
            ? 'border-whistle/40'
            : isSuccess
            ? 'border-pitch/40'
            : 'border-border-subtle';

          const iconColor = isError
            ? 'text-stoppage'
            : isWarning
            ? 'text-whistle'
            : isSuccess
            ? 'text-pitch'
            : 'text-text-muted';

          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={springTactile.snappy}
              className={`pointer-events-auto liquid-glass relative overflow-hidden rounded-2xl p-4 shadow-2xl border ${borderColor} bg-surface-elevated/95 backdrop-blur-xl text-text-primary flex flex-col gap-2`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-xl bg-surface/60 shrink-0 ${iconColor}`}>
                    {isError ? (
                      <WifiOff className="w-4 h-4" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold truncate">{n.title}</h4>
                      {n.source && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface/80 border border-border-subtle text-text-muted uppercase tracking-wider">
                          {n.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismissNotification(n.id)}
                  aria-label="Sulje ilmoitus"
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface/80 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message */}
              <p className="text-xs text-text-secondary leading-relaxed pl-8">
                {n.message}
              </p>

              {/* Action / Retry Button */}
              {n.retryAction && (
                <div className="pl-8 pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRetry(n)}
                    disabled={retryingId === n.id}
                    className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retryingId === n.id ? 'animate-spin' : ''}`} />
                    <span>{retryingId === n.id ? 'Yritetään...' : n.retryLabel || 'Yritä uudelleen'}</span>
                  </button>

                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>Käytetään välimuistia</span>
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
