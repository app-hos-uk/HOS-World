'use client';

import { useEffect, useState } from 'react';
import { isShopPubliclyEnabled } from '@/lib/shopAccess';

const ENV_FALLBACK = isShopPubliclyEnabled();

/**
 * Returns whether the e-commerce shop is available to this visitor.
 * True when the shop is publicly enabled, OR when the visitor has unlocked
 * a tester preview session (cookie set via /shop?preview=<secret>).
 */
export function useShopEnabled(): boolean {
  const [enabled, setEnabled] = useState(ENV_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shop-status', { cache: 'no-store' })
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
