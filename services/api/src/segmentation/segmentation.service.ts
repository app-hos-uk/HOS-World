import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AudienceSegment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  assertSafeCountComposition,
  buildSegmentUserWhere,
  countRuleMatches,
  extractCountRules,
  extractTouristRule,
  SEGMENT_DIMENSIONS,
  validateRuleGroup,
  type CountRule,
  type SegmentRuleGroup,
} from './engines/rule-evaluator';
import type { CreateSegmentDto } from './dto/create-segment.dto';
import type { UpdateSegmentDto } from './dto/update-segment.dto';

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return s || 'segment';
}

/** Collapse common country aliases so e.g. UK vs GB does not false-flag tourists. */
function normalizeGeoRegion(code: string | null | undefined): string | null {
  if (code == null) return null;
  const raw = String(code).trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'UK' || raw === 'GBR') return 'GB';
  if (raw.length === 2) return raw;
  return raw;
}

export type PreviewUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  tier: string | null;
  country: string | null;
};

export type SegmentMember = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tierName: string | null;
  points: number;
  country: string | null;
  joinedAt: Date;
};

@Injectable()
export class SegmentationService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private asRuleGroup(rules: unknown): SegmentRuleGroup {
    if (!rules || typeof rules !== 'object') {
      throw new BadRequestException('rules must be an object');
    }
    const g = rules as SegmentRuleGroup;
    if (g.operator !== 'AND' && g.operator !== 'OR') {
      throw new BadRequestException('rules.operator must be AND or OR');
    }
    if (!Array.isArray(g.rules)) {
      throw new BadRequestException('rules.rules must be an array');
    }
    return g;
  }

  validateRules(group: SegmentRuleGroup): void {
    validateRuleGroup(group);
    assertSafeCountComposition(group);
  }

  private async ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let n = 0;
    for (;;) {
      const found = await this.prisma.audienceSegment.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      });
      if (!found) return slug;
      n++;
      slug = `${base}-${n}`;
    }
  }

  async create(dto: CreateSegmentDto, createdBy: string): Promise<AudienceSegment> {
    const rules = this.asRuleGroup(dto.rules);
    this.validateRules(rules);
    const baseSlug = dto.slug?.trim() || slugify(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    const segment = await this.prisma.audienceSegment.create({
      data: {
        slug,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type ?? 'DYNAMIC',
        status: dto.status ?? 'ACTIVE',
        rules: rules as unknown as Prisma.InputJsonValue,
        refreshCron: dto.refreshCron ?? null,
        isTemplate: dto.isTemplate ?? false,
        templateSlug: dto.templateSlug ?? null,
        createdBy,
      },
    });
    if (segment.status === 'ACTIVE' && segment.type === 'DYNAMIC') {
      await this.evaluateSegment(segment.id).catch(() => {});
    }
    return segment;
  }

  async update(id: string, dto: UpdateSegmentDto): Promise<AudienceSegment> {
    const existing = await this.prisma.audienceSegment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Segment not found');
    let rulesJson: Prisma.InputJsonValue | undefined;
    if (dto.rules != null) {
      const rules = this.asRuleGroup(dto.rules);
      this.validateRules(rules);
      rulesJson = rules as unknown as Prisma.InputJsonValue;
    }
    const segment = await this.prisma.audienceSegment.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        type: dto.type,
        rules: rulesJson,
        refreshCron: dto.refreshCron,
      },
    });
    if (rulesJson != null && segment.status === 'ACTIVE' && segment.type === 'DYNAMIC') {
      await this.evaluateSegment(id).catch(() => {});
    }
    return segment;
  }

  async archive(id: string): Promise<AudienceSegment> {
    const existing = await this.prisma.audienceSegment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Segment not found');
    await this.prisma.segmentMembership.deleteMany({ where: { segmentId: id } });
    return this.prisma.audienceSegment.update({
      where: { id },
      data: { status: 'ARCHIVED', memberCount: 0, lastEvaluatedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.audienceSegment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Segment not found');
    if (existing.status !== 'ARCHIVED') {
      throw new BadRequestException('Only archived segments can be deleted');
    }
    await this.prisma.audienceSegment.delete({ where: { id } });
  }

  async findAll(filters: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AudienceSegment[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.AudienceSegmentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    const [items, total] = await Promise.all([
      this.prisma.audienceSegment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.audienceSegment.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string): Promise<AudienceSegment & { members: number }> {
    const s = await this.prisma.audienceSegment.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Segment not found');
    const members = await this.prisma.segmentMembership.count({ where: { segmentId: id } });
    return { ...s, members };
  }

  async findBySlug(slug: string): Promise<AudienceSegment> {
    const s = await this.prisma.audienceSegment.findUnique({ where: { slug } });
    if (!s) throw new NotFoundException('Segment not found');
    return s;
  }

  async findTemplates(): Promise<AudienceSegment[]> {
    return this.prisma.audienceSegment.findMany({
      where: { isTemplate: true },
      orderBy: { name: 'asc' },
    });
  }

  private async resolveTouristFlags(userIds: string[]): Promise<Map<string, boolean>> {
    const out = new Map<string, boolean>();
    if (!userIds.length) return out;

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, country: true },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        userId: { in: userIds },
        parentOrderId: null,
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        createdAt: true,
        shippingAddress: { select: { country: true } },
        clickCollect: { select: { store: { select: { defaultRegionCode: true } } } },
      },
    });
    const latestOrder = new Map<string, { at: Date; region: string | null }>();
    for (const o of orders) {
      if (latestOrder.has(o.userId)) continue;
      const region =
        o.clickCollect?.store?.defaultRegionCode || o.shippingAddress?.country || null;
      latestOrder.set(o.userId, {
        at: o.createdAt,
        region: normalizeGeoRegion(region ? String(region) : null),
      });
    }

    const sales = await this.prisma.pOSSale.findMany({
      where: { customerId: { in: userIds } },
      orderBy: { saleDate: 'desc' },
      select: {
        customerId: true,
        saleDate: true,
        store: { select: { defaultRegionCode: true } },
      },
    });
    const latestSale = new Map<string, { at: Date; region: string | null }>();
    for (const s of sales) {
      if (!s.customerId || latestSale.has(s.customerId)) continue;
      latestSale.set(s.customerId, {
        at: s.saleDate,
        region: normalizeGeoRegion(s.store?.defaultRegionCode ?? null),
      });
    }

    for (const u of users) {
      const o = latestOrder.get(u.id);
      const s = latestSale.get(u.id);
      let purchaseRegion: string | null = null;
      if (o && s) {
        purchaseRegion = s.at.getTime() > o.at.getTime() ? s.region : o.region;
      } else {
        purchaseRegion = o?.region ?? s?.region ?? null;
      }
      const userGeoNorm = normalizeGeoRegion(u.country) ?? '';
      const isTourist =
        !!purchaseRegion &&
        !!userGeoNorm &&
        userGeoNorm.length > 0 &&
        purchaseRegion.length > 0 &&
        userGeoNorm !== purchaseRegion;
      out.set(u.id, isTourist);
    }
    return out;
  }

  private async resolveMatchingUserIds(rules: SegmentRuleGroup): Promise<string[]> {
    const where = buildSegmentUserWhere(rules);
    const countRules = extractCountRules(rules);
    const touristWant = extractTouristRule(rules);
    const rows = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        _count: {
          select: {
            eventAttendances: true,
            quizAttempts: true,
            brandCampaignRedemptions: true,
          },
        },
      },
    });
    let ids = rows.map((r) => r.id);
    if (countRules.length) {
      ids = rows
        .filter((r) =>
          countRules.every((cr: CountRule) =>
            countRuleMatches(
              {
                eventAttendances: r._count.eventAttendances,
                quizAttempts: r._count.quizAttempts,
                brandRedemptions: r._count.brandCampaignRedemptions,
              },
              cr,
            ),
          ),
        )
        .map((r) => r.id);
    }
    if (touristWant !== null) {
      const flags = await this.resolveTouristFlags(ids);
      ids = ids.filter((id) => flags.get(id) === touristWant);
    }
    return ids;
  }

  async evaluateSegment(segmentId: string): Promise<{ added: number; removed: number; total: number }> {
    const segment = await this.prisma.audienceSegment.findUnique({ where: { id: segmentId } });
    if (!segment) throw new NotFoundException('Segment not found');
    if (segment.status === 'ARCHIVED') {
      return { added: 0, removed: 0, total: 0 };
    }
    if (segment.type !== 'DYNAMIC') {
      return { added: 0, removed: 0, total: segment.memberCount };
    }

    const rules = segment.rules as unknown as SegmentRuleGroup;
    const matchedIds = new Set(await this.resolveMatchingUserIds(rules));
    const current = await this.prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { userId: true },
    });
    const currentSet = new Set(current.map((c) => c.userId));
    const newUserIds = [...matchedIds].filter((id) => !currentSet.has(id));
    const staleUserIds = [...currentSet].filter((id) => !matchedIds.has(id));

    const batchSize = this.config.get<number>('SEGMENT_EVAL_BATCH_SIZE', 500);

    for (let i = 0; i < staleUserIds.length; i += batchSize) {
      const chunk = staleUserIds.slice(i, i + batchSize);
      await this.prisma.segmentMembership.deleteMany({
        where: { segmentId, userId: { in: chunk } },
      });
    }

    for (let i = 0; i < newUserIds.length; i += batchSize) {
      const chunk = newUserIds.slice(i, i + batchSize);
      await this.prisma.segmentMembership.createMany({
        data: chunk.map((userId) => ({ segmentId, userId })),
        skipDuplicates: true,
      });
    }

    await this.prisma.audienceSegment.update({
      where: { id: segmentId },
      data: {
        memberCount: matchedIds.size,
        lastEvaluatedAt: new Date(),
      },
    });

    return { added: newUserIds.length, removed: staleUserIds.length, total: matchedIds.size };
  }

  async evaluateAllActive(): Promise<{ evaluated: number; errors: number }> {
    const segments = await this.prisma.audienceSegment.findMany({
      where: { status: 'ACTIVE', type: 'DYNAMIC' },
      select: { id: true },
    });
    let errors = 0;
    for (const s of segments) {
      try {
        await this.evaluateSegment(s.id);
      } catch {
        errors++;
      }
    }
    return { evaluated: segments.length, errors };
  }

  async previewSegment(rules: SegmentRuleGroup): Promise<{ count: number; sampleUsers: PreviewUser[] }> {
    this.validateRules(rules);
    const previewLimit = this.config.get<number>('SEGMENT_PREVIEW_LIMIT', 10);
    const matched = await this.resolveMatchingUserIds(rules);
    const count = matched.length;
    const idSet = new Set(matched);
    const take = Math.min(500, Math.max(previewLimit * 20, previewLimit));
    const candidates = await this.prisma.user.findMany({
      where: { id: { in: matched.slice(0, take) } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        country: true,
        loyaltyMembership: { select: { tier: { select: { name: true } } } },
      },
    });
    const sampleUsers: PreviewUser[] = candidates
      .filter((u) => idSet.has(u.id))
      .slice(0, previewLimit)
      .map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        tier: u.loyaltyMembership?.tier?.name ?? null,
        country: u.country ?? null,
      }));

    return { count, sampleUsers };
  }

  async getSegmentMembers(
    segmentId: string,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{ items: SegmentMember[]; total: number }> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const whereMembership: Prisma.SegmentMembershipWhereInput = { segmentId };
    if (search?.trim()) {
      const q = search.trim();
      whereMembership.user = {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.segmentMembership.findMany({
        where: whereMembership,
        orderBy: { joinedAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              country: true,
              loyaltyMembership: { select: { currentBalance: true, tier: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.segmentMembership.count({ where: whereMembership }),
    ]);
    const items: SegmentMember[] = rows.map((r) => ({
      userId: r.user.id,
      email: r.user.email,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      tierName: r.user.loyaltyMembership?.tier?.name ?? null,
      points: r.user.loyaltyMembership?.currentBalance ?? 0,
      country: r.user.country ?? null,
      joinedAt: r.joinedAt,
    }));
    return { items, total };
  }

  async getUserSegments(userId: string): Promise<AudienceSegment[]> {
    const memberships = await this.prisma.segmentMembership.findMany({
      where: { userId },
      include: { segment: true },
    });
    return memberships.map((m) => m.segment);
  }

  async getSegmentUserIds(segmentId: string): Promise<string[]> {
    const rows = await this.prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async touchActivity(userId: string): Promise<void> {
    await this.prisma.loyaltyMembership.updateMany({
      where: { userId },
      data: { lastActivityAt: new Date() },
    });
  }

  dimensionsCatalog(): {
    dimension: string;
    category: string;
    operators: string[];
  }[] {
    const categories: Record<string, string> = {
      'tier.': 'Tier',
      'points.': 'Points & spend',
      'spend.': 'Points & spend',
      'purchase.': 'Points & spend',
      'engagement.': 'Points & spend',
      'composite.': 'Points & spend',
      'activity.': 'Activity',
      'geo.': 'Geography',
      'fandom.': 'Fandom',
      'user.': 'Demographics',
      'enrollment.': 'Enrollment',
      'comms.': 'Communication',
      'events.': 'Events',
      'quiz.': 'Quiz',
      'brand.': 'Brand partnerships',
    };
    const dims = [
      'tier.slug',
      'tier.level',
      'points.balance',
      'points.lifetime',
      'spend.total',
      'purchase.count',
      'engagement.count',
      'composite.score',
      'activity.lastAt',
      'activity.enrolledAt',
      'activity.lastLogin',
      'geo.country',
      'geo.regionCode',
      'geo.city',
      'geo.isTourist',
      'fandom.favorites',
      'fandom.affinity',
      'user.role',
      'user.birthday',
      'user.customerGroup',
      'enrollment.channel',
      'comms.optInEmail',
      'comms.optInSms',
      'comms.optInWhatsApp',
      'comms.optInPush',
      'events.attendanceCount',
      'events.hasAttended',
      'quiz.completedCount',
      'ambassador.status',
      'ambassador.tier',
      'ambassador.referralSignups',
      'ambassador.ugcApproved',
      'ambassador.isAmbassador',
      'brand.activeCampaignCount',
      'brand.hasRedeemed',
    ];
    return dims.map((dimension) => {
      const prefix = Object.keys(categories).find((k) => dimension.startsWith(k)) || '';
      const category = categories[prefix] || 'Other';
      const meta = SEGMENT_DIMENSIONS[dimension];
      return { dimension, category, operators: meta?.operators ?? [] };
    });
  }
}
