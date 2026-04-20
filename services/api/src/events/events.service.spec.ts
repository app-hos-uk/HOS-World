import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: any;
  let wallet: { applyDelta: jest.Mock };
  let tiers: { recalculateTier: jest.Mock };
  let notifications: { sendNotificationToUser: jest.Mock };
  let templates: { render: jest.Mock };
  let config: { get: jest.Mock };
  let marketingBus: { emit: jest.Mock; broadcast: jest.Mock };

  const baseEvent = {
    id: 'e1',
    title: 'Test Event',
    slug: 'test-event',
    status: 'PUBLISHED',
    capacity: 10,
    isPublic: true,
    minTierLevel: 0,
    allowedTierIds: [] as string[],
    attendancePoints: 100,
    earnRuleAction: null as string | null,
    storeId: null as string | null,
    type: 'IN_STORE',
    startsAt: new Date('2030-06-01T12:00:00Z'),
    virtualUrl: null as string | null,
  };

  beforeEach(() => {
    wallet = { applyDelta: jest.fn().mockResolvedValue({ balanceBefore: 0, balanceAfter: 100 }) };
    tiers = { recalculateTier: jest.fn().mockResolvedValue(undefined) };
    notifications = { sendNotificationToUser: jest.fn().mockResolvedValue(undefined) };
    templates = {
      render: jest.fn().mockResolvedValue({ subject: 'S', body: '<p>Hi</p>', channel: 'EMAIL' }),
    };
    config = {
      get: jest.fn((key: string, def?: unknown) => {
        if (key === 'EVENT_MAX_GUEST_COUNT') return 5;
        if (key === 'FRONTEND_URL') return 'https://example.com';
        if (key === 'EVENT_DEFAULT_POINTS') return 100;
        return def;
      }),
    };
    marketingBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      broadcast: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      event: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      eventRSVP: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      eventAttendance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      loyaltyMembership: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      loyaltyEarnRule: { findFirst: jest.fn() },
      loyaltyTransaction: { findFirst: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'A', email: 'a@b.c' }) },
      fandom: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          loyaltyMembership: { update: jest.fn() },
          loyaltyTransaction: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tx1' }),
          },
          eventAttendance: { create: jest.fn() },
        };
        return fn(tx);
      }),
    };

    const segmentation = { getSegmentUserIds: jest.fn().mockResolvedValue([]), touchActivity: jest.fn() };

    service = new EventsService(
      prisma,
      wallet as any,
      tiers as any,
      notifications as any,
      templates as any,
      config as unknown as ConfigService,
      segmentation as any,
      marketingBus as any,
    );
  });

  describe('canAccessEvent', () => {
    it('allows open events (no tier gate)', async () => {
      const r = await service.canAccessEvent('u1', { minTierLevel: 0, allowedTierIds: [] });
      expect(r.allowed).toBe(true);
      expect(prisma.loyaltyMembership.findUnique).not.toHaveBeenCalled();
    });

    it('denies when no membership and tier gate', async () => {
      prisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      const r = await service.canAccessEvent('u1', { minTierLevel: 1, allowedTierIds: [] });
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/No loyalty/);
    });

    it('allows when tier id is in allowedTierIds', async () => {
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        tierId: 't-vip',
        tier: { name: 'VIP', level: 1 },
      });
      const r = await service.canAccessEvent('u1', { minTierLevel: 0, allowedTierIds: ['t-vip'] });
      expect(r.allowed).toBe(true);
    });

    it('denies when tier id not in allowedTierIds', async () => {
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        tierId: 't-basic',
        tier: { name: 'Basic', level: 1 },
      });
      const r = await service.canAccessEvent('u1', { minTierLevel: 0, allowedTierIds: ['t-vip'] });
      expect(r.allowed).toBe(false);
    });

    it('allows when tier level meets minTierLevel', async () => {
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        tierId: 't1',
        tier: { name: 'Dragon', level: 3 },
      });
      const r = await service.canAccessEvent('u1', { minTierLevel: 2, allowedTierIds: [] });
      expect(r.allowed).toBe(true);
    });

    it('denies when tier level below minTierLevel', async () => {
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        tierId: 't1',
        tier: { name: 'Novice', level: 1 },
      });
      const r = await service.canAccessEvent('u1', { minTierLevel: 2, allowedTierIds: [] });
      expect(r.allowed).toBe(false);
    });
  });

  describe('confirmedHeadcount', () => {
    it('sums primary + guestCount per confirmed RSVP', async () => {
      prisma.eventRSVP.findMany.mockResolvedValue([{ guestCount: 0 }, { guestCount: 2 }]);
      const n = await service.confirmedHeadcount('e1');
      expect(n).toBe(4);
    });
  });

  describe('rsvp', () => {
    beforeEach(() => {
      prisma.event.findUnique.mockResolvedValue({ ...baseEvent });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Sam', email: 's@x.com' });
      prisma.eventRSVP.findFirst.mockResolvedValue(null);
    });

    it('waitlists when at capacity', async () => {
      jest.spyOn(service, 'confirmedHeadcount').mockResolvedValue(10);
      prisma.eventRSVP.findUnique.mockResolvedValue(null);
      prisma.eventRSVP.create.mockResolvedValue({
        id: 'r1',
        status: 'WAITLISTED',
        ticketCode: 'ABCD1234',
      });

      const r = await service.rsvp('e1', 'u1', { guestCount: 0 });

      expect(r.status).toBe('WAITLISTED');
      expect(prisma.eventRSVP.create).toHaveBeenCalled();
      expect(marketingBus.emit).toHaveBeenCalledWith(
        'EVENT_RSVP',
        'u1',
        expect.objectContaining({ rsvpStatus: 'WAITLISTED' }),
      );
    });

    it('throws ConflictException if already confirmed', async () => {
      jest.spyOn(service, 'confirmedHeadcount').mockResolvedValue(1);
      prisma.eventRSVP.findUnique.mockResolvedValue({ id: 'r1', status: 'CONFIRMED' });

      await expect(service.rsvp('e1', 'u1', {})).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when tier not eligible', async () => {
      jest.spyOn(service, 'confirmedHeadcount').mockResolvedValue(0);
      prisma.event.findUnique.mockResolvedValue({ ...baseEvent, minTierLevel: 5 });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'm1',
        tierId: 't1',
        tier: { name: 'Low', level: 1 },
      });
      prisma.eventRSVP.findUnique.mockResolvedValue(null);

      await expect(service.rsvp('e1', 'u1', {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkIn', () => {
    beforeEach(() => {
      prisma.event.findUnique.mockResolvedValue({ ...baseEvent });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.eventRSVP.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: 'CONFIRMED',
        ticketCode: 'TICK1234',
        guestCount: 0,
      });
      prisma.eventAttendance.findUnique.mockResolvedValue(null);
      prisma.eventAttendance.findUnique.mockResolvedValueOnce(null).mockResolvedValue({
        id: 'a1',
        pointsAwarded: 100,
      });
    });

    it('applies wallet delta and recalculates tier', async () => {
      await service.checkIn('e1', 'u1', {});

      expect(wallet.applyDelta).toHaveBeenCalled();
      expect(tiers.recalculateTier).toHaveBeenCalledWith('m1');
      expect(marketingBus.emit).toHaveBeenCalledWith(
        'EVENT_ATTENDED',
        'u1',
        expect.objectContaining({ eventId: 'e1' }),
      );
    });

    it('rejects waitlisted RSVP', async () => {
      prisma.eventAttendance.findUnique.mockResolvedValue(null);
      prisma.eventRSVP.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'WAITLISTED',
        ticketCode: 'X',
        guestCount: 0,
      });

      await expect(service.checkIn('e1', 'u1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkIn duplicate prevention', () => {
    it('throws ConflictException when already checked in', async () => {
      prisma.event.findUnique.mockResolvedValue({ ...baseEvent });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.eventRSVP.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: 'CONFIRMED',
        ticketCode: 'TICK',
        guestCount: 0,
      });
      prisma.eventAttendance.findUnique.mockResolvedValue({ id: 'a1', pointsAwarded: 100 });

      await expect(service.checkIn('e1', 'u1', {})).rejects.toThrow(ConflictException);
    });
  });

  describe('checkIn walk-in', () => {
    it('creates confirmed RSVP when public and no RSVP', async () => {
      prisma.event.findUnique.mockResolvedValue({ ...baseEvent, capacity: 20 });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.eventRSVP.findUnique.mockResolvedValue(null);
      prisma.eventAttendance.findUnique.mockResolvedValue(null);
      jest.spyOn(service, 'confirmedHeadcount').mockResolvedValue(5);
      prisma.eventRSVP.create.mockResolvedValue({
        id: 'r-new',
        status: 'CONFIRMED',
        ticketCode: 'NEWCODE1',
        guestCount: 0,
      });
      prisma.eventAttendance.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'a1', pointsAwarded: 100 });

      await service.checkIn('e1', 'u1', {});

      expect(prisma.eventRSVP.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        }),
      );
    });
  });

  describe('checkInByTicket', () => {
    it('delegates to checkIn for confirmed ticket holder', async () => {
      prisma.eventRSVP.findFirst.mockResolvedValue({
        userId: 'u9',
        status: 'CONFIRMED',
      });
      const spy = jest.spyOn(service, 'checkIn').mockResolvedValue({} as any);

      await service.checkInByTicket('e1', 'abc12345', 'staff-1');

      expect(spy).toHaveBeenCalledWith('e1', 'u9', { method: 'TICKET_SCAN' }, 'staff-1');
      spy.mockRestore();
    });
  });

  describe('cancelRsvp', () => {
    it('promotes waitlist after confirmed cancel', async () => {
      prisma.eventRSVP.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'CONFIRMED',
        guestCount: 0,
      });
      prisma.event.findUnique.mockResolvedValue({ ...baseEvent, capacity: 2, status: 'SOLD_OUT' });
      prisma.eventRSVP.update.mockResolvedValue({});
      prisma.event.update.mockResolvedValue({});
      prisma.eventRSVP.findFirst.mockResolvedValue(null);
      prisma.eventRSVP.findMany.mockResolvedValue([]);

      await service.cancelRsvp('e1', 'u1');

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PUBLISHED' } }),
      );
    });
  });

  describe('reconcileEndedEvents', () => {
    it('completes past events and marks no-shows', async () => {
      prisma.event.findMany.mockResolvedValue([{ id: 'e-old', status: 'PUBLISHED' }]);
      prisma.event.update.mockResolvedValue({});
      prisma.eventRSVP.findMany.mockResolvedValue([{ userId: 'u1', id: 'r1' }]);
      prisma.eventAttendance.findMany.mockResolvedValue([]);

      await service.reconcileEndedEvents();

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
      expect(prisma.eventRSVP.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'NO_SHOW' } }),
      );
    });
  });

  describe('sendRemindersWindow', () => {
    it('sends 24h reminder and flags metadata', async () => {
      const ev = { id: 'ev1', title: 'Gala', startsAt: new Date() };
      prisma.event.findMany
        .mockResolvedValueOnce([ev])
        .mockResolvedValueOnce([]);
      prisma.eventRSVP.findMany.mockResolvedValue([
        { id: 'r1', userId: 'u1', metadata: {} },
      ]);
      prisma.eventRSVP.update.mockResolvedValue({});

      await service.sendRemindersWindow();

      expect(templates.render).toHaveBeenCalledWith('event_reminder_24h', expect.any(Object));
      expect(notifications.sendNotificationToUser).toHaveBeenCalled();
      expect(prisma.eventRSVP.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ reminded24h: true }),
          }),
        }),
      );
      expect(marketingBus.emit).toHaveBeenCalledWith(
        'EVENT_REMINDER_DUE',
        'u1',
        expect.objectContaining({ hoursUntil: 24 }),
      );
    });
  });

  describe('getEventStats', () => {
    it('counts no-shows as confirmed minus attended users', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: 10 });
      prisma.eventRSVP.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.eventAttendance.count.mockResolvedValue(1);
      prisma.eventAttendance.aggregate.mockResolvedValue({ _sum: { pointsAwarded: 150 } });
      prisma.eventRSVP.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      prisma.eventAttendance.findMany.mockResolvedValue([{ userId: 'u1' }]);

      const s = await service.getEventStats('e1');

      expect(s.attended).toBe(1);
      expect(s.noShow).toBe(1);
      expect(s.totalPointsAwarded).toBe(150);
    });
  });

  describe('remove', () => {
    it('deletes draft only', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', status: 'DRAFT' });
      prisma.event.delete.mockResolvedValue({});

      await service.remove('e1');

      expect(prisma.event.delete).toHaveBeenCalled();
    });

    it('throws when not draft', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', status: 'PUBLISHED' });

      await expect(service.remove('e1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish', () => {
    it('sets status to PUBLISHED and broadcasts EVENT_PUBLISHED', async () => {
      prisma.event.update.mockResolvedValue({ ...baseEvent, status: 'PUBLISHED' });

      const r = await service.publish('e1');

      expect(r.status).toBe('PUBLISHED');
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PUBLISHED' } }),
      );
      expect(marketingBus.broadcast).toHaveBeenCalledWith(
        'EVENT_PUBLISHED',
        expect.objectContaining({ eventId: 'e1', eventTitle: 'Test Event' }),
      );
    });
  });

  describe('complete', () => {
    it('sets COMPLETED and marks no-shows', async () => {
      prisma.event.update.mockResolvedValue({});
      prisma.eventRSVP.findMany.mockResolvedValue([
        { userId: 'u1', id: 'r1' },
        { userId: 'u2', id: 'r2' },
      ]);
      prisma.eventAttendance.findMany.mockResolvedValue([{ userId: 'u1' }]);
      prisma.eventRSVP.update.mockResolvedValue({});
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', status: 'COMPLETED' });

      await service.complete('e1');

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
      expect(prisma.eventRSVP.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r2' }, data: { status: 'NO_SHOW' } }),
      );
      expect(prisma.eventRSVP.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1' }, data: { status: 'NO_SHOW' } }),
      );
    });
  });

  describe('findUpcoming', () => {
    it('returns accurate total for unauthenticated (open events only)', async () => {
      const openEvent = {
        ...baseEvent,
        id: 'e-open',
        minTierLevel: 0,
        allowedTierIds: [] as string[],
        store: null,
        fandom: null,
      };
      prisma.event.findMany.mockResolvedValue([openEvent]);
      prisma.eventRSVP.findMany.mockResolvedValue([]);

      const r = await service.findUpcoming({});

      expect(r.total).toBe(1);
      expect(r.items).toHaveLength(1);
    });
  });

  describe('findBySlug / getDetailForUser', () => {
    it('throws NotFound for non-published', async () => {
      prisma.event.findUnique.mockResolvedValue({
        ...baseEvent,
        status: 'DRAFT',
        store: null,
        fandom: null,
      });

      await expect(service.getDetailForUser('x', undefined)).rejects.toThrow(NotFoundException);
    });
  });
});
