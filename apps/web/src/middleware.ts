import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to handle subdomain-based routing for seller storefronts.
 *
 * When a request arrives at `{store-slug}.houseofspells.com`, it rewrites
 * the URL internally to `/sellers/{store-slug}` so the storefront page
 * handles it.  The user still sees the subdomain URL in their browser.
 *
 * Static assets, API routes, and the main domain are left untouched.
 */

// Root domains that should NOT be treated as seller subdomains
const ROOT_DOMAINS = [
  'houseofspells.com',
  'www.houseofspells.com',
  'localhost',
  '127.0.0.1',
];

// Prefixes that should never be rewritten (static files, API, Next internals)
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
  '/track-order',
  '/help',
  '/privacy-policy',
  '/terms',
  '/fandoms',
  '/collections',
  '/gift-cards',
  '/downloads',
  '/shipping',
  '/leaderboard',
  '/quests',
  '/access-denied',
  '/customer',
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
];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Skip static and internal paths
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Skip if no hostname or it's a root domain
  if (!hostname) {
    return NextResponse.next();
  }

  // Extract potential subdomain
  // Handle patterns like: store-name.houseofspells.com
  // Also handle: store-name.localhost:3000 for local dev
  let subdomain: string | null = null;

  // Strip port for comparison
  const hostWithoutPort = hostname.split(':')[0];

  // Check if this is a subdomain of a known root domain
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

  // Also handle localhost subdomains for development (e.g., store-name.localhost:3000)
  if (!subdomain && hostWithoutPort.endsWith('.localhost')) {
    subdomain = hostWithoutPort.replace('.localhost', '');
  }

  // If we found a subdomain, rewrite to the seller storefront
  if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
    // Rewrite root to seller storefront
    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = `/sellers/${subdomain}`;
      return NextResponse.rewrite(url);
    }

    // For other paths on the subdomain, let them pass through
    // (they might be product pages, etc.)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
