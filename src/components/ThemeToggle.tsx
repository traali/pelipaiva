import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={springTactile.snappy}
      onClick={() => setIsDark(!isDark)}
      aria-label={isDark ? 'Vaihda päivätilaan' : 'Vaihda yötilaan'}
      title={isDark ? 'Päivä' : 'Yö'}
      className="touch-target inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-elevated px-2.5 text-text-primary"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="hidden text-xs font-semibold sm:inline">{isDark ? 'Yö' : 'Päivä'}</span>
    </motion.button>
  );
};
