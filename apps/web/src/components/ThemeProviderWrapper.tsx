'use client';

import { ThemeProvider } from '@hos-marketplace/theme-system';
import { ThemeLoader } from './ThemeLoader';

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultThemeId="hos-default">
      <ThemeLoader />
      {children}
    </ThemeProvider>
  );
}

