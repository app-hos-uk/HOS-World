// OAuth methods for AuthService
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AuthResponse, User } from '@hos-marketplace/shared-types';

interface OAuthUserData {
  provider: 'google' | 'facebook' | 'apple';
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}

export type OAuthTokenGenerator = (user: {
  id: string;
  email: string;
  role: string;
  permissionRoleId?: string | null;
}) => Promise<{ accessToken: string; refreshToken: string }>;

@Injectable()
export class AuthOAuthService {
  constructor(
    private prisma: PrismaService,
    private _jwtService: JwtService,
    private _configService: ConfigService,
    private generateTokensForUser: OAuthTokenGenerator,
  ) {}

  /**
   * Validate or create user from OAuth provider
   */
  async validateOrCreateOAuthUser(oauthData: OAuthUserData): Promise<AuthResponse> {
    const email = oauthData.email?.toLowerCase().trim();
    if (!email) {
      throw new BadRequestException(
        'OAuth provider did not return an email. Grant email permission or use a provider that supplies email.',
      );
    }

    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: oauthData.provider,
          providerId: oauthData.providerId,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      if (oauthData.accessToken) {
        await this.prisma.oAuthAccount.update({
          where: { id: existingOAuth.id },
          data: {
            accessToken: oauthData.accessToken,
            refreshToken: oauthData.refreshToken,
            updatedAt: new Date(),
          },
        });
      }

      const tokens = await this.generateTokensForUser(existingOAuth.user);
      return {
        user: this.mapToUser(existingOAuth.user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    let user;
    if (existingUser) {
      await this.prisma.oAuthAccount.create({
        data: {
          provider: oauthData.provider,
          providerId: oauthData.providerId,
          userId: existingUser.id,
          accessToken: oauthData.accessToken,
          refreshToken: oauthData.refreshToken,
        },
      });
      user = await this.prisma.user.findUnique({ where: { id: existingUser.id } });
      if (!user) {
        throw new BadRequestException('Failed to load user after OAuth link');
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          firstName: oauthData.firstName,
          lastName: oauthData.lastName,
          avatar: oauthData.avatar,
          password: null,
          role: 'CUSTOMER',
          oAuthAccounts: {
            create: {
              provider: oauthData.provider,
              providerId: oauthData.providerId,
              accessToken: oauthData.accessToken || null,
              refreshToken: oauthData.refreshToken,
            },
          },
          customerProfile: {
            create: {
              currencyPreference: 'USD',
            },
          },
        },
      });
    }

    const tokens = await this.generateTokensForUser(user);
    return {
      user: this.mapToUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private mapToUser(user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    role: string;
    avatar?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      phone: user.phone || undefined,
      role: user.role as User['role'],
      avatar: user.avatar || undefined,
      createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt : new Date(user.updatedAt),
    };
  }
}
