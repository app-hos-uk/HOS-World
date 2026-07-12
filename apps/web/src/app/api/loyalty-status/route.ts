import { NextResponse } from 'next/server';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

export async function GET() {
  try {
    const apiUrl = getDirectApiBaseUrl();
    const res = await fetch(`${apiUrl}/config/loyalty-enabled`, {
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

  const fallback = process.env.NEXT_PUBLIC_LOYALTY_ENABLED !== 'false';
  return NextResponse.json(
    { enabled: fallback },
    { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
  );
}
