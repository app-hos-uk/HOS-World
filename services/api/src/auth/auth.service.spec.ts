import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { GeolocationService } from '../geolocation/geolocation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TemplatesService } from '../templates/templates.service';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { RegisterDto, RegisterRole } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let geolocationService: GeolocationService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
    seller: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn(),
    },
    oAuthAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    gDPRConsentLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    tenantMembership: {
      create: jest.fn().mockResolvedValue({}),
    },
    tenantUser: {
      create: jest.fn().mockResolvedValue({}),
    },
    tenant: {
      findFirst: jest.fn().mockResolvedValue({ id: 'platform' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'platform' }),
      create: jest.fn().mockResolvedValue({ id: 'platform', name: 'Platform', subdomain: 'platform', isActive: true }),
    },
    sellerInvitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    character: {
      findUnique: jest.fn(),
    },
    badge: {
      findUnique: jest.fn(),
    },
    userBadge: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-key-minimum-32-characters-long';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret-key-minimum-32-characters-long';
      if (key === 'JWT_EXPIRES_IN') return '1h';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return undefined;
    }),
  };

  const mockGeolocationService = {
    detectCountryFromIP: jest.fn(),
    getCurrencyForCountry: jest.fn(),
  };

  const mockNotificationsService = {
    sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
    sendNotificationToRole: jest.fn().mockResolvedValue(undefined),
  };

  const mockTemplatesService = {
    render: jest.fn().mockResolvedValue({ subject: 'Test', body: '<p>Test</p>' }),
  };

  const mockCartService = {
    mergeGuestCart: jest.fn().mockResolvedValue(undefined),
  };

  const mockAddressesService = {
    create: jest.fn().mockResolvedValue({ id: 'addr-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: GeolocationService,
          useValue: mockGeolocationService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
        {
          provide: CartService,
          useValue: mockCartService,
        },
        {
          provide: AddressesService,
          useValue: mockAddressesService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    geolocationService = module.get<GeolocationService>(GeolocationService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'User',
      role: RegisterRole.CUSTOMER,
      country: 'US',
      preferredCommunicationMethod: 'EMAIL' as any,
      gdprConsent: true,
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const mockUser = {
        id: 'user-id',
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'CUSTOMER',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('access-token');
      mockGeolocationService.getCurrencyForCountry.mockReturnValue('USD');
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REGISTRATION_MODE') return 'open';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_EXPIRES_IN') return '15m';
        return defaultValue;
      });

      const result = await service.register(registerDto, '127.0.0.1');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw ConflictException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto, '127.0.0.1')).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Test123!',
    };

    it('should login user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const mockUser = {
        id: 'user-id',
        email: loginDto.email,
        password: hashedPassword,
        role: 'CUSTOMER',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        firstName: 'Test',
        lastName: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');
      mockJwtService.sign.mockReturnValue('access-token');
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_EXPIRES_IN') return '15m';
        return defaultValue;
      });

      const result = await service.login(loginDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        select: expect.any(Object),
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, hashedPassword);
      expect(result).toHaveProperty('token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const mockUser = {
        id: 'user-id',
        email: loginDto.email,
        password: 'hashed-password',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getLinkedAccounts', () => {
    it('should return linked accounts from prisma', async () => {
      const userId = 'user-id';
      mockPrismaService.oAuthAccount.findMany.mockResolvedValue([]);

      const result = await service.getLinkedAccounts(userId);

      expect(mockPrismaService.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: {
          id: true,
          provider: true,
          providerId: true,
          createdAt: true,
        },
      });
      expect(result).toEqual([]);
    });
  });

  describe('unlinkOAuthAccount', () => {
    it('should reject when findUnique throws (e.g. model not available)', async () => {
      const userId = 'user-id';
      const provider = 'google';

      mockPrismaService.user.findUnique.mockRejectedValue(
        new Error('Unknown arg `oAuthAccounts` in include'),
      );

      await expect(service.unlinkOAuthAccount(userId, provider)).rejects.toThrow(
        'Unknown arg `oAuthAccounts` in include',
      );
    });

    it('should throw ConflictException when user not found', async () => {
      const userId = 'user-id';
      const provider = 'google';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.unlinkOAuthAccount(userId, provider)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when it is the only auth method (no password, one OAuth)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        password: null,
        oAuthAccounts: [{ id: 'oa-1', provider: 'google' }],
      });

      await expect(service.unlinkOAuthAccount('user-id', 'google')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when provider is not linked', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        password: 'hashed',
        oAuthAccounts: [{ id: 'oa-1', provider: 'google' }],
      });

      await expect(service.unlinkOAuthAccount('user-id', 'facebook')).rejects.toThrow(ConflictException);
    });

    it('should successfully unlink when user has a password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        password: 'hashed',
        oAuthAccounts: [{ id: 'oa-1', provider: 'google' }],
      });
      mockPrismaService.oAuthAccount.delete.mockResolvedValue({});

      await service.unlinkOAuthAccount('user-id', 'google');

      expect(mockPrismaService.oAuthAccount.delete).toHaveBeenCalledWith({
        where: { id: 'oa-1' },
      });
    });

    it('should successfully unlink when user has multiple OAuth accounts', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        password: null,
        oAuthAccounts: [
          { id: 'oa-1', provider: 'google' },
          { id: 'oa-2', provider: 'facebook' },
        ],
      });
      mockPrismaService.oAuthAccount.delete.mockResolvedValue({});

      await service.unlinkOAuthAccount('user-id', 'google');

      expect(mockPrismaService.oAuthAccount.delete).toHaveBeenCalledWith({
        where: { id: 'oa-1' },
      });
    });
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'CUSTOMER',
        isActive: true,
        firstName: 'Test',
        lastName: 'User',
        avatar: null,
        permissionRoleId: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-id');
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('unknown@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrong-password');

      expect(result).toBeNull();
    });

    it('should return null when user has no password (OAuth only)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: null,
        isActive: true,
      });

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when account is deactivated', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login - additional scenarios', () => {
    it('should throw UnauthorizedException when account is locked', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        failedLoginAttempts: 5,
        lockedUntil: futureDate,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'Test123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is deactivated', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@example.com', password: 'Test123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should increment failed login attempts on wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        failedLoginAttempts: 2,
        lockedUntil: null,
      });
      mockPrismaService.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        }),
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        failedLoginAttempts: 4,
        lockedUntil: null,
      });
      mockPrismaService.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should reset failed login attempts on successful login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        firstName: 'Test',
        lastName: 'User',
        role: 'CUSTOMER',
        isActive: true,
        failedLoginAttempts: 3,
        lockedUntil: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('token');
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_EXPIRES_IN') return '15m';
        return defaultValue;
      });

      await service.login({ email: 'test@example.com', password: 'correct' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    it('should allow login when lock has expired', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        firstName: 'Test',
        lastName: 'User',
        role: 'CUSTOMER',
        isActive: true,
        failedLoginAttempts: 5,
        lockedUntil: pastDate,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('token');
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_EXPIRES_IN') return '15m';
        return defaultValue;
      });

      const result = await service.login({ email: 'test@example.com', password: 'correct' });

      expect(result).toHaveProperty('token');
    });
  });

  describe('register - additional scenarios', () => {
    it('should throw BadRequestException when seller registration lacks storeName', async () => {
      const dto: RegisterDto = {
        email: 'seller@test.com',
        password: 'Test123!',
        firstName: 'Seller',
        lastName: 'User',
        role: RegisterRole.SELLER,
        country: 'US',
        preferredCommunicationMethod: 'EMAIL' as any,
        gdprConsent: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when gdprConsent is false', async () => {
      const dto: RegisterDto = {
        email: 'test@test.com',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'User',
        role: RegisterRole.CUSTOMER,
        country: 'US',
        preferredCommunicationMethod: 'EMAIL' as any,
        gdprConsent: false,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create seller profile for seller role', async () => {
      const dto: RegisterDto = {
        email: 'seller@test.com',
        password: 'Test123!',
        firstName: 'Seller',
        lastName: 'User',
        role: RegisterRole.SELLER,
        storeName: 'My Store',
        country: 'US',
        preferredCommunicationMethod: 'EMAIL' as any,
        gdprConsent: true,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id',
        email: dto.email,
        role: 'SELLER',
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.seller.findUnique.mockResolvedValue(null);
      mockPrismaService.seller.create.mockResolvedValue({});
      mockPrismaService.customer.upsert.mockResolvedValue({});
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('token');
      mockGeolocationService.getCurrencyForCountry.mockReturnValue('USD');
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REGISTRATION_MODE') return 'open';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_EXPIRES_IN') return '15m';
        return defaultValue;
      });

      const result = await service.register(dto);

      expect(mockPrismaService.seller.create).toHaveBeenCalled();
      expect(result).toHaveProperty('token');
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const user = { id: 'user-id', email: 'test@test.com', role: 'CUSTOMER' };

      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return '15m';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        return undefined;
      });
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(user);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should revoke oldest tokens when max sessions exceeded', async () => {
      const user = { id: 'user-id', email: 'test@test.com', role: 'CUSTOMER' };

      mockJwtService.sign.mockReturnValue('token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return '15m';
        if (key === 'REFRESH_TOKEN_TTL') return '30d';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        return undefined;
      });
      mockPrismaService.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1' }, { id: 'rt-2' }, { id: 'rt-3' }, { id: 'rt-4' }, { id: 'rt-5' },
      ]);
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.generateTokens(user);

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.any(Array) } },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('should throw UnauthorizedException when JWT_REFRESH_SECRET is not set', async () => {
      const user = { id: 'user-id', email: 'test@test.com', role: 'CUSTOMER' };

      mockJwtService.sign.mockImplementation(() => { throw new Error('JWT_REFRESH_SECRET must be configured'); });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return undefined;
        return 'value';
      });

      await expect(service.generateTokens(user)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    it('should return decoded payload for valid token', async () => {
      const payload = { sub: 'user-id', email: 'test@test.com' };
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(payload);
    });

    it('should return null for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      const result = await service.validateToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should pass custom secret when provided', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-id' });

      await service.validateToken('token', 'custom-secret');

      expect(mockJwtService.verify).toHaveBeenCalledWith('token', { secret: 'custom-secret' });
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when token is empty', async () => {
      await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'secret';
        return undefined;
      });
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'secret';
        return undefined;
      });
      mockJwtService.verify.mockReturnValue({ sub: 'user-id' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user account is deactivated', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'secret';
        return undefined;
      });
      mockJwtService.verify.mockReturnValue({ sub: 'user-id' });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        isActive: false,
      });

      await expect(service.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all active tokens for a user', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllTokens('user-id');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupExpiredTokens();

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should return generic message when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('unknown@test.com');

      expect(result.message).toContain('If an account with that email exists');
    });

    it('should update user with reset token and send email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
      });
      mockPrismaService.user.update.mockResolvedValue({});
      mockNotificationsService.sendNotificationToUser = jest.fn().mockResolvedValue(undefined);
      (mockNotificationsService as any).queueNotification = jest.fn().mockResolvedValue(undefined);

      const result = await service.requestPasswordReset('test@test.com');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetToken: expect.any(String),
            resetTokenExpiry: expect.any(Date),
          }),
        }),
      );
      expect(result.message).toContain('If an account with that email exists');
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException when password is too short', async () => {
      await expect(service.resetPassword('token', 'short')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when password is empty', async () => {
      await expect(service.resetPassword('token', '')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when token is invalid or expired', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', 'ValidPass123!')).rejects.toThrow(BadRequestException);
    });

    it('should reset password and revoke all tokens on valid token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed');
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resetPassword('valid-token', 'NewPassword123!');

      expect(result.message).toContain('Password has been reset');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'new-hashed',
            resetToken: null,
            resetTokenExpiry: null,
          }),
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestException when new password is too short', async () => {
      await expect(service.changePassword('user-id', 'current', 'short')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('user-id', 'current', 'NewPassword1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user has no password (OAuth only)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', password: null });

      await expect(
        service.changePassword('user-id', 'current', 'NewPassword1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when current password is incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', password: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-id', 'wrong-current', 'NewPassword1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new password equals current password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', password: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword('user-id', 'SamePass123!', 'SamePass123!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should change password and revoke all tokens on success', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', password: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed');
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.changePassword('user-id', 'OldPass123!', 'NewPass123!');

      expect(result.message).toContain('Password changed');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { password: 'new-hashed' },
        }),
      );
    });
  });

  describe('selectCharacter', () => {
    it('should throw NotFoundException when character does not exist', async () => {
      mockPrismaService.character.findUnique.mockResolvedValue(null);

      await expect(service.selectCharacter('user-id', 'char-missing')).rejects.toThrow(NotFoundException);
    });

    it('should update user with character and fandoms', async () => {
      mockPrismaService.character.findUnique.mockResolvedValue({ id: 'char-1', name: 'Wizard' });
      mockPrismaService.user.update.mockResolvedValue({});

      await service.selectCharacter('user-id', 'char-1', ['HP', 'LOTR']);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          characterAvatarId: 'char-1',
          favoriteFandoms: ['HP', 'LOTR'],
        },
      });
    });
  });

  describe('completeFandomQuiz', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.completeFandomQuiz('user-missing', { favoriteFandoms: ['HP'], interests: ['magic'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user with quiz data and award badge', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.badge.findUnique.mockResolvedValue({ id: 'badge-1', name: 'Explorer' });
      mockPrismaService.userBadge.create.mockResolvedValue({});

      const result = await service.completeFandomQuiz('user-id', {
        favoriteFandoms: ['HP', 'SW'],
        interests: ['magic', 'scifi'],
      });

      expect(result.favoriteFandoms).toEqual(['HP', 'SW']);
      expect(result.interests).toEqual(['magic', 'scifi']);
      expect(mockPrismaService.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 'user-id', badgeId: 'badge-1' },
      });
    });

    it('should not award badge if Explorer badge does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.badge.findUnique.mockResolvedValue(null);

      const result = await service.completeFandomQuiz('user-id', {
        favoriteFandoms: ['HP'],
        interests: ['magic'],
      });

      expect(result.favoriteFandoms).toEqual(['HP']);
      expect(mockPrismaService.userBadge.create).not.toHaveBeenCalled();
    });
  });

  describe('sendVerificationEmail', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.sendVerificationEmail('missing-user')).rejects.toThrow(NotFoundException);
    });

    it('should return early if email is already verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        emailVerified: true,
      });

      const result = await service.sendVerificationEmail('user-id');

      expect(result.message).toContain('already verified');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should store token hash and send email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        emailVerified: false,
        firstName: 'Test',
        lastName: 'User',
      });
      mockPrismaService.user.update.mockResolvedValue({});
      (mockNotificationsService as any).queueNotification = jest.fn().mockResolvedValue(undefined);

      const result = await service.sendVerificationEmail('user-id');

      expect(result.message).toContain('Verification email sent');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerifyToken: expect.any(String),
            emailVerifyTokenExpires: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('should throw BadRequestException for short/invalid tokens', async () => {
      await expect(service.verifyEmail('short')).rejects.toThrow(BadRequestException);
      await expect(service.verifyEmail('')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when token not found in DB', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyEmail('a'.repeat(64)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when token has expired', async () => {
      const pastExpiry = new Date(Date.now() - 48 * 60 * 60 * 1000);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-id',
        emailVerifyTokenExpires: pastExpiry,
        updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      mockPrismaService.user.update.mockResolvedValue({});

      await expect(
        service.verifyEmail('a'.repeat(64)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark email as verified on valid token', async () => {
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-id',
        emailVerifyTokenExpires: futureExpiry,
        updatedAt: new Date(),
      });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.verifyEmail('a'.repeat(64));

      expect(result.message).toContain('verified successfully');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerified: true,
            emailVerifiedAt: expect.any(Date),
            emailVerifyToken: null,
            emailVerifyTokenExpires: null,
          }),
        }),
      );
    });
  });

  describe('assertRegistrationAllowed', () => {
    it('should pass when registration mode is open', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REGISTRATION_MODE') return 'open';
        return defaultValue;
      });

      await service.assertRegistrationAllowed('test@test.com');
    });

    it('should throw ForbiddenException when invite-only and no valid code', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REGISTRATION_MODE') return 'invite_only';
        if (key === 'REGISTRATION_INVITE_CODES') return 'code1,code2';
        return defaultValue;
      });

      let thrownError: any;
      try {
        await service.assertRegistrationAllowed('test@test.com', 'wrong-code');
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(ForbiddenException);
    });

    it('should allow registration with valid invite code', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REGISTRATION_MODE') return 'invite_only';
        if (key === 'REGISTRATION_INVITE_CODES') return 'VALID_CODE,other';
        return defaultValue;
      });

      await service.assertRegistrationAllowed('test@test.com', 'valid_code');
    });
  });

  describe('getLinkedAccounts', () => {
    it('should return linked accounts from prisma', async () => {
      const userId = 'user-id';
      mockPrismaService.oAuthAccount.findMany.mockResolvedValue([]);

      const result = await service.getLinkedAccounts(userId);

      expect(mockPrismaService.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: {
          id: true,
          provider: true,
          providerId: true,
          createdAt: true,
        },
      });
      expect(result).toEqual([]);
    });
  });
});
