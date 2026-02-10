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
import { EventBusService, AUTH_EVENTS } from '@hos-marketplace/events';
import { AuthPrismaService } from '../database/prisma.service';
import { GeolocationService } from '../geolocation/geolocation.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly countryCodeMap: Record<string, string> = {
    'United Kingdom': 'GB', 'United States': 'US', USA: 'US',
    Canada: 'CA', Australia: 'AU', Germany: 'DE', France: 'FR',
    Italy: 'IT', Spain: 'ES', Netherlands: 'NL', Belgium: 'BE',
    Austria: 'AT', Portugal: 'PT', Ireland: 'IE', Greece: 'GR', Finland: 'FI',
    'United Arab Emirates': 'AE', UAE: 'AE', 'Saudi Arabia': 'SA',
    Kuwait: 'KW', Qatar: 'QA', Bahrain: 'BH', Oman: 'OM',
  };

  constructor(
    private prisma: AuthPrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private geolocationService: GeolocationService,
    private eventBus: EventBusService,
  ) {}

  private getCountryCode(country: string | undefined): string {
    if (!country) return 'GB';
    if (this.countryCodeMap[country]) return this.countryCodeMap[country];
    const countryLower = country.toLowerCase();
    for (const [name, code] of Object.entries(this.countryCodeMap)) {
      if (name.toLowerCase() === countryLower) return code;
    }
    return 'GB';
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  async register(registerDto: RegisterDto, ipAddress?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const sellerRoles = ['seller', 'wholesaler', 'b2c_seller'];
    if (sellerRoles.includes(registerDto.role) && !registerDto.storeName) {
      throw new BadRequestException('Store name is required for seller registration');
    }

    let userRole: string;
    let sellerType: 'WHOLESALER' | 'B2C_SELLER' | undefined;

    if (registerDto.role === 'wholesaler') {
      userRole = 'WHOLESALER';
      sellerType = 'WHOLESALER';
    } else if (registerDto.role === 'b2c_seller') {
      userRole = 'B2C_SELLER';
      sellerType = 'B2C_SELLER';
    } else if (registerDto.role === 'seller') {
      userRole = 'SELLER';
      sellerType = registerDto.sellerType || 'B2C_SELLER';
    } else {
      userRole = registerDto.role.toUpperCase();
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const countryCode = this.getCountryCode(registerDto.country);
    const currencyPreference = this.geolocationService.getCurrencyForCountry(countryCode) || 'GBP';

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
        id: true, email: true, firstName: true, lastName: true,
        role: true, avatar: true, createdAt: true, updatedAt: true,
      },
    });

    // Create GDPR consent log (best-effort)
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
      } catch {
        // Swallow - registration should succeed even if logging fails
      }
    }

    // Create customer or seller profile
    if (registerDto.role === 'customer') {
      await this.prisma.customer.create({
        data: { userId: user.id, country: registerDto.country, currencyPreference },
      });
    } else if (sellerRoles.includes(registerDto.role)) {
      const baseSlug = this.slugify(registerDto.storeName!);
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
          country: registerDto.country ?? 'GB',
          timezone: 'UTC',
          sellerType: sellerType || 'B2C_SELLER',
          logisticsOption: registerDto.logisticsOption || 'HOS_LOGISTICS',
        },
      });
    }

    // Create tenant membership
    try {
      let platformTenant = await this.prisma.tenant.findUnique({ where: { id: 'platform' } });
      if (!platformTenant) {
        platformTenant = await this.prisma.tenant.create({
          data: { id: 'platform', name: 'Platform', subdomain: 'platform', isActive: true },
        });
      }
      await this.prisma.tenantUser.create({
        data: { tenantId: platformTenant.id, userId: user.id, role: userRole, isActive: true },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { defaultTenantId: platformTenant.id },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to create tenant membership for user ${user.id}: ${error?.message}`);
    }

    const tokens = await this.generateTokens(user);

    // Emit auth.user.registered event
    try {
      this.eventBus.emit(AUTH_EVENTS.USER_REGISTERED, {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit user.registered event: ${e?.message}`);
    }

    return { user, token: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true, email: true, password: true, firstName: true,
        lastName: true, role: true, avatar: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials. This account uses OAuth login.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const { password, ...userWithoutPassword } = user;
    const tokens = await this.generateTokens(userWithoutPassword);

    // Emit auth.user.logged_in event
    try {
      this.eventBus.emit(AUTH_EVENTS.USER_LOGGED_IN, {
        userId: userWithoutPassword.id,
        email: userWithoutPassword.email,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit user.logged_in event: ${e?.message}`);
    }

    return { user: userWithoutPassword, token: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.password && (await bcrypt.compare(password, user.password))) {
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
      permissionRoleId: user.permissionRoleId,
    };

    const accessTokenTTL = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const accessToken = this.jwtService.sign(payload, { expiresIn: accessTokenTTL });

    const refreshTokenTTL = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
    const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshTokenTTL });

    // Store refresh token in DB with expiry matching the JWT TTL
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    const ttlMs = this.parseTTLtoMs(refreshTokenTTL);
    expiresAt.setTime(expiresAt.getTime() + ttlMs);

    try {
      await this.prisma.refreshToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to store refresh token: ${error?.message}`);
    }

    return { accessToken, refreshToken };
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch {
      return null;
    }
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Invalid or expired token');

    const payload = await this.validateToken(refreshToken);
    if (!payload?.sub) throw new UnauthorizedException('Invalid or expired token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { permissionRole: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const refreshTokens = await this.prisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    let tokenFound = false;
    for (const storedToken of refreshTokens) {
      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (isValid) {
        tokenFound = true;
        try {
          await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revokedAt: new Date() },
          });
        } catch (updateError: any) {
          this.logger.error(`Failed to revoke old refresh token: ${updateError?.message}`);
          throw new UnauthorizedException('Token refresh failed. Please log in again.');
        }
        break;
      }
    }

    if (!tokenFound) throw new UnauthorizedException('Invalid or expired refresh token');

    const { password, ...userWithoutPassword } = user as any;
    const tokens = await this.generateTokens(userWithoutPassword);

    return { user: userWithoutPassword, token: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async selectCharacter(userId: string, characterId: string, favoriteFandoms?: string[]): Promise<void> {
    const character = await this.prisma.character.findUnique({ where: { id: characterId } });
    if (!character) throw new NotFoundException('Character not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { characterAvatarId: characterId, favoriteFandoms: favoriteFandoms || [] },
    });
  }

  async completeFandomQuiz(userId: string, quizData: { favoriteFandoms: string[]; interests: string[] }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        favoriteFandoms: quizData.favoriteFandoms,
        aiPreferences: { interests: quizData.interests, favoriteFandoms: quizData.favoriteFandoms, quizCompleted: true },
      },
    });

    const explorerBadge = await this.prisma.badge.findUnique({ where: { name: 'Explorer' } });
    if (explorerBadge) {
      try {
        await this.prisma.userBadge.create({ data: { userId, badgeId: explorerBadge.id } });
      } catch {
        // Badge may already exist
      }
    }

    return { favoriteFandoms: quizData.favoriteFandoms, interests: quizData.interests };
  }

  // OAuth account methods
  async getLinkedAccounts(userId: string) {
    return this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: { id: true, provider: true, providerId: true, createdAt: true },
    });
  }

  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oAuthAccounts: true },
    });

    if (!user) throw new ConflictException('User not found');

    const hasPassword = user.password && user.password.length > 0;
    const oauthCount = user.oAuthAccounts?.length || 0;

    if (!hasPassword && oauthCount === 1) {
      throw new ConflictException('Cannot unlink the only authentication method.');
    }

    const accountToUnlink = user.oAuthAccounts?.find((a) => a.provider === provider);
    if (!accountToUnlink) throw new ConflictException(`No ${provider} account linked`);

    await this.prisma.oAuthAccount.delete({ where: { id: accountToUnlink.id } });
    this.logger.log(`OAuth account unlinked: ${provider} for user ${userId}`);
  }

  /**
   * Parse a TTL string like '30d', '7d', '24h', '15m' into milliseconds.
   * Falls back to 30 days if the format is unrecognised.
   */
  private parseTTLtoMs(ttl: string): number {
    const match = ttl.match(/^(\d+)\s*(d|h|m|s)$/i);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 's': return value * 1000;
      default:  return 30 * 24 * 60 * 60 * 1000;
    }
  }
}
