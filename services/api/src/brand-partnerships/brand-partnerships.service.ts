import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, type BrandCampaign, type BrandPartnership } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { SegmentationService } from '../segmentation/segmentation.service';
import { MarketingEventBus } from '../journeys/marketing-event.bus';
import { CreatePartnershipDto } from './dto/create-partnership.dto';
import { UpdatePartnershipDto } from './dto/update-partnership.dto';
import { CreateBrandCampaignDto } from './dto/create-brand-campaign.dto';
import { UpdateBrandCampaignDto } from './dto/update-brand-campaign.dto';
import { pickBrandCampaignMultipliers } from './engines/brand-campaign.engine';
import { randomBytes } from 'crypto';

function slugifyBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function makeSlug(base: string): string {
  const suffix = randomBytes(3).toString('hex');
  return `${base || 'partner'}-${suffix}`;
}

@Injectable()
export class BrandPartnershipsService {
  constructor(
    private prisma: PrismaService,
    private segmentation: SegmentationService,
    private marketingBus: MarketingEventBus,
  ) {}

  // ── Partnership CRUD ──

  async createPartnership(dto: CreatePartnershipDto): Promise<BrandPartnership> {
    const start = new Date(dto.contractStart);
    const end = new Date(dto.contractEnd);
    if (start >= end) throw new BadRequestException('contractStart must be before contractEnd');

    let base = slugifyBase(dto.name);
    let slug = makeSlug(base);
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.brandPartnership.findUnique({ where: { slug } });
      if (!exists) break;
      slug = makeSlug(base);
    }

    return this.prisma.brandPartnership.create({
      data: {
        name: dto.name.trim(),
        slug,
        contactName: dto.contactName?.trim() || null,
        contactEmail: dto.contactEmail?.trim() || null,
        logoUrl: dto.logoUrl?.trim() || null,
        description: dto.description?.trim() || null,
        contractStart: start,
        contractEnd: end,
        totalBudget: new Decimal(dto.totalBudget ?? 0),
        currency: dto.currency?.trim() || 'GBP',
      },
    });
  }

  async updatePartnership(id: string, dto: UpdatePartnershipDto): Promise<BrandPartnership> {
    await this.ensurePartnership(id);
    const data: Prisma.BrandPartnershipUpdateInput = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.contactName !== undefined) data.contactName = dto.contactName?.trim() || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail?.trim() || null;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.status != null) data.status = dto.status;
    if (dto.contractStart != null) data.contractStart = new Date(dto.contractStart);
    if (dto.contractEnd != null) data.contractEnd = new Date(dto.contractEnd);
    if (dto.totalBudget != null) data.totalBudget = new Decimal(dto.totalBudget);
    if (dto.currency != null) data.currency = dto.currency;

    const updated = await this.prisma.brandPartnership.update({ where: { id }, data });
    const start = updated.contractStart;
    const end = updated.contractEnd;
    if (start >= end) throw new BadRequestException('contractStart must be before contractEnd');
    return updated;
  }

  async getPartnership(id: string): Promise<BrandPartnership & { campaigns: BrandCampaign[] }> {
    const p = await this.prisma.brandPartnership.findUnique({
      where: { id },
      include: { campaigns: { orderBy: { createdAt: 'desc' } } },
    });
    if (!p) throw new NotFoundException('Partnership not found');
    return p;
  }

  async listPartnerships(filters: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: BrandPartnership[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.BrandPartnershipWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.search?.trim()) {
      where.OR = [
        { name: { contains: filters.search.trim(), mode: 'insensitive' } },
        { slug: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.brandPartnership.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.brandPartnership.count({ where }),
    ]);
    return { items, total };
  }

  async archivePartnership(id: string): Promise<BrandPartnership> {
    await this.ensurePartnership(id);
    return this.prisma.brandPartnership.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  // ── Campaign CRUD ──

  async createCampaign(partnershipId: string, dto: CreateBrandCampaignDto): Promise<BrandCampaign> {
    const p = await this.prisma.brandPartnership.findUnique({ where: { id: partnershipId } });
    if (!p) throw new NotFoundException('Partnership not found');
    if (p.status !== 'ACTIVE') throw new BadRequestException('Partnership must be ACTIVE');

    const start = new Date(dto.startsAt);
    const end = new Date(dto.endsAt);
    if (start >= end) throw new BadRequestException('startsAt must be before endsAt');

    let base = slugifyBase(dto.name);
    let slug = makeSlug(base);
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.brandCampaign.findUnique({ where: { slug } });
      if (!exists) break;
      slug = makeSlug(base);
    }

    return this.prisma.brandCampaign.create({
      data: {
        partnershipId,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        type: dto.type,
        status: 'DRAFT',
        startsAt: start,
        endsAt: end,
        multiplier:
          dto.multiplier != null && dto.type === 'MULTIPLIER' ? new Decimal(dto.multiplier) : null,
        bonusPoints: dto.bonusPoints ?? null,
        maxPointsPerUser: dto.maxPointsPerUser ?? null,
        totalPointsBudget: dto.totalPointsBudget ?? null,
        targetFandoms: dto.targetFandoms ?? [],
        targetBrands: dto.targetBrands ?? [],
        targetCategoryIds: dto.targetCategoryIds ?? [],
        targetProductIds: dto.targetProductIds ?? [],
        segmentId: dto.segmentId ?? null,
        minTierLevel: dto.minTierLevel ?? 0,
        regionCodes: dto.regionCodes ?? [],
        featuredProductIds: dto.featuredProductIds ?? [],
        exclusiveTierLevel: dto.exclusiveTierLevel ?? null,
        journeySlug: dto.journeySlug?.trim() || null,
        notifyOnStart: dto.notifyOnStart ?? true,
      },
    });
  }

  async updateCampaign(id: string, dto: UpdateBrandCampaignDto): Promise<BrandCampaign> {
    const c = await this.prisma.brandCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    if (['COMPLETED', 'CANCELLED'].includes(c.status)) {
      throw new BadRequestException('Cannot update a completed or cancelled campaign');
    }

    const data: Prisma.BrandCampaignUpdateInput = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.type != null) data.type = dto.type;
    if (dto.status != null) data.status = dto.status;
    if (dto.startsAt != null) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt != null) data.endsAt = new Date(dto.endsAt);
    if (dto.multiplier !== undefined) {
      data.multiplier = dto.multiplier != null ? new Decimal(dto.multiplier) : null;
    }
    if (dto.bonusPoints !== undefined) data.bonusPoints = dto.bonusPoints;
    if (dto.maxPointsPerUser !== undefined) data.maxPointsPerUser = dto.maxPointsPerUser;
    if (dto.totalPointsBudget !== undefined) data.totalPointsBudget = dto.totalPointsBudget;
    if (dto.targetFandoms != null) data.targetFandoms = dto.targetFandoms;
    if (dto.targetBrands != null) data.targetBrands = dto.targetBrands;
    if (dto.targetCategoryIds != null) data.targetCategoryIds = dto.targetCategoryIds;
    if (dto.targetProductIds != null) data.targetProductIds = dto.targetProductIds;
    if (dto.segmentId !== undefined) data.segmentId = dto.segmentId;
    if (dto.minTierLevel != null) data.minTierLevel = dto.minTierLevel;
    if (dto.regionCodes != null) data.regionCodes = dto.regionCodes;
    if (dto.featuredProductIds != null) data.featuredProductIds = dto.featuredProductIds;
    if (dto.exclusiveTierLevel !== undefined) data.exclusiveTierLevel = dto.exclusiveTierLevel;
    if (dto.journeySlug !== undefined) data.journeySlug = dto.journeySlug?.trim() || null;
    if (dto.notifyOnStart != null) data.notifyOnStart = dto.notifyOnStart;

    const updated = await this.prisma.brandCampaign.update({ where: { id }, data });
    if (updated.startsAt >= updated.endsAt) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    if (updated.status === 'ACTIVE') {
      await this.syncLoyaltyMirror(updated);
    }
    return updated;
  }

  async getCampaign(id: string): Promise<BrandCampaign & { partnership: BrandPartnership }> {
    const c = await this.prisma.brandCampaign.findUnique({
      where: { id },
      include: { partnership: true },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async listCampaigns(filters: {
    partnershipId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: BrandCampaign[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.BrandCampaignWhereInput = {};
    if (filters.partnershipId) where.partnershipId = filters.partnershipId;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    const [items, total] = await Promise.all([
      this.prisma.brandCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { partnership: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.brandCampaign.count({ where }),
    ]);
    return { items: items as BrandCampaign[], total };
  }

  async activateCampaign(id: string): Promise<BrandCampaign> {
    const c = await this.prisma.brandCampaign.findUnique({
      where: { id },
      include: { partnership: true },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    if (!['DRAFT', 'SCHEDULED'].includes(c.status)) {
      throw new BadRequestException('Only DRAFT or SCHEDULED campaigns can be activated');
    }
    if (c.partnership.status !== 'ACTIVE') {
      throw new BadRequestException('Partnership must be ACTIVE');
    }
    const now = new Date();
    if (c.endsAt < now) throw new BadRequestException('Campaign end date is in the past');

    const updated = await this.prisma.brandCampaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.syncLoyaltyMirror(updated);
    await this.fireCampaignStarted(updated, c.partnership);
    return this.getCampaign(id);
  }

  async pauseCampaign(id: string): Promise<BrandCampaign> {
    const c = await this.ensureCampaign(id);
    if (c.status !== 'ACTIVE') throw new BadRequestException('Campaign is not ACTIVE');
    const updated = await this.prisma.brandCampaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
    await this.syncLoyaltyMirror(updated);
    return updated;
  }

  async completeCampaign(
    id: string,
  ): Promise<BrandCampaign & { partnership: BrandPartnership }> {
    const updated = await this.prisma.brandCampaign.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    await this.syncLoyaltyMirror(updated);
    const c = await this.getCampaign(id);
    await this.marketingBus.broadcast('BRAND_CAMPAIGN_COMPLETED', {
      campaignId: c.id,
      campaignName: c.name,
      totalPointsAwarded: c.totalPointsAwarded,
    });
    return c;
  }

  async cancelCampaign(id: string): Promise<BrandCampaign> {
    const updated = await this.prisma.brandCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.syncLoyaltyMirror(updated);
    return updated;
  }

  async syncLoyaltyMirror(campaign: BrandCampaign): Promise<void> {
    const active = campaign.status === 'ACTIVE';
    const existing = await this.prisma.loyaltyBonusCampaign.findFirst({
      where: { brandCampaignId: campaign.id },
    });
    const payload = {
      name: `${campaign.name} (Brand)`,
      description: campaign.description,
      type: 'BRAND',
      multiplier: campaign.multiplier,
      bonusPoints: campaign.bonusPoints,
      regionCodes: campaign.regionCodes,
      channelCodes: [] as string[],
      isActive: active,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      brandCampaignId: campaign.id,
    };
    if (existing) {
      await this.prisma.loyaltyBonusCampaign.update({
        where: { id: existing.id },
        data: payload,
      });
    } else if (active) {
      await this.prisma.loyaltyBonusCampaign.create({ data: payload });
    }
  }

  private async fireCampaignStarted(
    campaign: BrandCampaign,
    partnership: BrandPartnership,
  ): Promise<void> {
    if (!campaign.notifyOnStart) return;

    const payload = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      partnerName: partnership.name,
      multiplier: campaign.multiplier?.toNumber() ?? null,
      bonusPoints: campaign.bonusPoints ?? null,
    };

    if (campaign.segmentId) {
      const userIds = await this.segmentation.getSegmentUserIds(campaign.segmentId);
      for (const userId of userIds) {
        await this.marketingBus.emit('BRAND_CAMPAIGN_STARTED', userId, payload);
      }
    } else {
      await this.marketingBus.broadcast('BRAND_CAMPAIGN_STARTED', payload);
    }
  }

  /** Scheduled → ACTIVE when window open; mirrors loyalty row. */
  async runScheduledActivations(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.brandCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { partnership: true },
    });
    let n = 0;
    for (const c of due) {
      try {
        if (c.partnership.status !== 'ACTIVE') continue;
        const updated = await this.prisma.brandCampaign.update({
          where: { id: c.id },
          data: { status: 'ACTIVE' },
        });
        await this.syncLoyaltyMirror(updated);
        await this.fireCampaignStarted(updated, c.partnership);
        n++;
      } catch {
        /* skip */
      }
    }
    return n;
  }

  /** ACTIVE past endsAt → COMPLETED; ending-soon notifications. */
  async runExpiredAndEndingSoon(): Promise<{ completed: number; endingNotified: number }> {
    const now = new Date();
    let completed = 0;
    const expired = await this.prisma.brandCampaign.findMany({
      where: { status: 'ACTIVE', endsAt: { lt: now } },
    });
    for (const c of expired) {
      await this.completeCampaign(c.id);
      completed++;
    }

    const soonEnd = new Date(now.getTime() + 48 * 3600_000);
    const soon = await this.prisma.brandCampaign.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { gt: now, lt: soonEnd },
      },
    });
    let endingNotified = 0;
    for (const c of soon) {
      const meta = (c.metadata as Record<string, unknown> | null) ?? {};
      if (meta.endingNotified) continue;

      const payload = { campaignId: c.id, campaignName: c.name, endsAt: c.endsAt.toISOString() };
      if (c.segmentId) {
        const userIds = await this.segmentation.getSegmentUserIds(c.segmentId);
        for (const userId of userIds) {
          await this.marketingBus.emit('BRAND_CAMPAIGN_ENDING', userId, payload);
        }
      } else {
        await this.marketingBus.broadcast('BRAND_CAMPAIGN_ENDING', payload);
      }

      await this.prisma.brandCampaign.update({
        where: { id: c.id },
        data: { metadata: { ...meta, endingNotified: true } as Prisma.InputJsonValue },
      });
      endingNotified++;
    }

    return { completed, endingNotified };
  }

  /** Run after order loyalty transaction commits — pauses campaigns / partnerships when budgets hit. */
  async reconcileAfterOrder(campaignId: string | undefined): Promise<void> {
    if (!campaignId) return;
    const c = await this.prisma.brandCampaign.findUnique({
      where: { id: campaignId },
      include: { partnership: true },
    });
    if (!c) return;

    if (
      c.totalPointsBudget != null &&
      c.totalPointsAwarded >= c.totalPointsBudget &&
      c.status === 'ACTIVE'
    ) {
      const u = await this.prisma.brandCampaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' },
      });
      await this.syncLoyaltyMirror(u);
    }

    const p = await this.prisma.brandPartnership.findUnique({ where: { id: c.partnershipId } });
    if (!p) return;
    if (new Decimal(p.spentBudget).lt(p.totalBudget)) return;

    const active = await this.prisma.brandCampaign.findMany({
      where: { partnershipId: p.id, status: 'ACTIVE' },
    });
    for (const row of active) {
      const u = await this.prisma.brandCampaign.update({
        where: { id: row.id },
        data: { status: 'PAUSED' },
      });
      await this.syncLoyaltyMirror(u);
    }
  }

  /**
   * Brand-funded points for an order, caps applied, ledger + analytics rows written in `tx`.
   */
  async applyBrandOrderBoostInTx(
    tx: Prisma.TransactionClient,
    args: {
      userId: string;
      tierLevel: number;
      regionCode: string;
      orderId: string;
      orderTotal: number;
      lines: Array<{
        productId: string;
        fandom?: string | null;
        brand?: string | null;
        categoryId?: string | null;
        lineBase: number;
      }>;
      internalMult: number;
      internalBonus: number;
    },
  ): Promise<{
    brandPoints: number;
    campaignId?: string;
    campaignName?: string;
    partnerName?: string;
    brandMultiplier?: number;
  }> {
    const now = new Date();
    const campaigns = await tx.brandCampaign.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
        type: { in: ['MULTIPLIER', 'BONUS_POINTS'] },
        partnership: {
          status: 'ACTIVE',
          contractStart: { lte: now },
          contractEnd: { gte: now },
        },
      },
      include: { partnership: true },
    });

    const eligible: typeof campaigns = [];
    for (const c of campaigns) {
      if (c.minTierLevel > args.tierLevel) continue;
      if (c.regionCodes.length && !c.regionCodes.includes(args.regionCode)) continue;

      const spentOk = new Decimal(c.partnership.spentBudget).lt(c.partnership.totalBudget);
      if (!spentOk) continue;

      if (c.totalPointsBudget != null && c.totalPointsAwarded >= c.totalPointsBudget) continue;

      if (c.segmentId) {
        const sm = await tx.segmentMembership.findUnique({
          where: { segmentId_userId: { segmentId: c.segmentId, userId: args.userId } },
        });
        if (!sm) continue;
      }

      eligible.push(c);
    }

    if (!eligible.length) {
      return { brandPoints: 0 };
    }

    const { bestMult, multCampaignId, bonusSum, qualifyingBase } = pickBrandCampaignMultipliers(
      eligible,
      args.lines,
    );

    const multPart =
      qualifyingBase > 0 && bestMult > 1
        ? qualifyingBase * args.internalMult * (bestMult - 1)
        : 0;
    let brandRaw = Math.max(0, Math.round(multPart + bonusSum));
    if (brandRaw <= 0) {
      return { brandPoints: 0 };
    }

    let primaryId = multCampaignId;
    if (!primaryId) {
      const b = eligible.find((c) => c.type === 'BONUS_POINTS' && (c.bonusPoints ?? 0) > 0);
      primaryId = b?.id;
    }
    if (!primaryId) return { brandPoints: 0 };

    const primary = eligible.find((c) => c.id === primaryId);
    if (!primary) return { brandPoints: 0 };

    // Lock campaign + partnership so concurrent order completions cannot
    // overspend point budgets (read-budget + increment is not safe otherwise).
    await tx.$executeRaw(
      Prisma.sql`SELECT 1 FROM brand_campaigns WHERE id = ${primaryId}::uuid FOR UPDATE`,
    );
    await tx.$executeRaw(
      Prisma.sql`SELECT 1 FROM brand_partnerships WHERE id = ${primary.partnershipId}::uuid FOR UPDATE`,
    );
    const primaryRow = await tx.brandCampaign.findUnique({
      where: { id: primaryId },
      include: { partnership: true },
    });
    if (!primaryRow) return { brandPoints: 0 };
    if (primaryRow.status !== 'ACTIVE') return { brandPoints: 0 };
    const at = new Date();
    if (at < primaryRow.startsAt || at > primaryRow.endsAt) {
      return { brandPoints: 0 };
    }
    const pship = primaryRow.partnership;
    if (pship.status !== 'ACTIVE' || at < pship.contractStart || at > pship.contractEnd) {
      return { brandPoints: 0 };
    }
    if (!new Decimal(pship.spentBudget).lt(pship.totalBudget)) {
      return { brandPoints: 0 };
    }
    if (
      primaryRow.totalPointsBudget != null &&
      primaryRow.totalPointsAwarded >= primaryRow.totalPointsBudget
    ) {
      return { brandPoints: 0 };
    }

    const userAwarded = await tx.brandCampaignRedemption.aggregate({
      where: { campaignId: primaryId, userId: args.userId },
      _sum: { pointsAwarded: true },
    });
    const prevUser = userAwarded._sum.pointsAwarded ?? 0;
    if (primaryRow.maxPointsPerUser != null) {
      const room = Math.max(0, primaryRow.maxPointsPerUser - prevUser);
      brandRaw = Math.min(brandRaw, room);
    }

    if (primaryRow.totalPointsBudget != null) {
      const roomCamp = Math.max(0, primaryRow.totalPointsBudget - primaryRow.totalPointsAwarded);
      brandRaw = Math.min(brandRaw, roomCamp);
    }

    const pRoom = new Decimal(pship.totalBudget).sub(pship.spentBudget).toNumber();
    const budgetRoomPoints = Math.max(0, Math.floor(pRoom));
    brandRaw = Math.min(brandRaw, budgetRoomPoints);

    if (brandRaw <= 0) {
      return { brandPoints: 0 };
    }

    const prevCount = await tx.brandCampaignRedemption.count({
      where: { campaignId: primaryId, userId: args.userId },
    });

    await tx.brandCampaignRedemption.create({
      data: {
        campaignId: primaryId,
        userId: args.userId,
        orderId: args.orderId,
        pointsAwarded: brandRaw,
        orderTotal: new Decimal(args.orderTotal),
        source: 'PURCHASE',
      },
    });

    await tx.brandCampaign.update({
      where: { id: primaryId },
      data: {
        totalPointsAwarded: { increment: brandRaw },
        totalOrders: { increment: 1 },
        totalRevenue: { increment: new Decimal(args.orderTotal) },
        ...(prevCount === 0 ? { uniqueUsers: { increment: 1 } } : {}),
      },
    });

    await tx.brandPartnership.update({
      where: { id: pship.id },
      data: { spentBudget: { increment: new Decimal(brandRaw) } },
    });

    return {
      brandPoints: brandRaw,
      campaignId: primaryRow.id,
      campaignName: primaryRow.name,
      partnerName: pship.name,
      brandMultiplier: bestMult > 1 ? bestMult : undefined,
    };
  }

  // ── Customer ──

  async getActivePublicCampaigns(userId: string, tierLevel: number): Promise<unknown[]> {
    const now = new Date();
    const rows = await this.prisma.brandCampaign.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
        minTierLevel: { lte: tierLevel },
        partnership: {
          status: 'ACTIVE',
          contractStart: { lte: now },
          contractEnd: { gte: now },
        },
      },
      include: { partnership: { select: { id: true, name: true, slug: true, logoUrl: true } } },
      orderBy: { startsAt: 'desc' },
    });

    const out: unknown[] = [];
    for (const c of rows) {
      if (c.segmentId) {
        const sm = await this.prisma.segmentMembership.findUnique({
          where: { segmentId_userId: { segmentId: c.segmentId, userId } },
        });
        if (!sm) continue;
      }
      out.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        type: c.type,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        multiplier: c.multiplier?.toNumber() ?? null,
        bonusPoints: c.bonusPoints,
        targetFandoms: c.targetFandoms,
        targetBrands: c.targetBrands,
        featuredProductIds: c.featuredProductIds,
        exclusiveTierLevel: c.exclusiveTierLevel,
        partner: c.partnership,
      });
    }
    return out;
  }

  async getCampaignProducts(campaignId: string, limit = 24): Promise<unknown[]> {
    const c = await this.ensureCampaign(campaignId);
    const take = Math.min(100, Math.max(1, limit));

    const hasTargets =
      c.targetProductIds.length ||
      c.targetBrands.length ||
      c.targetFandoms.length ||
      c.targetCategoryIds.length;

    if (!hasTargets) {
      return this.prisma.product.findMany({
        take,
        where: { status: ProductStatus.ACTIVE },
        select: { id: true, name: true, slug: true, fandom: true, brand: true, categoryId: true },
      });
    }

    const or: Prisma.ProductWhereInput[] = [];
    if (c.targetProductIds.length) {
      or.push({ id: { in: c.targetProductIds } });
    }
    if (c.targetCategoryIds.length) {
      or.push({ categoryId: { in: c.targetCategoryIds } });
    }
    if (c.targetBrands.length) {
      or.push({
        OR: c.targetBrands.map((b) => ({
          brand: { equals: b, mode: 'insensitive' as const },
        })),
      });
    }
    if (c.targetFandoms.length) {
      or.push({
        OR: c.targetFandoms.map((f) => ({
          fandom: { equals: f, mode: 'insensitive' as const },
        })),
      });
    }

    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, OR: or },
      take,
      select: { id: true, name: true, slug: true, fandom: true, brand: true, categoryId: true },
    });
  }

  // ── Reports ──

  async getPartnershipReport(id: string): Promise<unknown> {
    const p = await this.getPartnership(id);
    const redemptions = await this.prisma.brandCampaignRedemption.findMany({
      where: { campaign: { partnershipId: id } },
      select: { createdAt: true, pointsAwarded: true, orderTotal: true, orderId: true },
    });

    const byDay = new Map<string, { pointsAwarded: number; orders: number; revenue: number }>();
    for (const r of redemptions) {
      const d = r.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { pointsAwarded: 0, orders: 0, revenue: 0 };
      cur.pointsAwarded += r.pointsAwarded;
      cur.orders += r.orderId ? 1 : 0;
      cur.revenue += r.orderTotal ? new Decimal(r.orderTotal).toNumber() : 0;
      byDay.set(d, cur);
    }
    const timeline = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const total = new Decimal(p.totalBudget).toNumber();
    const spent = new Decimal(p.spentBudget).toNumber();

    return {
      partnership: {
        id: p.id,
        name: p.name,
        status: p.status,
        contractStart: p.contractStart.toISOString(),
        contractEnd: p.contractEnd.toISOString(),
      },
      budget: {
        total,
        spent,
        remaining: Math.max(0, total - spent),
        utilizationPercent: total > 0 ? Math.round((spent / total) * 10000) / 100 : 0,
      },
      campaigns: p.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        pointsAwarded: c.totalPointsAwarded,
        orders: c.totalOrders,
        revenue: new Decimal(c.totalRevenue).toNumber(),
        uniqueUsers: c.uniqueUsers,
      })),
      timeline,
    };
  }

  async getCampaignReport(id: string): Promise<unknown> {
    const c = await this.getCampaign(id);
    const redemptions = await this.prisma.brandCampaignRedemption.findMany({
      where: { campaignId: id },
      select: { createdAt: true, pointsAwarded: true, orderId: true },
    });

    const byDay = new Map<string, { points: number; orders: number }>();
    for (const r of redemptions) {
      const d = r.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { points: 0, orders: 0 };
      cur.points += r.pointsAwarded;
      if (r.orderId) cur.orders += 1;
      byDay.set(d, cur);
    }
    const dailyTrend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, points: v.points, orders: v.orders }));

    const topProductsMap = new Map<string, { orders: number; points: number }>();
    const orderIds = [...new Set(redemptions.map((r) => r.orderId).filter(Boolean) as string[])];
    if (orderIds.length) {
      const pointsByOrder = new Map<string, number>();
      for (const r of redemptions) {
        if (!r.orderId) continue;
        pointsByOrder.set(r.orderId, (pointsByOrder.get(r.orderId) ?? 0) + r.pointsAwarded);
      }

      const items = await this.prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { orderId: true, productId: true, quantity: true, price: true },
      });

      const orderTotals = new Map<string, number>();
      for (const it of items) {
        const lineVal = new Decimal(it.price).mul(it.quantity).toNumber();
        orderTotals.set(it.orderId, (orderTotals.get(it.orderId) ?? 0) + lineVal);
      }

      for (const it of items) {
        const pid = it.productId;
        const cur = topProductsMap.get(pid) ?? { orders: 0, points: 0 };
        cur.orders += it.quantity;
        const oTotal = orderTotals.get(it.orderId) ?? 1;
        const oPoints = pointsByOrder.get(it.orderId) ?? 0;
        const lineVal = new Decimal(it.price).mul(it.quantity).toNumber();
        cur.points += oTotal > 0 ? Math.round((lineVal / oTotal) * oPoints) : 0;
        topProductsMap.set(pid, cur);
      }
    }

    const pids = [...topProductsMap.keys()];
    const prodRows = await this.prisma.product.findMany({
      where: { id: { in: pids } },
      select: { id: true, name: true },
    });
    const nameById = new Map(prodRows.map((r) => [r.id, r.name]));

    const topProducts = [...topProductsMap.entries()]
      .map(([productId, v]) => ({
        productId,
        name: nameById.get(productId) ?? productId,
        orders: v.orders,
        points: v.points,
      }))
      .sort((a, b) => b.points - a.points);

    return {
      campaign: {
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
      },
      totals: {
        pointsAwarded: c.totalPointsAwarded,
        orders: c.totalOrders,
        revenue: new Decimal(c.totalRevenue).toNumber(),
        uniqueUsers: c.uniqueUsers,
      },
      budgetUsage: {
        perUserCap: c.maxPointsPerUser,
        totalCap: c.totalPointsBudget,
        used: c.totalPointsAwarded,
      },
      dailyTrend,
      topProducts,
    };
  }

  async getDashboard(): Promise<unknown> {
    const [totalPartnerships, activePartnerships, activeCampaigns, partners] = await Promise.all([
      this.prisma.brandPartnership.count(),
      this.prisma.brandPartnership.count({ where: { status: 'ACTIVE' } }),
      this.prisma.brandCampaign.count({ where: { status: 'ACTIVE' } }),
      this.prisma.brandPartnership.findMany({
        orderBy: { spentBudget: 'desc' },
        take: 8,
        include: { _count: { select: { campaigns: true } } },
      }),
    ]);

    const agg = await this.prisma.brandCampaign.aggregate({
      _sum: { totalPointsAwarded: true, totalRevenue: true },
    });

    const budgetRows = await this.prisma.brandPartnership.findMany({
      where: { totalBudget: { gt: 0 } },
      select: { totalBudget: true, spentBudget: true },
    });
    let utilSum = 0;
    let utilN = 0;
    for (const r of budgetRows) {
      const t = new Decimal(r.totalBudget).toNumber();
      if (t <= 0) continue;
      utilSum += new Decimal(r.spentBudget).toNumber() / t;
      utilN++;
    }
    const budgetUtilization = utilN > 0 ? Math.round((utilSum / utilN) * 10000) / 100 : 0;

    const recentCampaigns = await this.prisma.brandCampaign.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: { partnership: { select: { name: true } } },
    });

    return {
      totalPartnerships,
      activePartnerships,
      activeCampaigns,
      totalBrandFundedPoints: agg._sum.totalPointsAwarded ?? 0,
      totalBrandRevenue: new Decimal(agg._sum.totalRevenue ?? 0).toNumber(),
      budgetUtilization,
      topPartners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        spent: new Decimal(p.spentBudget).toNumber(),
        campaigns: p._count.campaigns,
      })),
      recentCampaigns: recentCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        partnerName: c.partnership.name,
        status: c.status,
        pointsAwarded: c.totalPointsAwarded,
      })),
    };
  }

  async runReportJob(): Promise<{ ok: true }> {
    return { ok: true };
  }

  private async ensurePartnership(id: string): Promise<BrandPartnership> {
    const p = await this.prisma.brandPartnership.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Partnership not found');
    return p;
  }

  private async ensureCampaign(id: string): Promise<BrandCampaign> {
    const c = await this.prisma.brandCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }
}
