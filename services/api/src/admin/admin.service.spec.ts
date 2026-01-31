import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AdminService', () => {
  let service: AdminService;
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          role: UserRole.CUSTOMER,
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          role: UserRole.SELLER,
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getAllUsers();

      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
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
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserData.password, 10);
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

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: expect.any(Object),
      });
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

      const result = await service.getDashboardStats();

      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('submissionsByStatus');
      expect(result).toHaveProperty('ordersByStatus');
      expect(result).toHaveProperty('recentActivity');
    });
  });
});
