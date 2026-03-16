import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
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
      update: jest.fn(),
    },
    customer: {
      create: jest.fn(),
    },
    seller: {
      create: jest.fn(),
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
    tenant: {
      findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
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
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('access-token');
      mockGeolocationService.detectCountryFromIP.mockResolvedValue({
        country: 'United States',
        countryCode: 'US',
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
  });
});
