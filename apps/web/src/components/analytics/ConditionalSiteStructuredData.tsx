'use client';

import { usePathname } from 'next/navigation';
import { SiteStructuredData } from './StructuredData';

/** Marketing landing routes use their own JSON-LD instead of marketplace schema. */
const LANDING_PATHS = new Set(['/', '/universes', '/the-experience', '/founding-members']);

export function ConditionalSiteStructuredData() {
  const pathname = usePathname();
  if (LANDING_PATHS.has(pathname ?? '')) {
    return null;
  }
  return <SiteStructuredData />;
}
