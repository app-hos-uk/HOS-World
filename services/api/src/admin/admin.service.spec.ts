import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PlatformRegionService } from '../config/platform-region.service';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_PASSWORD_ROUNDS } from '../config/bcrypt-cost';

jest.mock('bcrypt');

describe('AdminService', () => {
  let service: AdminService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    seller: {
      create: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      count: jest.fn(),
    },
    permissionRole: {
      findUnique: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    productSubmission: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    productReview: {
      count: jest.fn(),
    },
    notification: {
      count: jest.fn(),
    },
    activityLog: {
      findMany: jest.fn(),
    },
    discrepancy: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlatformRegionService,
          useValue: { invalidate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const createUserData = {
      email: 'newuser@example.com',
      password: 'Test123!',
      firstName: 'New',
      lastName: 'User',
      role: UserRole.CUSTOMER,
    };

    it('should create a user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const mockUser = {
        id: 'user-id',
        ...createUserData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.createUser(createUserData);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserData.email.toLowerCase().trim() },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserData.password, BCRYPT_PASSWORD_ROUNDS);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('should throw BadRequestException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.createUser(createUserData)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if seller role without storeName', async () => {
      const sellerData = {
        ...createUserData,
        role: UserRole.SELLER,
        storeName: undefined,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.createUser(sellerData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const userId = 'user-id';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        role: UserRole.CUSTOMER,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = 'user-id';
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };
      const mockUser = {
        id: userId,
        ...updateData,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.updateUser(userId, updateData);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
        select: expect.any(Object),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUser('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const userId = 'user-id';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await service.deleteUser(userId);

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      mockPrismaService.product.count.mockResolvedValue(100);
      mockPrismaService.order.count.mockResolvedValue(50);
      mockPrismaService.productSubmission.count.mockResolvedValue(25);
      mockPrismaService.seller.count.mockResolvedValue(10);
      mockPrismaService.customer.count.mockResolvedValue(200);
      mockPrismaService.productSubmission.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: 5 },
        { status: 'APPROVED', _count: 20 },
      ]);
      mockPrismaService.order.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: 10 },
        { status: 'COMPLETED', _count: 40 },
      ]);
      mockPrismaService.productSubmission.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(210);
      mockPrismaService.productReview.count.mockResolvedValue(3);
      mockPrismaService.notification.count.mockResolvedValue(1);
      mockPrismaService.activityLog.findMany.mockResolvedValue([]);
      mockPrismaService.discrepancy.count.mockResolvedValue(0);

      const result = await service.getDashboardStats();

      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('submissionsByStatus');
      expect(result).toHaveProperty('ordersByStatus');
      expect(result).toHaveProperty('recentActivity');
      expect(result).toHaveProperty('recentActivityLogs');
      expect(result.notifications).toEqual({ pending: 1, failed: 1 });
    });
  });

  describe('getUserStats', () => {
    it('should return aggregated user statistics', async () => {
      mockPrismaService.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5) // inactive
        .mockResolvedValueOnce(20); // newThisMonth
      (mockPrismaService.user as any).groupBy = jest.fn().mockResolvedValue([
        { role: 'ADMIN', _count: 2 },
        { role: 'CUSTOMER', _count: 80 },
        { role: 'SELLER', _count: 10 },
        { role: 'INFLUENCER', _count: 3 },
        { role: 'FULFILLMENT', _count: 5 },
      ]);

      const result = await service.getUserStats();

      expect(result.total).toBe(100);
      expect(result.admins).toBe(2);
      expect(result.customers).toBe(80);
      expect(result.active).toBe(95);
      expect(result.inactive).toBe(5);
    });
  });

  describe('toggleUserStatus', () => {
    it('should toggle user active status', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        isActive: true,
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        isActive: false,
      });

      const result = await service.toggleUserStatus('user-1');
      expect(result.isActive).toBe(false);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.toggleUserStatus('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for protected admin emails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'app@houseofspells.co.uk',
        isActive: true,
      });

      await expect(service.toggleUserStatus('user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetUserPassword', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.resetUserPassword('missing', 'newpass123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for short passwords', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });

      await expect(service.resetUserPassword('user-1', 'short')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should hash and update password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.resetUserPassword('user-1', 'validpassword123');
      expect(result.message).toBe('Password reset successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('validpassword123', BCRYPT_PASSWORD_ROUNDS);
    });
  });

  describe('deleteUser – admin protection', () => {
    it('should throw when trying to delete an ADMIN', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      await expect(service.deleteUser('admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw when trying to delete a protected admin email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'app@houseofspells.co.uk',
        role: 'CUSTOMER',
      });

      await expect(service.deleteUser('admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUser – protected admin guards', () => {
    it('should prevent changing role of a protected admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'app@houseofspells.co.uk',
        role: 'ADMIN',
      });

      await expect(service.updateUser('admin-1', { role: 'CUSTOMER' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deactivating a protected admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'app@houseofspells.co.uk',
        role: 'ADMIN',
      });

      await expect(service.updateUser('admin-1', { isActive: false })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid role string', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });

      await expect(service.updateUser('user-1', { role: 'INVALID_ROLE' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when email is already taken', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', email: 'old@example.com' })
        .mockResolvedValueOnce({ id: 'user-2', email: 'taken@example.com' });

      await expect(service.updateUser('user-1', { email: 'taken@example.com' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createPermissionRole', () => {
    it('should throw for built-in role names', async () => {
      await expect(service.createPermissionRole('ADMIN')).rejects.toThrow(BadRequestException);
    });

    it('should throw for empty name', async () => {
      await expect(service.createPermissionRole('   ')).rejects.toThrow(BadRequestException);
    });

    it('should create new permission role', async () => {
      mockPrismaService.permissionRole.findUnique.mockResolvedValue(null);
      (mockPrismaService as any).permissionRole.create = jest.fn().mockResolvedValue({
        id: 'role-1',
        name: 'CUSTOM_ROLE',
        permissions: [],
      });

      const result = await service.createPermissionRole('Custom Role');
      expect(result.name).toBe('CUSTOM_ROLE');
    });
  });

  describe('getPermissionCatalog', () => {
    it('should return array of permission ids', async () => {
      const catalog = await service.getPermissionCatalog();
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog[0]).toHaveProperty('id');
    });
  });
});
