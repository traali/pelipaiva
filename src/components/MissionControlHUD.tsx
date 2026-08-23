import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Car,
  MessageSquarePlus,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Trash2,
  Tv,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { springTactile } from '../lib/motion/springs';
import { ThemeToggle } from './ThemeToggle';
import type { MissionControlSnapshot } from '../lib/agents';

interface MissionControlHUDProps {
  snapshot: MissionControlSnapshot;
  isOffline: boolean;
  isSyncing: boolean;
  isDemo: boolean;
  onRefresh: () => void;
  onShare: () => void;
  onAmbient: () => void;
  onLogistics: () => void;
  onImport: () => void;
  onAsk?: () => void;
  onClear: () => void;
}

export const MissionControlHUD: React.FC<MissionControlHUDProps> = ({
  snapshot,
  isOffline,
  isSyncing,
  isDemo,
  onRefresh,
  onShare,
  onAmbient,
  onLogistics,
  onImport,
  onAsk,
  onClear
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const conflictCount = snapshot.conflicts.length;
  const leaveBy = snapshot.leaveBy;
  const child = snapshot.nextPlayer?.playerName;

  return (
    <header className="hud-stripe sticky top-0 z-30 border-b border-border-subtle bg-canvas/92 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-text-primary">PELIPÄIVÄ</h1>
            {isDemo && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Demo</span>
            )}
          </div>
          {leaveBy ? (
            <p className="truncate text-xs text-text-secondary">
              {child ? `${child} · ` : ''}
              <span className="font-semibold text-floodlight">Lähde klo {leaveBy}</span>
            </p>
          ) : (
            <p className="text-xs text-text-muted">{snapshot.weekendLabel}</p>
          )}
        </div>

        {conflictCount > 0 && (
          <button
            type="button"
            onClick={onLogistics}
            className="touch-target inline-flex items-center gap-1 rounded-md border border-whistle/40 bg-whistle/15 px-2.5 text-xs font-semibold text-whistle"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {conflictCount}
          </button>
        )}

        {isOffline && (
          <span className="hidden text-[11px] font-semibold text-whistle sm:inline">Offline</span>
        )}

        <ThemeToggle />

        <div className="relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={springTactile.snappy}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Lisää"
            className="touch-target inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-elevated text-text-primary"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-lg border border-border-strong bg-surface-base shadow-lg"
              >
                <MenuItem
                  icon={<RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />}
                  label="Päivitä sää"
                  onClick={() => {
                    onRefresh();
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Car className="h-4 w-4" />}
                  label="Kyytiapuri"
                  onClick={() => {
                    onLogistics();
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Share2 className="h-4 w-4" />}
                  label="Jaa perheelle"
                  onClick={() => {
                    onShare();
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Tv className="h-4 w-4" />}
                  label="Keittiönäyttö"
                  onClick={() => {
                    onAmbient();
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<CalendarPlus className="h-4 w-4" />}
                  label="Tuo joukkue"
                  onClick={() => {
                    onImport();
                    setMenuOpen(false);
                  }}
                />
                {onAsk && (
                  <MenuItem
                    icon={<MessageSquarePlus className="h-4 w-4" />}
                    label="Kysy aikataulusta"
                    onClick={() => {
                      onAsk();
                      setMenuOpen(false);
                    }}
                  />
                )}
                <div className="border-t border-border-subtle" />
                {!confirmClear ? (
                  <MenuItem
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Tyhjennä tiedot"
                    danger
                    onClick={() => setConfirmClear(true)}
                  />
                ) : (
                  <MenuItem
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Vahvista tyhjennys"
                    danger
                    onClick={() => {
                      onClear();
                      setConfirmClear(false);
                      setMenuOpen(false);
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

function MenuItem({
  icon,
  label,
  onClick,
  danger
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm ${
        danger ? 'text-stoppage' : 'text-text-primary'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
