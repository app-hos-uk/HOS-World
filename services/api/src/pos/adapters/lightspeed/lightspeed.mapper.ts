import type { POSSale, POSSaleItem, POSOutlet, POSProductPayload, POSCustomerPayload } from '../../interfaces/pos-types';

/** Lightspeed / Vend API response shapes (partial). */
export function mapOutletFromVend(row: {
  id?: string;
  name?: string;
  physical_address_1?: string;
  city?: string;
  country_id?: string;
  time_zone?: string;
  deleted_at?: string | null;
}): POSOutlet {
  return {
    externalId: String(row.id || ''),
    name: String(row.name || 'Outlet'),
    address: row.physical_address_1,
    city: row.city,
    country: row.country_id,
    timezone: row.time_zone,
    isActive: !row.deleted_at,
  };
}

export function mapProductToVendPayload(p: POSProductPayload): Record<string, unknown> {
  return {
    name: p.name,
    sku: p.sku,
    description: p.description ?? '',
    supply_price: p.costPrice ?? 0,
    retail_price: p.retailPrice,
    image_url: p.imageUrl,
    product_type: p.categoryName || (p.tags?.[0] ?? undefined),
  };
}

/**
 * Sparse Lightspeed customer body — omit absent fields so PUT never blanks
 * merchant-entered first/last/phone/mobile on an existing POS customer.
 */
export function mapCustomerToVend(c: POSCustomerPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    customer_code: c.internalId,
  };
  if (c.email) body.email = c.email;
  if (c.firstName) body.first_name = c.firstName;
  if (c.lastName) body.last_name = c.lastName;
  if (c.phone) {
    body.phone = c.phone;
    body.mobile = c.phone;
  }
  if (c.loyaltyCardNumber) body.custom_field_1 = c.loyaltyCardNumber;
  return body;
}

/** First defined numeric candidate; only falls back to 0 when none are present. */
function firstNumber(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const n = Number(c);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function mapLineItem(li: Record<string, unknown>): POSSaleItem {
  const rawQty = Number(li.quantity ?? 1);
  // Prisma POSSaleItem.quantity is Int — round fractional (weighed) qty; preserve sign for returns.
  const quantity =
    Number.isFinite(rawQty) && rawQty !== 0 ? Math.trunc(rawQty) || (rawQty < 0 ? -1 : 1) : 1;
  const absQty = Math.abs(quantity);
  const hasPriceTotal = li.price_total !== undefined && li.price_total !== null && li.price_total !== '';
  const hasPrice = li.price !== undefined && li.price !== null && li.price !== '';

  let unitPrice: number;
  let totalPrice: number;
  if (hasPriceTotal) {
    totalPrice = Number(li.price_total);
    unitPrice = absQty > 0 ? totalPrice / absQty : totalPrice;
  } else if (hasPrice) {
    unitPrice = Number(li.price);
    // Preserve signed quantity for returns (negative qty × unit price).
    totalPrice = unitPrice * quantity;
  } else {
    unitPrice = 0;
    totalPrice = 0;
  }

  return {
    externalProductId: String(li.product_id ?? li.id ?? ''),
    sku: li.sku ? String(li.sku) : undefined,
    name: String(li.name ?? li.sku ?? 'Item'),
    quantity,
    unitPrice,
    totalPrice,
    taxAmount: firstNumber(li.tax_total, li.tax),
  };
}

function resolveLineItems(payload: Record<string, unknown>): Record<string, unknown>[] {
  const registerProducts = payload.register_sale_products;
  if (Array.isArray(registerProducts) && registerProducts.length > 0) {
    return registerProducts as Record<string, unknown>[];
  }
  const lineItems = payload.line_items;
  if (Array.isArray(lineItems)) {
    return lineItems as Record<string, unknown>[];
  }
  return [];
}

export function mapSaleFromVend(payload: Record<string, unknown>, outletId: string): POSSale {
  const items: POSSaleItem[] = resolveLineItems(payload).map(mapLineItem);

  const totals =
    payload.totals && typeof payload.totals === 'object'
      ? (payload.totals as Record<string, unknown>)
      : undefined;

  const customer = payload.customer as Record<string, unknown> | undefined;
  const custEmail = customer?.email ? String(customer.email) : undefined;
  const custPhone = customer?.phone
    ? String(customer.phone)
    : customer?.mobile
      ? String(customer.mobile)
      : undefined;
  const custId = customer?.id ? String(customer.id) : undefined;

  const saleDateRaw = payload.sale_date ?? payload.created_at;
  const state = payload.state
    ? String(payload.state).toLowerCase()
    : payload.status
      ? String(payload.status).toLowerCase()
      : undefined;
  const versionRaw = Number(payload.version);
  const version = Number.isFinite(versionRaw) ? versionRaw : undefined;

  return {
    externalId: String(payload.id ?? payload.sale_id ?? ''),
    invoiceNumber: payload.invoice_number ? String(payload.invoice_number) : undefined,
    saleDate: saleDateRaw ? new Date(String(saleDateRaw)) : new Date(),
    outletId: String(payload.outlet_id ?? outletId),
    customer:
      custEmail || custPhone || custId
        ? { email: custEmail, phone: custPhone, externalId: custId }
        : undefined,
    items,
    // Prefer goods value (total_price) over tendered (total_payment) for loyalty/inventory.
    totalAmount: firstNumber(
      totals?.total_price,
      totals?.total_to_pay,
      payload.total_price,
      payload.total,
      totals?.total_payment,
      payload.total_payment,
    ),
    taxAmount: firstNumber(totals?.total_tax, payload.total_tax),
    discountAmount: firstNumber(totals?.total_discount, payload.total_discount),
    currency: String(payload.currency ?? 'GBP'),
    state,
    version,
    rawPayload: payload,
  };
}

/** Closed / completed sales only — parked, onaccount, voided must not earn or decrement stock. */
export function isClosedSale(sale: Pick<POSSale, 'state'>): boolean {
  const s = (sale.state || '').toLowerCase();
  if (!s) return true; // legacy payloads without state — import (poller + webhook closed path)
  return (
    s === 'closed' ||
    s === 'completed' ||
    s === 'complete' ||
    s === 'CLOSED' ||
    s === 'COMPLETED'
  );
}

export function isVoidedSale(sale: Pick<POSSale, 'state'>): boolean {
  const s = (sale.state || '').toLowerCase();
  return s === 'voided' || s === 'void' || s === 'cancelled' || s === 'canceled';
}
