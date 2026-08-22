import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { LoyaltyWalletService } from './wallet.service';

function makeTx(opts: {
  balance: number;
  txFindUnique?: jest.Mock;
  txCreate?: jest.Mock;
  updateManyCount?: number;
}) {
  let balance = opts.balance;
  const tx = {
    loyaltyMembership: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.updateManyCount ?? 1 }),
      findUnique: jest.fn().mockImplementation(async () => ({
        id: 'm1',
        userId: 'u1',
        currentBalance: balance,
      })),
      update: jest.fn().mockImplementation(async (_args: { data: { currentBalance?: number } }) => {
        if (typeof _args.data.currentBalance === 'number') {
          balance = _args.data.currentBalance;
        }
      }),
    },
    loyaltyTransaction: {
      findUnique: opts.txFindUnique ?? jest.fn().mockResolvedValue(null),
      create: opts.txCreate ?? jest.fn().mockResolvedValue({}),
    },
  };
  return {
    tx,
    getBalance: () => balance,
    setBalance: (n: number) => {
      balance = n;
    },
  };
}

describe('LoyaltyWalletService', () => {
  const segmentation = { touchActivity: jest.fn().mockResolvedValue(undefined) };
  const service = new LoyaltyWalletService(segmentation as any);

  it('locks the membership with a Prisma update rather than raw SQL', async () => {
    const { tx } = makeTx({ balance: 100 });
    await service.lockMembership(tx as any, 'm1');
    expect(tx.loyaltyMembership.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { currentBalance: { increment: 0 } },
    });
  });

  it('throws when the membership cannot be locked', async () => {
    const { tx } = makeTx({ balance: 100, updateManyCount: 0 });
    await expect(service.lockMembership(tx as any, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('credits and debits balance atomically in tx', async () => {
    const { tx, getBalance } = makeTx({ balance: 100 });

    await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
    });
    expect(getBalance()).toBe(150);

    await service.applyDelta(tx as any, 'm1', -50, LoyaltyTxType.BURN, {
      source: 'REDEMPTION',
      channel: 'MARKETPLACE_CHECKOUT',
    });
    expect(getBalance()).toBe(100);
  });

  it('rejects debit below zero', async () => {
    const { tx } = makeTx({ balance: 10 });

    await expect(
      service.applyDelta(tx as any, 'm1', -20, LoyaltyTxType.BURN, {
        source: 'REDEMPTION',
        channel: 'MARKETPLACE_CHECKOUT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('duplicate idempotencyKey does not double credit', async () => {
    const existing = {
      id: 'tx-1',
      balanceBefore: 100,
      balanceAfter: 150,
      points: 50,
      idempotencyKey: 'earn:PURCHASE:o1:base',
    };
    let createCalls = 0;
    const { tx, getBalance } = makeTx({
      balance: 100,
      txFindUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(existing),
      txCreate: jest.fn().mockImplementation(async () => {
        createCalls++;
        return existing;
      }),
    });

    const first = await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
      idempotencyKey: 'earn:PURCHASE:o1:base',
    });
    expect(first.applied).toBe(true);
    expect(getBalance()).toBe(150);
    expect(createCalls).toBe(1);

    const second = await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
      idempotencyKey: 'earn:PURCHASE:o1:base',
    });
    expect(second.applied).toBe(false);
    expect(second.balanceBefore).toBe(100);
    expect(second.balanceAfter).toBe(150);
    expect(getBalance()).toBe(150);
    expect(createCalls).toBe(1);
    expect(tx.loyaltyMembership.updateMany).toHaveBeenCalled();
  });

  it('on unique violation restores balance and returns existing', async () => {
    const existing = {
      id: 'tx-1',
      balanceBefore: 100,
      balanceAfter: 150,
      points: 50,
      idempotencyKey: 'earn:PURCHASE:o1:base',
    };
    const { tx, getBalance } = makeTx({
      balance: 100,
      txFindUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(existing),
      txCreate: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['idempotencyKey'] },
        }),
      ),
    });

    const result = await service.applyDelta(tx as any, 'm1', 50, LoyaltyTxType.EARN, {
      source: 'PURCHASE',
      channel: 'WEB',
      idempotencyKey: 'earn:PURCHASE:o1:base',
    });

    expect(result.applied).toBe(false);
    expect(result.balanceAfter).toBe(150);
    expect(getBalance()).toBe(100);
  });
});
