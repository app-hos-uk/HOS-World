// OAuth methods for AuthService
import { Injectable, ConflictException } from '@nestjs/common';
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

@Injectable()
export class AuthOAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Validate or create user from OAuth provider
   */
  async validateOrCreateOAuthUser(oauthData: OAuthUserData): Promise<AuthResponse> {
    // Check if OAuth account already exists
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
      // Update access token if provided
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

      // Generate tokens for existing user
      const tokens = await this.generateTokens(existingOAuth.user);
      return {
        user: this.mapToUser(existingOAuth.user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: oauthData.email },
    });

    let user;
    if (existingUser) {
      // Link OAuth account to existing user
      await this.prisma.oAuthAccount.create({
        data: {
          provider: oauthData.provider,
          providerId: oauthData.providerId,
          userId: existingUser.id,
          accessToken: oauthData.accessToken,
          refreshToken: oauthData.refreshToken,
        },
      });
      user = existingUser;
    } else {
      // Create new user with OAuth account
      user = await this.prisma.user.create({
        data: {
          email: oauthData.email,
          firstName: oauthData.firstName,
          lastName: oauthData.lastName,
          avatar: oauthData.avatar,
          password: '', // OAuth users don't have passwords
          role: 'CUSTOMER',
          oAuthAccounts: {
            create: {
              provider: oauthData.provider,
              providerId: oauthData.providerId,
              accessToken: oauthData.accessToken,
              refreshToken: oauthData.refreshToken,
            },
          },
          customer: {
            create: {},
          },
        },
      });
    }

    const tokens = await this.generateTokens(user);
    return {
      user: this.mapToUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Unlink OAuth account from user
   */
  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        oAuthAccounts: true,
      },
    });

    if (!user) {
      throw new ConflictException('User not found');
    }

    // Don't allow unlinking if it's the only authentication method
    const hasPassword = user.password && user.password.length > 0;
    const oauthCount = user.oAuthAccounts.length;

    if (!hasPassword && oauthCount === 1) {
      throw new ConflictException('Cannot unlink the only authentication method');
    }

    await this.prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider: provider as any,
      },
    });
  }

  /**
   * Get linked OAuth accounts for user
   */
  async getLinkedAccounts(userId: string) {
    return this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerId: true,
        createdAt: true,
      },
    });
  }

  private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }

  private mapToUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      phone: user.phone || undefined,
      role: user.role,
      avatar: user.avatar || undefined,
      loyaltyPoints: user.loyaltyPoints || 0,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

