import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Upload, Copy, Check, Share2, ShieldCheck, Smartphone } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { PlayerProfile } from '../types/matchday';
import { exportFamilyBackup, importFamilyBackup, generateSharePayload } from '../lib/sync/familyShare';

interface FamilyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: PlayerProfile[];
  onDataImported: () => void;
}

export const FamilyShareModal: React.FC<FamilyShareModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onDataImported
}) => {
  const [activeTab, setActiveTab] = useState<'share' | 'backup'>('share');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const sharePayload = generateSharePayload(profiles);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?share=${sharePayload}` : '';
  // Generates a lightweight Google Chart QR code image URL for zero-dependency rendering
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      setImportStatus(`Tuotu onnistuneesti: ${res.profilesCount} joukkuetta, ${res.rulesCount} sääntöä!`);
      onDataImported();
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1500);
    } catch (err) {
      setImportStatus('Virhe: Tiedoston lukeminen epäonnistui');
    }
  };

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
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-md rounded-3xl p-6 shadow-2xl z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Perhejako & Varmuuskopio</h3>
                  <p className="text-xs text-text-muted">100 % Yksityinen • Ei käyttäjätilejä</p>
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
                onClick={() => setActiveTab('share')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'share'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Jaa toiseen puhelimeen</span>
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
                <span>Varmuuskopio (JSON)</span>
              </button>
            </div>

            {activeTab === 'share' ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-xs text-text-secondary">
                  Skannaa QR-koodi toisella puhelimella (tai kopioi jakolinkki) siirtääksesi kaikki omat joukkueesi toiselle vanhemmalle:
                </p>

                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-2xl shadow-md border border-border-subtle inline-block">
                  <img
                    src={qrCodeUrl}
                    alt="Perhejaon QR-koodi"
                    className="w-44 h-44 rounded-lg"
                    loading="lazy"
                  />
                </div>

                <div className="w-full flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-pitch/20 hover:brightness-110 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Kopioitu leikepöydälle!' : 'Kopioi jakolinkki'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-text-secondary">
                  Tallenna kaikki joukkueesi, sääntösi ja kenttäpinnauksesi tiedostoksi uuden puhelimen käyttöönottoa tai selaimen tyhjennystä varten:
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

                {importStatus && (
                  <div className="p-2.5 rounded-xl bg-pitch/15 border border-pitch/30 text-pitch text-xs font-semibold text-center">
                    {importStatus}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-border-subtle flex items-center gap-2 text-[11px] text-text-muted justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-pitch shrink-0" />
              <span>Tiedot siirtyvät suoraan laitteelta toiselle ilman välikäsiä.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
