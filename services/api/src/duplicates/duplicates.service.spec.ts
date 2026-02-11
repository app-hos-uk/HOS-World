import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DuplicatesService } from './duplicates.service';
import { PrismaService } from '../database/prisma.service';

describe('DuplicatesService', () => {
  let service: DuplicatesService;

  const mockPrismaService = {
    productSubmission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    duplicateProduct: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicatesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DuplicatesService>(DuplicatesService);
    jest.clearAllMocks();
  });

  describe('findCrossSellerDuplicateGroups', () => {
    it('should return empty array when no submissions', async () => {
      mockPrismaService.productSubmission.findMany.mockResolvedValue([]);
      const result = await service.findCrossSellerDuplicateGroups();
      expect(result).toEqual([]);
      expect(mockPrismaService.productSubmission.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        include: { seller: { select: { id: true, storeName: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return groups of same product from different sellers', async () => {
      const sub1 = {
        id: 'sub-1',
        sellerId: 'seller-1',
        productData: { name: 'Widget', sku: 'SKU-001' },
        createdAt: new Date('2025-01-01'),
        status: 'SUBMITTED',
        seller: { id: 'seller-1', storeName: 'Store A', slug: 'store-a' },
      };
      const sub2 = {
        id: 'sub-2',
        sellerId: 'seller-2',
        productData: { name: 'Widget', sku: 'SKU-001' },
        createdAt: new Date('2025-01-02'),
        status: 'SUBMITTED',
        seller: { id: 'seller-2', storeName: 'Store B', slug: 'store-b' },
      };
      mockPrismaService.productSubmission.findMany.mockResolvedValue([sub1, sub2]);
      const result = await service.findCrossSellerDuplicateGroups();
      expect(result.length).toBe(1);
      expect(result[0].submissions.length).toBe(2);
      expect(result[0].matchReasons).toContain('Same SKU');
      expect(result[0].suggestedPrimaryId).toBe('sub-1');
    });
  });

  describe('rejectOthersInGroup', () => {
    it('should throw NotFoundException when group not found', async () => {
      mockPrismaService.productSubmission.findMany.mockResolvedValue([]);
      await expect(
        service.rejectOthersInGroup('unknown-group', 'sub-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when keepSubmissionId not in group', async () => {
      const sub1 = {
        id: 'sub-1',
        sellerId: 'seller-1',
        productData: { name: 'X', sku: 'S1' },
        createdAt: new Date(),
        status: 'SUBMITTED',
        seller: { storeName: 'A', slug: 'a' },
      };
      const sub2 = {
        id: 'sub-2',
        sellerId: 'seller-2',
        productData: { name: 'X', sku: 'S1' },
        createdAt: new Date(),
        status: 'SUBMITTED',
        seller: { storeName: 'B', slug: 'b' },
      };
      mockPrismaService.productSubmission.findMany
        .mockResolvedValueOnce([sub1, sub2])
        .mockResolvedValueOnce([sub1, sub2]);
      const groupId = `group-${sub1.id}-${sub2.id}`.slice(0, 50);
      await expect(
        service.rejectOthersInGroup(`group-${sub1.id}-${sub2.id}`, 'not-in-group'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject others and return rejected ids', async () => {
      const sub1 = {
        id: 'sub-1',
        sellerId: 'seller-1',
        productData: { name: 'X', sku: 'S1' },
        createdAt: new Date(),
        status: 'SUBMITTED',
        seller: { storeName: 'A', slug: 'a' },
      };
      const sub2 = {
        id: 'sub-2',
        sellerId: 'seller-2',
        productData: { name: 'X', sku: 'S1' },
        createdAt: new Date(),
        status: 'SUBMITTED',
        seller: { storeName: 'B', slug: 'b' },
      };
      // groupId is computed as group- + sorted submission ids
      const groupId = `group-${[sub1.id, sub2.id].sort().join('-')}`;
      mockPrismaService.productSubmission.findMany
        .mockResolvedValueOnce([sub1, sub2])
        .mockResolvedValueOnce([sub1, sub2]);
      mockPrismaService.productSubmission.findUnique.mockResolvedValue({
        id: sub2.id,
        procurementNotes: null,
        status: 'SUBMITTED',
      });
      mockPrismaService.productSubmission.update.mockResolvedValue({});
      const result = await service.rejectOthersInGroup(groupId, sub1.id);
      expect(result.rejectedIds).toContain(sub2.id);
      expect(mockPrismaService.productSubmission.update).toHaveBeenCalledWith({
        where: { id: sub2.id },
        data: {
          status: 'PROCUREMENT_REJECTED',
          procurementNotes: expect.stringContaining('Duplicate'),
        },
      });
    });
  });

  describe('assignCrossSellerGroupIds', () => {
    it('should return zeros when no submissions', async () => {
      mockPrismaService.productSubmission.findMany.mockReset();
      mockPrismaService.productSubmission.findMany.mockResolvedValue([]);
      const result = await service.assignCrossSellerGroupIds();
      expect(result).toEqual({ groupsAssigned: 0, submissionsUpdated: 0 });
    });

    it('should assign group id to submissions in same group', async () => {
      const sub1 = {
        id: 'sub-1',
        sellerId: 'seller-1',
        productData: { name: 'Y', sku: 'SKU-Y' },
        createdAt: new Date(),
      };
      const sub2 = {
        id: 'sub-2',
        sellerId: 'seller-2',
        productData: { name: 'Y', sku: 'SKU-Y' },
        createdAt: new Date(),
      };
      mockPrismaService.productSubmission.findMany.mockResolvedValueOnce([sub1, sub2]);
      mockPrismaService.productSubmission.update.mockResolvedValue({});
      const result = await service.assignCrossSellerGroupIds();
      expect(result.groupsAssigned).toBe(1);
      expect(result.submissionsUpdated).toBe(2);
      expect(mockPrismaService.productSubmission.update).toHaveBeenCalledTimes(2);
    });
  });
});
