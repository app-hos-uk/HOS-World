import { NextRequest, NextResponse } from 'next/server';
import {
  getShopPreviewSecret,
  isShopGatedPath,
  isShopPubliclyEnabled,
  SHOP_PREVIEW_COOKIE,
  SHOP_PREVIEW_MAX_AGE_SEC,
  SHOP_PREVIEW_QUERY,
} from '@/lib/shopAccess';

/**
 * Middleware handles:
 * 1. Auth protection — redirects unauthenticated users from protected routes
 * 2. Shop soft-launch gate — redirects commerce routes to /coming-soon unless
 *    the shop is public or the visitor has a valid preview cookie
 * 3. Subdomain routing — rewrites seller subdomains to /sellers/{slug}
 */

// Routes that require authentication (server-side redirect to /login)
const PROTECTED_PREFIXES = [
  '/admin',
  '/seller',
  '/wholesaler',
  '/influencer',
  '/procurement',
  '/fulfillment',
  '/catalog',
  '/marketing',
  '/finance',
  '/cms',
  '/customer',
  '/profile',
  '/orders',
  '/wishlist',
  '/loyalty',
  '/quests',
  '/downloads',
  '/notifications',
  '/support/tickets',
  '/payment',
  '/gift-cards',
];

// Root domains that should NOT be treated as seller subdomains
const ROOT_DOMAINS = [
  'houseofspells.com',
  'www.houseofspells.com',
  'localhost',
  '127.0.0.1',
];

// Prefixes that skip subdomain rewrite logic
const BYPASS_PREFIXES = [
  '/_next',
  '/api',
  '/admin',
  '/login',
  '/register',
  '/auth',
  '/seller',
  '/influencer',
  '/sellers',
  '/products',
  '/cart',
  '/checkout',
  '/payment',
  '/orders',
  '/wishlist',
  '/profile',
  '/settings',
  '/returns',
  '/gift-cards',
  '/track-order',
  '/help',
  '/blog',
  '/privacy-policy',
  '/terms',
  '/fandoms',
  '/collections',
  '/downloads',
  '/shipping',
  '/refund-policy',
  '/coming-soon',
  '/leaderboard',
  '/quests',
  '/access-denied',
  '/customer',
  '/loyalty',
  '/unsubscribe',
  '/quiz',
  '/events',
  '/ref',
  '/catalog',
  '/marketing',
  '/cms',
  '/i/',
  '/fulfillment',
  '/procurement',
  '/finance',
  '/wholesaler',
  '/influencer-invite',
  '/favicon.ico',
  '/notifications',
  '/support',
  '/shop',
  '/founding-members',
  '/universes',
  '/the-experience',
];

function hasValidShopPreview(request: NextRequest, secret: string): boolean {
  if (!secret) return false;
  return request.cookies.get(SHOP_PREVIEW_COOKIE)?.value === secret;
}

function setPreviewCookie(response: NextResponse, secret: string): void {
  response.cookies.set({
    name: SHOP_PREVIEW_COOKIE,
    value: secret,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SHOP_PREVIEW_MAX_AGE_SEC,
  });
}

function clearPreviewCookie(response: NextResponse): void {
  response.cookies.set({
    name: SHOP_PREVIEW_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const previewSecret = getShopPreviewSecret();
  const previewParam = request.nextUrl.searchParams.get(SHOP_PREVIEW_QUERY);

  // --- Shop preview unlock / revoke ---
  // Testers: /shop?preview=<SHOP_PREVIEW_SECRET>
  // Revoke:  /coming-soon?preview=off  (or any path with preview=off)
  if (previewParam === 'off') {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(SHOP_PREVIEW_QUERY);
    const res = NextResponse.redirect(clean);
    clearPreviewCookie(res);
    return res;
  }

  if (previewSecret && previewParam && previewParam === previewSecret) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(SHOP_PREVIEW_QUERY);
    // Default unlock landing is /shop when opened from a non-shop URL
    if (!isShopGatedPath(clean.pathname) && clean.pathname !== '/shop') {
      clean.pathname = '/shop';
    }
    const res = NextResponse.redirect(clean);
    setPreviewCookie(res, previewSecret);
    return res;
  }

  // --- Auth Protection ---
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    const isLoggedIn = request.cookies.get('is_logged_in')?.value === 'true';
    const hasAuthToken = !!request.cookies.get('access_token')?.value ||
      !!request.cookies.get('refresh_token')?.value;
    const isAuthenticated = hasAuthToken || isLoggedIn;

    if (!isAuthenticated) {
      // Soft-launch: unauthenticated hits on gated commerce routes go to
      // coming-soon instead of login when the shop is not public.
      if (
        !isShopPubliclyEnabled() &&
        isShopGatedPath(pathname) &&
        !hasValidShopPreview(request, previewSecret)
      ) {
        const comingSoon = request.nextUrl.clone();
        comingSoon.pathname = '/coming-soon';
        comingSoon.search = '';
        return NextResponse.redirect(comingSoon);
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('returnUrl', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Soft-launch shop gate ---
  // Public visitors cannot open commerce routes until the shop is enabled.
  // Testers with a valid preview cookie (set via ?preview=SECRET) can browse.
  if (
    !isShopPubliclyEnabled() &&
    isShopGatedPath(pathname) &&
    !hasValidShopPreview(request, previewSecret)
  ) {
    const comingSoon = request.nextUrl.clone();
    comingSoon.pathname = '/coming-soon';
    comingSoon.search = '';
    return NextResponse.redirect(comingSoon);
  }

  // --- Subdomain Routing ---
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!hostname) {
    return NextResponse.next();
  }

  let subdomain: string | null = null;
  const hostWithoutPort = hostname.split(':')[0];

  for (const root of ROOT_DOMAINS) {
    const rootWithoutPort = root.split(':')[0];
    if (
      hostWithoutPort !== rootWithoutPort &&
      hostWithoutPort.endsWith(`.${rootWithoutPort}`)
    ) {
      subdomain = hostWithoutPort.replace(`.${rootWithoutPort}`, '');
      break;
    }
  }

  if (!subdomain && hostWithoutPort.endsWith('.localhost')) {
    subdomain = hostWithoutPort.replace('.localhost', '');
  }

  if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = `/sellers/${subdomain}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|landing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
