import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Users,
  Plus,
  Trash2,
  Share2,
  PlusCircle,
  Pencil
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { PlayerProfile } from '../types/matchday';
import { db } from '../lib/storage/db';
import { TeamColorPicker } from './TeamColorPicker';

interface FamilyManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: PlayerProfile[];
  onOpenImportForPlayer: (playerName: string) => void;
  onEditProfile: (profile: PlayerProfile) => void;
  onOpenFamilyShare: () => void;
  onOpenOnboardingWizard: () => void;
}

export const FamilyManageModal: React.FC<FamilyManageModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onOpenImportForPlayer,
  onEditProfile,
  onOpenFamilyShare,
  onOpenOnboardingWizard
}) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [colorForId, setColorForId] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<{
    message: string;
    undoAction: () => Promise<void>;
  } | null>(null);

  // Group profiles by player name
  const playerGroups = React.useMemo(() => {
    const map = new Map<string, PlayerProfile[]>();
    for (const p of profiles) {
      const name = p.playerName || 'Pelaaja';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    }
    return Array.from(map.entries());
  }, [profiles]);

  const recordTombstones = async (deletedIds: string[]) => {
    const sync = await db.syncState.get('family');
    if (sync && sync.syncKey) {
      const key = `pelipaiva_tombstones_${sync.syncKey}`;
      const existingStr = localStorage.getItem(key);
      const list: Array<{ id: string; deletedAt: string }> = existingStr ? JSON.parse(existingStr) : [];
      for (const id of deletedIds) {
        list.push({ id, deletedAt: new Date().toISOString() });
      }
      localStorage.setItem(key, JSON.stringify(list));
      await db.syncState.update('family', { pendingUpload: true });
    }
  };

  // Undo must retract the tombstone too, or the restored profile is
  // re-deleted on every other family device (M-17/N4).
  const removeTombstones = async (ids: string[]) => {
    const sync = await db.syncState.get('family');
    if (sync && sync.syncKey) {
      const key = `pelipaiva_tombstones_${sync.syncKey}`;
      const existingStr = localStorage.getItem(key);
      const list: Array<{ id: string; deletedAt: string }> = existingStr ? JSON.parse(existingStr) : [];
      const idSet = new Set(ids);
      localStorage.setItem(key, JSON.stringify(list.filter((t) => !idSet.has(t.id))));
      await db.syncState.update('family', { pendingUpload: true });
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    const targetProfile = profiles.find((p) => p.id === profileId);
    if (!targetProfile) return;
    const eventsToDelete = await db.events.where('profileId').equals(profileId).toArray();

    // Remove from DB
    await db.profiles.delete(profileId);
    for (const ev of eventsToDelete) {
      await db.events.delete(ev.id);
    }

    // Record the tombstone immediately — if the tab closes before the 5 s
    // undo window elapses, the deletion previously never propagated (M-17/N4).
    await recordTombstones([profileId]);

    const timer = setTimeout(() => {
      setUndoState(null);
    }, 5000);

    setUndoState({
      message: `Joukkue ${targetProfile.teamName} poistettu.`,
      undoAction: async () => {
        clearTimeout(timer);
        await removeTombstones([profileId]);
        await db.profiles.put(targetProfile);
        for (const ev of eventsToDelete) {
          await db.events.put(ev);
        }
        setUndoState(null);
      }
    });
  };

  const handleDeleteChild = async (name: string, childProfiles: PlayerProfile[]) => {
    const ids = childProfiles.map((p) => p.id);
    const allEvents: any[] = [];
    for (const p of childProfiles) {
      const evs = await db.events.where('profileId').equals(p.id).toArray();
      allEvents.push(...evs);
      await db.profiles.delete(p.id);
      for (const ev of evs) {
        await db.events.delete(ev.id);
      }
    }

    await recordTombstones(ids);

    const timer = setTimeout(() => {
      setUndoState(null);
    }, 5000);

    setUndoState({
      message: `Pelaaja ${name} ja kaikki joukkueet poistettu.`,
      undoAction: async () => {
        clearTimeout(timer);
        await removeTombstones(ids);
        for (const p of childProfiles) {
          await db.profiles.put(p);
        }
        for (const ev of allEvents) {
          await db.events.put(ev);
        }
        setUndoState(null);
      }
    });
  };

  const handleAddNewPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    onOpenImportForPlayer(trimmed);
    setNewPlayerName('');
    setIsAddingPlayer(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="family-manage-title"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={springTactile.snappy}
          className="liquid-glass rounded-3xl p-6 max-w-lg w-full border border-pitch/30 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 id="family-manage-title" className="text-base font-black text-text-primary">
                  Perheen pelaajat & joukkueet
                </h2>
                <p className="text-xs text-text-muted">
                  Hallitse perheenjäsenten harrastuksia. Samalle lapselle voi lisätä sarjan ja cupit.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface-elevated text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body: List of Children & Teams */}
          <div className="py-4 overflow-y-auto flex-1 flex flex-col gap-4">
            {playerGroups.map(([playerName, playerProfiles]) => (
              <div
                key={playerName}
                className="p-4 rounded-2xl bg-surface-elevated/90 border border-border-strong flex flex-col gap-3"
              >
                {/* Child Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👤</span>
                    <span className="text-sm font-black text-text-primary">{playerName}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-pitch/15 text-pitch font-bold">
                      {playerProfiles.length} {playerProfiles.length === 1 ? 'joukkue' : 'joukkuetta'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenImportForPlayer(playerName)}
                      className="py-1 px-2.5 rounded-lg bg-surface border border-border-strong text-pitch hover:bg-pitch hover:text-text-inverse text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Lisää joukkue</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChild(playerName, playerProfiles)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-radar hover:bg-radar/10 cursor-pointer"
                      title={`Poista pelaaja ${playerName} ja kaikki joukkueet`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Teams List for this Child */}
                <div className="flex flex-col gap-1.5">
                  {playerProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-surface border border-border-subtle text-xs overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            title="Vaihda joukkueen väri"
                            onClick={() => setColorForId(colorForId === p.id ? null : p.id)}
                            className="h-8 w-8 shrink-0 rounded-full border-2 border-border-strong"
                            style={{ background: p.colorHex }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-text-primary truncate">{p.teamName}</div>
                            <div className="text-[10px] text-text-muted line-clamp-1">
                              {p.calendarUrl || 'Manuaaliset merkinnät'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { onEditProfile(p); }}
                            className="p-1.5 rounded-lg text-text-muted hover:text-pitch hover:bg-pitch/10 cursor-pointer"
                            title="Muokkaa joukkuetta / kategoriat"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-radar hover:bg-radar/10 cursor-pointer"
                            title="Poista joukkue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {colorForId === p.id && (
                        <div className="px-2.5 pb-2.5">
                          <TeamColorPicker
                            value={p.colorHex}
                            onChange={async (hex, label) => {
                              await db.profiles.update(p.id, { colorHex: hex, primaryColor: label });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add New Child / Player Box */}
            {isAddingPlayer ? (
              <div className="p-3.5 rounded-2xl bg-surface-elevated border border-pitch/40 flex flex-col gap-2.5">
                <label className="text-xs font-bold text-text-primary">
                  Uuden pelaajan / lapsen nimi:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="esim. Ville, Sofia, Aapo..."
                    className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-bold focus:outline-none focus:border-pitch"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewPlayer}
                    disabled={!newPlayerName.trim()}
                    className="py-2 px-3 rounded-xl bg-pitch text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer disabled:opacity-50"
                  >
                    Jatka joukkuevalintaan
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingPlayer(true)}
                className="w-full py-3 px-4 rounded-2xl bg-surface-elevated/70 border border-dashed border-border-strong hover:border-pitch text-text-secondary hover:text-text-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4 text-pitch" />
                <span>+ Lisää uusi perheenjäsen / pelaaja</span>
              </button>
            )}
          </div>

          {/* Floating Undo Snackbar */}
          {undoState && (
            <div
              role="alert"
              className="my-2 p-3 rounded-2xl bg-stoppage/20 border border-stoppage/40 text-text-primary text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in"
            >
              <span>{undoState.message}</span>
              <button
                type="button"
                onClick={undoState.undoAction}
                className="px-3 py-1 rounded-xl bg-stoppage text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer shadow-sm"
              >
                Kumoa
              </button>
            </div>
          )}

          {/* Footer: Family Sharing & Wizard */}
          <div className="pt-3 border-t border-border-subtle shrink-0 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFamilyShare();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-elevated border border-border-strong hover:border-pitch text-text-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-pitch" />
              <span>Liity perhe-koodilla / WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOnboardingWizard();
              }}
              className="text-[11px] font-semibold text-text-muted hover:text-pitch text-center cursor-pointer py-1"
            >
              Avaa ohjattu aloitusvelho uudelleen →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
