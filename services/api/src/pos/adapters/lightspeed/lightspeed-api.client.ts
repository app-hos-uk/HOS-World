import { Logger } from '@nestjs/common';
import type { LightspeedCredentials } from '../../interfaces/pos-types';

const MIN_INTERVAL_MS = 1500;
const MAX_RETRIES = 3;

export class LightspeedApiClient {
  private readonly logger = new Logger(LightspeedApiClient.name);
  private lastRequestAt = 0;

  constructor(
    private creds: LightspeedCredentials,
    private getAccessToken: () => string | undefined,
    private onTokenRefresh?: (c: LightspeedCredentials) => void,
  ) {}

  private baseUrl(): string {
    const p = this.creds.domainPrefix.replace(/\/$/, '');
    return `https://${p}.vendhq.com/api/2.0`;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - this.lastRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ data: T; status: number }> {
    let attempt = 0;
    let lastErr: Error | null = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      await this.throttle();
      const token = this.getAccessToken();
      if (!token) {
        throw new Error('Lightspeed: no access token');
      }

      const url = `${this.baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        const retryAfter = res.headers.get('retry-after');
        if (res.status === 429 && retryAfter && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, parseInt(retryAfter, 10) * 1000 || 5000));
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          if (res.status >= 500 && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            continue;
          }
          throw new Error(`Lightspeed API ${res.status}: ${text.slice(0, 500)}`);
        }

        const data = (await res.json()) as T;
        return { data, status: res.status };
      } catch (e) {
        lastErr = e as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt) + Math.random() * 200));
        }
      }
    }

    this.logger.warn(`Lightspeed request failed after ${MAX_RETRIES} attempts: ${lastErr?.message}`);
    throw lastErr || new Error('Lightspeed request failed');
  }

  updateCredentials(c: LightspeedCredentials): void {
    this.creds = c;
    this.onTokenRefresh?.(c);
  }
}
