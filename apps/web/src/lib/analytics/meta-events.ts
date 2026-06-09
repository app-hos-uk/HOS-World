import { hasMarketingConsent } from './consent';
import { getFbq, isMetaPixelEnabled } from './meta-pixel';

export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

export interface MetaCustomData {
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  contentCategory?: string;
  contentType?: string;
  numItems?: number;
  orderId?: string;
}

function canTrack(): boolean {
  return isMetaPixelEnabled() && hasMarketingConsent();
}

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

async function sendToConversionsApi(payload: {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data?: MetaUserData;
  custom_data?: MetaCustomData;
}): Promise<void> {
  try {
    await fetch('/api/meta/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        event_time: Math.floor(Date.now() / 1000),
      }),
      keepalive: true,
    });
  } catch {
    // Non-blocking — browser pixel is primary
  }
}

function trackMetaEvent(
  eventName: string,
  customData?: MetaCustomData,
  userData?: MetaUserData,
): void {
  if (!canTrack()) return;

  const eventId = generateEventId();
  const fbq = getFbq();

  if (fbq) {
    fbq('track', eventName, customData ?? {}, { eventID: eventId });
  }

  void sendToConversionsApi({
    event_name: eventName,
    event_id: eventId,
    event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_data: userData,
    custom_data: customData,
  });
}

export function trackMetaPageView(url?: string): void {
  if (!canTrack()) return;

  const eventId = generateEventId();
  const fbq = getFbq();

  if (fbq) {
    fbq('track', 'PageView', {}, { eventID: eventId });
  }

  void sendToConversionsApi({
    event_name: 'PageView',
    event_id: eventId,
    event_source_url: url || (typeof window !== 'undefined' ? window.location.href : undefined),
  });
}

export function trackMetaLead(userData?: MetaUserData): void {
  trackMetaEvent('Lead', undefined, userData);
}

export function trackMetaContact(userData?: MetaUserData): void {
  trackMetaEvent('Contact', undefined, userData);
}

export function trackMetaViewContent(product: {
  id?: string;
  slug?: string;
  name?: string;
  price?: number;
  currency?: string;
  fandom?: string;
}): void {
  if (!product) return;

  trackMetaEvent('ViewContent', {
    contentIds: [product.id || product.slug || 'unknown'],
    contentName: product.name,
    contentCategory: product.fandom,
    contentType: 'product',
    value: product.price,
    currency: product.currency || 'USD',
  });
}

export function trackMetaAddToCart(
  product: {
    id?: string;
    slug?: string;
    name?: string;
    price?: number;
    currency?: string;
    fandom?: string;
  },
  quantity = 1,
): void {
  if (!product) return;

  trackMetaEvent('AddToCart', {
    contentIds: [product.id || product.slug || 'unknown'],
    contentName: product.name,
    contentCategory: product.fandom,
    contentType: 'product',
    value: (product.price || 0) * quantity,
    currency: product.currency || 'USD',
    numItems: quantity,
  });
}

export function trackMetaInitiateCheckout(cart: {
  currency?: string;
  total?: number;
  subtotal?: number;
  items?: Array<{ productId?: string; quantity?: number }>;
}): void {
  if (!cart?.items?.length) return;

  trackMetaEvent('InitiateCheckout', {
    value: cart.total ?? cart.subtotal ?? 0,
    currency: cart.currency || 'USD',
    numItems: cart.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
    contentIds: cart.items.map((item) => item.productId || 'unknown'),
  });
}

const META_PURCHASE_DEDUPE_PREFIX = 'meta_purchase_';

export function trackMetaPurchase(
  order: {
    id: string;
    currency?: string;
    total?: number;
    items?: Array<{ productId?: string; quantity?: number }>;
  },
  userData?: MetaUserData,
): void {
  if (!order?.id) return;

  const dedupeKey = `${META_PURCHASE_DEDUPE_PREFIX}${order.id}`;
  if (typeof window !== 'undefined' && sessionStorage.getItem(dedupeKey)) return;
  if (typeof window !== 'undefined') sessionStorage.setItem(dedupeKey, '1');

  trackMetaEvent(
    'Purchase',
    {
      orderId: order.id,
      value: order.total ?? 0,
      currency: order.currency || 'USD',
      numItems: order.items?.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
      contentIds: order.items?.map((item) => item.productId || 'unknown'),
    },
    userData,
  );
}
