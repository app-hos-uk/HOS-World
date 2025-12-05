'use client';

import React, { memo } from 'react';
import { ThemeProvider } from '@hos-marketplace/theme-system';
import { ThemeLoader } from './ThemeLoader';

const ThemeProviderWrapperComponent = ({ children }: { children: React.ReactNode }) => {
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/ThemeProviderWrapper.tsx:7',message:'ThemeProviderWrapper render',data:{pathname:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }
  // #endregion
  return (
    <ThemeProvider defaultThemeId="hos-default">
      <ThemeLoader />
      {children}
    </ThemeProvider>
  );
};

// Memoize to prevent unnecessary remounts
export const ThemeProviderWrapper = memo(ThemeProviderWrapperComponent);

