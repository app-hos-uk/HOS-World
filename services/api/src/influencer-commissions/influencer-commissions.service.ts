import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CommissionStatus } from '@prisma/client';
import { AmbassadorService } from '../ambassador/ambassador.service';
import { UpdateCommissionStatusDto } from './dto/update-commission-status.dto';

function clampPage(page?: number): number {
  return Math.max(1, parseInt(String(page), 10) || 1);
}

/** Allowed admin status transitions (PAID is only set via payout or ambassador conversion). */
const ALLOWED_STATUS_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  [CommissionStatus.PENDING]: [CommissionStatus.APPROVED, CommissionStatus.CANCELLED],
  [CommissionStatus.APPROVED]: [CommissionStatus.CANCELLED, CommissionStatus.ADJUSTED],
  [CommissionStatus.ADJUSTED]: [CommissionStatus.APPROVED, CommissionStatus.CANCELLED],
  [CommissionStatus.PAID]: [],
  [CommissionStatus.CANCELLED]: [],
};

@Injectable()
export class InfluencerCommissionsService {
  private readonly logger = new Logger(InfluencerCommissionsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => AmbassadorService))
    private ambassador?: AmbassadorService,
  ) {}

  /**
   * Get commissions for influencer
   */
  async findByInfluencer(
    userId: string,
    options?: { page?: number; limit?: number; status?: string },
  ) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const page = clampPage(options?.page);
    const { limit = 20, status } = options || {};

    const where: any = { influencerId: influencer.id };
    if (status) where.status = status;

    const [commissions, total] = await Promise.all([
      this.prisma.influencerCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerCommission.count({ where }),
    ]);

    return {
      data: commissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get earnings summary for influencer
   */
  async getEarningsSummary(userId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const grouped = await this.prisma.influencerCommission.groupBy({
      by: ['status'],
      where: { influencerId: influencer.id },
      _sum: { amount: true },
    });

    const sumByStatus = (status: CommissionStatus) =>
      Number(grouped.find((g) => g.status === status)?._sum.amount ?? 0);

    const pending = sumByStatus(CommissionStatus.PENDING);
    const approved = sumByStatus(CommissionStatus.APPROVED);
    const paid = sumByStatus(CommissionStatus.PAID);
    const cancelled = sumByStatus(CommissionStatus.CANCELLED);

    const availableAgg = await this.prisma.influencerCommission.aggregate({
      where: {
        influencerId: influencer.id,
        status: CommissionStatus.APPROVED,
        payoutId: null,
      },
      _sum: { amount: true },
    });
    const available = Number(availableAgg._sum.amount ?? 0);

    return {
      pending,
      approved,
      paid,
      cancelled,
      total: pending + approved + paid,
      available,
    };
  }

  /**
   * List all commissions (admin)
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

    const [commissions, total] = await Promise.all([
      this.prisma.influencerCommission.findMany({
        where,
        include: {
          influencer: {
            select: { id: true, displayName: true, referralCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerCommission.count({ where }),
    ]);

    return {
      data: commissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update commission status (admin)
   */
  async updateStatus(id: string, dto: UpdateCommissionStatusDto) {
    const commission = await this.prisma.influencerCommission.findUnique({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (commission.payoutId) {
      throw new BadRequestException(
        'Cannot change status of a commission linked to a payout',
      );
    }

    const { status, notes } = dto;

    if (status === CommissionStatus.PAID) {
      throw new BadRequestException(
        'Commission status PAID can only be set via the payout or ambassador conversion flow',
      );
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[commission.status as CommissionStatus] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition commission from ${commission.status} to ${status}`,
      );
    }

    const updated = await this.prisma.influencerCommission.update({
      where: { id },
      data: {
        status,
        notes: notes ?? commission.notes,
      },
    });
    if (status === CommissionStatus.APPROVED) {
      void this.ambassador?.tryAutoConvertCommission(id);
    }
    return updated;
  }

  /**
   * Approve commission (admin)
   */
  async approve(id: string) {
    return this.updateStatus(id, { status: CommissionStatus.APPROVED });
  }
}
