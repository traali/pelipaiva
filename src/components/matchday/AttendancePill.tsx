import React from "react";
import { motion } from "motion/react";
import { springTactile } from "../../lib/motion/springs";

export interface AttendancePillProps {
  status: "in" | "out";
  compact?: boolean;
  onToggle: (newStatus: "in" | "out") => void;
}

export const AttendancePill: React.FC<AttendancePillProps> = ({
  status,
  compact: _compact = false,
  onToggle,
}) => {
  const isIn = status === "in";

  return (
    <div className="inline-flex items-center rounded-xl bg-surface-elevated p-0.5 border border-border-subtle shadow-sm">
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        transition={springTactile}
        onClick={() => onToggle("in")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
          isIn
            ? "bg-pitch text-text-inverse shadow-xs"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        In
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        transition={springTactile}
        onClick={() => onToggle("out")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
          !isIn
            ? "bg-semantic-red text-text-inverse shadow-xs"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        Out
      </motion.button>
    </div>
  );
};
