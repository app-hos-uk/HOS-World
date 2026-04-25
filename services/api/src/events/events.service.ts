import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, LoyaltyTxType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { LoyaltyWalletService } from '../loyalty/services/wallet.service';
import { LoyaltyTierEngine } from '../loyalty/engines/tier.engine';
import { MarketingEventBus } from '../journeys/marketing-event.bus';
import { NotificationsService } from '../notifications/notifications.service';
import { TemplatesService } from '../templates/templates.service';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import type { RsvpEventDto } from './dto/rsvp-event.dto';
import type { CheckInDto } from './dto/check-in.dto';
import type { InviteEventDto } from './dto/invite-event.dto';
import { SegmentationService } from '../segmentation/segmentation.service';

function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return s || 'event';
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private wallet: LoyaltyWalletService,
    private tiers: LoyaltyTierEngine,
    private notifications: NotificationsService,
    private templates: TemplatesService,
    private config: ConfigService,
    private segmentation: SegmentationService,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
  ) {}

  private maxGuestCount(): number {
    return this.config.get<number>('EVENT_MAX_GUEST_COUNT', 5);
  }

  private unsubscribeLink(): string {
    const base = this.config.get<string>('FRONTEND_URL', 'https://houseofspells.co.uk');
    return `${base.replace(/\/$/, '')}/unsubscribe`;
  }

  async confirmedHeadcount(eventId: string): Promise<number> {
    const rows = await this.prisma.eventRSVP.findMany({
      where: { eventId, status: 'CONFIRMED' },
      select: { guestCount: true },
    });
    return rows.reduce((acc, r) => acc + 1 + r.guestCount, 0);
  }

  async canAccessEvent(
    userId: string,
    event: { minTierLevel: number; allowedTierIds: string[] },
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (event.minTierLevel === 0 && (!event.allowedTierIds || event.allowedTierIds.length === 0)) {
      return { allowed: true };
    }
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!membership) return { allowed: false, reason: 'No loyalty membership' };
    if (event.allowedTierIds?.length > 0) {
      return event.allowedTierIds.includes(membership.tierId)
        ? { allowed: true }
        : { allowed: false, reason: `Tier ${membership.tier.name} not eligible` };
    }
    return membership.tier.level >= event.minTierLevel
      ? { allowed: true }
      : { allowed: false, reason: `Requires tier level ${event.minTierLevel}+` };
  }

  private async generateUniqueTicketCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const clash = await this.prisma.eventRSVP.findFirst({ where: { ticketCode: code } });
      if (!clash) return code;
    }
    throw new Error('Could not generate ticket code');
  }

  async adminList(filters: {
    status?: string;
    storeId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: unknown[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.EventWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.storeId) where.storeId = filters.storeId;
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, city: true } },
          fandom: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findUpcoming(filters: {
    storeId?: string;
    fandomId?: string;
    type?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: unknown[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.EventWhereInput = {
      status: { in: ['PUBLISHED', 'SOLD_OUT'] },
      startsAt: { gte: new Date() },
      isPublic: true,
    };
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.fandomId) where.fandomId = filters.fandomId;
    if (filters.type) where.type = filters.type;

    if (!filters.userId) {
      where.minTierLevel = 0;
      where.allowedTierIds = { isEmpty: true };
    }

    const allRows = await this.prisma.event.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, city: true } },
        fandom: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    let eligible = allRows;
    if (filters.userId) {
      const allowed: typeof allRows = [];
      for (const e of allRows) {
        const { allowed: ok } = await this.canAccessEvent(filters.userId, e);
        if (ok) allowed.push(e);
      }
      eligible = allowed;
    }

    const total = eligible.length;
    const paged = eligible.slice((page - 1) * limit, page * limit);

    const items = await Promise.all(
      paged.map(async (e) => {
        const rsvpCount = await this.confirmedHeadcount(e.id);
        const capacity = e.capacity;
        const spotsLeft = capacity != null ? Math.max(0, capacity - rsvpCount) : null;
        let userCanRsvp = false;
        if (filters.userId) {
          userCanRsvp = spotsLeft === null || spotsLeft > 0;
        }
        return {
          id: e.id,
          title: e.title,
          slug: e.slug,
          shortDescription: e.shortDescription,
          type: e.type,
          status: e.status,
          imageUrl: e.imageUrl,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          timezone: e.timezone,
          store: e.store,
          fandom: e.fandom,
          capacity,
          rsvpCount,
          spotsLeft,
          attendancePoints: e.attendancePoints,
          minTierLevel: e.minTierLevel,
          tags: e.tags,
          tierRestricted: e.minTierLevel > 0 || e.allowedTierIds.length > 0,
          userCanRsvp,
        };
      }),
    );

    return { items, total };
  }

  async findById(id: string) {
    const e = await this.prisma.event.findUnique({
      where: { id },
      include: {
        store: true,
        fandom: true,
        _count: { select: { rsvps: true, attendances: true } },
      },
    });
    if (!e) throw new NotFoundException('Event not found');
    const rsvpCount = await this.confirmedHeadcount(id);
    const { _count, ...rest } = e;
    return {
      ...rest,
      rsvpCount,
      attendanceCount: _count.attendances,
    };
  }

  async findBySlug(slug: string) {
    const e = await this.prisma.event.findUnique({
      where: { slug },
      include: { store: true, fandom: true },
    });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  async getDetailForUser(slug: string, userId?: string) {
    const e = await this.findBySlug(slug);
    if (e.status !== 'PUBLISHED' && e.status !== 'SOLD_OUT') {
      throw new NotFoundException('Event not found');
    }
    if (!e.isPublic && !userId) throw new NotFoundException('Event not found');

    const rsvpCount = await this.confirmedHeadcount(e.id);
    const capacity = e.capacity;
    const spotsLeft = capacity != null ? Math.max(0, capacity - rsvpCount) : null;

    let userRsvp = null as null | {
      id: string;
      status: string;
      ticketCode: string | null;
      guestCount: number;
    };
    let userAttended = false;
    let userCanRsvp = false;
    let virtualUrl: string | null = null;

    if (userId) {
      const access = await this.canAccessEvent(userId, e);
      if (!e.isPublic && !access.allowed) throw new NotFoundException('Event not found');

      const r = await this.prisma.eventRSVP.findUnique({
        where: { eventId_userId: { eventId: e.id, userId } },
      });
      if (r && r.status !== 'CANCELLED') {
        userRsvp = { id: r.id, status: r.status, ticketCode: r.ticketCode, guestCount: r.guestCount };
        if (r.status === 'CONFIRMED' && e.virtualUrl) virtualUrl = e.virtualUrl;
      }
      const att = await this.prisma.eventAttendance.findUnique({
        where: { eventId_userId: { eventId: e.id, userId } },
      });
      userAttended = !!att;
      userCanRsvp =
        access.allowed &&
        (spotsLeft === null || spotsLeft > 0 || (r?.status === 'WAITLISTED' || r?.status === 'CONFIRMED'));
    }

    return {
      id: e.id,
      title: e.title,
      slug: e.slug,
      description: e.description,
      shortDescription: e.shortDescription,
      type: e.type,
      status: e.status,
      imageUrl: e.imageUrl,
      bannerUrl: e.bannerUrl,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      timezone: e.timezone,
      doorsOpenAt: e.doorsOpenAt,
      store: e.store ? { id: e.store.id, name: e.store.name, city: e.store.city } : null,
      fandom: e.fandom ? { id: e.fandom.id, name: e.fandom.name, slug: e.fandom.slug } : null,
      venueName: e.venueName,
      venueAddress: e.venueAddress,
      virtualUrl,
      virtualPlatform: e.virtualPlatform,
      capacity,
      rsvpCount,
      spotsLeft,
      attendancePoints: e.attendancePoints,
      minTierLevel: e.minTierLevel,
      tags: e.tags,
      hostName: e.hostName,
      hostBio: e.hostBio,
      agenda: e.agenda,
      requiresTicket: e.requiresTicket,
      ticketPrice: e.ticketPrice != null ? Number(e.ticketPrice) : null,
      ticketCurrency: e.ticketCurrency,
      tierRestricted: e.minTierLevel > 0 || e.allowedTierIds.length > 0,
      userRsvp,
      userAttended,
      userCanRsvp,
    };
  }

  async rsvp(eventId: string, userId: string, dto: RsvpEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'PUBLISHED' && event.status !== 'SOLD_OUT') {
      throw new BadRequestException('Event is not open for RSVP');
    }

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new ForbiddenException('Loyalty membership required to RSVP');

    const access = await this.canAccessEvent(userId, event);
    if (!access.allowed) throw new ForbiddenException(access.reason || 'Not eligible for this event');

    const guestCount = Math.min(dto.guestCount ?? 0, this.maxGuestCount());
    const head = 1 + guestCount;
    const used = await this.confirmedHeadcount(eventId);

    const existing = await this.prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (existing?.status === 'CONFIRMED' || existing?.status === 'WAITLISTED') {
      throw new ConflictException('Already RSVPd');
    }

    const capacity = event.capacity;
    const space = capacity == null ? true : used + head <= capacity;
    const status = space ? 'CONFIRMED' : 'WAITLISTED';
    const ticketCode = await this.generateUniqueTicketCode();

    const rsvp = existing
      ? await this.prisma.eventRSVP.update({
          where: { id: existing.id },
          data: {
            status,
            guestCount,
            notes: dto.notes,
            ticketCode,
            cancelledAt: null,
            metadata: { reminded24h: false, reminded2h: false } as Prisma.InputJsonValue,
          },
        })
      : await this.prisma.eventRSVP.create({
          data: {
            eventId,
            userId,
            status,
            guestCount,
            notes: dto.notes,
            ticketCode,
            metadata: { reminded24h: false, reminded2h: false },
          },
        });

    if (capacity != null && (await this.confirmedHeadcount(eventId)) >= capacity) {
      await this.prisma.event.update({ where: { id: eventId }, data: { status: 'SOLD_OUT' } });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, email: true },
    });
    try {
      const rendered = await this.templates.render('event_rsvp_confirmation', {
        firstName: user?.firstName || 'Member',
        eventTitle: event.title,
        ticketCode: ticketCode,
        startsAt: event.startsAt.toISOString(),
        unsubscribeUrl: this.unsubscribeLink(),
      });
      await this.notifications.sendNotificationToUser(
        userId,
        'EVENT_INVITATION',
        rendered.subject || 'Your event RSVP',
        rendered.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        { eventId: event.id, ticketCode },
      );
    } catch (err) {
      this.logger.warn(`RSVP notification failed: ${(err as Error).message}`);
    }

    void this.marketingBus
      ?.emit('EVENT_RSVP', userId, {
        eventId: event.id,
        eventTitle: event.title,
        rsvpStatus: status,
        ticketCode,
        startsAt: event.startsAt.toISOString(),
      })
      .catch(() => {});

    return rsvp;
  }

  async cancelRsvp(eventId: string, userId: string) {
    const r = await this.prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!r || r.status === 'CANCELLED') throw new NotFoundException('RSVP not found');
    const wasConfirmed = r.status === 'CONFIRMED';
    await this.prisma.eventRSVP.update({
      where: { id: r.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (event?.status === 'SOLD_OUT') {
      await this.prisma.event.update({ where: { id: eventId }, data: { status: 'PUBLISHED' } });
    }
    if (wasConfirmed) await this.promoteWaitlist(eventId);
  }

  private async promoteWaitlist(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event?.capacity) return;
    let used = await this.confirmedHeadcount(eventId);
    while (used < event.capacity) {
      const next = await this.prisma.eventRSVP.findFirst({
        where: { eventId, status: 'WAITLISTED' },
        orderBy: { rsvpAt: 'asc' },
      });
      if (!next) break;
      const head = 1 + next.guestCount;
      if (used + head > event.capacity) break;
      await this.prisma.eventRSVP.update({
        where: { id: next.id },
        data: { status: 'CONFIRMED' },
      });
      used += head;
      try {
        const u = await this.prisma.user.findUnique({
          where: { id: next.userId },
          select: { firstName: true },
        });
        const rendered = await this.templates.render('event_waitlist_promoted', {
          firstName: u?.firstName || 'Member',
          eventTitle: event.title,
          ticketCode: next.ticketCode || '',
          startsAt: event.startsAt.toISOString(),
          unsubscribeUrl: this.unsubscribeLink(),
        });
        await this.notifications.sendNotificationToUser(
          next.userId,
          'GENERAL',
          rendered.subject || "You're in!",
          rendered.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          { eventId: event.id },
        );
      } catch (e) {
        this.logger.warn(`Waitlist promotion notify failed: ${(e as Error).message}`);
      }
    }
  }

  async getMyRsvps(userId: string) {
    return this.prisma.eventRSVP.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      include: { event: { include: { store: true, fandom: true } } },
      orderBy: { rsvpAt: 'desc' },
    });
  }

  async getMyAttendances(userId: string) {
    return this.prisma.eventAttendance.findMany({
      where: { userId },
      include: { event: { include: { store: true, fandom: true } } },
      orderBy: { checkedInAt: 'desc' },
    });
  }

  async checkIn(eventId: string, userId: string, dto: CheckInDto, checkedInBy?: string | null) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'PUBLISHED' && event.status !== 'SOLD_OUT' && event.status !== 'COMPLETED') {
      throw new BadRequestException('Check-in not available for this event');
    }

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new ForbiddenException('Loyalty membership required');

    let rsvp = await this.prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (dto.ticketCode) {
      const byCode = await this.prisma.eventRSVP.findFirst({
        where: { eventId, ticketCode: dto.ticketCode.toUpperCase() },
      });
      if (!byCode || byCode.userId !== userId) {
        throw new BadRequestException('Invalid ticket code');
      }
      rsvp = byCode;
    }

    if (!rsvp || rsvp.status === 'CANCELLED') {
      if (!event.isPublic) throw new BadRequestException('RSVP required');
      const head = 1;
      const used = await this.confirmedHeadcount(eventId);
      if (event.capacity != null && used + head > event.capacity) {
        throw new BadRequestException('Event is at capacity');
      }
      const ticketCode = await this.generateUniqueTicketCode();
      rsvp = await this.prisma.eventRSVP.create({
        data: {
          eventId,
          userId,
          status: 'CONFIRMED',
          guestCount: 0,
          ticketCode,
          metadata: { walkIn: true },
        },
      });
    }

    if (rsvp.status === 'WAITLISTED') {
      throw new BadRequestException('Waitlisted — not confirmed yet');
    }

    const existingAtt = await this.prisma.eventAttendance.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (existingAtt) throw new ConflictException('Already checked in');

    let pointsToAward = event.attendancePoints;
    let earnRuleId: string | null = null;
    if (event.earnRuleAction) {
      const rule = await this.prisma.loyaltyEarnRule.findFirst({
        where: { action: event.earnRuleAction, isActive: true },
      });
      if (rule) {
        pointsToAward = rule.pointsAmount;
        earnRuleId = rule.id;
      }
    }

    const method = dto.method ?? (checkedInBy ? 'TICKET_SCAN' : 'QR_SCAN');

    let transactionId: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, pointsToAward, LoyaltyTxType.EARN, {
          source: 'EVENT',
          sourceId: event.id,
          channel: 'EVENT',
          storeId: event.storeId,
          description: `Attended: ${event.title}`,
          earnRuleId: earnRuleId ?? undefined,
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: pointsToAward },
            engagementCount: { increment: 1 },
          },
        });
        const lastTx = await tx.loyaltyTransaction.findFirst({
          where: { membershipId: membership.id, source: 'EVENT', sourceId: event.id },
          orderBy: { createdAt: 'desc' },
        });
        transactionId = lastTx?.id ?? null;
        await tx.eventAttendance.create({
          data: {
            eventId,
            userId,
            checkedInBy: checkedInBy ?? undefined,
            method,
            pointsAwarded: pointsToAward,
            transactionId: transactionId ?? undefined,
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Already checked in');
      }
      throw e;
    }

    await this.tiers.recalculateTier(membership.id);

    try {
      await this.segmentation.touchActivity(userId);
    } catch {
      /* non-fatal */
    }

    if (rsvp) {
      await this.prisma.eventRSVP.update({
        where: { id: rsvp.id },
        data: {
          metadata: {
            ...((rsvp.metadata as Record<string, unknown>) || {}),
            attended: true,
            attendedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    void this.marketingBus
      ?.emit('EVENT_ATTENDED', userId, {
        eventId: event.id,
        eventTitle: event.title,
        pointsEarned: pointsToAward,
        eventType: event.type,
        storeId: event.storeId,
      })
      .catch(() => {});

    return this.prisma.eventAttendance.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
  }

  async checkInByTicket(eventId: string, ticketCode: string, staffUserId: string) {
    const rsvp = await this.prisma.eventRSVP.findFirst({
      where: { eventId, ticketCode: ticketCode.toUpperCase() },
    });
    if (!rsvp || rsvp.status !== 'CONFIRMED') throw new NotFoundException('Invalid ticket');
    return this.checkIn(eventId, rsvp.userId, { method: 'TICKET_SCAN' }, staffUserId);
  }

  async create(dto: CreateEventDto, createdBy: string) {
    let base = slugify(dto.title);
    let slug = base;
    for (let i = 0; i < 10; i++) {
      const clash = await this.prisma.event.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    }
    const data: Prisma.EventCreateInput = {
      title: dto.title,
      slug,
      description: dto.description,
      shortDescription: dto.shortDescription,
      type: dto.type ?? 'IN_STORE',
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      timezone: dto.timezone ?? 'Europe/London',
      doorsOpenAt: dto.doorsOpenAt ? new Date(dto.doorsOpenAt) : undefined,
      capacity: dto.capacity,
      isPublic: dto.isPublic ?? true,
      minTierLevel: dto.minTierLevel ?? 0,
      allowedTierIds: dto.allowedTierIds ?? [],
      requiresTicket: dto.requiresTicket ?? false,
      ticketCurrency: dto.ticketCurrency ?? 'GBP',
      attendancePoints: dto.attendancePoints ?? this.config.get<number>('EVENT_DEFAULT_POINTS', 100),
      earnRuleAction: dto.earnRuleAction,
      tags: dto.tags ?? [],
      hostName: dto.hostName,
      hostBio: dto.hostBio,
      agenda: dto.agenda as Prisma.InputJsonValue,
      imageUrl: dto.imageUrl,
      bannerUrl: dto.bannerUrl,
      virtualUrl: dto.virtualUrl,
      virtualPlatform: dto.virtualPlatform,
      venueName: dto.venueName,
      venueAddress: dto.venueAddress,
      createdBy,
      status: 'DRAFT',
    };
    if (dto.ticketPrice != null) data.ticketPrice = dto.ticketPrice;
    if (dto.storeId) data.store = { connect: { id: dto.storeId } };
    if (dto.fandomId) data.fandom = { connect: { id: dto.fandomId } };
    return this.prisma.event.create({ data });
  }

  async update(id: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    const data: Prisma.EventUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = new Date(dto.endsAt);
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.doorsOpenAt !== undefined) data.doorsOpenAt = dto.doorsOpenAt ? new Date(dto.doorsOpenAt) : null;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    if (dto.minTierLevel !== undefined) data.minTierLevel = dto.minTierLevel;
    if (dto.allowedTierIds !== undefined) data.allowedTierIds = dto.allowedTierIds;
    if (dto.requiresTicket !== undefined) data.requiresTicket = dto.requiresTicket;
    if (dto.ticketPrice !== undefined) data.ticketPrice = dto.ticketPrice;
    if (dto.ticketCurrency !== undefined) data.ticketCurrency = dto.ticketCurrency;
    if (dto.attendancePoints !== undefined) data.attendancePoints = dto.attendancePoints;
    if (dto.earnRuleAction !== undefined) data.earnRuleAction = dto.earnRuleAction;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.hostName !== undefined) data.hostName = dto.hostName;
    if (dto.hostBio !== undefined) data.hostBio = dto.hostBio;
    if (dto.agenda !== undefined) data.agenda = dto.agenda as Prisma.InputJsonValue;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.bannerUrl !== undefined) data.bannerUrl = dto.bannerUrl;
    if (dto.virtualUrl !== undefined) data.virtualUrl = dto.virtualUrl;
    if (dto.virtualPlatform !== undefined) data.virtualPlatform = dto.virtualPlatform;
    if (dto.venueName !== undefined) data.venueName = dto.venueName;
    if (dto.venueAddress !== undefined) data.venueAddress = dto.venueAddress;
    if (dto.storeId !== undefined) {
      data.store = dto.storeId ? { connect: { id: dto.storeId } } : { disconnect: true };
    }
    if (dto.fandomId !== undefined) {
      data.fandom = dto.fandomId ? { connect: { id: dto.fandomId } } : { disconnect: true };
    }
    return this.prisma.event.update({ where: { id }, data });
  }

  async publish(id: string) {
    const event = await this.prisma.event.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });

    void this.marketingBus
      ?.broadcast('EVENT_PUBLISHED', {
        eventId: event.id,
        eventTitle: event.title,
        eventType: event.type,
        startsAt: event.startsAt.toISOString(),
        storeId: event.storeId,
        fandomId: event.fandomId,
        minTierLevel: event.minTierLevel,
      })
      .catch(() => {});

    return event;
  }

  async cancel(id: string, reason?: string) {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    await this.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });
    const rsvps = await this.prisma.eventRSVP.findMany({
      where: { eventId: id, status: { in: ['CONFIRMED', 'WAITLISTED'] } },
    });
    for (const r of rsvps) {
      await this.prisma.eventRSVP.update({
        where: { id: r.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      try {
        const rendered = await this.templates.render('event_cancelled_notice', {
          firstName: 'Member',
          eventTitle: e.title,
          reason: reason || 'Please check our site for updates.',
          unsubscribeUrl: this.unsubscribeLink(),
        });
        await this.notifications.sendNotificationToUser(
          r.userId,
          'GENERAL',
          rendered.subject || 'Event cancelled',
          rendered.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          { eventId: id },
        );
      } catch (err) {
        this.logger.warn(`Cancel notify failed: ${(err as Error).message}`);
      }
      void this.marketingBus
        ?.emit('EVENT_CANCELLED', r.userId, {
          eventId: e.id,
          eventTitle: e.title,
          reason: reason ?? '',
        })
        .catch(() => {});
    }
    return this.prisma.event.findUnique({ where: { id } });
  }

  async complete(id: string) {
    await this.prisma.event.update({ where: { id }, data: { status: 'COMPLETED' } });
    const confirmed = await this.prisma.eventRSVP.findMany({
      where: { eventId: id, status: 'CONFIRMED' },
      select: { userId: true, id: true },
    });
    const attended = new Set(
      (
        await this.prisma.eventAttendance.findMany({
          where: { eventId: id },
          select: { userId: true },
        })
      ).map((a) => a.userId),
    );
    for (const r of confirmed) {
      if (!attended.has(r.userId)) {
        await this.prisma.eventRSVP.update({ where: { id: r.id }, data: { status: 'NO_SHOW' } });
      }
    }
    return this.prisma.event.findUnique({ where: { id } });
  }

  async remove(id: string) {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    if (e.status !== 'DRAFT') throw new BadRequestException('Only draft events can be deleted');
    await this.prisma.event.delete({ where: { id } });
  }

  async getAttendees(eventId: string) {
    return this.prisma.eventAttendance.findMany({
      where: { eventId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { checkedInAt: 'asc' },
    });
  }

  async getRsvpsForAdmin(eventId: string) {
    return this.prisma.eventRSVP.findMany({
      where: { eventId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { rsvpAt: 'asc' },
    });
  }

  async getEventStats(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const [confirmed, waitlisted, cancelled, attended, pointsSum] = await Promise.all([
      this.prisma.eventRSVP.count({ where: { eventId, status: 'CONFIRMED' } }),
      this.prisma.eventRSVP.count({ where: { eventId, status: 'WAITLISTED' } }),
      this.prisma.eventRSVP.count({ where: { eventId, status: 'CANCELLED' } }),
      this.prisma.eventAttendance.count({ where: { eventId } }),
      this.prisma.eventAttendance.aggregate({
        where: { eventId },
        _sum: { pointsAwarded: true },
      }),
    ]);
    const rsvpConfirmed = await this.prisma.eventRSVP.findMany({
      where: { eventId, status: 'CONFIRMED' },
      select: { userId: true },
    });
    const attendedIds = new Set(
      (await this.prisma.eventAttendance.findMany({ where: { eventId }, select: { userId: true } })).map(
        (a) => a.userId,
      ),
    );
    let noShow = 0;
    for (const r of rsvpConfirmed) {
      if (!attendedIds.has(r.userId)) noShow++;
    }
    const cap = event.capacity;
    const used = await this.confirmedHeadcount(eventId);
    const capacityUsed = cap && cap > 0 ? Math.round((used / cap) * 100) : 0;
    return {
      rsvpConfirmed: confirmed,
      rsvpWaitlisted: waitlisted,
      rsvpCancelled: cancelled,
      attended,
      noShow,
      totalPointsAwarded: pointsSum._sum.pointsAwarded ?? 0,
      capacityUsed,
    };
  }

  async inviteToEvent(eventId: string, body: InviteEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const limit = Math.min(body.limit ?? 500, 5000);
    let members: { userId: string }[];

    if (body.segmentId) {
      const ids = await this.segmentation.getSegmentUserIds(body.segmentId);
      members = ids.slice(0, limit).map((userId) => ({ userId }));
    } else {
      const where: Prisma.LoyaltyMembershipWhereInput = {};
      if (body.tierIds?.length) where.tierId = { in: body.tierIds };
      if (body.minTierLevel != null) where.tier = { level: { gte: body.minTierLevel } };
      if (body.fandomId) {
        const fandom = await this.prisma.fandom.findUnique({ where: { id: body.fandomId } });
        if (fandom) {
          where.user = { favoriteFandoms: { has: fandom.slug } };
        }
      }
      members = await this.prisma.loyaltyMembership.findMany({
        where,
        select: { userId: true },
        take: limit,
      });
    }
    let invited = 0;
    let alreadyRsvped = 0;
    for (const m of members) {
      const existing = await this.prisma.eventRSVP.findUnique({
        where: { eventId_userId: { eventId, userId: m.userId } },
      });
      if (existing && (existing.status === 'CONFIRMED' || existing.status === 'WAITLISTED')) {
        alreadyRsvped++;
        continue;
      }
      try {
        const rendered = await this.templates.render('event_rsvp_confirmation', {
          firstName: 'Member',
          eventTitle: event.title,
          ticketCode: '',
          startsAt: event.startsAt.toISOString(),
          unsubscribeUrl: this.unsubscribeLink(),
        });
        await this.notifications.sendNotificationToUser(
          m.userId,
          'EVENT_INVITATION',
          `You're invited: ${event.title}`,
          rendered.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          { eventId: event.id },
        );
        invited++;
      } catch (e) {
        this.logger.warn(`Invite failed for ${m.userId}: ${(e as Error).message}`);
      }
    }
    return { invited, alreadyRsvped };
  }

  /** Called from EventJobsService */
  async sendRemindersWindow(): Promise<void> {
    const now = new Date();
    const in24hStart = new Date(now.getTime() + 23 * 3600000);
    const in24hEnd = new Date(now.getTime() + 25 * 3600000);
    const in2hStart = new Date(now.getTime() + 1.5 * 3600000);
    const in2hEnd = new Date(now.getTime() + 2.5 * 3600000);

    const events24 = await this.prisma.event.findMany({
      where: {
        status: { in: ['PUBLISHED', 'SOLD_OUT'] },
        startsAt: { gte: in24hStart, lte: in24hEnd },
      },
    });
    const events2h = await this.prisma.event.findMany({
      where: {
        status: { in: ['PUBLISHED', 'SOLD_OUT'] },
        startsAt: { gte: in2hStart, lte: in2hEnd },
      },
    });

    for (const ev of events24) {
      const rsvps = await this.prisma.eventRSVP.findMany({
        where: { eventId: ev.id, status: 'CONFIRMED' },
      });
      for (const r of rsvps) {
        const meta = (r.metadata as Record<string, boolean>) || {};
        if (meta.reminded24h) continue;
        try {
          const rendered = await this.templates.render('event_reminder_24h', {
            firstName: 'Member',
            eventTitle: ev.title,
            startsAt: ev.startsAt.toISOString(),
            unsubscribeUrl: this.unsubscribeLink(),
          });
          await this.notifications.sendNotificationToUser(
            r.userId,
            'EVENT_REMINDER',
            rendered.subject || 'Event tomorrow',
            rendered.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            { eventId: ev.id },
          );
          await this.prisma.eventRSVP.update({
            where: { id: r.id },
            data: { metadata: { ...meta, reminded24h: true } as Prisma.InputJsonValue },
          });
          void this.marketingBus
            ?.emit('EVENT_REMINDER_DUE', r.userId, {
              eventId: ev.id,
              eventTitle: ev.title,
              startsAt: ev.startsAt.toISOString(),
              hoursUntil: 24,
            })
            .catch(() => {});
        } catch (e) {
          this.logger.warn(`24h reminder failed: ${(e as Error).message}`);
        }
      }
    }

    for (const ev of events2h) {
      const rsvps = await this.prisma.eventRSVP.findMany({
        where: { eventId: ev.id, status: 'CONFIRMED' },
      });
      for (const r of rsvps) {
        const meta = (r.metadata as Record<string, boolean>) || {};
        if (meta.reminded2h) continue;
        try {
          const rendered = await this.templates.render('event_starting_soon', {
            eventTitle: ev.title,
            unsubscribeUrl: this.unsubscribeLink(),
          });
          await this.notifications.sendNotificationToUser(
            r.userId,
            'EVENT_REMINDER',
            rendered.subject || 'Starting soon',
            rendered.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            { eventId: ev.id },
          );
          await this.prisma.eventRSVP.update({
            where: { id: r.id },
            data: { metadata: { ...meta, reminded2h: true } as Prisma.InputJsonValue },
          });
          void this.marketingBus
            ?.emit('EVENT_REMINDER_DUE', r.userId, {
              eventId: ev.id,
              eventTitle: ev.title,
              startsAt: ev.startsAt.toISOString(),
              hoursUntil: 2,
            })
            .catch(() => {});
        } catch (e) {
          this.logger.warn(`2h reminder failed: ${(e as Error).message}`);
        }
      }
    }
  }

  async reconcileEndedEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 3600000);
    const toComplete = await this.prisma.event.findMany({
      where: { status: { in: ['PUBLISHED', 'SOLD_OUT'] }, endsAt: { lt: cutoff } },
    });
    for (const ev of toComplete) {
      await this.prisma.event.update({ where: { id: ev.id }, data: { status: 'COMPLETED' } });
      const confirmed = await this.prisma.eventRSVP.findMany({
        where: { eventId: ev.id, status: 'CONFIRMED' },
        select: { userId: true, id: true },
      });
      const attended = new Set(
        (
          await this.prisma.eventAttendance.findMany({
            where: { eventId: ev.id },
            select: { userId: true },
          })
        ).map((a) => a.userId),
      );
      for (const r of confirmed) {
        if (!attended.has(r.userId)) {
          await this.prisma.eventRSVP.update({ where: { id: r.id }, data: { status: 'NO_SHOW' } });
        }
      }
    }
  }
}
