import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';
import { isShopPubliclyEnabled } from '@/lib/shopAccess';

/** Short TTL so an admin kill-switch flip reaches the gate within seconds. */
const CACHE_TTL_MS = 5_000;

let cache: { value: boolean; expiresAt: number } | null = null;

/**
 * Whether commerce routes are open to the general public.
 *
 * Two independent switches, deliberately asymmetric:
 *   - `NEXT_PUBLIC_SHOP_ENABLED` (deploy-time) is the only thing that can *open*
 *     the shop, so no data change can end the soft launch by accident.
 *   - Admin → Settings → Online Shop can *close* it again without a redeploy.
 *
 * If the API is unreachable while the shop is live we keep it open: a transient
 * upstream blip should not take down checkout.
 */
export async function isShopPublic(): Promise<boolean> {
  if (!isShopPubliclyEnabled()) return false;

  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  let value = true;
  try {
    const res = await fetch(`${getDirectApiBaseUrl()}/config/shop-enabled`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { enabled?: boolean };
      value = data?.enabled !== false;
    }
  } catch {
    // Keep the shop open — see note above.
  }

  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}
