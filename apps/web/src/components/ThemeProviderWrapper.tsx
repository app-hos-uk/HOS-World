'use client';

import React, { memo, useCallback } from 'react';
import { ThemeProvider, normalizeApiTheme } from '@hos-marketplace/theme-system';
import { ThemeLoader } from './ThemeLoader';
import { apiClient } from '@/lib/api';

const ThemeProviderWrapperComponent = ({ children }: { children: React.ReactNode }) => {
  const loadThemeFromApi = useCallback(async (themeId: string) => {
    try {
      const res = await apiClient.getTheme(themeId);
      return normalizeApiTheme(res?.data);
    } catch {
      return null;
    }
  }, []);

  return (
    <ThemeProvider defaultThemeId="hos-default" loadThemeFromApi={loadThemeFromApi}>
      <ThemeLoader />
      {children}
    </ThemeProvider>
  );
};

export const ThemeProviderWrapper = memo(ThemeProviderWrapperComponent);
