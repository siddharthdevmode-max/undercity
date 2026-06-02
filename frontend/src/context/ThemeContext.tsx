import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// ============================================================
// THEME CONTEXT
// Manages dark/light/grey themes with localStorage persistence
// ============================================================

export type Theme = 'dark' | 'light' | 'grey';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Valid themes for validation
const VALID_THEMES: Theme[] = ['dark', 'light', 'grey'];

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('undercity-theme');
  
  // Handle migration from temporary 'navy' theme
  if (saved === 'navy') {
    localStorage.setItem('undercity-theme', 'grey');
    return 'grey';
  }
  
  // Validate saved theme
  if (saved && VALID_THEMES.includes(saved as Theme)) {
    return saved as Theme;
  }
  
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('undercity-theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    if (VALID_THEMES.includes(t)) {
      setThemeState(t);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
