import { Logger } from '@nestjs/common';
import type { LightspeedCredentials } from '../../interfaces/pos-types';

/**
 * OAuth token refresh for Lightspeed Retail (Vend) X-Series.
 * https://developers.vendhq.com/reference/token-auth
 */
export class LightspeedAuthService {
  private readonly logger = new Logger(LightspeedAuthService.name);

  constructor(private creds: LightspeedCredentials) {}

  getCredentials(): LightspeedCredentials {
    return { ...this.creds };
  }

  setCredentials(c: LightspeedCredentials): void {
    this.creds = { ...c };
  }

  getAccessToken(): string | undefined {
    if (!this.creds.accessToken) return undefined;
    if (this.creds.expiresAt && Date.now() > this.creds.expiresAt - 60_000) {
      return undefined;
    }
    return this.creds.accessToken;
  }

  async authenticate(initial: Record<string, unknown>): Promise<void> {
    const domainPrefix = String(initial.domainPrefix || this.creds.domainPrefix || '');
    const clientId = String(initial.clientId || this.creds.clientId || '');
    const clientSecret = String(initial.clientSecret || this.creds.clientSecret || '');
    const refreshToken = String(initial.refreshToken || this.creds.refreshToken || '');
    const accessToken = String(initial.accessToken || this.creds.accessToken || '');

    this.creds = {
      ...this.creds,
      domainPrefix,
      clientId,
      clientSecret,
      refreshToken: refreshToken || this.creds.refreshToken,
      accessToken: accessToken || this.creds.accessToken,
    };

    if (this.creds.accessToken && !this.isExpired()) {
      return;
    }
    if (this.creds.refreshToken && this.creds.clientId && this.creds.clientSecret) {
      await this.refreshAuth();
      return;
    }
    if (!this.creds.accessToken) {
      throw new Error(
        'Lightspeed: set accessToken or refreshToken+clientId+clientSecret in credentials',
      );
    }
  }

  private isExpired(): boolean {
    if (!this.creds.expiresAt) return false;
    return Date.now() > this.creds.expiresAt - 60_000;
  }

  async refreshAuth(): Promise<void> {
    const { domainPrefix, clientId, clientSecret, refreshToken } = this.creds;
    if (!domainPrefix || !clientId || !clientSecret || !refreshToken) {
      throw new Error('Lightspeed: missing refresh credentials');
    }

    const url = `https://${domainPrefix}.vendhq.com/api/1.0/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Lightspeed token refresh failed: ${res.status} ${t.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires?: number;
      expires_in?: number;
    };

    this.creds.accessToken = json.access_token;
    if (json.refresh_token) this.creds.refreshToken = json.refresh_token;
    const expiresIn = json.expires_in ?? json.expires ?? 3600;
    this.creds.expiresAt = Date.now() + expiresIn * 1000;
    this.logger.debug('Lightspeed token refreshed');
  }
}
