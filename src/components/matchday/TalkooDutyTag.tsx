import React from "react";
import { Sparkles } from "lucide-react";

export interface TalkooDutyTagProps {
  duty?: string;
}

export const TalkooDutyTag: React.FC<TalkooDutyTagProps> = ({ duty }) => {
  if (!duty) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
      <Sparkles className="w-3 h-3" />
      <span>{duty}</span>
    </span>
  );
};
