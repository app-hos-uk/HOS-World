// OAuth methods for AuthService
import { Injectable, ConflictException, NotImplementedException } from '@nestjs/common';
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
    // OAuthAccount model not in schema - feature disabled
    throw new NotImplementedException('OAuth authentication is not available. OAuthAccount model is not in the database schema.');
    
    // Check if OAuth account already exists
    /* const existingOAuth = await this.prisma.oAuthAccount.findUnique({
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
              accessToken: oauthData.accessToken || null,
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
    */ // End of commented OAuth code
  }

  /**
   * Unlink OAuth account from user
   */
  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    throw new NotImplementedException('OAuth authentication is not available. OAuthAccount model is not in the database schema.');
  }

  /**
   * Get linked OAuth accounts for user
   */
  async getLinkedAccounts(userId: string) {
    throw new NotImplementedException('OAuth authentication is not available. OAuthAccount model is not in the database schema.');
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
    // Map to User type (loyaltyPoints is only on Customer, not base User)
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      phone: user.phone || undefined,
      role: user.role,
      avatar: user.avatar || undefined,
      createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt : new Date(user.updatedAt),
    };
  }
}

