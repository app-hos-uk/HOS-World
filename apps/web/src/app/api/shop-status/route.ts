import { NextRequest, NextResponse } from 'next/server';
import {
  getShopPreviewSecret,
  hasShopPreviewAccess,
  SHOP_PREVIEW_COOKIE,
  SHOP_PREVIEW_QUERY,
} from '@/lib/shopAccess';
import { isShopPublic } from '@/lib/shopGate';

/**
 * Whether this visitor may use the storefront.
 *
 * Must mirror the middleware gate exactly — if this said "enabled" while
 * middleware disagreed, nav would render shop links that bounce to
 * /coming-soon. Testers pass via preview cookie / ?preview=.
 *
 * Always private — must not be CDN-cached across visitors.
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

  return NextResponse.json(
    { enabled: await isShopPublic() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
