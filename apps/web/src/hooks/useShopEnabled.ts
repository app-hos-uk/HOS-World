'use client';

import { useEffect, useState } from 'react';
import { isShopPubliclyEnabled } from '@/lib/shopAccess';
import {
  captureShopPreviewFromUrl,
  clearStoredShopPreview,
  getLiveShopPreview,
} from '@/lib/shopPreviewClient';

const ENV_FALLBACK = isShopPubliclyEnabled();

/**
 * Returns whether the e-commerce shop is available to this visitor.
 * True when the shop is publicly enabled, OR when the visitor has unlocked
 * a tester preview session (cookie / ?preview=<secret>).
 */
export function useShopEnabled(): boolean {
  const [enabled, setEnabled] = useState(ENV_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    captureShopPreviewFromUrl();

    const qs = getLiveShopPreview();

    // Unlock nav immediately when a tester preview token is present so links
    // get ?preview= before /api/shop-status returns.
    if (qs) setEnabled(true);

    const url = qs
      ? `/api/shop-status?preview=${encodeURIComponent(qs)}`
      : '/api/shop-status';

    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled || typeof d.enabled !== 'boolean') return;
        setEnabled(d.enabled);
        // Drop a bogus stored token when the server rejects preview access.
        if (!d.enabled && qs && !d.preview) {
          clearStoredShopPreview();
        }
      })
      .catch(() => {
        // Keep optimistic unlock when a token is present; middleware still
        // validates the secret on gated routes. Invalid tokens are cleared
        // above when shop-status returns enabled:false.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
