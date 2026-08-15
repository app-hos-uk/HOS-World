import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';

/**
 * Handles the Lightspeed Retail (X-Series) OAuth authorization-code flow.
 *
 * Flow:
 *  1. Frontend builds the Lightspeed authorize URL using NEXT_PUBLIC_LIGHTSPEED_CLIENT_ID
 *     and redirects the admin there.
 *  2. Lightspeed redirects back to GET /api/pos/lightspeed/callback with ?code=…&state=…
 *  3. This controller exchanges the code for tokens and redirects the admin back to
 *     the store creation form with tokens in the URL fragment.
 */

/**
 * A Lightspeed tenant prefix is a single DNS label. This must stay strict: the callback is
 * @Public() and the token-exchange body carries LIGHTSPEED_CLIENT_SECRET, so any character
 * that can terminate the host (`/`, `?`, `#`, `@`, `:`) would let a crafted `state` redirect
 * that secret to an attacker-controlled server.
 */
const DOMAIN_PREFIX_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const LIGHTSPEED_TOKEN_HOST_SUFFIX = '.retail.lightspeed.app';

@ApiTags('lightspeed-oauth')
@Controller('pos/lightspeed')
export class LightspeedOAuthController {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly frontendUrl: string;

  constructor(private config: ConfigService) {
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

      const fragment = new URLSearchParams({
        ls_domain: domainPrefix,
        ls_access_token: tokens.access_token,
        ls_refresh_token: tokens.refresh_token || '',
      });

      res.redirect(`${frontendCallback}#${fragment.toString()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Token exchange failed';
      res.redirect(`${frontendCallback}?ls_error=${encodeURIComponent(msg)}`);
    }
  }
}
