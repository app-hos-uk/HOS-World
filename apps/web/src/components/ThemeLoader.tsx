'use client';

import { useEffect } from 'react';
import { useTheme } from '@hos-marketplace/theme-system';

export function ThemeLoader() {
  const theme = useTheme();

  useEffect(() => {
    // Skip malformed themes (e.g. API themes with tokens nested under config)
    if (!theme?.colors?.primary || !theme.colors.text?.primary) return;

    const root = document.documentElement;

    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-text-primary', theme.colors.text.primary);
    root.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-error', theme.colors.error);
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-warning', theme.colors.warning);

    /* Dark luxury storefront tokens */
    root.style.setProperty('--color-bg-primary', theme.colors.background);
    root.style.setProperty('--color-bg-secondary', '#1A1A1A');
    root.style.setProperty('--color-bg-tertiary', '#141414');
    root.style.setProperty('--color-border', '#2A2A2A');
    root.style.setProperty('--color-border-accent', '#3A3A3A');
    root.style.setProperty('--color-text-muted', '#666666');
    root.style.setProperty('--color-accent-gold', theme.colors.accent);
    root.style.setProperty('--color-accent-gold-hover', theme.colors.secondary);
    root.style.setProperty('--color-sale-red', theme.colors.error);
    root.style.setProperty('--color-new-green', theme.colors.success);
    
    root.style.setProperty('--font-family-primary', theme.typography?.fontFamily?.primary ?? '');
    root.style.setProperty('--font-family-secondary', theme.typography?.fontFamily?.secondary ?? '');
  }, [theme]);

  return null;
}


