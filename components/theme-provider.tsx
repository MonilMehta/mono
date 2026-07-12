'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCardShadow } from '@/lib/theme';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  cardShadow: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
  cardShadow: '',
});

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    applyTheme(prefersDark);
    setHasMounted(true);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark: hasMounted && isDark, toggleTheme, cardShadow: getCardShadow(hasMounted && isDark) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
