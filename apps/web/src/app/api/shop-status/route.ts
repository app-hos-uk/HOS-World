import { NextResponse } from 'next/server';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

/**
 * Lightweight proxy for GET /config/shop-enabled on the NestJS API.
 * Cached for 30 s so client components and middleware can poll cheaply.
 */
export async function GET() {
  try {
    const apiUrl = getDirectApiBaseUrl();
    const res = await fetch(`${apiUrl}/config/shop-enabled`, {
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
      });
    }
  } catch {
    // API unreachable — fall back to env var
  }

  const fallback = process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';
  return NextResponse.json(
    { enabled: fallback },
    { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
  );
}
