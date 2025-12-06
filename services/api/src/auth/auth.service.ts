import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { slugify } from '@hos-marketplace/utils';
import type { User, AuthResponse } from '@hos-marketplace/shared-types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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
    const currencyPreference = this.getCurrencyForCountry(countryCode) || 'GBP';

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
        preferredCommunicationMethod: registerDto.preferredCommunicationMethod as any,
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
          country: registerDto.country,
          timezone: 'UTC',
          sellerType: sellerType || registerDto.sellerType || 'B2C_SELLER',
          logisticsOption: registerDto.logisticsOption || 'HOS_LOGISTICS',
        },
      });
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
    const currencyPreference = this.getCurrencyForCountry(countryCode) || 'GBP';

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
        preferredCommunicationMethod: registerDto.preferredCommunicationMethod as any,
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
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    // Generate tokens
    const tokens = await this.generateTokens(userWithoutPassword);

    return {
      user: userWithoutPassword as User,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
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

    return {
      accessToken,
      refreshToken,
    };
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }

  async selectCharacter(userId: string, characterId: string, favoriteFandoms?: string[]): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        characterAvatar: characterId,
        favoriteFandoms: favoriteFandoms || [],
      },
    });
  }

  async completeFandomQuiz(userId: string, quizData: { favoriteFandoms: string[]; interests: string[] }): Promise<any> {
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
    const oauthService = new AuthOAuthService(
      this.prisma,
      this.jwtService,
      this.configService,
    );
    return oauthService.validateOrCreateOAuthUser(oauthData);
  }

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
}
