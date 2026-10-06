import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Soft geo hint for the global hub only. Never redirects.
 * The US landing leaves this as a pass-through when NEXT_PUBLIC_SITE_ROLE is unset.
 */
export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_SITE_ROLE !== 'hub') {
    return NextResponse.next();
  }
  const country = request.headers.get('cf-ipcountry');
  const response = NextResponse.next();
  if (country && /^[A-Za-z]{2}$/.test(country) && !request.cookies.get('hos_geo_country')) {
    response.cookies.set('hos_geo_country', country.toUpperCase(), {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
