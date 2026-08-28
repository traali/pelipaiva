import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  MessageCircle,
  Key
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { PlayerProfile } from '../types/matchday';
import { db } from '../lib/storage/db';
import { exportFamilyBackup, importFamilyBackup, generateSharePayload } from '../lib/sync/familyShare';
import { ingestSourceForProfile } from '../lib/clubs/ingestOfficial';
import {
  syncFamilyRosterCycle,
  isValidFamilyCode,
  normalizeFamilyCode
} from '../lib/sync/familyCloud';
import { generateJoinWhatsApp } from '../lib/sync/familyWhatsApp';

interface FamilyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles?: PlayerProfile[];
  onDataImported: () => void;
}

export const FamilyShareModal: React.FC<FamilyShareModalProps> = ({
  isOpen,
  onClose,
  profiles = [],
  onDataImported
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'link' | 'backup'>('link');
  const [familyCode, setFamilyCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      db.syncState.get('family').then((record) => {
        if (record && record.syncKey) {
          setFamilyCode(record.syncKey);
          setLastSynced(record.lastSyncedAt);
        }
      });
    }
  }, [isOpen]);

  const handleJoinWithCode = async () => {
    const clean = normalizeFamilyCode(inputCode);
    if (!isValidFamilyCode(clean)) {
      setStatusMessage('Virheellinen koodin muoto');
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    setIsSyncing(true);
    const res = await syncFamilyRosterCycle(clean, db);
    setIsSyncing(false);

    if (res.success) {
      setFamilyCode(clean);
      setLastSynced(new Date().toISOString());
      setStatusMessage('Liitytty perheeseen onnistuneesti!');
      onDataImported();
      setTimeout(() => setStatusMessage(null), 2500);
    } else if (res.error === 'unknown_family') {
      setStatusMessage('Koodi ei ole voimassa');
      setTimeout(() => setStatusMessage(null), 2500);
    } else {
      setStatusMessage('Perhettä ei löytynyt tai verkkovirhe');
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const handleSyncNow = async () => {
    if (!familyCode) return;
    setIsSyncing(true);
    const res = await syncFamilyRosterCycle(familyCode, db);
    setIsSyncing(false);
    if (res.success) {
      setLastSynced(new Date().toISOString());
      setStatusMessage('Synkronoitu!');
      onDataImported();
    } else {
      setStatusMessage('Synkronointivirhe');
    }
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleLeaveFamily = async () => {
    if (window.confirm('Haluatko varmasti poistua perheestä tällä laitteella?')) {
      await db.syncState.delete('family');
      setFamilyCode('');
      setLastSynced(null);
      setStatusMessage('Poistuttu perhejaosta.');
      setTimeout(() => setStatusMessage(null), 2000);
    }
  };

  const directPayload = profiles && profiles.length > 0 ? generateSharePayload(profiles) : '';
  const shareUrl =
    typeof window !== 'undefined'
      ? familyCode
        ? `${window.location.origin}/?perhe=${familyCode}`
        : directPayload
          ? `${window.location.origin}/?share=${directPayload}`
          : ''
      : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    // Await + catch: clipboard permission denial must not report success (M-08/V56).
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setStatusMessage('Kopiointi estetty — valitse linkki ja kopioi käsin.');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWhatsAppMessage = async () => {
    const msg = familyCode
      ? generateJoinWhatsApp(familyCode)
      : `Tässä on meidän perheen Pelipäivä-kalenteri:\n${shareUrl}\n\nAvaa linkki puhelimellasi niin joukkueet synkronoituvat!`;
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
    } catch {
      setStatusMessage('Kopiointi estetty — valitse viesti ja kopioi käsin.');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (familyCode) {
      const msg = generateJoinWhatsApp(familyCode);
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (shareUrl) {
      const msg = `Tässä on meidän perheen Pelipäivä-kalenteri:\n${shareUrl}\n\nAvaa linkki puhelimellasi niin joukkueet ja ottelut synkronoituvat heti!`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadBackup = async () => {
    const backupData = await exportFamilyBackup();
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pelipaiva-varmuuskopio-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await importFamilyBackup(data);

      // Spec (FAMILY_SYNC_FINAL Phase 0): file import must trigger hydration —
      // each phone fetches fixtures itself from tulospalvelu. Without this the
      // restored phone shows rosters with an empty dashboard forever (M-30/D-II).
      let hydratedCount = 0;
      for (const p of data.profiles ?? []) {
        const url = p.associationUrl || p.calendarUrl;
        if (!url) continue;
        try {
          const n = await ingestSourceForProfile({
            profileId: p.id,
            playerName: p.playerName,
            teamName: p.teamName,
            sport: p.sport,
            url
          });
          hydratedCount += n > 0 ? 1 : 0;
        } catch {
          // Per-profile failure must not abort the rest of the restore.
        }
      }

      setStatusMessage(
        `Tuotu onnistuneesti: ${res.profilesCount} joukkuetta, ${res.rulesCount} sääntöä${
          hydratedCount > 0 ? `, ottelut haettu ${hydratedCount} joukkueelle` : ''
        }!`
      );
      onDataImported();
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1500);
    } catch (err) {
      setStatusMessage('Virhe: Tiedoston lukeminen epäonnistui');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
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
            aria-labelledby="family-share-title"
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-lg rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Perhejako</h3>
                  <p className="text-xs text-text-muted">Valinnainen • ilman koodia vain tämä puhelin</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex rounded-xl bg-surface-elevated p-1 mb-5 border border-border-subtle">
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'code'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Perhe-koodi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('link')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'link'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Jakolinkki</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'backup'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tiedosto</span>
              </button>
            </div>

            {/* Tab 1: Perhe-koodi */}
            {activeTab === 'code' && (
              <div className="flex flex-col gap-4">
                {familyCode ? (
                  <div className="p-4 rounded-2xl bg-surface-elevated border border-pitch/30 flex flex-col items-center text-center gap-2">
                    <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
                      Aktiivinen perhe-koodi
                    </span>
                    <span className="text-3xl font-black tracking-widest text-pitch font-mono">
                      {familyCode}
                    </span>
                    {lastSynced && (
                      <span className="text-[11px] text-text-muted">
                        Viimeksi synkronoitu:{' '}
                        {new Date(lastSynced).toLocaleTimeString('fi-FI', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Helsinki'
                        })}
                      </span>
                    )}

                    <div className="flex items-center gap-2 mt-2 w-full">
                      <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={isSyncing}
                        className="flex-1 py-2 rounded-xl bg-surface border border-border-strong text-xs font-bold text-text-primary flex items-center justify-center gap-1.5 hover:border-pitch cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>Päivitä nyt</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareWhatsApp}
                        className="flex-1 py-2 rounded-xl bg-[#25D366] text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-105 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsAppiin</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyWhatsAppMessage}
                      className="w-full py-2 rounded-xl bg-surface-elevated border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-pitch" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Kopioitu leikepöydälle!' : 'Kopioi liittymisviesti'}</span>
                    </button>

                    <div className="flex items-center justify-end w-full pt-2 border-t border-border-subtle mt-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleLeaveFamily}
                        className="text-radar hover:brightness-110 underline cursor-pointer"
                      >
                        Poistu perheestä
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="p-4 rounded-2xl bg-surface-elevated border border-border-strong flex flex-col gap-2.5">
                      <div className="text-xs font-bold text-text-primary">Liity perhe-koodilla</div>
                      <p className="text-xs text-text-muted">
                        Syötä perheeltä tai ylläpidolta saamasi koodi:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="XXXXX-X"
                          autoComplete="off"
                          autoCapitalize="characters"
                          value={inputCode}
                          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                          className="flex-1 py-2 px-3 rounded-xl bg-surface border border-border-strong text-xs font-mono font-bold tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none focus:border-pitch"
                        />
                        <button
                          type="button"
                          onClick={handleJoinWithCode}
                          disabled={isSyncing || !inputCode.trim()}
                          className="py-2 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 cursor-pointer disabled:opacity-50"
                        >
                          Liity
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Jaa linkki */}
            {activeTab === 'link' && (
              <div className="flex flex-col gap-3 text-center">
                {shareUrl ? (
                  <>
                    <p className="text-xs text-text-secondary">
                      {familyCode
                        ? 'Avaa tämä linkki toisessa puhelimessa liittyäksesi perheeseen yhdellä napautuksella:'
                        : 'Jaa perheen joukkueet ja kalenterit toiseen puhelimeen:'}
                    </p>
                    <div className="p-3 rounded-xl bg-surface border border-border-strong font-mono text-xs text-text-primary break-all">
                      {shareUrl}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-pitch/20 hover:brightness-110 cursor-pointer"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Kopioitu leikepöydälle!' : 'Kopioi linkki'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleShareWhatsApp}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-[#25D366] text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 hover:brightness-105 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Jaa WhatsAppiin</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-xs text-text-muted">
                    Lisää ensin vähintään yksi lapsi ja joukkue, niin perheen jakolinkki syntyy automaattisesti.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Tiedosto (Airgap Backup) */}
            {activeTab === 'backup' && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-text-secondary">
                  Tallenna joukkueasetukset (roster, säännöt, kenttäpinnat) tiedostoksi. Ottelut haetaan uudelleen tulospalvelusta puhelimeen palautuksen yhteydessä — varmuuskopio ei sisällä ottelutietoja:
                </p>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-3 px-4 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-bold text-xs flex items-center justify-center gap-2 hover:border-pitch cursor-pointer"
                >
                  <Download className="w-4 h-4 text-pitch" />
                  <span>Lataa varmuuskopio (.json)</span>
                </button>

                <div className="relative">
                  <label className="w-full py-3 px-4 rounded-xl bg-surface-elevated border border-dashed border-border-strong text-text-secondary font-medium text-xs flex items-center justify-center gap-2 hover:text-text-primary hover:border-pitch cursor-pointer">
                    <Upload className="w-4 h-4 text-pitch" />
                    <span>Valitse varmuuskopiotiedosto ja palauta</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {statusMessage && (
              <div className="mt-3 p-2.5 rounded-xl bg-pitch/15 border border-pitch/30 text-pitch text-xs font-semibold text-center">
                {statusMessage}
              </div>
            )}

            {/* Honest Disclosure & Privacy Footer */}
            <div className="mt-5 pt-3 border-t border-border-subtle flex flex-col gap-1.5 text-[11px] text-text-muted">
              <div className="flex items-center gap-1.5 font-bold text-text-primary">
                <ShieldCheck className="w-3.5 h-3.5 text-pitch shrink-0" />
                <span>Yksityisyys & GDPR</span>
              </div>
              <p className="leading-relaxed">
                Etunimi ja joukkue-URL Cloudflareen 7 päivää. Ottelut haetaan tulospalvelusta tällä puhelimella. Ei käyttäjätunnusta.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
