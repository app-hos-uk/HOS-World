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

export function mapCustomerToVend(c: POSCustomerPayload): Record<string, unknown> {
  return {
    email: c.email,
    first_name: c.firstName ?? '',
    last_name: c.lastName ?? '',
    phone: c.phone ?? '',
    custom_field_1: c.loyaltyCardNumber ?? '',
    customer_code: c.internalId,
  };
}

export function mapSaleFromVend(payload: Record<string, unknown>, outletId: string): POSSale {
  const lineItems = (payload.line_items as Record<string, unknown>[]) || [];
  const items: POSSaleItem[] = lineItems.map((li) => ({
    externalProductId: String(li.product_id ?? li.id ?? ''),
    sku: li.sku ? String(li.sku) : undefined,
    name: String(li.name ?? li.sku ?? 'Item'),
    quantity: Number(li.quantity ?? 1),
    unitPrice: Number(li.price_total ?? li.price ?? 0) / Math.max(1, Number(li.quantity ?? 1)),
    totalPrice: Number(li.price_total ?? li.price ?? 0),
    taxAmount: Number(li.tax_total ?? 0),
  }));

  const customer = payload.customer as Record<string, unknown> | undefined;
  const custEmail = customer?.email ? String(customer.email) : undefined;
  const custPhone = customer?.phone ? String(customer.phone) : undefined;
  const custId = customer?.id ? String(customer.id) : undefined;

  return {
    externalId: String(payload.id ?? payload.sale_id ?? ''),
    invoiceNumber: payload.invoice_number ? String(payload.invoice_number) : undefined,
    saleDate: payload.created_at
      ? new Date(String(payload.created_at))
      : payload.sale_date
        ? new Date(String(payload.sale_date))
        : new Date(),
    outletId: String(payload.outlet_id ?? outletId),
    customer:
      custEmail || custPhone || custId
        ? { email: custEmail, phone: custPhone, externalId: custId }
        : undefined,
    items,
    totalAmount: Number(payload.total_payment ?? payload.total ?? 0),
    taxAmount: Number(payload.total_tax ?? 0),
    discountAmount: Number(payload.total_discount ?? 0),
    currency: String(payload.currency ?? 'GBP'),
    rawPayload: payload,
  };
}
