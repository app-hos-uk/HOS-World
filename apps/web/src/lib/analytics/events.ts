import { hasAnalyticsConsent } from './consent';
import { gtag, isAnyGoogleTagEnabled } from './gtag';

type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_category?: string;
  item_brand?: string;
};

function canTrack(): boolean {
  return isAnyGoogleTagEnabled() && hasAnalyticsConsent();
}

function toItem(product: {
  id?: string;
  slug?: string;
  name?: string;
  price?: number;
  currency?: string;
  fandom?: string;
  vendor?: string | { name?: string };
  seller?: { name?: string };
}, quantity = 1): AnalyticsItem {
  const vendorName =
    typeof product.vendor === 'string'
      ? product.vendor
      : product.vendor?.name || product.seller?.name;

  return {
    item_id: product.id || product.slug || 'unknown',
    item_name: product.name || 'Product',
    price: product.price,
    quantity,
    item_category: product.fandom,
    item_brand: vendorName,
  };
}

export function trackViewItem(product: Parameters<typeof toItem>[0]): void {
  if (!canTrack() || !product) return;

  const item = toItem(product);
  gtag('event', 'view_item', {
    currency: product.currency || 'USD',
    value: product.price,
    items: [item],
  });
}

export function trackAddToCart(
  product: Parameters<typeof toItem>[0],
  quantity = 1,
): void {
  if (!canTrack() || !product) return;

  const item = toItem(product, quantity);
  gtag('event', 'add_to_cart', {
    currency: product.currency || 'USD',
    value: (product.price || 0) * quantity,
    items: [item],
  });
}

export function trackBeginCheckout(cart: {
  currency?: string;
  total?: number;
  subtotal?: number;
  items?: Array<{
    productId?: string;
    product?: { id?: string; name?: string; price?: number; currency?: string; fandom?: string };
    quantity?: number;
    price?: number;
  }>;
}): void {
  if (!canTrack() || !cart?.items?.length) return;

  const items = cart.items.map((line) =>
    toItem(
      {
        id: line.productId || line.product?.id,
        name: line.product?.name,
        price: line.price ?? line.product?.price,
        currency: cart.currency || line.product?.currency,
        fandom: line.product?.fandom,
      },
      line.quantity ?? 1,
    ),
  );

  gtag('event', 'begin_checkout', {
    currency: cart.currency || 'USD',
    value: cart.total ?? cart.subtotal ?? 0,
    items,
  });
}

const PURCHASE_DEDUPE_PREFIX = 'analytics_purchase_';

export function trackPurchase(order: {
  id: string;
  currency?: string;
  total?: number;
  items?: Array<{
    productId?: string;
    product?: { id?: string; name?: string; price?: number; fandom?: string };
    quantity?: number;
    price?: number;
  }>;
}): void {
  if (!canTrack() || !order?.id) return;

  const dedupeKey = `${PURCHASE_DEDUPE_PREFIX}${order.id}`;
  if (typeof window !== 'undefined' && sessionStorage.getItem(dedupeKey)) return;
  if (typeof window !== 'undefined') sessionStorage.setItem(dedupeKey, '1');

  const items =
    order.items?.map((line) =>
      toItem(
        {
          id: line.productId || line.product?.id,
          name: line.product?.name,
          price: line.price ?? line.product?.price,
          fandom: line.product?.fandom,
        },
        line.quantity ?? 1,
      ),
    ) ?? [];

  gtag('event', 'purchase', {
    transaction_id: order.id,
    currency: order.currency || 'USD',
    value: order.total ?? 0,
    items,
  });
}
