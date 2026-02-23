import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { GeolocationService } from '../geolocation/geolocation.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { slugify } from '@hos-marketplace/utils';
import type { User, AuthResponse } from '@hos-marketplace/shared-types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private refreshTokenAvailable: boolean = false;
  private refreshTokenChecked: boolean = false;

  // Simple country name to country code mapping
  private readonly countryCodeMap: Record<string, string> = {
    'United Kingdom': 'GB',
    'United States': 'US',
    USA: 'US',
    Canada: 'CA',
    Australia: 'AU',
    Germany: 'DE',
    France: 'FR',
    Italy: 'IT',
    Spain: 'ES',
    Netherlands: 'NL',
    Belgium: 'BE',
    Austria: 'AT',
    Portugal: 'PT',
    Ireland: 'IE',
    Greece: 'GR',
    Finland: 'FI',
    'United Arab Emirates': 'AE',
    UAE: 'AE',
    'Saudi Arabia': 'SA',
    Kuwait: 'KW',
    Qatar: 'QA',
    Bahrain: 'BH',
    Oman: 'OM',
  };

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private geolocationService: GeolocationService,
  ) {
    // Check if RefreshToken model is available on startup
    this.checkRefreshTokenAvailability();
  }

  private checkRefreshTokenAvailability() {
    if (this.refreshTokenChecked) return;
    try {
      this.refreshTokenAvailable = typeof (this.prisma as any).refreshToken !== 'undefined';
      this.refreshTokenChecked = true;
      if (!this.refreshTokenAvailable) {
        this.logger.warn('RefreshToken model not available in Prisma client. Auth methods will skip refresh token storage. Solution: pnpm db:generate');
      } else {
        this.logger.log('RefreshToken model available');
      }
    } catch (error: any) {
      this.logger.error(`Error checking RefreshToken availability: ${error?.message}`);
      this.refreshTokenAvailable = false;
      this.refreshTokenChecked = true;
    }
  }

  /**
   * Parse refresh token TTL string (e.g. '30d', '7d', '14d') to days
   */
  private parseRefreshTokenTTLDays(ttl: string): number {
    const match = ttl.match(/^(\d+)([dh])$/);
    if (!match) return 30;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    return unit === 'd' ? value : Math.ceil(value / 24);
  }

  /**
   * Get country code from country name
   */
  private getCountryCode(country: string | undefined): string {
    if (!country) return 'GB';
    // Try exact match first
    if (this.countryCodeMap[country]) {
      return this.countryCodeMap[country];
    }
    // Try case-insensitive match
    const countryLower = country.toLowerCase();
    for (const [name, code] of Object.entries(this.countryCodeMap)) {
      if (name.toLowerCase() === countryLower) {
        return code;
      }
    }
    // Default to GB if not found
    return 'GB';
  }

  async register(registerDto: RegisterDto, ipAddress?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate seller registration
    const sellerRoles = ['seller', 'wholesaler', 'b2c_seller'];
    if (sellerRoles.includes(registerDto.role) && !registerDto.storeName) {
      throw new BadRequestException('Store name is required for seller registration');
    }

    // Determine user role and seller type
    let userRole: string;
    let sellerType: 'WHOLESALER' | 'B2C_SELLER' | undefined;

    if (registerDto.role === 'wholesaler') {
      userRole = 'WHOLESALER';
      sellerType = 'WHOLESALER';
    } else if (registerDto.role === 'b2c_seller') {
      userRole = 'B2C_SELLER';
      sellerType = 'B2C_SELLER';
    } else if (registerDto.role === 'seller') {
      // Legacy seller role - use sellerType from DTO or default to B2C_SELLER
      userRole = 'SELLER';
      sellerType = registerDto.sellerType || 'B2C_SELLER';
    } else {
      userRole = registerDto.role.toUpperCase();
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Determine currency preference based on country
    const countryCode = this.getCountryCode(registerDto.country);
    const currencyPreference = this.geolocationService.getCurrencyForCountry(countryCode) || 'GBP';

    // Create user with global platform fields
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: userRole as any,
        country: registerDto.country,
        whatsappNumber: registerDto.whatsappNumber,
        preferredCommunicationMethod: registerDto.preferredCommunicationMethod,
        currencyPreference,
        gdprConsent: registerDto.gdprConsent,
        gdprConsentDate: registerDto.gdprConsent ? new Date() : null,
        dataProcessingConsent: registerDto.dataProcessingConsent || {},
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create GDPR consent log (best-effort)
    // If the prod DB hasn't been migrated yet (missing gdpr_consent_logs table/columns),
    // we should not fail registration — the account creation is higher priority.
    if (registerDto.gdprConsent) {
      try {
        const consentTypes = registerDto.dataProcessingConsent || {};
        for (const [consentType, granted] of Object.entries(consentTypes)) {
          if (granted) {
            await this.prisma.gDPRConsentLog.create({
              data: {
                userId: user.id,
                consentType: consentType.toUpperCase(),
                granted: true,
                grantedAt: new Date(),
                ipAddress,
              },
            });
          }
        }
      } catch (e) {
        // Swallow and continue – registration should succeed even if logging fails.
      }
    }

    // Create customer or seller profile
    if (registerDto.role === 'customer') {
      await this.prisma.customer.create({
        data: {
          userId: user.id,
          country: registerDto.country,
          currencyPreference,
        },
      });
    } else if (sellerRoles.includes(registerDto.role)) {
      // Generate unique slug for seller
      const baseSlug = slugify(registerDto.storeName!);
      let slug = baseSlug;
      let counter = 1;

      while (await this.prisma.seller.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      await this.prisma.seller.create({
        data: {
          userId: user.id,
          storeName: registerDto.storeName!,
          slug,
          country: registerDto.country ?? (user as { country?: string }).country ?? 'GB',
          timezone: 'UTC',
          sellerType: sellerType || registerDto.sellerType || 'B2C_SELLER',
          logisticsOption: registerDto.logisticsOption || 'HOS_LOGISTICS',
        },
      });
    }

    // Create tenant membership for new user (default to platform tenant)
    try {
      // Get or create platform tenant
      let platformTenant = await this.prisma.tenant.findUnique({
        where: { id: 'platform' },
      });

      if (!platformTenant) {
        platformTenant = await this.prisma.tenant.create({
          data: {
            id: 'platform',
            name: 'Platform',
            subdomain: 'platform',
            isActive: true,
          },
        });
      }

      // Create tenant membership
      await this.prisma.tenantUser.create({
        data: {
          tenantId: platformTenant.id,
          userId: user.id,
          role: userRole, // Use the user's role as tenant role
          isActive: true,
        },
      });

      // Set default tenant for user
      await this.prisma.user.update({
        where: { id: user.id },
        data: { defaultTenantId: platformTenant.id },
      });
    } catch (error: any) {
      // Log error but don't fail registration if tenant system isn't fully set up
      this.logger.warn(`Failed to create tenant membership for user ${user.id}: ${error?.message}`);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: user as User,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async acceptInvitation(
    token: string,
    registerDto: RegisterDto,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    // Get invitation
    const invitation = await this.prisma.sellerInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.sellerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    // Verify email matches
    if (invitation.email !== registerDto.email) {
      throw new BadRequestException('Email does not match invitation');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate seller registration
    if (!registerDto.storeName) {
      throw new BadRequestException('Store name is required for seller registration');
    }

    // Determine user role based on seller type
    let userRole: string;
    if (invitation.sellerType === 'WHOLESALER') {
      userRole = 'WHOLESALER';
    } else {
      userRole = 'B2C_SELLER';
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Determine currency preference based on country
    const countryCode = this.getCountryCode(registerDto.country);
    const currencyPreference = this.geolocationService.getCurrencyForCountry(countryCode) || 'GBP';

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: userRole as any,
        country: registerDto.country,
        whatsappNumber: registerDto.whatsappNumber,
        preferredCommunicationMethod: registerDto.preferredCommunicationMethod,
        currencyPreference,
        gdprConsent: registerDto.gdprConsent,
        gdprConsentDate: registerDto.gdprConsent ? new Date() : null,
        dataProcessingConsent: registerDto.dataProcessingConsent || {},
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create GDPR consent log
    if (registerDto.gdprConsent) {
      const consentTypes = registerDto.dataProcessingConsent || {};
      for (const [consentType, granted] of Object.entries(consentTypes)) {
        if (granted) {
          await this.prisma.gDPRConsentLog.create({
            data: {
              userId: user.id,
              consentType: consentType.toUpperCase(),
              granted: true,
              grantedAt: new Date(),
            },
          });
        }
      }
    }

    // Generate unique slug for seller
    const baseSlug = slugify(registerDto.storeName);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.seller.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create seller profile
    await this.prisma.seller.create({
      data: {
        userId: user.id,
        storeName: registerDto.storeName,
        slug,
        country: registerDto.country,
        timezone: 'UTC',
        sellerType: invitation.sellerType,
        logisticsOption: registerDto.logisticsOption || 'HOS_LOGISTICS',
      },
    });

    // Mark invitation as accepted
    await this.prisma.sellerInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: user as User,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: loginDto.email },
        select: {
          id: true,
          email: true,
          password: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMs = user.lockedUntil.getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        throw new UnauthorizedException(
          `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`,
        );
      }

      // Verify password
      if (!user.password) {
        throw new UnauthorizedException('Invalid credentials. This account uses OAuth login.');
      }
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      if (!isPasswordValid) {
        const newFailedAttempts = user.failedLoginAttempts + 1;
        const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
          failedLoginAttempts: newFailedAttempts,
        };

        if (newFailedAttempts >= 5) {
          updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }

        await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user account is active
      if (user.isActive === false) {
        throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
      }

      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
      }

      // Remove password and lockout fields from response
      const { password, failedLoginAttempts, lockedUntil, ...userWithoutPassword } = user;

      // Generate tokens
      const tokens = await this.generateTokens(userWithoutPassword);

      return {
        user: userWithoutPassword as User,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error: any) {
      throw error;
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissionRoleId: user.permissionRoleId,
      };

      // Shorten access token TTL to 15 minutes for better security
      const accessTokenTTL = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: accessTokenTTL,
      });

      // Generate refresh token
      const refreshTokenTTL = this.configService.get<string>('REFRESH_TOKEN_TTL') || '30d';
      const refreshToken = this.jwtService.sign(payload, {
        expiresIn: refreshTokenTTL,
      });

      // Hash and store refresh token in DB
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date();
      const ttlDays = this.parseRefreshTokenTTLDays(refreshTokenTTL);
      expiresAt.setDate(expiresAt.getDate() + ttlDays);

      // Defensive check: ensure RefreshToken model exists
      if (!this.refreshTokenAvailable) {
        console.warn('[AUTH] ⚠️ RefreshToken model not available - skipping token storage');
        console.warn('[AUTH] Token will be generated but not stored in database');
        // Continue without storing refresh token - this allows the service to start
        // but refresh functionality won't work until Prisma client is regenerated
        return {
          accessToken,
          refreshToken,
        };
      }

      const refreshTokenModel = (this.prisma as any).refreshToken;
      if (!refreshTokenModel) {
        console.warn('[AUTH] ⚠️ RefreshToken model not found - skipping storage');
        return {
          accessToken,
          refreshToken,
        };
      }

      // Enforce max 5 concurrent sessions per user
      const MAX_SESSIONS = 5;
      const activeTokens = await refreshTokenModel.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (activeTokens.length >= MAX_SESSIONS) {
        const tokensToRevoke = activeTokens.slice(0, activeTokens.length - MAX_SESSIONS + 1);
        await refreshTokenModel.updateMany({
          where: { id: { in: tokensToRevoke.map((t: { id: string }) => t.id) } },
          data: { revokedAt: new Date() },
        });
      }

      await refreshTokenModel.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      return {
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      throw error;
    }
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Validate JWT structure first
    const payload = await this.validateToken(refreshToken);
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { permissionRole: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Find and verify refresh token in DB
    if (!this.refreshTokenAvailable) {
      console.warn(
        '[AUTH] ⚠️ RefreshToken model not available - refresh token functionality disabled',
      );
      throw new UnauthorizedException(
        'Token refresh is currently unavailable. Please log in again.',
      );
    }

    const refreshTokenModel = (this.prisma as any).refreshToken;
    if (!refreshTokenModel) {
      console.warn('[AUTH] ⚠️ RefreshToken model not found during refresh');
      throw new UnauthorizedException(
        'Token refresh is currently unavailable. Please log in again.',
      );
    }
    const refreshTokens = await refreshTokenModel.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check if provided token matches any stored token
    let tokenFound = false;
    for (const storedToken of refreshTokens) {
      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (isValid) {
        tokenFound = true;
        // Revoke the old token (rotation) - CRITICAL: must succeed before issuing new tokens
        if (this.refreshTokenAvailable && refreshTokenModel) {
          try {
            await refreshTokenModel.update({
              where: { id: storedToken.id },
              data: { revokedAt: new Date() },
            });
          } catch (updateError: any) {
            console.error(
              '[AUTH] ❌ CRITICAL: Failed to revoke old refresh token:',
              updateError?.message,
            );
            console.error('[AUTH] Token rotation aborted - old token remains valid');
            // Fail the refresh to prevent token replay attacks
            throw new UnauthorizedException(
              'Token refresh failed - unable to revoke previous token. Please log in again.',
            );
          }
        }
        break;
      }
    }

    if (!tokenFound) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new tokens (rotation)
    const { password, ...userWithoutPassword } = user as any;
    const tokens = await this.generateTokens(userWithoutPassword);

    return {
      user: userWithoutPassword as User,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Revoke all refresh tokens for a user (logout)
   */
  async revokeAllTokens(userId: string): Promise<void> {
    const refreshTokenModel = (this.prisma as any).refreshToken;
    if (!refreshTokenModel) {
      console.warn('[AUTH] ⚠️ RefreshToken model not found, skipping token revocation');
      return;
    }
    await refreshTokenModel.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Clean up expired refresh tokens (should be called periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    if (!this.refreshTokenAvailable) {
      console.warn('[AUTH] ⚠️ RefreshToken model not available, skipping cleanup');
      return;
    }

    const refreshTokenModel = (this.prisma as any).refreshToken;
    if (!refreshTokenModel) {
      console.warn('[AUTH] ⚠️ RefreshToken model not found, skipping cleanup');
      return;
    }
    await refreshTokenModel.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  async selectCharacter(
    userId: string,
    characterId: string,
    favoriteFandoms?: string[],
  ): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        characterAvatarId: characterId,
        favoriteFandoms: favoriteFandoms || [],
      },
    });
  }

  async completeFandomQuiz(
    userId: string,
    quizData: { favoriteFandoms: string[]; interests: string[] },
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user with quiz results
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        favoriteFandoms: quizData.favoriteFandoms,
        aiPreferences: {
          interests: quizData.interests,
          favoriteFandoms: quizData.favoriteFandoms,
          quizCompleted: true,
        },
      },
    });

    // Award "Explorer" badge for completing quiz
    const explorerBadge = await this.prisma.badge.findUnique({
      where: { name: 'Explorer' },
    });

    if (explorerBadge) {
      await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId: explorerBadge.id,
        },
      });
    }

    return {
      favoriteFandoms: quizData.favoriteFandoms,
      interests: quizData.interests,
    };
  }

  // OAuth methods (delegate to OAuth service)
  async validateOrCreateOAuthUser(oauthData: any): Promise<any> {
    // Import OAuth service dynamically to avoid circular dependency
    const { AuthOAuthService } = await import('./auth.service.oauth');
    const oauthService = new AuthOAuthService(this.prisma, this.jwtService, this.configService);
    return oauthService.validateOrCreateOAuthUser(oauthData);
  }

  // OAuth account methods
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

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: resetExpiry,
      } as any,
    });

    this.logger.log(`Password reset requested for ${email}`);
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      } as any,
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      } as any,
    });

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new BadRequestException('Cannot change password for this account');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    // Get user with OAuth accounts
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        oAuthAccounts: true,
      },
    });

    if (!user) {
      throw new ConflictException('User not found');
    }

    // Validate that user has at least one authentication method remaining
    const hasPassword = user.password && user.password.length > 0;
    const oauthAccounts = user.oAuthAccounts || [];
    const oauthCount = oauthAccounts.length;

    // Prevent unlinking if it's the only authentication method
    if (!hasPassword && oauthCount === 1) {
      throw new ConflictException(
        'Cannot unlink the only authentication method. Please set a password first.',
      );
    }

    // Find the specific OAuth account to unlink
    const accountToUnlink = oauthAccounts.find((account) => account.provider === provider);

    if (!accountToUnlink) {
      throw new ConflictException(`No ${provider} account linked to this user`);
    }

    // Delete the OAuth account
    await this.prisma.oAuthAccount.delete({
      where: {
        id: accountToUnlink.id,
      },
    });

    this.logger.log(`OAuth account unlinked: ${provider} for user ${userId}`);
  }
}
