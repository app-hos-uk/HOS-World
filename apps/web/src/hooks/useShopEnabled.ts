'use client';

import { useEffect, useState } from 'react';

const ENV_FALLBACK = process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';

/**
 * Returns whether the e-commerce shop is enabled.
 * Fetches the live value from `/api/shop-status` and falls back
 * to the build-time env var while loading or on error.
 */
export function useShopEnabled(): boolean {
  const [enabled, setEnabled] = useState(ENV_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shop-status')
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
