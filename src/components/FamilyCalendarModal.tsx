import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  X,
  Copy,
  Check,
  Download,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Car,
  BookOpen
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { MatchdayEvent, PlayerProfile } from '../types/matchday';
import { generateIcsCalendarFeed } from '../lib/calendar/calendarFeedGenerator';
import { db } from '../lib/storage/db';
import { WORKER_BASE_URL } from '../lib/sync/familyCloud';

interface FamilyCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
  familyCode?: string;
}

export const FamilyCalendarModal: React.FC<FamilyCalendarModalProps> = ({
  isOpen,
  onClose,
  events,
  profiles,
  familyCode: propFamilyCode
}) => {
  const [familyCode, setFamilyCode] = useState<string>(propFamilyCode || 'PERHE-1');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (propFamilyCode) {
      setFamilyCode(propFamilyCode);
    } else {
      // Try to read active family sync key from db
      db.syncState.get('family').then((sync) => {
        if (sync && sync.syncKey) {
          setFamilyCode(sync.syncKey);
        }
      }).catch(console.warn);
    }
  }, [propFamilyCode, isOpen]);

  if (!isOpen) return null;

  const calendarHost = WORKER_BASE_URL.replace(/^https:\/\//, '');
  const webcalFeedUrl = `webcal://${calendarHost}/api/calendar?perhe=${encodeURIComponent(familyCode)}`;
  const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalFeedUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(webcalFeedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadIcs = () => {
    const icsString = generateIcsCalendarFeed(events, profiles, {
      familyCode,
      calendarTitle: `FamDay (${familyCode})`
    });
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `famday-${familyCode.toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-canvas/80 backdrop-blur-md"
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-modal-title"
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          transition={springTactile.gentle}
          className="liquid-glass relative w-full max-w-lg rounded-3xl p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-pitch/15 text-pitch">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 id="calendar-modal-title" className="text-base font-bold text-text-primary">
                  Tilaa elävä perhekalenteri
                </h2>
                <p className="text-xs text-text-muted">
                  Päivittyy automaattisesti iPhonessa & Google Kalenterissa
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Benefits Feature Cards */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="p-2.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col items-center text-center">
              <RefreshCw className="w-4 h-4 text-pitch mb-1" />
              <span className="text-[11px] font-bold text-text-primary">Aina ajan tasalla</span>
              <span className="text-[10px] text-text-muted">Päivittyy taustalla</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col items-center text-center">
              <Car className="w-4 h-4 text-pitch mb-1" />
              <span className="text-[11px] font-bold text-text-primary">Kyydit & Ajat</span>
              <span className="text-[10px] text-text-muted">Kuskijaot kalenterissa</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle flex flex-col items-center text-center">
              <BookOpen className="w-4 h-4 text-pitch mb-1" />
              <span className="text-[11px] font-bold text-text-primary">Wilma & Kokeet</span>
              <span className="text-[10px] text-text-muted">Koulun kokeet mukana</span>
            </div>
          </div>

          {/* 1-Click Action Buttons */}
          <div className="flex flex-col gap-2.5 mb-5">
            {/* Apple Calendar 1-Click */}
            <a
              href={webcalFeedUrl}
              className="w-full py-3 px-4 rounded-2xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-between hover:brightness-110 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4" />
                <div className="text-left">
                  <div>Tilaa Apple Kalenteriin (iPhone / Mac)</div>
                  <div className="text-[10px] font-normal opacity-90">Avaa ja tilaa suoraan yhdellä klikkauksella</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>

            {/* Google Calendar 1-Click */}
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary font-bold text-xs flex items-center justify-between hover:bg-surface-base hover:border-pitch/40 shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-pitch" />
                <div className="text-left">
                  <div>Tilaa Google Kalenteriin (Android / Web)</div>
                  <div className="text-[10px] font-normal text-text-muted">Lisää automaattitilauksena Google-tilillesi</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 shrink-0 text-text-muted" />
            </a>
          </div>

          {/* Copy URL Section */}
          <div className="p-3.5 rounded-2xl bg-surface-base border border-border-subtle mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-text-secondary">
                Suora tilauslinkki (Outlook & muut sovellukset):
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[11px] font-bold text-pitch hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-pitch" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Kopioitu!' : 'Kopioi'}</span>
              </button>
            </div>
            <div className="p-2 rounded-xl bg-surface-elevated border border-border-subtle font-mono text-[11px] text-text-primary break-all select-all">
              {webcalFeedUrl}
            </div>
          </div>

          {/* Offline Download Option */}
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <div className="text-xs text-text-muted">
              Haluatko kertaviennin ilman jatkuvaa tilausta?
            </div>
            <button
              type="button"
              onClick={handleDownloadIcs}
              className="py-1.5 px-3 rounded-xl bg-surface-elevated border border-border-subtle hover:text-text-primary text-xs font-semibold text-text-secondary flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Lataa .ics</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
