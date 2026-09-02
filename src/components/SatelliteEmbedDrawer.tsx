import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';

interface SatelliteEmbedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  embedUrl: string;
  sourceRepo: 'parkkis' | 'football-stats' | 'volleyball-stats';
}

export const SatelliteEmbedDrawer: React.FC<SatelliteEmbedDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  embedUrl,
  sourceRepo,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!isOpen) return null;

  const repoColor =
    sourceRepo === 'parkkis'
      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
      : sourceRepo === 'football-stats'
      ? 'border-amber-400/30 text-amber-300 bg-amber-400/10'
      : 'border-orange-500/30 text-orange-400 bg-orange-500/10';

  const repoLabel =
    sourceRepo === 'parkkis'
      ? '🅿️ ParkkiS Spatial'
      : sourceRepo === 'football-stats'
      ? '⚽ Football Stats'
      : '🏐 Volleyball Stats';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
          onClick={onClose}
        />

        {/* Slide-over Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={springTactile.snappy}
          className="relative z-10 flex h-full w-full max-w-xl flex-col bg-surface-elevated border-l border-border-subtle shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 bg-surface-elevated/90 shrink-0">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${repoColor}`}>
                  {repoLabel}
                </span>
              </div>
              <h2 className="text-base font-bold text-text-primary truncate mt-0.5">{title}</h2>
              {subtitle && <p className="text-xs text-text-muted truncate">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Avaa erillisessä välilehdessä"
                className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
                title="Avaa erillisessä välilehdessä"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sulje"
                className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Iframe Content Area */}
          <div className="relative flex-1 bg-surface-base overflow-hidden">
            {isLoading && !hasError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-base gap-3">
                <RefreshCw className="h-6 w-6 text-pitch animate-spin" />
                <span className="text-xs font-medium text-text-muted">Ladataan tilastoja...</span>
              </div>
            )}

            {hasError ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-whistle mb-3" />
                <h3 className="text-sm font-bold text-text-primary">Satelliittinäkymää ei voitu ladata</h3>
                <p className="mt-1 text-xs text-text-muted max-w-xs">
                  Palvelu ei vastannut tai olet offline-tilassa. Voit silti käyttää Pelipäivän paikallisia tietoja.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHasError(false);
                    setIsLoading(true);
                  }}
                  className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-elevated border border-border-subtle hover:border-pitch/40 text-text-primary"
                >
                  Yritä uudelleen
                </button>
              </div>
            ) : (
              <iframe
                src={embedUrl}
                title={title}
                className="h-full w-full border-0"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>

          {/* Footer Contract Guarantee */}
          <div className="border-t border-border-subtle px-4 py-2 bg-surface-base text-[11px] text-text-muted flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-pitch" />
              <span>Sopimus: CrossRepoQuery v1.0.0</span>
            </span>
            <span>Offline Safe</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
