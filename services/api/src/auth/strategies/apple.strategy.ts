import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { verifyAppleIdToken } from '../utils/apple-id-token';
import { decodeOAuthInvite } from '../oauth-state.util';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID'),
      teamID: configService.get<string>('APPLE_TEAM_ID'),
      keyID: configService.get<string>('APPLE_KEY_ID'),
      privateKeyLocation: configService.get<string>('APPLE_PRIVATE_KEY_PATH'),
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL') || '/api/auth/apple/callback',
      scope: ['name', 'email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    if (!clientId) {
      return done(new UnauthorizedException('Apple OAuth is not configured'), false);
    }

    try {
      const decoded = await verifyAppleIdToken(idToken, clientId);
      const rawState =
        typeof req?.query?.state === 'string'
          ? req.query.state
          : typeof req?.body?.state === 'string'
            ? req.body.state
            : undefined;
      const inviteFromState = decodeOAuthInvite(rawState);
      const user = {
        provider: 'apple' as const,
        providerId: String(decoded.sub),
        email: decoded.email as string | undefined,
        firstName: profile?.name?.firstName,
        lastName: profile?.name?.lastName,
        accessToken,
        refreshToken,
        inviteCode: inviteFromState,
      };

      const result = await this.authService.validateOrCreateOAuthUser(user);
      done(null, result);
    } catch (err: any) {
      done(err instanceof Error ? err : new UnauthorizedException('Invalid Apple id_token'), false);
    }
  }
}
