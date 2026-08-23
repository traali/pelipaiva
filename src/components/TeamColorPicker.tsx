import React from 'react';
import { TEAM_COLOR_SWATCHES } from '../lib/sport/teamColors';

interface TeamColorPickerProps {
  value: string;
  onChange: (hex: string, label: string) => void;
}

export const TeamColorPicker: React.FC<TeamColorPickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Joukkueen väri">
      {TEAM_COLOR_SWATCHES.map((swatch) => {
        const selected = swatch.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={swatch.hex}
            type="button"
            role="option"
            aria-selected={selected}
            title={swatch.fi}
            onClick={() => onChange(swatch.hex, swatch.label)}
            className={`h-11 w-11 shrink-0 rounded-full border-2 ${
              selected ? 'border-floodlight ring-2 ring-floodlight/40' : 'border-border-strong'
            }`}
            style={{ background: swatch.hex }}
          >
            <span className="sr-only">{swatch.fi}</span>
          </button>
        );
      })}
    </div>
  );
};
