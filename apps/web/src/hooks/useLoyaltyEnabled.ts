'use client';

import { useEffect, useState } from 'react';

const ENV_FALLBACK = process.env.NEXT_PUBLIC_LOYALTY_ENABLED !== 'false';

/**
 * Returns whether the loyalty programme is enabled.
 * Fetches the live value from `/api/loyalty-status` and falls back
 * to the build-time env var while loading or on error.
 */
export function useLoyaltyEnabled(): boolean {
  const [enabled, setEnabled] = useState(ENV_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/loyalty-status')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled && typeof d.enabled === 'boolean') setEnabled(d.enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
