'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import type { Theme } from '@hos-marketplace/shared-types';
import { hosTheme, defaultThemes } from './theme';
import { normalizeTheme } from './normalize-theme';

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

function applyTheme(themeToApply: Theme) {
  if (typeof window === 'undefined') return;
  const safe = normalizeTheme(themeToApply) || hosTheme;
  if (!safe.colors?.primary) return;

  const root = document.documentElement;

  root.style.setProperty('--color-primary', safe.colors.primary);
  root.style.setProperty('--color-secondary', safe.colors.secondary);
  root.style.setProperty('--color-background', safe.colors.background);
  root.style.setProperty('--color-surface', safe.colors.surface);
  root.style.setProperty('--color-text-primary', safe.colors.text.primary);
  root.style.setProperty('--color-text-secondary', safe.colors.text.secondary);
  root.style.setProperty('--color-accent', safe.colors.accent);
  root.style.setProperty('--color-error', safe.colors.error);
  root.style.setProperty('--color-success', safe.colors.success);
  root.style.setProperty('--color-warning', safe.colors.warning);

  root.style.setProperty('--font-family-primary', safe.typography.fontFamily.primary);
  root.style.setProperty('--font-family-secondary', safe.typography.fontFamily.secondary);
}

export function ThemeProvider({
  children,
  defaultThemeId = 'hos-default',
  storageKey = 'hos-theme',
  loadThemeFromApi,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => normalizeTheme(defaultThemes[defaultThemeId]) || hosTheme,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const loadStoredTheme = async () => {
      try {
        const storedThemeId = localStorage.getItem(storageKey);
        if (storedThemeId) {
          const storedTheme = defaultThemes[storedThemeId];
          if (storedTheme) {
            const normalized = normalizeTheme(storedTheme);
            if (normalized) {
              setThemeState((prev) => (prev.id === normalized.id ? prev : normalized));
            }
          } else if (loadThemeFromApi) {
            const apiTheme = await loadThemeFromApi(storedThemeId);
            const normalized = normalizeTheme(apiTheme);
            if (normalized) {
              setThemeState((prev) => (prev.id === normalized.id ? prev : normalized));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load theme from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStoredTheme();
  }, [storageKey, loadThemeFromApi]);

  const setTheme = useCallback((newTheme: Theme) => {
    const normalized = normalizeTheme(newTheme);
    if (!normalized) return;

    setThemeState((prev) => (prev.id === normalized.id ? prev : normalized));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, normalized.id);
      } catch (error) {
        console.error('Failed to save theme to storage:', error);
      }
    }
    applyTheme(normalized);
  }, [storageKey]);

  const setThemeById = useCallback((themeId: string) => {
    const foundTheme = defaultThemes[themeId];
    if (foundTheme) {
      setTheme(foundTheme);
    }
  }, [setTheme]);

  const loadTheme = useCallback(async (themeId: string): Promise<Theme | null> => {
    const defaultTheme = defaultThemes[themeId];
    if (defaultTheme) {
      const normalized = normalizeTheme(defaultTheme) || hosTheme;
      setTheme(normalized);
      return normalized;
    }

    if (loadThemeFromApi) {
      try {
        const apiTheme = await loadThemeFromApi(themeId);
        const normalized = normalizeTheme(apiTheme);
        if (normalized) {
          setThemeState((prev) => (prev.id === normalized.id ? prev : normalized));
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(storageKey, normalized.id);
            } catch {
              /* ignore */
            }
          }
          applyTheme(normalized);
          return normalized;
        }
      } catch (error) {
        console.error('Failed to load theme from API:', error);
      }
    }

    return null;
  }, [loadThemeFromApi, setTheme, storageKey]);

  useEffect(() => {
    if (!isLoading) {
      applyTheme(theme);
    }
  }, [theme, isLoading]);

  const value: ThemeContextValue = useMemo(() => ({
    theme,
    setTheme,
    setThemeById,
    loadTheme,
  }), [theme, setTheme, setThemeById, loadTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
