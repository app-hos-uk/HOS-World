import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

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
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // Apple sends user info in idToken JWT
    // Decode and extract user information
    const decoded = this.decodeIdToken(idToken);
    
    const user = {
      provider: 'apple',
      providerId: decoded.sub,
      email: decoded.email,
      firstName: profile?.name?.firstName,
      lastName: profile?.name?.lastName,
      accessToken,
      refreshToken,
    };

    const result = await this.authService.validateOrCreateOAuthUser(user);
    done(null, result);
  }

  private decodeIdToken(idToken: string): any {
    // Simple base64 decode (in production, verify JWT signature)
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString()
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  }
}

