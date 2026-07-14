'use client';

import React, { memo, useEffect, useCallback } from 'react';
import { ThemeProvider, useThemeContext } from '@hos-marketplace/theme-system';
import { ThemeLoader } from './ThemeLoader';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

const SELLER_ROLES = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];

function SellerThemeSync() {
  const { user, isAuthenticated } = useAuth();
  const { loadTheme } = useThemeContext();

  const fetchAndApplySellerTheme = useCallback(async () => {
    try {
      const response = await apiClient.getSellerTheme();
      const data = response?.data as any;
      const theme = data?.theme;
      if (theme?.id) {
        await loadTheme(theme.id);
      }
    } catch {
      // Seller may not have a theme configured yet; keep default
    }
  }, [loadTheme]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const role = String(user.role || '').toUpperCase();
    if (SELLER_ROLES.includes(role)) {
      fetchAndApplySellerTheme();
    }
  }, [isAuthenticated, user, fetchAndApplySellerTheme]);

  return null;
}

const ThemeProviderWrapperComponent = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      defaultThemeId="hos-default"
      loadThemeFromApi={async (themeId) => {
        try {
          const res = await apiClient.getTheme(themeId);
          return res?.data ?? null;
        } catch {
          return null;
        }
      }}
    >
      <ThemeLoader />
      <SellerThemeSync />
      {children}
    </ThemeProvider>
  );
};

export const ThemeProviderWrapper = memo(ThemeProviderWrapperComponent);
