import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePayoutDto } from './dto/create-payout.dto';

function clampPage(page?: number): number {
  return Math.max(1, parseInt(String(page), 10) || 1);
}

@Injectable()
export class InfluencerPayoutsService {
  private readonly logger = new Logger(InfluencerPayoutsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get payouts for influencer
   */
  async findByInfluencer(userId: string, options?: { page?: number; limit?: number }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const page = clampPage(options?.page);
    const { limit = 20 } = options || {};

    const [payouts, total] = await Promise.all([
      this.prisma.influencerPayout.findMany({
        where: { influencerId: influencer.id },
        include: {
          _count: { select: { commissions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerPayout.count({ where: { influencerId: influencer.id } }),
    ]);

    return {
      data: payouts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List all payouts (admin)
   */
  async findAll(options?: {
    page?: number;
    limit?: number;
    status?: string;
    influencerId?: string;
  }) {
    const page = clampPage(options?.page);
    const { limit = 20, status, influencerId } = options || {};

    const where: any = {};
    if (status) where.status = status;
    if (influencerId) where.influencerId = influencerId;

    const [payouts, total] = await Promise.all([
      this.prisma.influencerPayout.findMany({
        where,
        include: {
          influencer: {
            select: { id: true, displayName: true, referralCode: true },
          },
          _count: { select: { commissions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerPayout.count({ where }),
    ]);

    return {
      data: payouts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create payout record (admin)
   */
  async create(data: CreatePayoutDto) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: data.influencerId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    const payout = await this.prisma.$transaction(async (tx) => {
      const commissionWhere = {
        influencerId: data.influencerId,
        status: 'APPROVED' as const,
        payoutId: null,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        ...(data.commissionIds?.length ? { id: { in: data.commissionIds } } : {}),
      };

      const candidates = await tx.influencerCommission.findMany({
        where: commissionWhere,
        select: { id: true },
      });

      if (candidates.length === 0) {
        throw new BadRequestException('No approved commissions found for this period');
      }

      const candidateIds = candidates.map((c) => c.id);

      const newPayout = await tx.influencerPayout.create({
        data: {
          influencerId: data.influencerId,
          periodStart,
          periodEnd,
          totalAmount: 0,
          notes: data.notes,
          status: 'PENDING',
        },
      });

      const claimResult = await tx.influencerCommission.updateMany({
        where: {
          id: { in: candidateIds },
          status: 'APPROVED',
          payoutId: null,
        },
        data: { payoutId: newPayout.id },
      });

      if (claimResult.count !== candidateIds.length) {
        throw new BadRequestException(
          'Some commissions were claimed by another payout; please retry',
        );
      }

      const claimed = await tx.influencerCommission.findMany({
        where: { payoutId: newPayout.id },
        select: { amount: true },
      });

      const totalAmount = claimed.reduce((sum, c) => sum + Number(c.amount), 0);

      return tx.influencerPayout.update({
        where: { id: newPayout.id },
        data: { totalAmount },
      });
    });

    return payout;
  }

  /**
   * Mark payout as paid (admin)
   */
  async markPaid(
    id: string,
    paidBy: string,
    data: { paymentMethod?: string; paymentRef?: string },
  ) {
    const payout = await this.prisma.influencerPayout.findUnique({
      where: { id },
      include: { commissions: true },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status === 'PAID') {
      throw new BadRequestException('Payout has already been marked as paid');
    }

    const invalidCommissions = payout.commissions.filter((c) => c.status !== 'APPROVED');
    if (invalidCommissions.length > 0) {
      throw new BadRequestException(
        'All linked commissions must be in APPROVED status before marking payout as paid',
      );
    }

    // Update payout and commissions in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.influencerPayout.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paidBy,
          paymentMethod: data.paymentMethod,
          paymentRef: data.paymentRef,
        },
      });

      // Mark all linked commissions as paid
      await tx.influencerCommission.updateMany({
        where: { payoutId: id, status: 'APPROVED' },
        data: { status: 'PAID' },
      });
    });

    return this.prisma.influencerPayout.findUnique({
      where: { id },
      include: {
        influencer: { select: { displayName: true, referralCode: true } },
        _count: { select: { commissions: true } },
      },
    });
  }

  /**
   * Cancel payout (admin)
   */
  async cancel(id: string) {
    const payout = await this.prisma.influencerPayout.findUnique({
      where: { id },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status === 'PAID') {
      throw new BadRequestException('Cannot cancel a paid payout');
    }

    // Update payout and unlink commissions
    await this.prisma.$transaction(async (tx) => {
      await tx.influencerPayout.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Unlink commissions so they can be included in future payouts
      await tx.influencerCommission.updateMany({
        where: { payoutId: id },
        data: { payoutId: null },
      });
    });

    return { message: 'Payout cancelled successfully' };
  }
}
