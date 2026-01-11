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
    'USA': 'US',
    'Canada': 'CA',
    'Australia': 'AU',
    'Germany': 'DE',
    'France': 'FR',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Austria': 'AT',
    'Portugal': 'PT',
    'Ireland': 'IE',
    'Greece': 'GR',
    'Finland': 'FI',
    'United Arab Emirates': 'AE',
    'UAE': 'AE',
    'Saudi Arabia': 'SA',
    'Kuwait': 'KW',
    'Qatar': 'QA',
    'Bahrain': 'BH',
    'Oman': 'OM',
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
        console.error('═══════════════════════════════════════════════════════════');
        console.error('⚠️  WARNING: RefreshToken model not available in Prisma client!');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Auth methods will skip refresh token storage.');
        console.error('This may cause issues with token refresh functionality.');
        console.error('Solution: Regenerate Prisma client with: pnpm db:generate');
        console.error('═══════════════════════════════════════════════════════════');
      } else {
        console.log('[AUTH] ✅ RefreshToken model available');
      }
    } catch (error: any) {
      console.error('[AUTH] Error checking RefreshToken availability:', error?.message);
      this.refreshTokenAvailable = false;
      this.refreshTokenChecked = true;
    }
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
          country: registerDto.country,
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:428',message:'Login entry',data:{email:loginDto.email,hasEmail:!!loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:430',message:'Before user query',data:{email:loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:442',message:'After user query',data:{userFound:!!user,hasPassword:!!user?.password},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (!user) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:444',message:'User not found',data:{email:loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      if (!user.password) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:449',message:'No password (OAuth user)',data:{email:loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        throw new UnauthorizedException('Invalid credentials. This account uses OAuth login.');
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:452',message:'Before password compare',data:{email:loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:453',message:'After password compare',data:{isValid:isPasswordValid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (!isPasswordValid) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:454',message:'Invalid password',data:{email:loginDto.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        throw new UnauthorizedException('Invalid credentials');
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Generate tokens
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:461',message:'Before generateTokens',data:{userId:userWithoutPassword.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const tokens = await this.generateTokens(userWithoutPassword);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:462',message:'After generateTokens',data:{hasAccessToken:!!tokens.accessToken,hasRefreshToken:!!tokens.refreshToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:463',message:'Login success',data:{userId:userWithoutPassword.id,email:userWithoutPassword.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return {
        user: userWithoutPassword as User,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:468',message:'Login error',data:{errorMessage:error?.message,errorName:error?.name,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:522',message:'generateTokens entry',data:{userId:user?.id,hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissionRoleId: user.permissionRoleId,
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:528',message:'Before JWT sign',data:{hasUserId:!!payload.sub,hasEmail:!!payload.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // Shorten access token TTL to 15 minutes for better security
      const accessTokenTTL = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: accessTokenTTL,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:533',message:'After access token sign',data:{hasAccessToken:!!accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // Generate refresh token
      const refreshTokenTTL = '30d';
      const refreshToken = this.jwtService.sign(payload, {
        expiresIn: refreshTokenTTL,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:550',message:'After refresh token sign',data:{hasRefreshToken:!!refreshToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // Hash and store refresh token in DB
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:556',message:'Before token storage',data:{refreshTokenAvailable:this.refreshTokenAvailable},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
      
      // Defensive check: ensure RefreshToken model exists
      if (!this.refreshTokenAvailable) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:562',message:'RefreshToken model not available',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:571',message:'RefreshToken model not found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.warn('[AUTH] ⚠️ RefreshToken model not found - skipping storage');
        return {
          accessToken,
          refreshToken,
        };
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:578',message:'Before refreshTokenModel.create',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      await refreshTokenModel.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:585',message:'After refreshTokenModel.create',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:589',message:'generateTokens success',data:{hasAccessToken:!!accessToken,hasRefreshToken:!!refreshToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return {
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8743deaa-734d-4185-9f60-b0828f74ef5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.service.ts:595',message:'generateTokens error',data:{errorMessage:error?.message,errorName:error?.name,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
      console.warn('[AUTH] ⚠️ RefreshToken model not available - refresh token functionality disabled');
      throw new UnauthorizedException('Token refresh is currently unavailable. Please log in again.');
    }
    
    const refreshTokenModel = (this.prisma as any).refreshToken;
    if (!refreshTokenModel) {
      console.warn('[AUTH] ⚠️ RefreshToken model not found during refresh');
      throw new UnauthorizedException('Token refresh is currently unavailable. Please log in again.');
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
            console.error('[AUTH] ❌ CRITICAL: Failed to revoke old refresh token:', updateError?.message);
            console.error('[AUTH] Token rotation aborted - old token remains valid');
            // Fail the refresh to prevent token replay attacks
            throw new UnauthorizedException('Token refresh failed - unable to revoke previous token. Please log in again.');
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
        characterAvatarId: characterId,
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
      throw new ConflictException('Cannot unlink the only authentication method. Please set a password first.');
    }

    // Find the specific OAuth account to unlink
    const accountToUnlink = oauthAccounts.find(
      (account) => account.provider === provider,
    );

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
