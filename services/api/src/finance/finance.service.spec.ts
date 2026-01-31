import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SetPricingDto, ApprovePricingDto } from './dto/set-pricing.dto';

describe('FinanceService', () => {
  let service: FinanceService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    productSubmission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockNotificationsService = {
    sendSellerInvitation: jest.fn(),
    sendOrderConfirmation: jest.fn(),
    sendNotificationToRole: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findPending', () => {
    it('should return pending submissions', async () => {
      const mockSubmissions = [
        {
          id: 'submission-1',
          status: 'MARKETING_COMPLETED',
          seller: { id: 'seller-1', storeName: 'Test Store' },
        },
      ];

      mockPrismaService.productSubmission.findMany.mockResolvedValue(mockSubmissions);

      const result = await service.findPending();

      expect(mockPrismaService.productSubmission.findMany).toHaveBeenCalledWith({
        where: { status: 'MARKETING_COMPLETED' },
        include: expect.any(Object),
        orderBy: { marketingCompletedAt: 'asc' },
      });
      expect(result).toEqual(mockSubmissions);
    });
  });

  describe('setPricing', () => {
    const submissionId = 'submission-1';
    const userId = 'user-1';
    const setPricingDto: SetPricingDto = {
      basePrice: 100,
      hosMargin: 0.15,
      visibilityLevel: 'STANDARD',
    };

    it('should set pricing successfully', async () => {
      const mockSubmission = {
        id: submissionId,
        status: 'MARKETING_COMPLETED',
        productData: { price: 100 },
      };

      mockPrismaService.productSubmission.findUnique.mockResolvedValue(mockSubmission);
      mockPrismaService.productSubmission.update.mockResolvedValue({
        ...mockSubmission,
        financeNotes: expect.any(String),
      });

      const result = await service.setPricing(submissionId, userId, setPricingDto);

      expect(result).toHaveProperty('submissionId', submissionId);
      expect(result).toHaveProperty('basePrice', 100);
      expect(result).toHaveProperty('hosMargin', 0.15);
      expect(result).toHaveProperty('finalPrice');
      expect(Math.abs(result.finalPrice - 115)).toBeLessThan(0.01); // Allow for floating point precision
      expect(mockPrismaService.productSubmission.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if submission not found', async () => {
      mockPrismaService.productSubmission.findUnique.mockResolvedValue(null);

      await expect(service.setPricing(submissionId, userId, setPricingDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if status is not MARKETING_COMPLETED', async () => {
      const mockSubmission = {
        id: submissionId,
        status: 'PENDING',
      };

      mockPrismaService.productSubmission.findUnique.mockResolvedValue(mockSubmission);

      await expect(service.setPricing(submissionId, userId, setPricingDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approve', () => {
    const submissionId = 'submission-1';
    const userId = 'user-1';
    const approveDto: ApprovePricingDto = {
      notes: 'Approved',
    };

    it('should approve pricing successfully', async () => {
      const mockSubmission = {
        id: submissionId,
        status: 'FINANCE_PENDING',
      };

      mockPrismaService.productSubmission.findUnique.mockResolvedValue(mockSubmission);
      mockPrismaService.productSubmission.update.mockResolvedValue({
        ...mockSubmission,
        status: 'FINANCE_APPROVED',
      });

      const result = await service.approve(submissionId, userId, approveDto);

      expect(result).toHaveProperty('id', submissionId);
      expect(result).toHaveProperty('status', 'FINANCE_APPROVED');
      expect(mockPrismaService.productSubmission.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if submission not found', async () => {
      mockPrismaService.productSubmission.findUnique.mockResolvedValue(null);

      await expect(service.approve(submissionId, userId, approveDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
