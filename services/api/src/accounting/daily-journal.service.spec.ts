import { DailyJournalService } from './daily-journal.service';
import { LedgerEntryType } from './accounting.types';

describe('DailyJournalService', () => {
  function build(overrides?: { accountingEnabled?: boolean }) {
    const prisma: any = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      loyaltyTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }),
      },
      loyaltyPosVoucher: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      giftCardTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      giftCard: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 0 } }),
      },
    };
    const config: any = {
      get: jest.fn().mockReturnValue('0.01'),
    };
    const journals = {
      buildOnlineSales: jest.fn().mockReturnValue({ meta: { entryType: 'ONLINE_SALES' } }),
      buildRefunds: jest.fn().mockReturnValue({ meta: { entryType: 'REFUNDS' } }),
      buildPointsLiability: jest.fn().mockReturnValue({ meta: { entryType: 'POINTS_LIABILITY' } }),
      buildGcBridgeReclass: jest.fn().mockReturnValue({ meta: { entryType: 'GC_BRIDGE_RECLASS' } }),
      buildHosGiftCards: jest.fn().mockReturnValue({ meta: { entryType: 'HOS_GIFT_CARDS' } }),
    };
    const accounting: any = {
      isEnabled: jest.fn().mockReturnValue(overrides?.accountingEnabled ?? true),
      getCoaMapping: jest.fn().mockResolvedValue({ currency: 'GBP' }),
      getJournalBuilder: jest.fn().mockReturnValue(journals),
      enqueueBuilt: jest.fn().mockImplementation(async (_type, _day, build) => {
        build();
        return { id: 'ob-1' };
      }),
    };
    const metrics: any = { incrementCounter: jest.fn() };

    const svc = new DailyJournalService(prisma, config, accounting, metrics);
    return { svc, prisma, accounting, journals, metrics };
  }

  it('skips when accounting is disabled', async () => {
    const { svc, accounting } = build({ accountingEnabled: false });
    const result = await svc.enqueueForPeriod('2026-08-05');
    expect(result.skipped).toContain('disabled');
    expect(accounting.enqueueBuilt).not.toHaveBeenCalled();
  });

  it('defaults periodDate to previous UTC day', () => {
    const { svc } = build();
    expect(svc.defaultPeriodDate(new Date('2026-08-06T12:00:00.000Z'))).toBe('2026-08-05');
  });

  it('enqueues online sales when paid orders exist', async () => {
    const { svc, prisma, accounting, journals } = build();
    prisma.order.findMany.mockResolvedValue([
      {
        total: 120,
        tax: 20,
        platformFeeAmount: 2,
        loyaltyDiscountAmount: 5,
        giftCardTransactions: [{ amount: 10 }],
      },
    ]);

    const result = await svc.enqueueForPeriod('2026-08-05');
    expect(result.enqueued).toContain(LedgerEntryType.ONLINE_SALES);
    expect(journals.buildOnlineSales).toHaveBeenCalledWith(
      expect.objectContaining({
        periodDate: '2026-08-05',
        grossRevenue: 100,
        taxAmount: 20,
        stripeFees: 2,
        giftCardRedeemed: 10,
        loyaltyDiscount: 5,
        netReceivable: 103,
      }),
      expect.anything(),
    );
    expect(accounting.enqueueBuilt).toHaveBeenCalled();
  });

  it('enqueues points liability from earn/burn/expire aggregates', async () => {
    const { svc, prisma, journals } = build();
    prisma.loyaltyTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { points: 1000 } }) // earn
      .mockResolvedValueOnce({ _sum: { points: -200 } }) // burn
      .mockResolvedValueOnce({ _sum: { points: -50 } }); // expire

    const result = await svc.enqueueForPeriod('2026-08-05');
    expect(result.enqueued).toContain(LedgerEntryType.POINTS_LIABILITY);
    expect(journals.buildPointsLiability).toHaveBeenCalledWith(
      expect.objectContaining({
        pointsEarnedValue: 10,
        pointsBurnedValue: 2,
        breakageRecognised: 0.5,
      }),
      expect.anything(),
    );
  });
});
