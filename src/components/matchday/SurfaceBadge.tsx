import React from "react";
import type { PitchSurface } from "../../types/matchday";
import { surfaceLabel } from "../../hooks/useMatchdayLogistics";

export interface SurfaceBadgeProps {
  surface?: PitchSurface;
  isIndoor?: boolean;
}

export const SurfaceBadge: React.FC<SurfaceBadgeProps> = ({ surface = "artificial_turf_3g", isIndoor = false }) => {
  const label = surfaceLabel(surface, isIndoor);

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
      <span>🌱</span>
      <span>{label}</span>
    </span>
  );
};
