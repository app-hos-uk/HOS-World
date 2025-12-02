'use client';

import { useEffect } from 'react';
import { useTheme } from '@hos-marketplace/theme-system';

export function ThemeLoader() {
  const theme = useTheme();

  useEffect(() => {
    // Apply theme CSS variables to document root
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
    
    root.style.setProperty('--font-family-primary', theme.typography.fontFamily.primary);
    root.style.setProperty('--font-family-secondary', theme.typography.fontFamily.secondary);
  }, [theme]);

  return null;
}


