import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';

const VALID_CODE = 'ABCD-EFGH-JKLM-NPQR';

function makeMocks() {
  const prisma: any = {
    giftCard: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    giftCardTransaction: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    user: { findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };
  const config: any = { get: jest.fn().mockReturnValue(undefined) };
  const platformRegion: any = { getCurrency: jest.fn().mockResolvedValue('USD') };
  const service = new GiftCardsService(prisma, config, platformRegion);
  return { service, prisma };
}

function yesterday(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function tomorrow(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

describe('GiftCardsService', () => {
  describe('expiry status (bug 007)', () => {
    it('expireOverdueGiftCards retires active cards past their expiry', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.updateMany.mockResolvedValue({ count: 2 });

      const count = await service.expireOverdueGiftCards();

      expect(count).toBe(2);
      expect(prisma.giftCard.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', expiresAt: { not: null, lt: expect.any(Date) } },
        data: { status: 'EXPIRED' },
      });
    });

    it('listAll reports an overdue card as EXPIRED rather than ACTIVE', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findMany.mockResolvedValue([
        { id: 'gc1', status: 'ACTIVE', expiresAt: yesterday(), _count: { transactions: 1 } },
      ]);
      prisma.giftCard.count.mockResolvedValue(1);

      const result = await service.listAll();

      expect(result.items[0].status).toBe('EXPIRED');
    });

    it('listAll leaves a card that has not expired as ACTIVE', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findMany.mockResolvedValue([
        { id: 'gc1', status: 'ACTIVE', expiresAt: tomorrow(), _count: { transactions: 0 } },
      ]);
      prisma.giftCard.count.mockResolvedValue(1);

      const result = await service.listAll();

      expect(result.items[0].status).toBe('ACTIVE');
    });

    it('validate rejects an expired card and settles its stored status', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        status: 'ACTIVE',
        balance: 50,
        expiresAt: yesterday(),
      });

      await expect(service.validate(VALID_CODE)).rejects.toThrow(BadRequestException);
      expect(prisma.giftCard.updateMany).toHaveBeenCalledWith({
        where: { id: 'gc1', status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('ownership on issue', () => {
    it('leaves a card with no recipient unassigned so it stays a bearer instrument', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue(null);
      prisma.giftCard.create.mockResolvedValue({ id: 'gc1' });

      await service.create('admin-1', { type: 'digital', amount: 50 } as any);

      expect(prisma.giftCard.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: null }) }),
      );
    });

    it('assigns the card to the recipient account when one matches the email', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue(null);
      prisma.giftCard.create.mockResolvedValue({ id: 'gc1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-a' });

      await service.create('admin-1', {
        type: 'digital',
        amount: 50,
        issuedToEmail: 'a@example.com',
      } as any);

      expect(prisma.giftCard.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-a' }) }),
      );
    });

    it('an admin-issued bearer card is redeemable by the customer holding the code', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: null,
        issuedToEmail: null,
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });
      prisma.giftCard.update.mockResolvedValue({ id: 'gc1', balance: 40 });

      await service.redeem('customer-1', { code: VALID_CODE, amount: 10 });

      expect(prisma.giftCard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'customer-1' }) }),
      );
    });
  });

  describe('assignment enforcement (bug 008)', () => {
    it('rejects redemption by a user other than the assigned owner', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: 'user-a',
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });

      await expect(service.redeem('user-b', { code: VALID_CODE, amount: 10 })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.giftCardTransaction.create).not.toHaveBeenCalled();
    });

    it('allows the assigned owner to redeem', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: 'user-a',
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });
      prisma.giftCard.update.mockResolvedValue({ id: 'gc1', balance: 40 });

      await service.redeem('user-a', { code: VALID_CODE, amount: 10 });

      expect(prisma.giftCardTransaction.create).toHaveBeenCalled();
    });

    it('rejects a card issued to another email even before it is claimed', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: null,
        issuedToEmail: 'a@example.com',
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ email: 'b@example.com' });

      await expect(service.redeem('user-b', { code: VALID_CODE, amount: 10 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets the named recipient claim a card issued to their email', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: null,
        issuedToEmail: 'A@Example.com',
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ email: 'a@example.com' });
      prisma.giftCard.update.mockResolvedValue({ id: 'gc1', balance: 40 });

      await service.redeem('user-a', { code: VALID_CODE, amount: 10 });

      expect(prisma.giftCard.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-a' }) }),
      );
    });

    it('validate rejects a signed-in caller who does not own the card', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: 'user-a',
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });

      await expect(service.validate(VALID_CODE, 'user-b')).rejects.toThrow(ForbiddenException);
    });

    it('validate accepts the owner', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: 'user-a',
        status: 'ACTIVE',
        balance: 50,
        currency: 'USD',
        expiresAt: null,
      });

      await expect(service.validate(VALID_CODE, 'user-a')).resolves.toMatchObject({
        valid: true,
        balance: 50,
      });
    });

    it('validate stays open to guests, who are caught later at redeem', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: 'user-a',
        status: 'ACTIVE',
        balance: 50,
        currency: 'USD',
        expiresAt: null,
      });

      await expect(service.validate(VALID_CODE)).resolves.toMatchObject({ valid: true });
    });

    it('still lets any holder redeem an unassigned bearer card', async () => {
      const { service, prisma } = makeMocks();
      prisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc1',
        userId: null,
        issuedToEmail: null,
        status: 'ACTIVE',
        balance: 50,
        expiresAt: null,
      });
      prisma.giftCard.update.mockResolvedValue({ id: 'gc1', balance: 40 });

      await service.redeem('user-b', { code: VALID_CODE, amount: 10 });

      expect(prisma.giftCardTransaction.create).toHaveBeenCalled();
    });
  });
});
