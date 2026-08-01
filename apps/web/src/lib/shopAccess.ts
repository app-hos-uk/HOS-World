/**
 * Soft-launch shop access control.
 *
 * When the shop is not publicly enabled (`NEXT_PUBLIC_SHOP_ENABLED` / admin
 * shopEnabled), commerce routes redirect to `/coming-soon` unless the visitor
 * has unlocked a preview session.
 *
 * Testers unlock by visiting:
 *   /shop?preview=<SHOP_PREVIEW_SECRET>
 * which sets an HttpOnly cookie used by middleware + /api/shop-status.
 */

export const SHOP_PREVIEW_COOKIE = 'hos_shop_preview';
export const SHOP_PREVIEW_QUERY = 'preview';

/** Cookie lifetime for tester preview sessions (7 days). */
export const SHOP_PREVIEW_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * Storefront paths locked behind coming-soon when the shop is not public.
 * Admin / staff dashboards are intentionally excluded.
 */
export const SHOP_GATED_PREFIXES = [
  '/shop',
  '/products',
  '/fandoms',
  '/cart',
  '/checkout',
  '/collections',
  '/sellers',
  '/gift-cards',
  '/wishlist',
  '/payment',
  '/order-confirmation',
] as const;

/** Link href prefixes treated as "shopping" in header/footer nav. */
export const SHOP_NAV_HREF_PREFIXES = [
  '/shop',
  '/products',
  '/fandoms',
  '/cart',
  '/checkout',
  '/collections',
  '/sellers',
  '/gift-cards',
  '/wishlist',
] as const;

export function isShopPubliclyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';
}

export function getShopPreviewSecret(): string {
  return (process.env.SHOP_PREVIEW_SECRET || '').trim();
}

export function isShopGatedPath(pathname: string): boolean {
  return SHOP_GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isShopNavHref(href: string): boolean {
  if (!href || href.startsWith('http://') || href.startsWith('https://')) return false;
  const path = href.split('?')[0].split('#')[0];
  return SHOP_NAV_HREF_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Rewrite a nav href to coming-soon when the shop is locked for the visitor. */
export function resolveShopNavHref(href: string, shopEnabled: boolean): string {
  if (shopEnabled || !isShopNavHref(href)) return href;
  return '/coming-soon';
}
