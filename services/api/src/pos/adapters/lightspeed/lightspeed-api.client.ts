import { Logger } from '@nestjs/common';
import type { LightspeedCredentials } from '../../interfaces/pos-types';

const MIN_INTERVAL_MS = 1500;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15_000;
/** Leave enough budget to be worth starting an attempt at all. */
const MIN_ATTEMPT_BUDGET_MS = 1_000;

export type LightspeedRedisThrottle = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
  isRedisConnected: () => boolean;
};

export class LightspeedApiClient {
  private readonly logger = new Logger(LightspeedApiClient.name);
  private lastRequestAt = 0;
  private redis?: LightspeedRedisThrottle;
  private deadlineAt?: number;

  constructor(
    private creds: LightspeedCredentials,
    private getAccessToken: () => string | undefined,
    private onTokenRefresh?: (c: LightspeedCredentials) => void,
    private refreshAuth?: () => Promise<void>,
  ) {}

  /** Optional Redis-backed throttle shared across API replicas. */
  setRedisThrottle(redis: LightspeedRedisThrottle): void {
    this.redis = redis;
  }

  /**
   * Bound the total wall-clock time this client may spend, across throttle waits,
   * per-attempt timeouts and retry backoff. Interactive callers (e.g. issuing a till
   * voucher while a customer waits) set a budget so the request fails predictably
   * instead of outliving the HTTP client that is waiting on it.
   * Pass `undefined` to clear.
   */
  setDeadline(deadlineAt: number | undefined): void {
    this.deadlineAt = deadlineAt;
  }

  /** Milliseconds left in the budget, or null when unbounded. */
  private remainingMs(): number | null {
    return this.deadlineAt == null ? null : this.deadlineAt - Date.now();
  }

  /** True when a budget is set and there is no longer room for a useful attempt. */
  private budgetExhausted(): boolean {
    const remaining = this.remainingMs();
    return remaining != null && remaining < MIN_ATTEMPT_BUDGET_MS;
  }

  private deadlineError(method: string, path: string): Error {
    return new Error(
      `Lightspeed API deadline exceeded before completing ${method} ${path} (budget spent on throttle, retries or slow responses)`,
    );
  }

  /**
   * Sleep, but never past the deadline. Returns false when the full delay does not
   * fit in the remaining budget, so the caller can stop instead of sleeping it away.
   */
  private async delay(ms: number): Promise<boolean> {
    const remaining = this.remainingMs();
    if (remaining != null && ms > remaining - MIN_ATTEMPT_BUDGET_MS) {
      return false;
    }
    await new Promise((r) => setTimeout(r, ms));
    return true;
  }

  private baseUrl(): string {
    const p = this.creds.domainPrefix.replace(/\/$/, '');
    return `https://${p}.vendhq.com/api/2.0`;
  }

  /**
   * Space out calls to stay within Lightspeed's rate limit. Returns false when the
   * required wait does not fit the remaining budget — the throttle key is shared with
   * background sync jobs, so an interactive caller must be able to give up rather than
   * queue behind them.
   */
  private async throttle(): Promise<boolean> {
    const key = `lightspeed:rl:${this.creds.domainPrefix || 'default'}`;
    if (this.redis?.isRedisConnected()) {
      try {
        const lastRaw = await this.redis.get(key);
        const last = lastRaw ? Number(lastRaw) : 0;
        const wait = Number.isFinite(last) ? Math.max(0, MIN_INTERVAL_MS - (Date.now() - last)) : 0;
        if (wait > 0 && !(await this.delay(wait))) return false;
        await this.redis.set(key, String(Date.now()), 60);
        this.lastRequestAt = Date.now();
        return true;
      } catch {
        // fall through to in-process throttle
      }
    }

    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - this.lastRequestAt));
    if (wait > 0 && !(await this.delay(wait))) return false;
    this.lastRequestAt = Date.now();
    return true;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ data: T; status: number }> {
    let attempt = 0;
    let lastErr: Error | null = null;
    let refreshed = false;

    while (attempt < MAX_RETRIES) {
      attempt++;

      if (this.budgetExhausted()) {
        throw lastErr ?? this.deadlineError(method, path);
      }
      if (!(await this.throttle())) {
        throw lastErr ?? this.deadlineError(method, path);
      }

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

      // Never let a single attempt outlive the overall budget.
      const remaining = this.remainingMs();
      const attemptTimeoutMs =
        remaining == null ? REQUEST_TIMEOUT_MS : Math.min(REQUEST_TIMEOUT_MS, remaining);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);

      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (e) {
        const timedOut = controller.signal.aborted && (e as Error)?.name === 'AbortError';
        lastErr = timedOut
          ? new Error(
              `Lightspeed API request timed out after ${attemptTimeoutMs}ms: ${method} ${path}`,
            )
          : (e as Error);
        if (attempt >= MAX_RETRIES) break;
        if (!(await this.delay(1000 * Math.pow(2, attempt) + Math.random() * 200))) {
          throw lastErr;
        }
        continue;
      } finally {
        // Headers received (or the attempt failed) — the network round-trip is over,
        // so disarm the timeout before reading the body.
        clearTimeout(timeoutId);
      }

      const retryAfter = res.headers.get('retry-after');
      if (res.status === 429 && retryAfter && attempt < MAX_RETRIES) {
        await res.text().catch(() => '');
        lastErr = new Error(`Lightspeed API 429: rate limited on ${method} ${path}`);
        if (!(await this.delay(parseInt(retryAfter, 10) * 1000 || 5000))) throw lastErr;
        continue;
      }

      if (res.status === 401 && !refreshed && this.refreshAuth) {
        refreshed = true;
        await res.text().catch(() => '');
        await this.refreshAuth();
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Lightspeed API ${res.status}: ${text.slice(0, 500)}`);
        // Only 5xx is worth retrying. 4xx is a decided answer — notably 404, which
        // getGiftCardByNumber() reads as "no such card"; retrying it would burn the
        // budget on the common path for a brand new voucher.
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          lastErr = err;
          if (!(await this.delay(1000 * Math.pow(2, attempt)))) throw err;
          continue;
        }
        throw err;
      }

      return { data: (await res.json()) as T, status: res.status };
    }

    this.logger.warn(
      `Lightspeed request failed after ${MAX_RETRIES} attempts: ${lastErr?.message}`,
    );
    throw lastErr || new Error('Lightspeed request failed');
  }

  updateCredentials(c: LightspeedCredentials): void {
    this.creds = c;
    this.onTokenRefresh?.(c);
  }
}
