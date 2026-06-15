import { NextRequest, NextResponse } from 'next/server';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

/**
 * Middleware handles:
 * 1. Shop feature gate — reads the shopEnabled flag from the backend API
 *    (cached in-memory for 30 s, env-var fallback). When disabled, all
 *    e-commerce routes redirect to /coming-soon. Admin routes are excluded.
 * 2. Auth protection — redirects unauthenticated users from protected routes
 * 3. Subdomain routing — rewrites seller subdomains to /sellers/{slug}
 */

// ---------------------------------------------------------------------------
// Dynamic shop-enabled check with in-memory cache
// ---------------------------------------------------------------------------
const ENV_SHOP_ENABLED = process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';
const CACHE_TTL_MS = 30_000; // 30 seconds

let cachedShopEnabled: boolean = ENV_SHOP_ENABLED;
let cacheTimestamp = 0;

async function fetchShopEnabled(): Promise<boolean> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS) return cachedShopEnabled;

  try {
    const res = await fetch(`${getDirectApiBaseUrl()}/config/shop-enabled`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      cachedShopEnabled = data.enabled === true;
    }
  } catch {
    // API unreachable — keep previous cached value
  }
  cacheTimestamp = now;
  return cachedShopEnabled;
}

const SHOP_ROUTE_PREFIXES = [
  '/shop',
  '/products',
  '/cart',
  '/checkout',
  '/sellers',
  '/fandoms',
  '/collections',
  '/wishlist',
  '/orders',
  '/track-order',
  '/gift-cards',
  '/returns',
  '/refund-policy',
];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // --- Shop Feature Gate ---
  const shopEnabled = await fetchShopEnabled();
  if (!shopEnabled) {
    const isShopRoute = SHOP_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
    if (isShopRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      return NextResponse.redirect(url);
    }
  }

  // --- Auth Protection ---
  // Check is_logged_in cookie set by the frontend after successful auth.
  // In cross-origin deployments (API on railway.app, frontend on vercel.app),
  // the HttpOnly access_token cookie is bound to the API domain and invisible
  // to the Next.js middleware. The is_logged_in cookie is set on the frontend
  // domain by client JS after a successful login/register response.
  // Real auth validation happens API-side on every request via the JWT.
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    const isLoggedIn = request.cookies.get('is_logged_in')?.value === 'true';

    if (!isLoggedIn) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Subdomain Routing ---
  // Skip subdomain logic for paths handled by app routes
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
