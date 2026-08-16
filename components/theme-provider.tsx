'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCardShadow } from '@/lib/theme';

const THEME_KEY = 'mono-theme';

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
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const dark = savedTheme === 'dark';
    setIsDark(dark);
    applyTheme(dark);
    setHasMounted(true);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      window.localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
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
