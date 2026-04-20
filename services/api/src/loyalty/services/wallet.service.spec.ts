import { LoyaltyTxType } from '@prisma/client';
import { LoyaltyWalletService } from './wallet.service';

describe('LoyaltyWalletService', () => {
  const segmentation = { touchActivity: jest.fn().mockResolvedValue(undefined) };
  const service = new LoyaltyWalletService(segmentation as any);

  it('credits and debits balance atomically in tx', async () => {
    let balance = 100;
    const tx = {
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
      loyaltyMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', userId: 'u1', currentBalance: 10 }),
      },
      loyaltyTransaction: { create: jest.fn() },
    };

    await expect(
      service.applyDelta(tx as any, 'm1', -20, LoyaltyTxType.BURN, {
        source: 'REDEMPTION',
        channel: 'MARKETPLACE_CHECKOUT',
      }),
    ).rejects.toThrow('Insufficient loyalty balance');
  });
});
