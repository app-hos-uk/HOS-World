import { NextRequest, NextResponse } from 'next/server';
import {
  getShopPreviewSecret,
  hasShopPreviewAccess,
  isShopGatedPath,
  isShopPubliclyEnabled,
  SHOP_PREVIEW_COOKIE,
  SHOP_PREVIEW_MAX_AGE_SEC,
  SHOP_PREVIEW_QUERY,
} from '@/lib/shopAccess';
import { isShopPublic } from '@/lib/shopGate';
import {
  isValidLoyaltyReferralCode,
  LOYALTY_REF_COOKIE,
  LOYALTY_REF_COOKIE_MAX_AGE,
} from '@/lib/referralAttribution';

/**
 * Middleware handles:
 * 1. Auth protection — redirects unauthenticated users from protected routes
 * 2. Shop soft-launch gate — redirects commerce routes to /coming-soon unless
 *    the shop is public or the visitor has a valid preview cookie / ?preview=
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
  const previewCookie = request.cookies.get(SHOP_PREVIEW_COOKIE)?.value;
  const hasPreview = hasShopPreviewAccess(previewCookie, previewParam, previewSecret);

  // --- Shop preview unlock / revoke ---
  // Testers: /shop?preview=<SHOP_PREVIEW_SECRET>
  // Revoke:  /coming-soon?preview=off  (or any path with preview=off)
  if (previewParam === 'off') {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(SHOP_PREVIEW_QUERY);
    // Signal the client to drop sessionStorage preview so SPA links stop re-unlocking.
    clean.searchParams.set('preview_cleared', '1');
    if (isShopGatedPath(clean.pathname)) {
      clean.pathname = '/coming-soon';
    }
    const res = NextResponse.redirect(clean);
    clearPreviewCookie(res);
    return res;
  }

  // Valid ?preview= on a non-shop URL → send testers to /shop (keep query).
  // On shop/gated URLs, fall through so auth + gate still run; cookie is attached below.
  if (
    previewSecret &&
    previewParam &&
    previewParam === previewSecret &&
    !isShopGatedPath(pathname) &&
    pathname !== '/shop'
  ) {
    const shopUrl = request.nextUrl.clone();
    shopUrl.pathname = '/shop';
    const res = NextResponse.redirect(shopUrl);
    setPreviewCookie(res, previewSecret);
    return res;
  }

  // --- Auth Protection ---
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const needsShopGate = isShopGatedPath(pathname);
  // Only consult the admin kill switch for commerce routes (keeps other middleware
  // matches free of upstream latency). Testers come through ?preview=/cookie.
  const shopPublic = needsShopGate ? await isShopPublic() : isShopPubliclyEnabled();

  if (isProtected) {
    const isLoggedIn = request.cookies.get('is_logged_in')?.value === 'true';
    const hasAuthToken = !!request.cookies.get('access_token')?.value ||
      !!request.cookies.get('refresh_token')?.value;
    const isAuthenticated = hasAuthToken || isLoggedIn;

    if (!isAuthenticated) {
      // Soft-launch: unauthenticated hits on gated commerce routes go to
      // coming-soon instead of login when the shop is not public.
      if (!shopPublic && needsShopGate && !hasPreview) {
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
  // Testers with a valid preview cookie OR ?preview=SECRET can browse.
  if (needsShopGate && !shopPublic && !hasPreview) {
    const comingSoon = request.nextUrl.clone();
    comingSoon.pathname = '/coming-soon';
    comingSoon.search = '';
    return NextResponse.redirect(comingSoon);
  }

  // Attach preview cookie whenever the secret matches (query or existing cookie
  // refresh) so subsequent navigations without ?preview= keep working.
  const attachPreviewCookie =
    !!previewSecret &&
    hasPreview &&
    previewCookie !== previewSecret;

  const withPreviewCookie = (res: NextResponse): NextResponse => {
    if (attachPreviewCookie && previewSecret) setPreviewCookie(res, previewSecret);
    return res;
  };

  // --- Loyalty referral attribution (/ref/HOS-…) ---
  // Cookie must be set here (or in a Route Handler), never in a Server Component render.
  const loyaltyRefMatch = pathname.match(/^\/ref\/([^/]+)\/?$/);
  if (loyaltyRefMatch) {
    const code = decodeURIComponent(loyaltyRefMatch[1] || '').trim();
    const res = withPreviewCookie(NextResponse.next());
    if (code && isValidLoyaltyReferralCode(code)) {
      res.cookies.set({
        name: LOYALTY_REF_COOKIE,
        value: code,
        path: '/',
        maxAge: LOYALTY_REF_COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return res;
  }

  // --- Subdomain Routing ---
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withPreviewCookie(NextResponse.next());
  }

  if (!hostname) {
    return withPreviewCookie(NextResponse.next());
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
      return withPreviewCookie(NextResponse.rewrite(url));
    }
    return withPreviewCookie(NextResponse.next());
  }

  return withPreviewCookie(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|landing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
