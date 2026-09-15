import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { Public } from '../common/decorators/public.decorator';
import { RedisService } from '../cache/redis.service';

/**
 * Handles the Lightspeed Retail (X-Series) OAuth authorization-code flow.
 *
 * Flow:
 *  1. Frontend builds the Lightspeed authorize URL using NEXT_PUBLIC_LIGHTSPEED_CLIENT_ID
 *     and redirects the admin there.
 *  2. Lightspeed redirects back to GET /api/pos/lightspeed/callback with ?code=…&state=…
 *  3. This controller exchanges the code for tokens, stores them in Redis behind a
 *     one-time session key, and redirects to the frontend with only that key in a query param.
 *  4. Frontend calls GET /api/pos/lightspeed/session/:sessionId (authenticated) to retrieve
 *     the tokens. The Redis key is deleted after retrieval.
 */

/**
 * A Lightspeed tenant prefix is a single DNS label. This must stay strict: the callback is
 * @Public() and the token-exchange body carries LIGHTSPEED_CLIENT_SECRET, so any character
 * that can terminate the host (`/`, `?`, `#`, `@`, `:`) would let a crafted `state` redirect
 * that secret to an attacker-controlled server.
 */
const DOMAIN_PREFIX_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const LIGHTSPEED_TOKEN_HOST_SUFFIX = '.retail.lightspeed.app';

const LS_SESSION_PREFIX = 'ls_oauth_session:';
const LS_SESSION_TTL = 300; // 5 minutes

@ApiTags('lightspeed-oauth')
@Controller('pos/lightspeed')
export class LightspeedOAuthController {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private config: ConfigService,
    private redis: RedisService,
  ) {
    this.clientId = config.get('LIGHTSPEED_CLIENT_ID', '');
    this.clientSecret = config.get('LIGHTSPEED_CLIENT_SECRET', '');
    this.frontendUrl =
      config.get('FRONTEND_URL') ||
      config.get('NEXT_PUBLIC_FRONTEND_URL') ||
      config.get('CORS_ORIGIN') ||
      'http://localhost:3000';
  }

  private getRedirectUri(): string {
    const apiUrl = this.config.get('API_URL');
    if (apiUrl) {
      const base = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      return `${base}/pos/lightspeed/callback`;
    }
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
    if (railwayDomain) {
      const host = railwayDomain.replace(/^https?:\/\//, '');
      return `https://${host}/api/pos/lightspeed/callback`;
    }
    const port = this.config.get('PORT') || '3001';
    return `http://localhost:${port}/api/pos/lightspeed/callback`;
  }

  @Get('config')
  @Public()
  @ApiOperation({ summary: 'Return non-secret OAuth config for the frontend' })
  getConfig(): { clientId: string; redirectUri: string } {
    return {
      clientId: this.clientId,
      redirectUri: this.getRedirectUri(),
    };
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Lightspeed OAuth callback — exchanges code for tokens' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendCallback = `${this.frontendUrl}/admin/stores/new`;

    if (error) {
      res.redirect(`${frontendCallback}?ls_error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.redirect(`${frontendCallback}?ls_error=no_code`);
      return;
    }
    if (!this.clientId || !this.clientSecret) {
      res.redirect(
        `${frontendCallback}?ls_error=${encodeURIComponent('LIGHTSPEED_CLIENT_ID / LIGHTSPEED_CLIENT_SECRET not configured on server')}`,
      );
      return;
    }

    let domainPrefix = '';
    try {
      const parsed = JSON.parse(Buffer.from(state || '', 'base64').toString());
      domainPrefix = parsed.domainPrefix || '';
    } catch {
      res.redirect(`${frontendCallback}?ls_error=invalid_state`);
      return;
    }

    if (!DOMAIN_PREFIX_RE.test(domainPrefix)) {
      res.redirect(`${frontendCallback}?ls_error=invalid_state`);
      return;
    }

    try {
      const tokenUrl = new URL(
        `https://${domainPrefix}${LIGHTSPEED_TOKEN_HOST_SUFFIX}/api/1.0/token`,
      );
      // Belt-and-braces: the regex above already forbids host-terminating characters, but
      // never send the client secret anywhere outside Lightspeed's domain.
      if (tokenUrl.hostname !== `${domainPrefix.toLowerCase()}${LIGHTSPEED_TOKEN_HOST_SUFFIX}`) {
        res.redirect(`${frontendCallback}?ls_error=invalid_state`);
        return;
      }
      const body = new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
      });

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        res.redirect(
          `${frontendCallback}?ls_error=${encodeURIComponent(`Token exchange failed: ${tokenRes.status} ${text.slice(0, 200)}`)}`,
        );
        return;
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires?: number;
        expires_in?: number;
        domain_prefix?: string;
      };

      const sessionId = randomUUID();
      const sessionData = JSON.stringify({
        domainPrefix,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });

      await this.redis.set(`${LS_SESSION_PREFIX}${sessionId}`, sessionData, LS_SESSION_TTL);

      res.redirect(`${frontendCallback}?ls_session=${sessionId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Token exchange failed';
      res.redirect(`${frontendCallback}?ls_error=${encodeURIComponent(msg)}`);
    }
  }

  /** One-time retrieval of OAuth tokens stored during the callback redirect. */
  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Retrieve Lightspeed OAuth tokens by session ID (one-time use)' })
  async getSession(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    domainPrefix: string;
    accessToken: string;
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }> {
    const key = `${LS_SESSION_PREFIX}${sessionId}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new NotFoundException('Session expired or already consumed');
    }

    await this.redis.del(key);

    return JSON.parse(raw);
  }
}
