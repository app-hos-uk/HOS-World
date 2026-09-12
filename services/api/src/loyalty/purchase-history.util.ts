/** Unified customer purchase history (online orders + in-store POS sales). */

export type PurchaseHistoryLine = {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  product?: { id?: string; name: string; images: Array<{ url: string }> };
};

export type PurchaseHistoryItem = {
  id: string;
  type: 'online' | 'in-store';
  date: string;
  storeName?: string | null;
  orderNumber?: string | null;
  items: PurchaseHistoryLine[];
  total: number;
  currency: string;
  pointsEarned: number;
  status: string;
  paidWithLoyaltyVoucher?: boolean;
};

export type LoyaltyVoucherHint = {
  cardNumber: string;
  storeId: string;
  issuedAt: Date | null;
  createdAt: Date;
  metadata?: unknown;
};

/** Voucher issued up to 4 hours before the sale (plus 15 min clock skew). */
const VOUCHER_WINDOW_MS = 4 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 15 * 60 * 1000;

const CARD_NUMBER_KEYS = new Set([
  'gift_card_number',
  'giftcardnumber',
  'card_number',
  'cardnumber',
  'voucher_number',
  'vouchernumber',
  'loyaltycardnumber',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function toMoneyNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeCardNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toLowerCase();
}

/** Walk Lightspeed payment / metadata trees for gift-card / voucher numbers. */
export function extractPaymentCardNumbers(rawPayload: unknown): string[] {
  const found = new Set<string>();

  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    for (const [key, val] of Object.entries(rec)) {
      const compact = key.replace(/[-_]/g, '').toLowerCase();
      if (CARD_NUMBER_KEYS.has(key.toLowerCase()) || CARD_NUMBER_KEYS.has(compact)) {
        if (val != null && String(val).trim()) found.add(String(val).trim());
      }
      if (typeof val === 'object') visit(val, depth + 1);
    }
  };

  visit(rawPayload, 0);
  return [...found];
}

function paymentBuckets(rawPayload: unknown): unknown[] {
  const raw = asRecord(rawPayload);
  if (!raw) return [];
  return [raw.payments, raw.register_sale_payments, raw.tenders].filter((b) => Array.isArray(b));
}

export function hasPaymentLines(rawPayload: unknown): boolean {
  return paymentBuckets(rawPayload).some((b) => Array.isArray(b) && b.length > 0);
}

export function payloadLooksLikeGiftCardTender(rawPayload: unknown): boolean {
  for (const bucket of paymentBuckets(rawPayload)) {
    if (!Array.isArray(bucket)) continue;
    for (const payment of bucket) {
      const rec = asRecord(payment);
      if (!rec) continue;
      const name = String(
        rec.name ?? rec.payment_type_name ?? rec.type ?? rec.payment_type ?? '',
      ).toLowerCase();
      if (
        name.includes('gift') ||
        name.includes('voucher') ||
        name.includes('loyalty') ||
        name.includes('enchanted')
      ) {
        return true;
      }
    }
  }
  return false;
}

function metadataLinksVoucher(rawPayload: unknown): boolean {
  const raw = asRecord(rawPayload);
  if (!raw) return false;
  const meta = asRecord(raw.metadata) ?? asRecord(raw.meta);
  if (!meta) return false;
  return Boolean(
    meta.loyaltyVoucherId ||
      meta.loyalty_voucher_id ||
      meta.posVoucherId ||
      meta.pos_voucher_id ||
      meta.voucherId ||
      meta.voucher_id,
  );
}

/**
 * Best-effort flag: sale was tendered with a loyalty POS gift-card voucher.
 * Prefers an exact card-number match; falls back to same-store timing.
 */
export function salePaidWithLoyaltyVoucher(
  sale: {
    storeId: string;
    saleDate: Date;
    loyaltyPointsRedeemed?: number | null;
    rawPayload?: unknown;
  },
  vouchers: LoyaltyVoucherHint[],
): boolean {
  if ((sale.loyaltyPointsRedeemed ?? 0) > 0) return true;
  if (metadataLinksVoucher(sale.rawPayload)) return true;

  const paymentCards = new Set(
    extractPaymentCardNumbers(sale.rawPayload).map(normalizeCardNumber),
  );
  for (const voucher of vouchers) {
    if (paymentCards.has(normalizeCardNumber(voucher.cardNumber))) return true;
  }

  const saleTime = sale.saleDate.getTime();
  if (!Number.isFinite(saleTime)) return false;

  const giftTender = payloadLooksLikeGiftCardTender(sale.rawPayload);
  const paymentsMissing = !hasPaymentLines(sale.rawPayload);

  for (const voucher of vouchers) {
    if (voucher.storeId !== sale.storeId) continue;
    const issued = (voucher.issuedAt ?? voucher.createdAt).getTime();
    if (!Number.isFinite(issued)) continue;
    const delta = saleTime - issued;
    if (delta < -CLOCK_SKEW_MS || delta > VOUCHER_WINDOW_MS) continue;
    // Exact tender match is preferred; if Lightspeed omitted payments, use timing.
    if (giftTender || paymentsMissing) return true;
  }

  return false;
}

const CANCELLED_STATUSES = new Set(['CANCELLED', 'CANCELED', 'REFUNDED', 'REJECTED', 'VOIDED', 'VOID']);

export function customerFacingPosStatus(status: string, rawPayload?: unknown): string {
  const s = (status || '').toUpperCase();
  if (CANCELLED_STATUSES.has(s)) return 'CANCELLED';
  const raw = asRecord(rawPayload);
  const state = String(raw?.state ?? raw?.status ?? '').toLowerCase();
  if (['voided', 'void', 'cancelled', 'canceled'].includes(state)) return 'CANCELLED';
  return 'COMPLETED';
}

export function countsTowardSpend(item: Pick<PurchaseHistoryItem, 'type' | 'status'>): boolean {
  const s = (item.status || '').toUpperCase();
  if (CANCELLED_STATUSES.has(s)) return false;
  if (item.type === 'in-store') return true;
  return ['DELIVERED', 'COMPLETED', 'PAID'].includes(s);
}

export function mapOnlineOrder(order: {
  id: string;
  orderNumber: string;
  createdAt: Date;
  total: unknown;
  currency: string;
  status: string;
  loyaltyPointsEarned?: number | null;
  loyaltyPointsRedeemed?: number | null;
  items: Array<{
    id?: string;
    quantity: number;
    price: unknown;
    product?: { name: string } | null;
  }>;
}): PurchaseHistoryItem {
  return {
    id: order.id,
    type: 'online',
    date: order.createdAt.toISOString(),
    orderNumber: order.orderNumber,
    items: order.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      name: item.product?.name || 'Item',
      quantity: item.quantity,
      price: toMoneyNumber(item.price),
    })),
    total: toMoneyNumber(order.total),
    currency: order.currency || 'USD',
    pointsEarned: order.loyaltyPointsEarned ?? 0,
    status: order.status,
    paidWithLoyaltyVoucher: (order.loyaltyPointsRedeemed ?? 0) > 0,
  };
}

export function mapPosSale(
  sale: {
    id: string;
    saleDate: Date;
    totalAmount: unknown;
    currency: string;
    status: string;
    loyaltyPointsEarned?: number | null;
    loyaltyPointsRedeemed?: number | null;
    rawPayload?: unknown;
    storeId: string;
    externalInvoice?: string | null;
    store?: { name: string } | null;
    items: Array<{
      id?: string;
      name: string;
      quantity: number;
      unitPrice: unknown;
      product?: { id?: string; name: string; images?: Array<{ url: string }> } | null;
    }>;
  },
  vouchers: LoyaltyVoucherHint[],
): PurchaseHistoryItem {
  return {
    id: sale.id,
    type: 'in-store',
    date: sale.saleDate.toISOString(),
    storeName: sale.store?.name ?? null,
    orderNumber: sale.externalInvoice ?? null,
    items: sale.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      name: item.name || 'Item',
      quantity: item.quantity,
      price: toMoneyNumber(item.unitPrice),
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            images: item.product.images ?? [],
          }
        : undefined,
    })),
    total: toMoneyNumber(sale.totalAmount),
    currency: sale.currency || 'USD',
    pointsEarned: sale.loyaltyPointsEarned ?? 0,
    status: customerFacingPosStatus(sale.status, sale.rawPayload),
    paidWithLoyaltyVoucher: salePaidWithLoyaltyVoucher(sale, vouchers),
  };
}
