import React from 'react';
import { FootwearRecommendation } from '../types/matchday';
import { ShieldCheck } from 'lucide-react';

interface NappisvahtiProps {
  footwear: FootwearRecommendation;
  reason: string;
}

const FOOTWEAR_LABELS: Record<
  FootwearRecommendation,
  { title: string; badge: string; color: string }
> = {
  AG_ARTIFICIAL_GRASS: {
    title: 'AG-Nappikset',
    badge: 'Tekonurmi',
    color: 'text-pitch border-pitch/30 bg-pitch/10'
  },
  FG_FIRM_GROUND: {
    title: 'FG-Nappikset',
    badge: 'Luonnonnurmi',
    color: 'text-pitch border-pitch/30 bg-pitch/10'
  },
  SG_SOFT_GROUND: {
    title: 'SG-Rautatapit',
    badge: 'Märkä nurmi',
    color: 'text-radar border-radar/30 bg-radar/10'
  },
  TF_TURF_SHOES: {
    title: 'TF Turf-kengät',
    badge: 'Kylmä/Hiekka',
    color: 'text-whistle border-whistle/30 bg-whistle/10'
  },
  INDOOR_NON_MARKING: {
    title: 'Sisäpelikengät',
    badge: 'Salipohja',
    color: 'text-text-primary border-border-strong bg-surface-elevated'
  }
};

export const NappisvahtiPill: React.FC<NappisvahtiProps> = ({ footwear, reason }) => {
  const config = FOOTWEAR_LABELS[footwear] || FOOTWEAR_LABELS.AG_ARTIFICIAL_GRASS;

  return (
    <div className="flex flex-col justify-between p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <ShieldCheck className="w-4 h-4 text-pitch" />
          <span>Nappisvahti</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.color}`}>
          {config.badge}
        </span>
      </div>
      <div className="text-sm font-bold text-text-primary">{config.title}</div>
      <p className="text-[11px] text-text-secondary mt-1 leading-tight line-clamp-2">{reason}</p>
    </div>
  );
};
