import React from 'react';
import {
  CircleDot,
  Dumbbell,
  Footprints,
  Goal,
  Snowflake,
  Target,
  Trophy,
  Volleyball
} from 'lucide-react';
import type { SportType } from '../types/matchday';
import { sportIconName } from '../lib/sport/sportMeta';

interface SportGlyphProps {
  sport: SportType;
  className?: string;
}

export const SportGlyph: React.FC<SportGlyphProps> = ({ sport, className = 'w-4 h-4' }) => {
  switch (sportIconName(sport)) {
    case 'goal':
      return <Goal className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'circle-dot':
      return <CircleDot className={className} />;
    case 'volleyball':
      return <Volleyball className={className} />;
    case 'snowflake':
      return <Snowflake className={className} />;
    case 'footprints':
      return <Footprints className={className} />;
    case 'dumbbell':
      return <Dumbbell className={className} />;
    default:
      return <Trophy className={className} />;
  }
};
