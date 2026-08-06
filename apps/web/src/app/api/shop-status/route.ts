import { NextRequest, NextResponse } from 'next/server';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  getShopPreviewSecret,
  hasShopPreviewAccess,
  isShopPubliclyEnabled,
  SHOP_PREVIEW_COOKIE,
  SHOP_PREVIEW_QUERY,
} from '@/lib/shopAccess';

/**
 * Lightweight proxy for GET /config/shop-enabled on the NestJS API.
 * Also honors the tester preview cookie / ?preview= so UI nav unlocks for
 * preview sessions. Always private — must not be CDN-cached across visitors.
 */
export async function GET(request: NextRequest) {
  const previewSecret = getShopPreviewSecret();
  const previewCookie = request.cookies.get(SHOP_PREVIEW_COOKIE)?.value;
  const previewParam = request.nextUrl.searchParams.get(SHOP_PREVIEW_QUERY);

  if (hasShopPreviewAccess(previewCookie, previewParam, previewSecret)) {
    return NextResponse.json(
      { enabled: true, preview: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const apiUrl = getDirectApiBaseUrl();
    const res = await fetch(`${apiUrl}/config/shop-enabled`, {
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
  } catch {
    // API unreachable — fall back to env var
  }

  const fallback = isShopPubliclyEnabled();
  return NextResponse.json(
    { enabled: fallback },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
