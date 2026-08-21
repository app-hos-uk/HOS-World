import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../database/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-key-minimum-32-characters-long';
      return undefined;
    }),
  };

  beforeEach(() => {
    strategy = new JwtStrategy(
      mockConfig as unknown as ConfigService,
      mockPrisma as unknown as PrismaService,
    );
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('rejects non-access token types', async () => {
      await expect(strategy.validate({ sub: 'u1', type: 'refresh' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate({ sub: 'missing', type: 'access' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects deactivated users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: false,
      });

      await expect(strategy.validate({ sub: 'u1', type: 'access' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns active user payload', async () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        role: 'ADMIN',
        isActive: true,
        tokenVersion: 0,
        tenantMemberships: [],
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(strategy.validate({ sub: 'u1', type: 'access' })).resolves.toEqual(user);
    });

    it('rejects tokens whose tokenVersion does not match the user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: 'ADMIN',
        isActive: true,
        tokenVersion: 2,
        tenantMemberships: [],
      });

      await expect(
        strategy.validate({ sub: 'u1', type: 'access', tokenVersion: 0 }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
