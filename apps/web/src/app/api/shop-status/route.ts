import { NextRequest, NextResponse } from 'next/server';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  getShopPreviewSecret,
  isShopPubliclyEnabled,
  SHOP_PREVIEW_COOKIE,
} from '@/lib/shopAccess';

/**
 * Lightweight proxy for GET /config/shop-enabled on the NestJS API.
 * Also honors the tester preview cookie so UI nav unlocks for preview sessions.
 */
export async function GET(request: NextRequest) {
  const previewSecret = getShopPreviewSecret();
  const previewCookie = request.cookies.get(SHOP_PREVIEW_COOKIE)?.value;
  if (previewSecret && previewCookie === previewSecret) {
    return NextResponse.json(
      { enabled: true, preview: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

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

  const fallback = isShopPubliclyEnabled();
  return NextResponse.json(
    { enabled: fallback },
    { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
  );
}
