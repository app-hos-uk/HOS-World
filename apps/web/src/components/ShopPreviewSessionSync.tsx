'use client';

import { useEffect } from 'react';
import { captureShopPreviewFromUrl, withShopPreview } from '@/lib/shopPreviewClient';

/**
 * Ensures preview sessionStorage is cleared on revoke redirects
 * (`?preview_cleared=1` / `?preview=off`), including pages that do not
 * mount `useShopEnabled` (e.g. /coming-soon).
 *
 * Also rewrites in-page shop links on click so product/fandom cards that
 * omit `?preview=` still work when the HttpOnly preview cookie is blocked.
 */
export default function ShopPreviewSessionSync() {
  useEffect(() => {
    captureShopPreviewFromUrl();

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const raw = anchor.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      const next = withShopPreview(raw);
      if (next && next !== raw) {
        anchor.setAttribute('href', next);
      }
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);
  return null;
}
