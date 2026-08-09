import { Injectable, Logger } from '@nestjs/common';
import type { XeroManualJournalPayload } from './accounting.types';

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';
const MAX_RETRIES = 4;

export interface XeroApiResponse<T = unknown> {
  data: T;
  status: number;
}

export class XeroRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'XeroRateLimitError';
  }
}

/**
 * Thin Xero Accounting API client.
 * Uses fetch (injectable via globalThis for tests — never hit real Xero in specs).
 */
@Injectable()
export class XeroApiClient {
  private readonly logger = new Logger(XeroApiClient.name);

  async postManualJournal(
    accessToken: string,
    tenantId: string,
    journal: XeroManualJournalPayload,
    idempotencyKey: string,
  ): Promise<{ manualJournalId: string; raw: unknown }> {
    const body = {
      ManualJournals: [
        {
          Narration: journal.narration,
          Date: journal.date,
          LineAmountTypes: journal.lineAmountTypes ?? 'NoTax',
          Status: journal.status ?? 'POSTED',
          JournalLines: journal.journalLines.map((line) => ({
            AccountCode: line.accountCode,
            Description: line.description,
            LineAmount:
              line.debit !== undefined && line.debit !== null ? line.debit : -(line.credit ?? 0),
            TaxType: line.taxType ?? 'NONE',
          })),
        },
      ],
    };

    const result = await this.request<{
      ManualJournals?: Array<{ ManualJournalID?: string }>;
    }>('POST', '/ManualJournals', accessToken, tenantId, body, idempotencyKey);

    const id = result.data?.ManualJournals?.[0]?.ManualJournalID;
    if (!id) {
      throw new Error('Xero ManualJournal response missing ManualJournalID');
    }
    return { manualJournalId: id, raw: result.data };
  }

  async getAccounts(accessToken: string, tenantId: string): Promise<unknown> {
    const result = await this.request('GET', '/Accounts', accessToken, tenantId);
    return result.data;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    accessToken: string,
    tenantId: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<XeroApiResponse<T>> {
    let attempt = 0;
    let lastErr: Error | null = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      const url = `${XERO_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (idempotencyKey && method !== 'GET') {
        // Xero Idempotency-Key: dedupe writes for 24h (max 128 chars)
        headers['Idempotency-Key'] = idempotencyKey.slice(0, 128);
      }

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (res.status === 429) {
          const retryAfterHeader = res.headers.get('retry-after');
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 60 : 60;
          await res.text().catch(() => '');
          if (attempt < MAX_RETRIES) {
            this.logger.warn(
              `Xero 429 — waiting ${retryAfterSeconds}s (attempt ${attempt}/${MAX_RETRIES})`,
            );
            await sleep(retryAfterSeconds * 1000);
            continue;
          }
          throw new XeroRateLimitError(
            `Xero rate limited after ${MAX_RETRIES} attempts`,
            retryAfterSeconds,
          );
        }

        if (!res.ok) {
          const text = await res.text();
          if (res.status >= 500 && attempt < MAX_RETRIES) {
            await sleep(1000 * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`Xero API ${res.status}: ${text.slice(0, 500)}`);
        }

        const data = (await res.json()) as T;
        return { data, status: res.status };
      } catch (e) {
        if (e instanceof XeroRateLimitError) throw e;
        lastErr = e as Error;
        if (attempt < MAX_RETRIES && !(e as Error).message?.startsWith('Xero API 4')) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        throw e;
      }
    }

    throw lastErr || new Error('Xero request failed');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
