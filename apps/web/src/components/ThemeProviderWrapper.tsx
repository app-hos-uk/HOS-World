'use client';

import React, { memo } from 'react';
import { ThemeProvider } from '@hos-marketplace/theme-system';
import { ThemeLoader } from './ThemeLoader';

const ThemeProviderWrapperComponent = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider defaultThemeId="hos-default">
      <ThemeLoader />
      {children}
    </ThemeProvider>
  );
};

// Memoize to prevent unnecessary remounts
export const ThemeProviderWrapper = memo(ThemeProviderWrapperComponent);



