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

  private async resolveMatchingUserIds(rules: SegmentRuleGroup): Promise<string[]> {
    const where = buildSegmentUserWhere(rules);
    const countRules = extractCountRules(rules);
    const rows = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        _count: { select: { eventAttendances: true, quizAttempts: true } },
      },
    });
    if (!countRules.length) {
      return rows.map((r) => r.id);
    }
    return rows
      .filter((r) =>
        countRules.every((cr: CountRule) =>
          countRuleMatches(
            {
              eventAttendances: r._count.eventAttendances,
              quizAttempts: r._count.quizAttempts,
            },
            cr,
          ),
        ),
      )
      .map((r) => r.id);
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
    const where = buildSegmentUserWhere(rules);
    const countRules = extractCountRules(rules);
    const previewLimit = this.config.get<number>('SEGMENT_PREVIEW_LIMIT', 10);

    const count = countRules.length
      ? (
          await this.prisma.user.findMany({
            where,
            select: {
              id: true,
              _count: { select: { eventAttendances: true, quizAttempts: true } },
            },
          })
        ).filter((r) =>
          countRules.every((cr: CountRule) =>
            countRuleMatches(
              {
                eventAttendances: r._count.eventAttendances,
                quizAttempts: r._count.quizAttempts,
              },
              cr,
            ),
          ),
        ).length
      : await this.prisma.user.count({ where });

    const candidates = await this.prisma.user.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        country: true,
        _count: { select: { eventAttendances: true, quizAttempts: true } },
        loyaltyMembership: { select: { tier: { select: { name: true } } } },
      },
    });
    const filtered = countRules.length
      ? candidates.filter((r) =>
          countRules.every((cr: CountRule) =>
            countRuleMatches(
              {
                eventAttendances: r._count.eventAttendances,
                quizAttempts: r._count.quizAttempts,
              },
              cr,
            ),
          ),
        )
      : candidates;

    const sampleUsers: PreviewUser[] = filtered.slice(0, previewLimit).map((u) => ({
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
    ];
    return dims.map((dimension) => {
      const prefix = Object.keys(categories).find((k) => dimension.startsWith(k)) || '';
      const category = categories[prefix] || 'Other';
      const meta = SEGMENT_DIMENSIONS[dimension];
      return { dimension, category, operators: meta?.operators ?? [] };
    });
  }
}
