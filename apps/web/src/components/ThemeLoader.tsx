'use client';

import { useEffect } from 'react';
import { useTheme, normalizeTheme, hosTheme } from '@hos-marketplace/theme-system';

export function ThemeLoader() {
  const theme = useTheme();

  useEffect(() => {
    const safe = normalizeTheme(theme) || hosTheme;
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

    /* Dark luxury storefront tokens */
    root.style.setProperty('--color-bg-primary', safe.colors.background);
    root.style.setProperty('--color-bg-secondary', '#1A1A1A');
    root.style.setProperty('--color-bg-tertiary', '#141414');
    root.style.setProperty('--color-border', '#2A2A2A');
    root.style.setProperty('--color-border-accent', '#3A3A3A');
    root.style.setProperty('--color-text-muted', '#666666');
    root.style.setProperty('--color-accent-gold', safe.colors.accent);
    root.style.setProperty('--color-accent-gold-hover', safe.colors.secondary);
    root.style.setProperty('--color-sale-red', safe.colors.error);
    root.style.setProperty('--color-new-green', safe.colors.success);

    root.style.setProperty('--font-family-primary', safe.typography.fontFamily.primary);
    root.style.setProperty('--font-family-secondary', safe.typography.fontFamily.secondary);
  }, [theme]);

  return null;
}
