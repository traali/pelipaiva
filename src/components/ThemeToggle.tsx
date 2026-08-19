import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
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
      whileTap={{ scale: 0.92 }}
      transition={springTactile.snappy}
      onClick={() => setIsDark(!isDark)}
      aria-label="Vaihda teemaa"
      className="relative flex items-center justify-between h-9 w-16 p-1 rounded-full bg-surface-elevated border border-border-strong cursor-pointer"
    >
      <motion.div
        layout
        transition={springTactile.snappy}
        className={`absolute h-7 w-7 rounded-full bg-pitch flex items-center justify-center text-text-inverse shadow-md ${
          isDark ? 'right-1' : 'left-1'
        }`}
      >
        {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </motion.div>
      <Sun className="w-3.5 h-3.5 ml-1.5 text-text-muted" />
      <Moon className="w-3.5 h-3.5 mr-1.5 text-text-muted" />
    </motion.button>
  );
};
