/**
 * Client-only helpers for soft-launch tester preview.
 *
 * The preview secret is already in the shared tester URL. We persist it in
 * sessionStorage so Next.js client navigations (which drop the query string)
 * still append ?preview= when cookies are blocked.
 */

import { isShopNavHref, SHOP_PREVIEW_QUERY } from '@/lib/shopAccess';

const STORAGE_KEY = 'hos_shop_preview_q';

export function clearStoredShopPreview(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Sync URL → sessionStorage (or clear on revoke). Safe to call from effects
 * and from link helpers before first paint of client nav.
 */
export function captureShopPreviewFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(SHOP_PREVIEW_QUERY) === 'off' || params.get('preview_cleared') === '1') {
      clearStoredShopPreview();
      return;
    }
    const param = params.get(SHOP_PREVIEW_QUERY);
    if (param && param.trim()) {
      sessionStorage.setItem(STORAGE_KEY, param.trim());
    }
  } catch {
    /* private mode / blocked storage */
  }
}

export function getStoredShopPreview(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Live preview token: URL wins (covers first render before capture), then
 * sessionStorage. Revoke flags clear storage and return null.
 */
export function getLiveShopPreview(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(SHOP_PREVIEW_QUERY) === 'off' || params.get('preview_cleared') === '1') {
      clearStoredShopPreview();
      return null;
    }
    const fromUrl = params.get(SHOP_PREVIEW_QUERY)?.trim();
    if (fromUrl) {
      try {
        sessionStorage.setItem(STORAGE_KEY, fromUrl);
      } catch {
        /* ignore */
      }
      return fromUrl;
    }
  } catch {
    /* ignore */
  }
  return getStoredShopPreview();
}

/** Append ?preview= to shop / checkout hrefs when a tester token is present. */
export function withShopPreview(href: string): string {
  if (!href) return href;
  const preview = getLiveShopPreview();
  if (!preview) return href;
  // Allow checkout/payment/order-confirmation too (gated but not always in nav prefixes).
  const path = href.split('?')[0].split('#')[0];
  const gated =
    isShopNavHref(href) ||
    path === '/checkout' ||
    path.startsWith('/checkout/') ||
    path === '/payment' ||
    path.startsWith('/payment/') ||
    path === '/order-confirmation' ||
    path.startsWith('/order-confirmation/');
  if (!gated) return href;
  try {
    const url = new URL(href, window.location.origin);
    if (!url.searchParams.get(SHOP_PREVIEW_QUERY)) {
      url.searchParams.set(SHOP_PREVIEW_QUERY, preview);
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
