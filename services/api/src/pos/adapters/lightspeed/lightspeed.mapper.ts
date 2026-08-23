import type {
  POSSale,
  POSSaleItem,
  POSOutlet,
  POSProductPayload,
  POSCustomerPayload,
} from '../../interfaces/pos-types';
import { PLATFORM_DEFAULT_CURRENCY } from '../../../common/currency-defaults';

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNonEmptyString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return undefined;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * API 2.0 line items nest product/pricing/tax (`product.id`, `pricing.price`).
 * API 0.9 / webhooks flatten them (`product_id`, `sku`, `price`, `price_total`).
 * Never fall back to the line-item `id` — that is not a product id.
 */
function mapLineItem(li: Record<string, unknown>): POSSaleItem {
  const product = asRecord(li.product);
  const pricing = asRecord(li.pricing);
  const taxObj = asRecord(li.tax);

  const rawQty = Number(li.quantity ?? 1);
  // Prisma POSSaleItem.quantity is Int — round fractional (weighed) qty; preserve sign for returns.
  const quantity =
    Number.isFinite(rawQty) && rawQty !== 0 ? Math.trunc(rawQty) || (rawQty < 0 ? -1 : 1) : 1;
  const absQty = Math.abs(quantity);

  const totalCandidate = isPresent(li.price_total)
    ? li.price_total
    : isPresent(pricing?.total)
      ? pricing?.total
      : isPresent(pricing?.price_total)
        ? pricing?.price_total
        : undefined;
  const unitCandidate = isPresent(li.price)
    ? li.price
    : isPresent(pricing?.price)
      ? pricing?.price
      : undefined;

  let unitPrice: number;
  let totalPrice: number;
  if (totalCandidate !== undefined) {
    totalPrice = Number(totalCandidate);
    unitPrice = absQty > 0 ? totalPrice / absQty : totalPrice;
  } else if (unitCandidate !== undefined) {
    unitPrice = Number(unitCandidate);
    // Preserve signed quantity for returns (negative qty × unit price).
    totalPrice = unitPrice * quantity;
  } else {
    unitPrice = 0;
    totalPrice = 0;
  }

  const externalProductId = firstNonEmptyString(li.product_id, product?.id) ?? '';
  const sku = firstNonEmptyString(li.sku, product?.sku);
  const name =
    firstNonEmptyString(li.name, product?.name, sku, li.gift_card_number ? 'Gift card' : undefined) ??
    'Item';

  return {
    externalProductId,
    sku: sku ?? (externalProductId ? `ls:${externalProductId}` : undefined),
    name,
    quantity,
    unitPrice,
    totalPrice,
    taxAmount: firstNumber(
      li.tax_total,
      taxObj?.total,
      taxObj?.amount,
      typeof li.tax === 'object' ? undefined : li.tax,
    ),
  };
}

/** True when the staff-entered invoice/receipt matches this Lightspeed sale row. */
export function saleMatchesInvoice(payload: Record<string, unknown>, invoiceNumber: string): boolean {
  const target = invoiceNumber.trim().toLowerCase();
  if (!target) return false;
  const candidates = [payload.invoice_number, payload.receipt_number, payload.id, payload.sale_id];
  return candidates.some((c) => c != null && String(c).trim().toLowerCase() === target);
}

function resolveSaleCustomer(payload: Record<string, unknown>): POSSale['customer'] {
  const nested = asRecord(payload.customer);
  const contact = asRecord(nested?.contact) ?? asRecord(payload.contact);
  const email = firstNonEmptyString(
    nested ? emailFromVendCustomer(nested) : undefined,
    contact?.email,
    payload.customer_email,
  );
  const phone = firstNonEmptyString(
    nested?.phone,
    nested?.mobile,
    contact?.phone,
    contact?.mobile,
  );
  const externalId = firstNonEmptyString(
    nested?.id,
    payload.customer_id,
    typeof payload.customer === 'string' ? payload.customer : undefined,
  );
  if (!email && !phone && !externalId) return undefined;
  return { email, phone, externalId };
}

/** Lightspeed customer rows use several email keys depending on API version. */
export function emailFromVendCustomer(row: Record<string, unknown>): string | undefined {
  const contact = asRecord(row.contact);
  const emails = row.emails;
  const listed = Array.isArray(emails)
    ? firstNonEmptyString(
        ...emails.map((entry) =>
          typeof entry === 'string' ? entry : asRecord(entry)?.email,
        ),
      )
    : undefined;
  return firstNonEmptyString(
    row.email,
    row.email_address,
    row.customer_email,
    contact?.email,
    listed,
  );
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

export function mapSaleFromVend(
  payload: Record<string, unknown>,
  outletId: string,
  /** Region/platform currency when Lightspeed omits `currency` on the sale. */
  defaultCurrency = PLATFORM_DEFAULT_CURRENCY,
): POSSale {
  const items: POSSaleItem[] = resolveLineItems(payload).map(mapLineItem);

  const totals =
    payload.totals && typeof payload.totals === 'object'
      ? (payload.totals as Record<string, unknown>)
      : undefined;

  const customer = resolveSaleCustomer(payload);

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
    invoiceNumber: payload.invoice_number
      ? String(payload.invoice_number)
      : payload.receipt_number
        ? String(payload.receipt_number)
        : undefined,
    saleDate: saleDateRaw ? new Date(String(saleDateRaw)) : new Date(),
    outletId: String(payload.outlet_id ?? outletId),
    customer,
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
    currency: String(payload.currency ?? defaultCurrency),
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
    s === 'closed' || s === 'completed' || s === 'complete' || s === 'CLOSED' || s === 'COMPLETED'
  );
}

export function isVoidedSale(sale: Pick<POSSale, 'state'>): boolean {
  const s = (sale.state || '').toLowerCase();
  return s === 'voided' || s === 'void' || s === 'cancelled' || s === 'canceled';
}
