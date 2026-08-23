import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, Trash2 } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';

interface DemoBannerProps {
  onOpenImport: () => void;
  onClearDemo: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onOpenImport, onClearDemo }) => {
  return (
    <div className="mb-4 p-3 md:p-3.5 rounded-2xl bg-whistle/15 border border-whistle/30 text-whistle flex flex-col sm:flex-row items-center justify-between gap-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
        <Sparkles className="w-4 h-4 text-whistle shrink-0" />
        <span>
          <strong>Kokeilutila:</strong> PPJ, TOPOLA ja Indians — ei sinun perheesi otteluita.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={springTactile.snappy}
          onClick={onOpenImport}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold shadow-sm shadow-pitch/20 hover:brightness-110 cursor-pointer"
        >
          <span>Tuo oma joukkue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={springTactile.snappy}
          onClick={onClearDemo}
          title="Tyhjennä esimerkkidata ja aloita alusta"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-elevated border border-border-subtle hover:border-stoppage/50 text-text-muted hover:text-stoppage text-xs font-semibold cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Poista demo</span>
        </motion.button>
      </div>
    </div>
  );
};
