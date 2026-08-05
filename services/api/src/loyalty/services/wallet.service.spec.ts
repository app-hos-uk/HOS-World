import { BadRequestException } from '@nestjs/common';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { LoyaltyWalletService } from './wallet.service';

describe('LoyaltyWalletService', () => {
  const segmentation = { touchActivity: jest.fn().mockResolvedValue(undefined) };
  const service = new LoyaltyWalletService(segmentation as any);

  it('credits and debits balance atomically in tx', async () => {
    let balance = 100;
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      loyaltyMembership: {
        findUnique: jest
          .fn()
          .mockImplementation(async () => ({ id: 'm1', userId: 'u1', currentBalance: balance })),
        update: jest.fn().mockImplementation(async (_args: any) => {
          if (typeof _args.data.currentBalance === 'number') {
            balance = _args.data.currentBalance;
          }
        }),
      },
      loyaltyTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
    });
    expect(balance).toBe(150);

    await service.applyDelta(tx as any, 'm1', -50, LoyaltyTxType.BURN, {
      source: 'REDEMPTION',
      channel: 'MARKETPLACE_CHECKOUT',
    });
    expect(balance).toBe(100);
  });

  it('rejects debit below zero', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      loyaltyMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', userId: 'u1', currentBalance: 10 }),
      },
      loyaltyTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };

    await expect(
      service.applyDelta(tx as any, 'm1', -20, LoyaltyTxType.BURN, {
        source: 'REDEMPTION',
        channel: 'MARKETPLACE_CHECKOUT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('duplicate idempotencyKey does not double credit', async () => {
    let balance = 100;
    const existing = {
      id: 'tx-1',
      balanceBefore: 100,
      balanceAfter: 150,
      points: 50,
      idempotencyKey: 'earn:PURCHASE:o1:base',
    };
    let createCalls = 0;

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      loyaltyMembership: {
        findUnique: jest
          .fn()
          .mockImplementation(async () => ({ id: 'm1', userId: 'u1', currentBalance: balance })),
        update: jest.fn().mockImplementation(async (_args: any) => {
          if (typeof _args.data.currentBalance === 'number') {
            balance = _args.data.currentBalance;
          }
        }),
      },
      loyaltyTransaction: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue(existing),
        create: jest.fn().mockImplementation(async () => {
          createCalls++;
          return existing;
        }),
      },
    };

    const first = await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
      idempotencyKey: 'earn:PURCHASE:o1:base',
    });
    expect(first.applied).toBe(true);
    expect(balance).toBe(150);
    expect(createCalls).toBe(1);

    const second = await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
      idempotencyKey: 'earn:PURCHASE:o1:base',
    });
    expect(second.applied).toBe(false);
    expect(second.balanceBefore).toBe(100);
    expect(second.balanceAfter).toBe(150);
    expect(balance).toBe(150);
    expect(createCalls).toBe(1);
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('on unique violation restores balance and returns existing', async () => {
    let balance = 100;
    const existing = {
      id: 'tx-1',
      balanceBefore: 100,
      balanceAfter: 150,
      points: 50,
      idempotencyKey: 'earn:PURCHASE:o1:base',
    };

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      loyaltyMembership: {
        findUnique: jest
          .fn()
          .mockImplementation(async () => ({ id: 'm1', userId: 'u1', currentBalance: balance })),
        update: jest.fn().mockImplementation(async (_args: any) => {
          if (typeof _args.data.currentBalance === 'number') {
            balance = _args.data.currentBalance;
          }
        }),
      },
      loyaltyTransaction: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue(existing),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['idempotencyKey'] },
          }),
        ),
      },
    };

    const result = await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
      idempotencyKey: 'earn:PURCHASE:o1:base',
    });

    expect(result.applied).toBe(false);
    expect(result.balanceAfter).toBe(150);
    expect(balance).toBe(100);
  });
});
