import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Car,
  Home,
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
  showConflictWarnings?: boolean;
  onToggleConflictWarnings?: () => void;
  onOpenHomeLocation?: () => void;
  onAsk?: () => void;
  onClear: () => void;
}

export const MissionControlHUD: React.FC<MissionControlHUDProps> = ({
  snapshot,
  isOffline,
  isSyncing,
  isDemo,
  showConflictWarnings = true,
  onToggleConflictWarnings,
  onRefresh,
  onShare,
  onAmbient,
  onLogistics,
  onImport,
  onOpenHomeLocation,
  onAsk,
  onClear
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const conflictCount = snapshot.conflicts.length;
  const leaveBy = snapshot.leaveBy;
  const child = snapshot.nextPlayer?.playerName;

  return (
    <header className="hud-stripe sticky top-0 z-40 border-b border-border-subtle bg-canvas/92 pt-[env(safe-area-inset-top)] backdrop-blur-md">
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
              <span className="font-semibold text-floodlight">
                {snapshot.leaveTransitLabel ? `${snapshot.leaveTransitLabel} · ` : ''}
                Lähde klo {leaveBy}
              </span>
            </p>
          ) : (
            <p className="text-xs text-text-muted">{snapshot.summary || snapshot.weekendLabel}</p>
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

        <div className="relative z-50">
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
              <React.Fragment key="hud-menu-group">
                <motion.div
                  key="hud-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  key="hud-dropdown"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-border-strong bg-surface-base shadow-2xl"
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
                {onOpenHomeLocation && (
                  <MenuItem
                    icon={<Home className="h-4 w-4" />}
                    label="Kotiosoite & Kulkuvälineet"
                    onClick={() => {
                      onOpenHomeLocation();
                      setMenuOpen(false);
                    }}
                  />
                )}
                <MenuItem
                  icon={<Share2 className="h-4 w-4" />}
                  label="Perhe-koodi"
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
                {onToggleConflictWarnings && (
                  <MenuItem
                    icon={<AlertTriangle className={`h-4 w-4 ${showConflictWarnings ? 'text-whistle' : 'text-text-muted'}`} />}
                    label={showConflictWarnings ? 'Varoitukset: Päällä' : 'Varoitukset: Piilotettu'}
                    onClick={() => {
                      onToggleConflictWarnings();
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
                <div className="px-3 py-1.5 text-[10px] font-mono text-text-muted border-t border-border-subtle bg-surface-elevated/40 flex items-center justify-between">
                  <span>v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}</span>
                  <span>git:{typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'}</span>
                </div>
              </motion.div>
              </React.Fragment>
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
