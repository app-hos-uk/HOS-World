import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { FeatureFlag, FeatureFlagsService } from '../config/feature-flags.service';
import { PrismaService } from '../database/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { JobType, QueueService } from '../queue/queue.service';
import { TemplatesService } from '../templates/templates.service';

export type AudienceType = 'INDIVIDUAL' | 'SEGMENT' | 'ALL';

export interface AudienceFilters {
  role?: string;
  tierSlug?: string;
  regionCode?: string;
}

export interface AudienceParams {
  audienceType: AudienceType;
  userIds?: string[];
  search?: string;
  filters?: AudienceFilters;
}

export interface AudienceUser {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

export interface ResolveAudienceResult {
  count: number;
  cap: number;
  capped: boolean;
  sample: AudienceUser[];
  missing?: string[];
}

export type MailboxSource = 'all' | 'transactional' | 'marketing' | 'campaign';

const VAR_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const VALID_ROLES = new Set(Object.values(UserRole));

@Injectable()
export class AdminEmailService {
  private readonly logger = new Logger(AdminEmailService.name);
  private readonly recipientCap: number;

  constructor(
    private prisma: PrismaService,
    private messaging: MessagingService,
    private queue: QueueService,
    private flags: FeatureFlagsService,
    private config: ConfigService,
    private templates: TemplatesService,
  ) {
    this.recipientCap = Number(this.config.get('ADMIN_EMAIL_RECIPIENT_CAP') ?? 2000);
  }

  getCap(): number {
    return this.recipientCap;
  }

  async resolveAudience(audience: AudienceParams): Promise<ResolveAudienceResult> {
    const { users, missing, totalCount } = await this.loadAudience(audience);
    const count = totalCount;
    const capped = count > this.recipientCap;
    return {
      count,
      cap: this.recipientCap,
      capped,
      sample: users.slice(0, 20),
      ...(missing?.length ? { missing } : {}),
    };
  }

  async sendCampaign(
    params: AudienceParams & {
      templateSlug?: string;
      subject: string;
      bodyHtml: string;
      dryRun?: boolean;
    },
    sentBy: string,
  ) {
    if (!this.flags.isEnabled(FeatureFlag.ADMIN_EMAIL_COMPOSE)) {
      throw new ForbiddenException('Admin email compose is disabled');
    }

    const subject = (params.subject ?? '').trim();
    const bodyHtml = (params.bodyHtml ?? '').trim();
    if (!subject) {
      throw new BadRequestException('subject is required');
    }
    if (!bodyHtml) {
      throw new BadRequestException('bodyHtml is required');
    }

    const resolved = await this.resolveAudience(params);
    if (resolved.count === 0) {
      return {
        dryRun: params.dryRun !== false,
        targeted: 0,
        wouldSend: 0,
        skippedConsent: 0,
        skippedNoEmail: 0,
        sent: 0,
        failed: 0,
      };
    }

    if (resolved.count > this.recipientCap) {
      throw new BadRequestException(
        `Audience of ${resolved.count} exceeds the maximum of ${this.recipientCap}. Narrow the audience and try again.`,
      );
    }

    // Safer default: omitted dryRun means dry run. Live send requires dryRun: false.
    const dryRun = params.dryRun !== false;

    const { users } = await this.loadAudience(params, { fetchAll: true });

    if (dryRun) {
      let wouldSend = 0;
      let skippedConsent = 0;
      for (const user of users) {
        const allowed = await this.messaging.canSendMarketing(user.userId, 'EMAIL');
        if (allowed) wouldSend += 1;
        else skippedConsent += 1;
      }
      return {
        dryRun: true,
        targeted: users.length,
        wouldSend,
        skippedConsent,
        skippedNoEmail: 0,
      };
    }

    const audienceQuery = {
      audienceType: params.audienceType,
      userIds: params.userIds,
      search: params.search,
      filters: params.filters,
    };

    const campaign = await this.prisma.adminEmailCampaign.create({
      data: {
        subject,
        bodyHtml,
        templateSlug: params.templateSlug ?? null,
        audienceType: params.audienceType,
        audienceQuery: audienceQuery as object,
        recipientCount: users.length,
        status: 'QUEUED',
        sentBy,
      },
    });

    const snapshotSlug = `admin_campaign_${campaign.id}`;
    const variables = this.extractTemplateVars(subject + bodyHtml);

    await this.prisma.emailTemplate.upsert({
      where: { slug: snapshotSlug },
      create: {
        slug: snapshotSlug,
        subject,
        body: bodyHtml,
        variables,
        description: 'Admin campaign snapshot',
        isActive: true,
        updatedBy: sentBy,
      },
      update: {
        subject,
        body: bodyHtml,
        variables,
        description: 'Admin campaign snapshot',
        isActive: true,
        updatedBy: sentBy,
      },
    });

    await this.prisma.adminEmailCampaign.update({
      where: { id: campaign.id },
      data: {
        audienceQuery: { ...audienceQuery, snapshotSlug } as object,
      },
    });

    const jobId = await this.queue.addJob(JobType.ADMIN_EMAIL_CAMPAIGN, {
      campaignId: campaign.id,
    });

    return {
      dryRun: false,
      campaignId: campaign.id,
      jobId,
      targeted: users.length,
    };
  }

  async processCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.adminEmailCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign || campaign.status === 'COMPLETED') {
      return;
    }

    await this.prisma.adminEmailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENDING',
        sentAt: campaign.sentAt ?? new Date(),
      },
    });

    try {
      const rawQuery = (campaign.audienceQuery ?? {}) as Record<string, unknown>;
      const snapshotSlug =
        typeof rawQuery.snapshotSlug === 'string' ? rawQuery.snapshotSlug : null;
      if (!snapshotSlug) {
        throw new Error('Campaign missing snapshotSlug in audienceQuery');
      }

      const { snapshotSlug: _snap, ...audienceRest } = rawQuery;
      const audience: AudienceParams = {
        audienceType: (audienceRest.audienceType as AudienceType) || (campaign.audienceType as AudienceType),
        userIds: audienceRest.userIds as string[] | undefined,
        search: audienceRest.search as string | undefined,
        filters: audienceRest.filters as AudienceFilters | undefined,
      };

      const { users } = await this.loadAudience(audience, { fetchAll: true });

      const alreadySent = new Set(
        (
          await this.prisma.messageLog.findMany({
            where: {
              channel: 'EMAIL',
              metadata: { path: ['campaignId'], equals: campaignId },
              status: { in: ['SENT', 'SKIPPED_NO_CONFIG', 'SKIPPED_CONSENT'] },
            },
            select: { userId: true },
          })
        ).map((l) => l.userId),
      );

      let sentCount = campaign.sentCount;
      let failedCount = campaign.failedCount;
      let skippedCount = campaign.skippedCount;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (alreadySent.has(user.userId)) continue;
        const templateVars: Record<string, string> = {
          firstName: user.firstName || 'there',
          lastName: user.lastName || '',
          email: user.email,
        };

        try {
          const personalizedSubject = campaign.subject.replace(
            VAR_TOKEN_RE,
            (_, key: string) => templateVars[key] ?? '',
          );

          const result = await this.messaging.send({
            userId: user.userId,
            channel: 'EMAIL',
            templateSlug: snapshotSlug,
            templateVars,
            subject: personalizedSubject,
            metadata: { campaignId, source: 'campaign' },
          });

          if (result.success) {
            sentCount += 1;
          } else if (result.error === 'SKIPPED_CONSENT') {
            skippedCount += 1;
          } else {
            failedCount += 1;
          }
        } catch (err) {
          failedCount += 1;
          this.logger.warn(
            `Campaign ${campaignId} send failed for ${user.userId}: ${(err as Error).message}`,
          );
        }

        if ((i + 1) % 100 === 0) {
          this.logger.log(
            `Campaign ${campaignId} progress: ${i + 1}/${users.length} (sent=${sentCount} failed=${failedCount} skipped=${skippedCount})`,
          );
          await this.prisma.adminEmailCampaign.update({
            where: { id: campaignId },
            data: { sentCount, failedCount, skippedCount },
          });
        }
      }

      await this.prisma.adminEmailCampaign.update({
        where: { id: campaignId },
        data: {
          sentCount,
          failedCount,
          skippedCount,
          status: 'COMPLETED',
        },
      });
      this.logger.log(
        `Campaign ${campaignId} completed: sent=${sentCount} failed=${failedCount} skipped=${skippedCount}`,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Campaign ${campaignId} failed: ${message}`);
      await this.prisma.adminEmailCampaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', error: message },
      });
    }
  }

  async searchUsers(search?: string): Promise<AudienceUser[]> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      email: { not: '' },
    };
    const q = (search ?? '').trim();
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.user.findMany({
      where,
      take: 20,
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return rows.map((u) => ({
      userId: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
    }));
  }

  async listCampaigns(page = 1, limit = 25) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.adminEmailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.adminEmailCampaign.count(),
    ]);
    return { items, total, page: Math.max(page, 1), limit: take };
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.adminEmailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign "${id}" not found`);
    }

    const messageLogs = await this.prisma.messageLog.findMany({
      where: {
        channel: 'EMAIL',
        metadata: { path: ['campaignId'], equals: id },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return { campaign, messageLogs };
  }

  async getMailbox(params: {
    source?: MailboxSource;
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const source = params.source ?? 'all';
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const skip = (page - 1) * limit;
    const stats = await this.computeMailboxStats();

    if (source === 'campaign') {
      const where: Prisma.AdminEmailCampaignWhereInput = {};
      if (params.status) where.status = params.status;
      if (params.q?.trim()) {
        where.subject = { contains: params.q.trim(), mode: 'insensitive' };
      }
      const [campaigns, total] = await Promise.all([
        this.prisma.adminEmailCampaign.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.adminEmailCampaign.count({ where }),
      ]);
      const items = campaigns.map((c) => ({
        id: c.id,
        source: 'campaign' as const,
        subject: c.subject,
        recipientEmail: null,
        recipientName: null,
        status: c.status,
        sentAt: c.sentAt ?? c.createdAt,
        templateSlug: c.templateSlug,
        campaignId: c.id,
        recipientCount: c.recipientCount,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
      }));
      return { items, total, page, limit, stats };
    }

    if (source === 'marketing') {
      const { items, total } = await this.listMarketingMailbox({
        status: params.status,
        q: params.q,
        skip,
        take: limit,
      });
      return { items, total, page, limit, stats };
    }

    if (source === 'transactional') {
      const { items, total } = await this.listTransactionalMailbox({
        status: params.status,
        q: params.q,
        skip,
        take: limit,
      });
      return { items, total, page, limit, stats };
    }

    // source=all: individual sent emails only (MessageLog + Notification).
    // Campaigns are NOT mixed into "all" — use source=campaign for campaign rows.
    const fetchN = page * limit;
    const [marketing, transactional] = await Promise.all([
      this.listMarketingMailbox({
        status: params.status,
        q: params.q,
        skip: 0,
        take: fetchN,
      }),
      this.listTransactionalMailbox({
        status: params.status,
        q: params.q,
        skip: 0,
        take: fetchN,
      }),
    ]);

    const merged = [...marketing.items, ...transactional.items].sort((a, b) => {
      const ta = new Date(a.sentAt ?? 0).getTime();
      const tb = new Date(b.sentAt ?? 0).getTime();
      return tb - ta;
    });
    const items = merged.slice(skip, skip + limit);
    const total = marketing.total + transactional.total;
    return { items, total, page, limit, stats };
  }

  async getMailboxDetail(source: string, id: string) {
    if (source === 'marketing') {
      const log = await this.prisma.messageLog.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      if (!log || log.channel !== 'EMAIL') {
        throw new NotFoundException(`Marketing message "${id}" not found`);
      }
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const body = await this.resolveMarketingBody(log.templateSlug, meta);
      return {
        source: 'marketing' as const,
        id: log.id,
        subject: log.subject,
        body,
        status: log.status,
        templateSlug: log.templateSlug,
        recipientEmail: log.user?.email ?? null,
        recipientName: [log.user?.firstName, log.user?.lastName].filter(Boolean).join(' ') || null,
        userId: log.userId,
        metadata: meta,
        vars: meta.vars ?? null,
        error: log.error,
        sentAt: log.sentAt,
        deliveredAt: log.deliveredAt,
        openedAt: log.openedAt,
        clickedAt: log.clickedAt,
        createdAt: log.createdAt,
        campaignId: typeof meta.campaignId === 'string' ? meta.campaignId : null,
      };
    }

    if (source === 'transactional') {
      const n = await this.prisma.notification.findUnique({ where: { id } });
      if (!n || (n.email == null && n.subject == null)) {
        throw new NotFoundException(`Transactional notification "${id}" not found`);
      }
      return {
        source: 'transactional' as const,
        id: n.id,
        subject: n.subject,
        body: n.content,
        status: n.status,
        email: n.email,
        recipientEmail: n.email,
        sentAt: n.sentAt,
        createdAt: n.createdAt,
        metadata: n.metadata,
        templateSlug: null,
        userId: n.userId,
      };
    }

    if (source === 'campaign') {
      const campaign = await this.prisma.adminEmailCampaign.findUnique({ where: { id } });
      if (!campaign) {
        throw new NotFoundException(`Campaign "${id}" not found`);
      }
      return { source: 'campaign' as const, ...campaign };
    }

    throw new BadRequestException(
      'source must be transactional, marketing, or campaign',
    );
  }

  /** Prefer the campaign snapshot HTML; otherwise re-render the stored template. */
  private async resolveMarketingBody(
    templateSlug: string | null,
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    if (typeof meta.campaignId === 'string') {
      const campaign = await this.prisma.adminEmailCampaign.findUnique({
        where: { id: meta.campaignId },
        select: { bodyHtml: true },
      });
      if (campaign?.bodyHtml) return campaign.bodyHtml;
    }
    if (!templateSlug) return null;
    try {
      const vars =
        meta.vars && typeof meta.vars === 'object' && !Array.isArray(meta.vars)
          ? (meta.vars as Record<string, string>)
          : {};
      const rendered = await this.templates.render(templateSlug, vars);
      return rendered.body;
    } catch {
      return null;
    }
  }

  private extractTemplateVars(text: string): string[] {
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    const re = new RegExp(VAR_TOKEN_RE.source, 'g');
    while ((match = re.exec(text)) !== null) {
      found.add(match[1]);
    }
    return [...found];
  }

  private async loadAudience(
    audience: AudienceParams,
    opts?: { fetchAll?: boolean },
  ): Promise<{ users: AudienceUser[]; missing?: string[]; totalCount: number }> {
    const select = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    } as const;

    if (audience.audienceType === 'INDIVIDUAL') {
      const userIds = audience.userIds ?? [];
      if (!userIds.length) {
        throw new BadRequestException('userIds is required for INDIVIDUAL audience');
      }

      const rows = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          isActive: true,
          email: { not: '' },
        },
        select,
      });
      const found = new Set(rows.map((r) => r.id));
      const missing = userIds.filter((id) => !found.has(id));
      const users = rows.map((u) => ({
        userId: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
      }));
      return { users, missing, totalCount: users.length };
    }

    const where = this.buildSegmentWhere(audience);
    const totalCount = await this.prisma.user.count({ where });

    const take = opts?.fetchAll
      ? Math.min(totalCount, this.recipientCap)
      : Math.min(20, this.recipientCap);

    const rows = await this.prisma.user.findMany({
      where,
      select,
      take,
      orderBy: { createdAt: 'desc' },
    });

    const users = rows.map((u) => ({
      userId: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
    }));

    return { users, totalCount };
  }

  private buildSegmentWhere(audience: AudienceParams): Prisma.UserWhereInput {
    const filters = audience.filters ?? {};
    const where: Prisma.UserWhereInput = {
      isActive: true,
      email: { not: '' },
    };

    if (filters.role) {
      if (!VALID_ROLES.has(filters.role as UserRole)) {
        throw new BadRequestException(`Invalid role filter: ${filters.role}`);
      }
      where.role = filters.role as UserRole;
    }

    const membershipFilter: Prisma.LoyaltyMembershipWhereInput = {};
    if (filters.tierSlug) {
      membershipFilter.status = 'ACTIVE';
      membershipFilter.tier = { slug: filters.tierSlug };
    }
    if (filters.regionCode) {
      membershipFilter.regionCode = filters.regionCode;
    }
    if (Object.keys(membershipFilter).length > 0) {
      where.loyaltyMembership = { is: membershipFilter };
    }

    const q = (audience.search ?? '').trim();
    if (q) {
      where.AND = [
        {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return where;
  }

  private async listMarketingMailbox(opts: {
    status?: string;
    q?: string;
    skip: number;
    take: number;
  }) {
    const where: Prisma.MessageLogWhereInput = { channel: 'EMAIL' };
    if (opts.status) where.status = opts.status;
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    const items = rows.map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        source: 'marketing' as const,
        subject: r.subject,
        recipientEmail: r.user?.email ?? null,
        recipientName:
          [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || null,
        status: r.status,
        sentAt: r.sentAt ?? r.createdAt,
        templateSlug: r.templateSlug,
        campaignId: typeof meta.campaignId === 'string' ? meta.campaignId : null,
      };
    });

    return { items, total };
  }

  private async listTransactionalMailbox(opts: {
    status?: string;
    q?: string;
    skip: number;
    take: number;
  }) {
    const VALID_NOTIFICATION_STATUSES = new Set(['PENDING', 'SENT', 'FAILED', 'BOUNCED']);
    const where: Prisma.NotificationWhereInput = {
      email: { not: null },
    };
    if (opts.status && VALID_NOTIFICATION_STATUSES.has(opts.status)) {
      where.status = opts.status as Prisma.EnumNotificationStatusFilter;
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const items = rows.map((n) => ({
      id: n.id,
      source: 'transactional' as const,
      subject: n.subject,
      recipientEmail: n.email,
      recipientName: null as string | null,
      status: n.status,
      sentAt: n.sentAt ?? n.createdAt,
      templateSlug: null as string | null,
      campaignId: null as string | null,
    }));

    return { items, total };
  }

  private async computeMailboxStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      mToday,
      mWeek,
      mMonth,
      nToday,
      nWeek,
      nMonth,
      mFailed30,
      nFailed30,
    ] = await Promise.all([
      this.prisma.messageLog.count({
        where: {
          channel: 'EMAIL',
          status: 'SENT',
          OR: [{ sentAt: { gte: startOfToday } }, { createdAt: { gte: startOfToday } }],
        },
      }),
      this.prisma.messageLog.count({
        where: {
          channel: 'EMAIL',
          status: 'SENT',
          OR: [{ sentAt: { gte: weekAgo } }, { createdAt: { gte: weekAgo } }],
        },
      }),
      this.prisma.messageLog.count({
        where: {
          channel: 'EMAIL',
          status: 'SENT',
          OR: [{ sentAt: { gte: monthAgo } }, { createdAt: { gte: monthAgo } }],
        },
      }),
      this.prisma.notification.count({
        where: {
          status: 'SENT',
          email: { not: null },
          OR: [{ sentAt: { gte: startOfToday } }, { createdAt: { gte: startOfToday } }],
        },
      }),
      this.prisma.notification.count({
        where: {
          status: 'SENT',
          email: { not: null },
          OR: [{ sentAt: { gte: weekAgo } }, { createdAt: { gte: weekAgo } }],
        },
      }),
      this.prisma.notification.count({
        where: {
          status: 'SENT',
          email: { not: null },
          OR: [{ sentAt: { gte: monthAgo } }, { createdAt: { gte: monthAgo } }],
        },
      }),
      this.prisma.messageLog.count({
        where: {
          channel: 'EMAIL',
          status: 'FAILED',
          OR: [{ sentAt: { gte: monthAgo } }, { createdAt: { gte: monthAgo } }],
        },
      }),
      this.prisma.notification.count({
        where: {
          status: 'FAILED',
          email: { not: null },
          OR: [{ sentAt: { gte: monthAgo } }, { createdAt: { gte: monthAgo } }],
        },
      }),
    ]);

    const sentToday = mToday + nToday;
    const sentWeek = mWeek + nWeek;
    const sentMonth = mMonth + nMonth;
    const sent = mMonth + nMonth;
    const failed = mFailed30 + nFailed30;
    const denom = sent + failed;
    const deliveryRate = denom === 0 ? 0 : sent / denom;
    const failureRate = denom === 0 ? 0 : failed / denom;

    return { sentToday, sentWeek, sentMonth, deliveryRate, failureRate };
  }
}
