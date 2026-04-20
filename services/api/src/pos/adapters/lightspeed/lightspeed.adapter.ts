import * as crypto from 'crypto';
import type { POSAdapter } from '../../interfaces/pos-adapter.interface';
import type {
  LightspeedCredentials,
  POSCustomer,
  POSCustomerPayload,
  POSOutlet,
  POSProductPayload,
  POSSale,
} from '../../interfaces/pos-types';
import { LightspeedApiClient } from './lightspeed-api.client';
import { LightspeedAuthService } from './lightspeed-auth.service';
import * as M from './lightspeed.mapper';

export class LightspeedAdapter implements POSAdapter {
  readonly providerName = 'lightspeed';
  private auth: LightspeedAuthService;
  private client: LightspeedApiClient;

  constructor(initial: LightspeedCredentials) {
    this.auth = new LightspeedAuthService(initial);
    this.client = new LightspeedApiClient(
      initial,
      () => this.auth.getAccessToken(),
      (c) => this.auth.setCredentials(c),
    );
  }

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    await this.auth.authenticate(credentials as LightspeedCredentials & Record<string, unknown>);
    this.client.updateCredentials(this.auth.getCredentials());
  }

  async refreshAuth(): Promise<void> {
    await this.auth.refreshAuth();
    this.client.updateCredentials(this.auth.getCredentials());
  }

  async getOutlets(): Promise<POSOutlet[]> {
    const { data } = await this.client.request<{ data?: Record<string, unknown>[] }>(
      'GET',
      '/outlets',
    );
    const rows = data?.data ?? (data as unknown as Record<string, unknown>[]) ?? [];
    const list = Array.isArray(rows) ? rows : [];
    return list.map((r) => M.mapOutletFromVend(r as Parameters<typeof M.mapOutletFromVend>[0]));
  }

  async syncProduct(product: POSProductPayload, outletId: string): Promise<string> {
    const body = M.mapProductToVendPayload(product);
    (body as Record<string, unknown>).outlet_id = outletId;

    if (product.existingExternalId) {
      const { data: putData } = await this.client.request<{ data?: { id?: string } }>(
        'PUT',
        `/products/${product.existingExternalId}`,
        body,
      );
      const pid = putData?.data?.id ?? (putData as { id?: string })?.id;
      return String(pid || product.existingExternalId);
    }

    const { data } = await this.client.request<{ data?: { id?: string } }>('POST', '/products', body);
    const id = data?.data?.id ?? (data as { id?: string })?.id;
    return String(id || product.internalId);
  }

  async removeProduct(externalId: string, _outletId: string): Promise<void> {
    await this.client.request('DELETE', `/products/${externalId}`);
  }

  async getInventory(externalProductId: string, _outletId: string): Promise<number> {
    const { data } = await this.client.request<{ data?: { inventory?: number[] } }>(
      'GET',
      `/products/${externalProductId}`,
    );
    const inv = data?.data?.inventory;
    if (Array.isArray(inv) && inv.length) return Number(inv[0]);
    return Number((data as { data?: { quantity?: number } })?.data?.quantity ?? 0);
  }

  async updateInventory(
    externalProductId: string,
    outletId: string,
    targetQuantity: number,
  ): Promise<void> {
    await this.client.request('POST', `/products/${externalProductId}/inventory`, {
      outlet_id: outletId,
      quantity: targetQuantity,
    });
  }

  async syncCustomer(customer: POSCustomerPayload): Promise<string> {
    const body = M.mapCustomerToVend(customer);
    const { data } = await this.client.request<{ data?: { id?: string } }>(
      'POST',
      '/customers',
      body,
    );
    return String(data?.data?.id ?? (data as { id?: string })?.id ?? customer.internalId);
  }

  async lookupCustomer(identifier: string): Promise<POSCustomer | null> {
    const q = encodeURIComponent(identifier);
    const { data } = await this.client.request<{ data?: Record<string, unknown>[] }>(
      'GET',
      `/customers?email=${q}`,
    );
    const rows = data?.data ?? [];
    if (!Array.isArray(rows) || !rows.length) return null;
    const c = rows[0] as Record<string, unknown>;
    return {
      externalId: String(c.id ?? ''),
      email: c.email ? String(c.email) : undefined,
      firstName: c.first_name ? String(c.first_name) : undefined,
      lastName: c.last_name ? String(c.last_name) : undefined,
      phone: c.phone ? String(c.phone) : undefined,
    };
  }

  async getSales(since: Date, outletId?: string): Promise<POSSale[]> {
    const from = since.toISOString();
    let path = `/register_sales?date_from=${encodeURIComponent(from)}&page_size=100`;
    if (outletId) path += `&outlet_id=${encodeURIComponent(outletId)}`;

    const { data } = await this.client.request<{ data?: Record<string, unknown>[] }>('GET', path);
    const rows = data?.data ?? [];
    if (!Array.isArray(rows)) return [];
    return rows.map((r) =>
      M.mapSaleFromVend(r as Record<string, unknown>, outletId || String((r as { outlet_id?: string }).outlet_id ?? '')),
    );
  }

  validateWebhook(payload: unknown, signature: string, secret: string): boolean {
    if (!secret || !signature) return false;
    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const sig = signature.trim().toLowerCase();
    const exp = hmac.toLowerCase();
    if (sig.length !== exp.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp));
    } catch {
      return false;
    }
  }

  parseWebhookSale(payload: unknown): POSSale {
    const p = (typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const inner = (p.payload as Record<string, unknown>) || p;
    const outletId = String(inner.outlet_id ?? inner.register_id ?? '');
    return M.mapSaleFromVend(inner, outletId);
  }
}
