'use client';

import React, { memo, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, useThemeContext, normalizeApiTheme } from '@hos-marketplace/theme-system';
import { ThemeLoader } from './ThemeLoader';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

const SELLER_ROLES = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];

function SellerThemeSync() {
  const { user, isAuthenticated } = useAuth();
  const { loadTheme } = useThemeContext();
  const appliedThemeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const role = String(user.role || '').toUpperCase();
    if (!SELLER_ROLES.includes(role)) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.getSellerTheme();
        const data = response?.data as { theme?: { id?: string } } | undefined;
        const themeId = data?.theme?.id;
        if (!themeId || cancelled) return;
        if (appliedThemeIdRef.current === themeId) return;
        const applied = await loadTheme(themeId);
        // Only mark as applied on success so transient failures can retry
        if (applied && !cancelled) {
          appliedThemeIdRef.current = themeId;
        }
      } catch {
        // Seller may not have a theme configured yet; keep default
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, loadTheme]);

  return null;
}

const ThemeProviderWrapperComponent = ({ children }: { children: React.ReactNode }) => {
  const loadThemeFromApi = useCallback(async (themeId: string) => {
    try {
      const res = await apiClient.getTheme(themeId);
      // API themes nest tokens under `config`; map them to the client Theme shape
      return normalizeApiTheme(res?.data);
    } catch {
      return null;
    }
  }, []);

  return (
    <ThemeProvider defaultThemeId="hos-default" loadThemeFromApi={loadThemeFromApi}>
      <ThemeLoader />
      <SellerThemeSync />
      {children}
    </ThemeProvider>
  );
};

export const ThemeProviderWrapper = memo(ThemeProviderWrapperComponent);
