import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import { RedisService } from '../cache/redis.service';
import {
  XERO_INTEGRATION_CATEGORY,
  XERO_INTEGRATION_PROVIDER,
  XERO_OAUTH_SCOPES,
  type XeroTokenCredentials,
} from './accounting.types';

const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

const STATE_TTL_SEC = 10 * 60; // 10 minutes
const STATE_KEY_PREFIX = 'xero:oauth:state:';
const REFRESH_LOCK_KEY = 'xero:token:refresh:lock';
const REFRESH_LOCK_TTL_SEC = 30;

/**
 * Xero OAuth2 (authorization code + refresh).
 *
 * Granular scopes (apps created after 2026-03-02):
 *   offline_access            — long-lived refresh tokens
 *   accounting.manualjournals — post daily summary ManualJournals
 *   accounting.settings.read  — seed CoA mapping via GET /Accounts
 *
 * Tokens are stored encrypted on IntegrationConfig (category=ACCOUNTING, provider=xero)
 * using EncryptionService — same pattern as other integrations.
 *
 * OAuth CSRF state and refresh single-flight use Redis so multi-instance API
 * replicas share the same connect/refresh lifecycle.
 */
@Injectable()
export class XeroAuthService {
  private readonly logger = new Logger(XeroAuthService.name);

  /** Fallback when Redis is unavailable (single-instance / local only). */
  private pendingStates = new Map<string, number>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private redis: RedisService,
  ) {}

  /**
   * Generate a state token, store it (Redis preferred), and return the authorize URL.
   */
  async createConnectUrl(): Promise<{ url: string; scopes: readonly string[]; state: string }> {
    const state = randomBytes(16).toString('hex');
    await this.storeOAuthState(state);

    const clientId = this.config.get<string>('XERO_CLIENT_ID');
    const redirectUri = this.config.get<string>('XERO_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new BadRequestException('XERO_CLIENT_ID and XERO_REDIRECT_URI must be configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: XERO_OAUTH_SCOPES.join(' '),
      state,
    });

    return {
      url: `${XERO_AUTHORIZE_URL}?${params.toString()}`,
      scopes: XERO_OAUTH_SCOPES,
      state,
    };
  }

  /** Validate and consume a CSRF state token. Throws if invalid or expired. */
  async validateAndConsumeState(state: string): Promise<void> {
    const redisKey = `${STATE_KEY_PREFIX}${state}`;
    if (this.redis.isRedisConnected()) {
      const stored = await this.redis.get(redisKey);
      if (stored == null) {
        // Fall through to in-memory for transitional single-instance flows
        const memExp = this.pendingStates.get(state);
        if (memExp == null) {
          throw new ForbiddenException('Invalid or expired OAuth state — restart the connect flow');
        }
        this.pendingStates.delete(state);
        if (Date.now() > memExp) {
          throw new ForbiddenException('OAuth state expired — restart the connect flow');
        }
        return;
      }
      await this.redis.del(redisKey);
      const expiresAt = Number(stored);
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        throw new ForbiddenException('OAuth state expired — restart the connect flow');
      }
      return;
    }

    const expiresAt = this.pendingStates.get(state);
    if (expiresAt == null) {
      throw new ForbiddenException('Invalid or expired OAuth state — restart the connect flow');
    }
    this.pendingStates.delete(state);
    if (Date.now() > expiresAt) {
      throw new ForbiddenException('OAuth state expired — restart the connect flow');
    }
  }

  private async storeOAuthState(state: string): Promise<void> {
    const expiresAt = Date.now() + STATE_TTL_SEC * 1000;
    if (this.redis.isRedisConnected()) {
      await this.redis.set(`${STATE_KEY_PREFIX}${state}`, String(expiresAt), STATE_TTL_SEC);
      return;
    }
    this.logger.warn(
      'Redis unavailable — storing Xero OAuth state in memory (not multi-instance safe)',
    );
    this.pendingStates.set(state, expiresAt);
    this.pruneExpiredStates();
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    for (const [key, exp] of this.pendingStates) {
      if (now > exp) this.pendingStates.delete(key);
    }
  }

  async exchangeCode(code: string): Promise<XeroTokenCredentials> {
    const tokens = await this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.get<string>('XERO_REDIRECT_URI') || '',
    });

    const tenantId =
      this.config.get<string>('XERO_TENANT_ID') ||
      (await this.fetchPrimaryTenantId(tokens.accessToken));

    const creds: XeroTokenCredentials = {
      ...tokens,
      tenantId: tenantId || undefined,
    };
    await this.storeTokens(creds);
    return creds;
  }

  async getValidAccessToken(): Promise<{ accessToken: string; tenantId: string }> {
    const creds = await this.loadTokens();
    if (!creds?.accessToken || !creds.refreshToken) {
      throw new BadRequestException('Xero is not connected — complete OAuth first');
    }

    const tenantId = creds.tenantId || this.config.get<string>('XERO_TENANT_ID') || '';
    if (!tenantId) {
      throw new BadRequestException('Xero tenant id missing — set XERO_TENANT_ID or reconnect');
    }

    const skewMs = 60_000;
    if (creds.expiresAt && Date.now() < creds.expiresAt - skewMs) {
      return { accessToken: creds.accessToken, tenantId };
    }

    return this.refreshWithSingleFlight(creds, tenantId);
  }

  /**
   * Only one replica refreshes at a time; others wait and re-read stored tokens.
   */
  private async refreshWithSingleFlight(
    creds: XeroTokenCredentials,
    tenantId: string,
  ): Promise<{ accessToken: string; tenantId: string }> {
    let acquired = false;
    if (this.redis.isRedisConnected()) {
      try {
        acquired = await this.redis.setNX(REFRESH_LOCK_KEY, '1', REFRESH_LOCK_TTL_SEC);
      } catch (e) {
        this.logger.warn(
          `Xero refresh lock unavailable: ${(e as Error).message} — proceeding without lock`,
        );
        acquired = true;
      }
    } else {
      acquired = true;
    }

    if (!acquired) {
      // Another instance is refreshing — wait briefly and reload.
      await new Promise((r) => setTimeout(r, 750));
      const reloaded = await this.loadTokens();
      if (reloaded?.accessToken && reloaded.expiresAt && Date.now() < reloaded.expiresAt - 60_000) {
        return {
          accessToken: reloaded.accessToken,
          tenantId: reloaded.tenantId || tenantId,
        };
      }
      // Still stale — try once more after another wait, then refresh ourselves.
      await new Promise((r) => setTimeout(r, 750));
      const again = await this.loadTokens();
      if (again?.accessToken && again.expiresAt && Date.now() < again.expiresAt - 60_000) {
        return {
          accessToken: again.accessToken,
          tenantId: again.tenantId || tenantId,
        };
      }
    }

    try {
      const refreshed = await this.refreshTokens(creds.refreshToken!);
      const next: XeroTokenCredentials = {
        ...refreshed,
        refreshToken: refreshed.refreshToken || creds.refreshToken,
        tenantId,
      };
      await this.storeTokens(next);
      return { accessToken: next.accessToken, tenantId };
    } finally {
      if (acquired && this.redis.isRedisConnected()) {
        await this.redis.del(REFRESH_LOCK_KEY);
      }
    }
  }

  async getConnectionStatus(): Promise<{
    connected: boolean;
    hasRefreshToken: boolean;
    tenantId: string | null;
    expiresAt: number | null;
  }> {
    const creds = await this.loadTokens();
    return {
      connected: !!creds?.accessToken,
      hasRefreshToken: !!creds?.refreshToken,
      tenantId: creds?.tenantId || this.config.get<string>('XERO_TENANT_ID') || null,
      expiresAt: creds?.expiresAt ?? null,
    };
  }

  async storeTokens(creds: XeroTokenCredentials): Promise<void> {
    const encrypted = this.encryption.encryptJson(creds as unknown as Record<string, unknown>);
    await this.prisma.integrationConfig.upsert({
      where: {
        category_provider: {
          category: XERO_INTEGRATION_CATEGORY,
          provider: XERO_INTEGRATION_PROVIDER,
        },
      },
      create: {
        category: XERO_INTEGRATION_CATEGORY,
        provider: XERO_INTEGRATION_PROVIDER,
        displayName: 'Xero Accounting',
        description: 'HOS → Xero daily summary manual journals (online + liabilities only)',
        isActive: true,
        isTestMode: true,
        credentials: encrypted,
        settings: {},
        testStatus: 'NEVER_TESTED',
        priority: 0,
      },
      update: {
        credentials: encrypted,
        isActive: true,
      },
    });
    this.logger.log('Xero OAuth tokens stored (encrypted)');
  }

  async loadTokens(): Promise<XeroTokenCredentials | null> {
    const row = await this.prisma.integrationConfig.findUnique({
      where: {
        category_provider: {
          category: XERO_INTEGRATION_CATEGORY,
          provider: XERO_INTEGRATION_PROVIDER,
        },
      },
    });
    if (!row?.credentials) return null;
    try {
      return this.encryption.decryptJson<XeroTokenCredentials>(row.credentials);
    } catch (e) {
      this.logger.error(`Failed to decrypt Xero tokens: ${(e as Error).message}`);
      return null;
    }
  }

  private async refreshTokens(refreshToken: string): Promise<XeroTokenCredentials> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async requestToken(params: Record<string, string>): Promise<XeroTokenCredentials> {
    const clientId = this.config.get<string>('XERO_CLIENT_ID');
    const clientSecret = this.config.get<string>('XERO_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('XERO_CLIENT_ID and XERO_CLIENT_SECRET must be configured');
    }

    const body = new URLSearchParams(params);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Xero token exchange failed: ${res.status} ${text.slice(0, 200)}`);
      throw new BadRequestException('Xero token exchange failed');
    }

    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    if (!json.access_token) {
      throw new BadRequestException('Xero token response missing access_token');
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (Number(json.expires_in) || 1800) * 1000,
      tokenType: json.token_type,
      scope: json.scope,
    };
  }

  private async fetchPrimaryTenantId(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(XERO_CONNECTIONS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{ tenantId?: string }>;
      return rows?.[0]?.tenantId || null;
    } catch {
      return null;
    }
  }
}
