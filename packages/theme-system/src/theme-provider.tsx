'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import type { Theme } from '@hos-marketplace/shared-types';
import { hosTheme, defaultThemes } from './theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setThemeById: (themeId: string) => void;
  loadTheme: (themeId: string) => Promise<Theme | null>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultThemeId?: string;
  storageKey?: string;
  loadThemeFromApi?: (themeId: string) => Promise<Theme | null>;
}

export function ThemeProvider({
  children,
  defaultThemeId = 'hos-default',
  storageKey = 'hos-theme',
  loadThemeFromApi,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultThemes[defaultThemeId] || hosTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const storedThemeId = localStorage.getItem(storageKey);
      if (storedThemeId) {
        const storedTheme = defaultThemes[storedThemeId];
        if (storedTheme) {
          setThemeState(storedTheme);
        }
      }
    } catch (error) {
      console.error('Failed to load theme from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, newTheme.id);
      } catch (error) {
        console.error('Failed to save theme to storage:', error);
      }
    }
    applyTheme(newTheme);
  };

  const setThemeById = (themeId: string) => {
    const foundTheme = defaultThemes[themeId];
    if (foundTheme) {
      setTheme(foundTheme);
    }
  };

  const loadTheme = async (themeId: string): Promise<Theme | null> => {
    // Check default themes first
    const defaultTheme = defaultThemes[themeId];
    if (defaultTheme) {
      setTheme(defaultTheme);
      return defaultTheme;
    }

    // Try to load from API if provided
    if (loadThemeFromApi) {
      try {
        const apiTheme = await loadThemeFromApi(themeId);
        if (apiTheme) {
          setTheme(apiTheme);
          return apiTheme;
        }
      } catch (error) {
        console.error('Failed to load theme from API:', error);
      }
    }

    return null;
  };

  const applyTheme = (themeToApply: Theme) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    
    // Apply CSS variables
    root.style.setProperty('--color-primary', themeToApply.colors.primary);
    root.style.setProperty('--color-secondary', themeToApply.colors.secondary);
    root.style.setProperty('--color-background', themeToApply.colors.background);
    root.style.setProperty('--color-surface', themeToApply.colors.surface);
    root.style.setProperty('--color-text-primary', themeToApply.colors.text.primary);
    root.style.setProperty('--color-text-secondary', themeToApply.colors.text.secondary);
    root.style.setProperty('--color-accent', themeToApply.colors.accent);
    root.style.setProperty('--color-error', themeToApply.colors.error);
    root.style.setProperty('--color-success', themeToApply.colors.success);
    root.style.setProperty('--color-warning', themeToApply.colors.warning);
    
    // Apply typography
    root.style.setProperty('--font-family-primary', themeToApply.typography.fontFamily.primary);
    root.style.setProperty('--font-family-secondary', themeToApply.typography.fontFamily.secondary);
  };

  // Apply theme on mount and when theme changes
  useEffect(() => {
    if (!isLoading) {
      applyTheme(theme);
    }
  }, [theme, isLoading]);

  // Keep context value simple - only recreate when theme changes
  // Functions are stable and don't need memoization
  const value: ThemeContextValue = useMemo(() => ({
    theme,
    setTheme,
    setThemeById,
    loadTheme,
  }), [theme]); // Only recreate when theme changes

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}


