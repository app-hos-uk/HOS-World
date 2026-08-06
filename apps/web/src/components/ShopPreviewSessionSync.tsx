'use client';

import { useEffect } from 'react';
import { captureShopPreviewFromUrl } from '@/lib/shopPreviewClient';

/**
 * Ensures preview sessionStorage is cleared on revoke redirects
 * (`?preview_cleared=1` / `?preview=off`), including pages that do not
 * mount `useShopEnabled` (e.g. /coming-soon).
 */
export default function ShopPreviewSessionSync() {
  useEffect(() => {
    captureShopPreviewFromUrl();
  }, []);
  return null;
}
