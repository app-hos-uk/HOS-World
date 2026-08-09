import * as crypto from 'crypto';
import type { POSAdapter } from '../../interfaces/pos-adapter.interface';
import type {
  LightspeedCredentials,
  POSCustomer,
  POSCustomerPayload,
  POSGiftCard,
  POSGiftCardCreatePayload,
  POSGiftCardTransaction,
  POSGiftCardTransactionPayload,
  POSOutlet,
  POSProductPayload,
  POSSale,
  POSSalesPage,
} from '../../interfaces/pos-types';
import { LightspeedApiClient, type LightspeedRedisThrottle } from './lightspeed-api.client';
import { LightspeedAuthService, type LightspeedRedisLock } from './lightspeed-auth.service';
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
      () => this.refreshAuth(),
    );
  }

  /**
   * Wire Redis for cross-replica refresh lock + API rate limiting.
   * Safe to call with a partial Redis surface (lock + throttle share get/set/setNX/del).
   */
  attachRedis(redis: LightspeedRedisLock & LightspeedRedisThrottle): void {
    this.auth.setRedisLock(redis);
    this.client.setRedisThrottle(redis);
  }

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    await this.auth.authenticate(credentials as LightspeedCredentials & Record<string, unknown>);
    this.client.updateCredentials(this.auth.getCredentials());
  }

  async refreshAuth(): Promise<void> {
    await this.auth.refreshAuth();
    this.client.updateCredentials(this.auth.getCredentials());
  }

  /** Current credentials after auth/refresh — callers may persist these. */
  getCredentials(): LightspeedCredentials {
    return this.auth.getCredentials();
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

    const { data } = await this.client.request<{ data?: { id?: string } }>(
      'POST',
      '/products',
      body,
    );
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

  /**
   * Search-then-update upsert: find by customer_code (membership id), else email;
   * PUT when found, POST when not. Avoids duplicate customers.
   */
  async syncCustomer(customer: POSCustomerPayload): Promise<string> {
    const body = M.mapCustomerToVend(customer);
    const existing =
      (await this.findCustomerRow({ customer_code: customer.internalId })) ??
      (customer.email ? await this.findCustomerRow({ email: customer.email }) : null);
    const existingId = existing?.id ? String(existing.id) : null;

    if (existingId) {
      const { data: putData } = await this.client.request<{ data?: { id?: string } }>(
        'PUT',
        `/customers/${existingId}`,
        body,
      );
      const pid = putData?.data?.id ?? (putData as { id?: string })?.id;
      return String(pid || existingId);
    }

    const { data } = await this.client.request<{ data?: { id?: string } }>(
      'POST',
      '/customers',
      body,
    );
    return String(data?.data?.id ?? (data as { id?: string })?.id ?? customer.internalId);
  }

  /** Lookup by customer_code first, then email. */
  async lookupCustomer(identifier: string): Promise<POSCustomer | null> {
    const row =
      (await this.findCustomerRow({ customer_code: identifier })) ??
      (await this.findCustomerRow({ email: identifier }));
    if (!row) return null;
    return {
      externalId: String(row.id ?? ''),
      email: row.email ? String(row.email) : undefined,
      firstName: row.first_name ? String(row.first_name) : undefined,
      lastName: row.last_name ? String(row.last_name) : undefined,
      phone: row.phone ? String(row.phone) : row.mobile ? String(row.mobile) : undefined,
    };
  }

  /**
   * Page Lightspeed customers (version cursor). Used by identity backfill.
   */
  async listCustomersPage(params: { after?: number; pageSize?: number }): Promise<{
    customers: Array<{
      id: string;
      email?: string;
      customer_code?: string;
      custom_field_1?: string;
      phone?: string;
      mobile?: string;
      version?: number;
    }>;
    maxVersion: number | null;
  }> {
    const pageSize = params.pageSize ?? 100;
    let path = `/customers?page_size=${pageSize}`;
    if (params.after != null) path += `&after=${encodeURIComponent(String(params.after))}`;

    const { data } = await this.client.request<{
      data?: Record<string, unknown>[];
      version?: { min?: number; max?: number };
    }>('GET', path);

    const rows = Array.isArray(data?.data) ? data.data : [];
    const customers = rows.map((r) => ({
      id: String(r.id ?? ''),
      email: r.email ? String(r.email) : undefined,
      customer_code: r.customer_code != null ? String(r.customer_code) : undefined,
      custom_field_1: r.custom_field_1 != null ? String(r.custom_field_1) : undefined,
      phone: r.phone ? String(r.phone) : undefined,
      mobile: r.mobile ? String(r.mobile) : undefined,
      version: Number.isFinite(Number(r.version)) ? Number(r.version) : undefined,
    }));

    const versionMax = data?.version?.max;
    let maxVersion: number | null =
      versionMax != null && Number.isFinite(versionMax) ? versionMax : null;
    if (maxVersion == null) {
      const rowVersions = customers
        .map((c) => c.version)
        .filter((v): v is number => v != null && Number.isFinite(v));
      maxVersion = rowVersions.length ? Math.max(...rowVersions) : null;
    }

    return { customers, maxVersion };
  }

  /** Stamp identity fields on an existing Lightspeed customer. */
  async updateCustomerIdentity(
    externalId: string,
    fields: { customer_code: string; custom_field_1?: string },
  ): Promise<void> {
    const body: Record<string, unknown> = {
      customer_code: fields.customer_code,
    };
    if (fields.custom_field_1 !== undefined) {
      body.custom_field_1 = fields.custom_field_1;
    }
    await this.client.request('PUT', `/customers/${externalId}`, body);
  }

  /**
   * Return a single row only when it exactly matches the requested code/email.
   * Never trust the first Search hit (prefix/fuzzy/multi-row).
   */
  private pickVerifiedCustomerRow(
    rows: Record<string, unknown>[],
    params: { customer_code?: string; email?: string },
  ): Record<string, unknown> | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const matches = rows.filter((r) => {
      if (params.customer_code) {
        return String(r.customer_code ?? '') === params.customer_code;
      }
      if (params.email) {
        return String(r.email ?? '').toLowerCase() === params.email.toLowerCase();
      }
      return false;
    });
    return matches.length === 1 ? matches[0] : null;
  }

  private async findCustomerRow(params: {
    customer_code?: string;
    email?: string;
  }): Promise<Record<string, unknown> | null> {
    const qs = new URLSearchParams({ type: 'customers' });
    if (params.customer_code) qs.set('customer_code', params.customer_code);
    if (params.email) qs.set('email', params.email);

    try {
      const { data } = await this.client.request<{ data?: Record<string, unknown>[] }>(
        'GET',
        `/search?${qs.toString()}`,
      );
      const verified = this.pickVerifiedCustomerRow(data?.data ?? [], params);
      if (verified) return verified;
    } catch {
      // Fall through to list filter when Search API unavailable.
    }

    if (params.email) {
      const q = encodeURIComponent(params.email);
      const { data } = await this.client.request<{ data?: Record<string, unknown>[] }>(
        'GET',
        `/customers?email=${q}`,
      );
      return this.pickVerifiedCustomerRow(data?.data ?? [], params);
    }

    return null;
  }

  /**
   * List Sales: GET /api/2.0/sales?after=&page_size=
   * @see https://x-series-api.lightspeedhq.com/reference/listsales
   */
  async getSales(params: { afterVersion?: number; outletId?: string }): Promise<POSSalesPage> {
    const pageSize = 100;
    const sales: POSSale[] = [];
    let after = params.afterVersion;
    let maxVersion: number | null = params.afterVersion ?? null;

    for (;;) {
      let path = `/sales?page_size=${pageSize}`;
      if (after != null) path += `&after=${encodeURIComponent(String(after))}`;

      const { data } = await this.client.request<{
        data?: Record<string, unknown>[];
        version?: { min?: number; max?: number };
      }>('GET', path);

      const rows = data?.data ?? [];
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const r of rows) {
        const mapped = M.mapSaleFromVend(
          r as Record<string, unknown>,
          params.outletId || String((r as { outlet_id?: string }).outlet_id ?? ''),
        );
        if (params.outletId && mapped.outletId && mapped.outletId !== params.outletId) {
          continue;
        }
        sales.push(mapped);
        if (mapped.version != null && Number.isFinite(mapped.version)) {
          maxVersion = maxVersion == null ? mapped.version : Math.max(maxVersion, mapped.version);
        }
      }

      const versionMax = data?.version?.max;
      if (versionMax != null && Number.isFinite(versionMax)) {
        maxVersion = maxVersion == null ? versionMax : Math.max(maxVersion, versionMax);
        after = versionMax;
      } else {
        const rowVersions = rows
          .map((r) => Number((r as { version?: number }).version))
          .filter((v) => Number.isFinite(v));
        if (!rowVersions.length) break;
        after = Math.max(...rowVersions);
        maxVersion = maxVersion == null ? after : Math.max(maxVersion, after);
      }

      // Page until empty collection (API may return full pages of non-matching outlets)
      if (rows.length === 0) break;
      if (rows.length < pageSize) break;
    }

    return { sales, maxVersion };
  }

  validateWebhook(payload: unknown, signature: string, secret: string): boolean {
    if (!secret || !signature) return false;

    let sigHex = signature.trim();
    let algorithm = 'HMAC-SHA256';
    if (sigHex.includes('signature=')) {
      for (const part of sigHex.split(',')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const key = part.slice(0, eq).trim().toLowerCase();
        const val = part.slice(eq + 1).trim();
        if (key === 'signature') sigHex = val;
        if (key === 'algorithm') algorithm = val;
      }
    }

    if (algorithm.toUpperCase() !== 'HMAC-SHA256') return false;

    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return false;
    const body = typeof payload === 'string' ? payload : payload;

    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const a = Buffer.from(sigHex.toLowerCase());
    const b = Buffer.from(hmac.toLowerCase());
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhookSale(payload: unknown): POSSale {
    const p = (
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
    ) as Record<string, unknown>;

    let inner: Record<string, unknown>;
    if (typeof p.payload === 'string') {
      try {
        inner = JSON.parse(p.payload) as Record<string, unknown>;
      } catch {
        inner = {};
      }
    } else if (p.payload && typeof p.payload === 'object') {
      inner = p.payload as Record<string, unknown>;
    } else {
      inner = p;
    }

    const outletId = String(inner.outlet_id ?? inner.register_id ?? '');
    return M.mapSaleFromVend(inner, outletId);
  }

  /**
   * List gift cards: GET /gift_cards (paginated via `before` cursor).
   * @see https://x-series-api.lightspeedhq.com/docs/gift_cards
   */
  async listGiftCards(params?: { pageSize?: number }): Promise<POSGiftCard[]> {
    const pageSize = Math.min(Math.max(params?.pageSize ?? 100, 1), 1000);
    const cards: POSGiftCard[] = [];
    let before: string | undefined;

    for (;;) {
      let path = `/gift_cards?page_size=${pageSize}`;
      if (before) path += `&before=${encodeURIComponent(before)}`;

      const { data } = await this.client.request<{ data?: Record<string, unknown>[] }>('GET', path);
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length === 0) break;

      for (const r of rows) {
        cards.push(this.mapGiftCard(r));
      }

      const lastId = rows[rows.length - 1]?.id;
      if (lastId == null || rows.length < pageSize) break;
      before = String(lastId);
    }

    return cards;
  }

  /**
   * Create gift card: POST /gift_cards
   * @see https://x-series-api.lightspeedhq.com/docs/gift_cards
   */
  async createGiftCard(payload: POSGiftCardCreatePayload): Promise<POSGiftCard> {
    const body: Record<string, unknown> = {
      amount: payload.amount,
      number: payload.number,
    };
    if (payload.expiresAt) {
      const d = payload.expiresAt instanceof Date ? payload.expiresAt : new Date(payload.expiresAt);
      if (!Number.isNaN(d.getTime())) {
        body.expires_at = d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
      }
    }

    const { data } = await this.client.request<{ data?: Record<string, unknown> }>(
      'POST',
      '/gift_cards',
      body,
    );
    return this.mapGiftCard(data?.data ?? (data as unknown as Record<string, unknown>));
  }

  async getGiftCardByNumber(number: string): Promise<POSGiftCard | null> {
    const encoded = encodeURIComponent(number);
    try {
      const { data } = await this.client.request<{ data?: Record<string, unknown> }>(
        'GET',
        `/gift_cards/by_number/${encoded}`,
      );
      const row = data?.data ?? (data as unknown as Record<string, unknown>);
      if (!row || typeof row !== 'object') return null;
      return this.mapGiftCard(row);
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      if (msg.includes('404') || /not found/i.test(msg)) return null;
      throw e;
    }
  }

  async giftCardTransaction(
    number: string,
    payload: POSGiftCardTransactionPayload,
  ): Promise<POSGiftCardTransaction> {
    const abs = Math.abs(Number(payload.amount));
    const signed = payload.type === 'REDEEMING' ? -abs : abs;
    const encoded = encodeURIComponent(number);
    const { data } = await this.client.request<{ data?: Record<string, unknown> }>(
      'POST',
      `/gift_cards/${encoded}/transactions`,
      {
        amount: signed,
        type: payload.type,
        client_id: payload.clientId,
      },
    );
    return this.mapGiftCardTransaction(data?.data ?? (data as unknown as Record<string, unknown>));
  }

  async reverseGiftCardTransaction(transactionId: string): Promise<POSGiftCardTransaction> {
    const encoded = encodeURIComponent(transactionId);
    const { data } = await this.client.request<{ data?: Record<string, unknown> }>(
      'DELETE',
      `/gift_cards/transactions/${encoded}`,
    );
    return this.mapGiftCardTransaction(data?.data ?? (data as unknown as Record<string, unknown>));
  }

  async voidGiftCard(number: string): Promise<POSGiftCard> {
    const encoded = encodeURIComponent(number);
    const { data } = await this.client.request<{ data?: Record<string, unknown> }>(
      'DELETE',
      `/gift_cards/by_number/${encoded}`,
    );
    return this.mapGiftCard(data?.data ?? (data as unknown as Record<string, unknown>));
  }

  private mapGiftCard(row: Record<string, unknown> | undefined | null): POSGiftCard {
    const r = row && typeof row === 'object' ? row : {};
    const txsRaw = r.gift_card_transactions;
    const transactions = Array.isArray(txsRaw)
      ? txsRaw.map((t) => this.mapGiftCardTransaction(t as Record<string, unknown>))
      : undefined;
    return {
      id: String(r.id ?? ''),
      number: String(r.number ?? ''),
      balance: Number(r.balance ?? 0),
      status: r.status != null ? String(r.status) : undefined,
      expiresAt: r.expires_at != null ? String(r.expires_at) : null,
      transactions,
    };
  }

  private mapGiftCardTransaction(
    row: Record<string, unknown> | undefined | null,
  ): POSGiftCardTransaction {
    const r = row && typeof row === 'object' ? row : {};
    return {
      id: String(r.id ?? ''),
      amount: Number(r.amount ?? 0),
      type: String(r.type ?? ''),
      clientId: r.client_id != null ? String(r.client_id) : null,
      createdAt: r.created_at != null ? String(r.created_at) : undefined,
    };
  }
}
