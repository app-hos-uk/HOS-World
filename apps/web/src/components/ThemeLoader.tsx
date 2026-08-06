'use client';

import { useEffect } from 'react';
import { useTheme } from '@hos-marketplace/theme-system';

/**
 * Applies brandable theme tokens without fighting the static CSS design system.
 *
 * Surface / muted / border tokens stay aligned with `globals.css` so hydration
 * does not flash a different palette or drop muted text below WCAG AA.
 * Only accent / semantic brand colors come from the active theme.
 */
export function ThemeLoader() {
  const theme = useTheme();

  useEffect(() => {
    // Skip malformed themes (e.g. API themes with tokens nested under config)
    if (!theme?.colors?.primary || !theme.colors.text?.primary) return;

    const root = document.documentElement;

    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-error', theme.colors.error);
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-warning', theme.colors.warning);

    // Keep storefront dark surfaces consistent with globals.css (no FOUC / flash)
    root.style.setProperty('--color-bg-primary', theme.colors.background || '#070708');
    root.style.setProperty('--color-background', theme.colors.background || '#070708');
    root.style.setProperty('--color-bg-secondary', '#0e0e12');
    root.style.setProperty('--color-bg-tertiary', '#14141a');
    root.style.setProperty('--color-surface', theme.colors.surface || '#14141a');
    root.style.setProperty('--color-border', 'rgba(201, 162, 39, 0.22)');
    root.style.setProperty('--color-border-accent', 'rgba(201, 162, 39, 0.42)');

    // Prefer theme text when provided, but never allow muted below AA on dark surfaces
    root.style.setProperty('--color-text-primary', theme.colors.text.primary || '#e8e4dc');
    root.style.setProperty('--color-text-secondary', theme.colors.text.secondary || '#9a958a');
    root.style.setProperty('--color-text-muted', '#9a958a');

    root.style.setProperty('--color-accent-gold', theme.colors.accent);
    root.style.setProperty('--color-accent-gold-hover', theme.colors.secondary);
    root.style.setProperty('--color-sale-red', theme.colors.error);
    root.style.setProperty('--color-new-green', theme.colors.success);
  }, [theme]);

  return null;
}
