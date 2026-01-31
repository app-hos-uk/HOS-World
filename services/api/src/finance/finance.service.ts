import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SetPricingDto, ApprovePricingDto } from './dto/set-pricing.dto';
import { ProductSubmissionStatus, VisibilityLevel } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findPending() {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: 'MARKETING_COMPLETED',
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            sellerType: true,
          },
        },
        catalogEntry: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        marketingMaterials: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { marketingCompletedAt: 'asc' },
    });

    return submissions;
  }

  async setPricing(submissionId: string, userId: string, setPricingDto: SetPricingDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'MARKETING_COMPLETED') {
      throw new BadRequestException('Pricing can only be set for marketing-completed submissions');
    }

    const productData = submission.productData as any;
    const basePrice = setPricingDto.basePrice || productData.price;

    // Calculate final price with HOS margin
    const finalPrice = basePrice * (1 + setPricingDto.hosMargin);

    // Update submission status to finance pending
    await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'FINANCE_PENDING',
        financeNotes: `Pricing set: Base: $${basePrice}, Margin: ${(setPricingDto.hosMargin * 100).toFixed(2)}%, Final: $${finalPrice.toFixed(2)}`,
      },
    });

    // Store pricing information (will be used when product is created)
    // For now, we'll store it in the submission's financeNotes
    // The actual ProductPricing will be created when the product is published

    return {
      submissionId,
      basePrice,
      hosMargin: setPricingDto.hosMargin,
      finalPrice,
      visibilityLevel: setPricingDto.visibilityLevel || 'STANDARD',
    };
  }

  async approve(submissionId: string, userId: string, approveDto: ApprovePricingDto) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'FINANCE_PENDING') {
      throw new BadRequestException(`Cannot approve submission in status: ${submission.status}`);
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'FINANCE_APPROVED',
        financeApprovedAt: new Date(),
        financeNotes: approveDto.notes
          ? `${submission.financeNotes || ''}\n\nApproved: ${approveDto.notes}`
          : submission.financeNotes,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        catalogEntry: true,
        marketingMaterials: true,
      },
    });

    // Send notification to HOS Admin for publishing
    await this.notificationsService.sendNotificationToRole(
      'ADMIN',
      'ORDER_CONFIRMATION', // Using existing type as placeholder
      'Product Ready for Publishing',
      `A product submission from ${updated.seller?.storeName || 'Unknown Seller'} has completed all review stages and is ready for publishing.`,
      { submissionId },
    );

    return updated;
  }

  async reject(submissionId: string, userId: string, reason: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'FINANCE_PENDING') {
      throw new BadRequestException(`Cannot reject submission in status: ${submission.status}`);
    }

    const updated = await this.prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        financeNotes: `Rejected: ${reason}`,
      },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    // Send notification to seller
    if (updated.seller?.userId) {
      await this.notificationsService.sendNotificationToUser(
        updated.seller.userId,
        'ORDER_CANCELLED', // Using existing type as placeholder
        'Product Submission Rejected',
        `Your product submission has been rejected by Finance. Reason: ${reason}`,
        { submissionId },
      );
    }

    return updated;
  }

  async getPricingHistory(submissionId: string) {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        financeNotes: true,
        financeApprovedAt: true,
        product: {
          include: {
            pricing: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return {
      submissionId: submission.id,
      financeNotes: submission.financeNotes,
      approvedAt: submission.financeApprovedAt,
      productPricing: submission.product?.pricing,
    };
  }

  async getDashboardStats() {
    const [pending, approved, rejected, total] = await Promise.all([
      this.prisma.productSubmission.count({
        where: { status: 'FINANCE_PENDING' },
      }),
      this.prisma.productSubmission.count({
        where: { status: 'FINANCE_APPROVED' },
      }),
      this.prisma.productSubmission.count({
        where: { status: 'REJECTED' },
      }),
      this.prisma.productSubmission.count({
        where: {
          status: {
            in: ['FINANCE_PENDING', 'FINANCE_APPROVED'],
          },
        },
      }),
    ]);

    return {
      pending,
      approved,
      rejected,
      total,
    };
  }
}
