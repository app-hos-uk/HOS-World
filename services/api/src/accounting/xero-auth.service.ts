import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import {
  XERO_INTEGRATION_CATEGORY,
  XERO_INTEGRATION_PROVIDER,
  XERO_OAUTH_SCOPES,
  type XeroTokenCredentials,
} from './accounting.types';

const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
 */
@Injectable()
export class XeroAuthService {
  private readonly logger = new Logger(XeroAuthService.name);

  /** In-memory CSRF state tokens with expiry. Low-volume admin flow only. */
  private pendingStates = new Map<string, number>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Generate a state token, store it, and return the authorize URL.
   */
  createConnectUrl(): { url: string; scopes: readonly string[]; state: string } {
    const state = randomBytes(16).toString('hex');
    this.pendingStates.set(state, Date.now() + STATE_TTL_MS);
    this.pruneExpiredStates();

    const clientId = this.config.get<string>('XERO_CLIENT_ID');
    const redirectUri = this.config.get<string>('XERO_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'XERO_CLIENT_ID and XERO_REDIRECT_URI must be configured',
      );
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
  validateAndConsumeState(state: string): void {
    const expiresAt = this.pendingStates.get(state);
    if (expiresAt == null) {
      throw new ForbiddenException('Invalid or expired OAuth state — restart the connect flow');
    }
    this.pendingStates.delete(state);
    if (Date.now() > expiresAt) {
      throw new ForbiddenException('OAuth state expired — restart the connect flow');
    }
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

    const tenantId =
      creds.tenantId || this.config.get<string>('XERO_TENANT_ID') || '';
    if (!tenantId) {
      throw new BadRequestException('Xero tenant id missing — set XERO_TENANT_ID or reconnect');
    }

    const skewMs = 60_000;
    if (creds.expiresAt && Date.now() < creds.expiresAt - skewMs) {
      return { accessToken: creds.accessToken, tenantId };
    }

    const refreshed = await this.refreshTokens(creds.refreshToken);
    const next: XeroTokenCredentials = {
      ...refreshed,
      refreshToken: refreshed.refreshToken || creds.refreshToken,
      tenantId,
    };
    await this.storeTokens(next);
    return { accessToken: next.accessToken, tenantId };
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

  private async requestToken(
    params: Record<string, string>,
  ): Promise<XeroTokenCredentials> {
    const clientId = this.config.get<string>('XERO_CLIENT_ID');
    const clientSecret = this.config.get<string>('XERO_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('XERO_CLIENT_ID and XERO_CLIENT_SECRET must be configured');
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Xero token exchange failed: ${res.status} ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (json.expires_in || 1800) * 1000,
      tokenType: json.token_type,
      scope: json.scope,
    };
  }

  private async fetchPrimaryTenantId(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(XERO_CONNECTIONS_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const connections = (await res.json()) as Array<{ tenantId?: string }>;
      return connections?.[0]?.tenantId ?? null;
    } catch {
      return null;
    }
  }
}
