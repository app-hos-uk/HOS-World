import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware handles:
 * 1. Auth protection — redirects unauthenticated users from protected routes
 * 2. Subdomain routing — rewrites seller subdomains to /sellers/{slug}
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
  '/privacy-policy',
  '/terms',
  '/fandoms',
  '/collections',
  '/downloads',
  '/shipping',
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // --- Auth Protection ---
  // Require HttpOnly access_token cookie (not forgeable is_logged_in indicator)
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    const hasToken = !!request.cookies.get('access_token')?.value;

    if (!hasToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
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
