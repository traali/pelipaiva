import React from 'react';
import { motion } from 'motion/react';
import { springTactile } from '../../lib/motion/springs';

interface ToggleSliderProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  icon?: React.ReactNode;
  id?: string;
}

export const ToggleSlider: React.FC<ToggleSliderProps> = ({
  label,
  description,
  checked,
  onChange,
  icon,
  id,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-3.5 rounded-2xl bg-surface-elevated/60 border border-border-subtle transition-all hover:bg-surface-elevated/90">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <div
            className={`p-2 rounded-xl shrink-0 transition-colors ${
              checked
                ? 'bg-pitch/15 text-pitch'
                : 'bg-surface-base text-text-muted'
            }`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className="text-xs font-bold text-text-primary block cursor-pointer select-none leading-tight"
          >
            {label}
          </label>
          {description && (
            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-pitch focus-visible:outline-none ${
          checked ? 'bg-pitch' : 'bg-surface-elevated border border-border-strong'
        }`}
      >
        <span className="sr-only">{label}</span>
        <motion.span
          layout
          transition={springTactile.snappy}
          animate={{ x: checked ? 20 : 0 }}
          className="pointer-events-none block h-5.5 w-5.5 rounded-full bg-white shadow-md ring-0"
        />
      </button>
    </div>
  );
};
