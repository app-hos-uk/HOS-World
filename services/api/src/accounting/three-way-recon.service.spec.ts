import { ThreeWayReconService } from './three-way-recon.service';
import { LedgerEntryType, LedgerOutboxStatus } from './accounting.types';

describe('ThreeWayReconService', () => {
  function createService(overrides: {
    prisma?: Record<string, unknown>;
    config?: Record<string, unknown>;
    accounting?: Record<string, unknown>;
    xeroAuth?: Record<string, unknown>;
  } = {}) {
    const prisma = {
      loyaltyMembership: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { currentBalance: 10_000 } }),
      },
      loyaltyPosVoucher: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 3 },
          _sum: { amount: 75.5 },
        }),
        count: jest.fn().mockResolvedValue(2),
      },
      discrepancy: {
        count: jest.fn().mockResolvedValue(1),
      },
      ledgerOutboxEntry: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.entryType === LedgerEntryType.POINTS_LIABILITY) {
            return {
              id: 'outbox-pl',
              periodDate: new Date('2026-08-01T00:00:00.000Z'),
              postedAt: new Date('2026-08-02T12:00:00.000Z'),
              xeroJournalId: 'xero-1',
            };
          }
          if (where.entryType === LedgerEntryType.HOS_GIFT_CARDS) {
            return {
              id: 'outbox-gc',
              periodDate: new Date('2026-08-03T00:00:00.000Z'),
              postedAt: null,
              xeroJournalId: null,
            };
          }
          return null;
        }),
      },
      ...(overrides.prisma || {}),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'LOYALTY_DEFAULT_REDEEM_VALUE') return '0.02';
        return undefined;
      }),
      ...(overrides.config || {}),
    };

    const accounting = {
      isEnabled: jest.fn().mockReturnValue(true),
      getCoaMapping: jest.fn().mockResolvedValue({
        pointsLiability: '850',
        giftCardLiability: '855',
        currency: 'GBP',
      }),
      ...(overrides.accounting || {}),
    };

    const xeroAuth = {
      getConnectionStatus: jest.fn().mockResolvedValue({
        connected: true,
        hasRefreshToken: true,
        tenantId: 'tenant-1',
        expiresAt: null,
      }),
      ...(overrides.xeroAuth || {}),
    };

    const service = new ThreeWayReconService(
      prisma as any,
      config as any,
      accounting as any,
      xeroAuth as any,
    );

    return { service, prisma, config, accounting, xeroAuth };
  }

  it('aggregates points, gift cards, and latest posted outbox entries', async () => {
    const { service, prisma, accounting, xeroAuth } = createService();

    const report = await service.getReport();

    expect(report.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.pointsLiability).toEqual({
      totalPoints: 10_000,
      redeemValuePerPoint: 0.02,
      estimatedCurrencyLiability: 200,
      currency: 'GBP',
    });
    expect(report.giftCards).toEqual({
      issuedVoucherCount: 3,
      issuedAmount: 75.5,
      failedCount: 2,
      openDiscrepancyCount: 1,
    });
    expect(report.xero.accountingEnabled).toBe(true);
    expect(report.xero.connected).toBe(true);
    expect(report.xero.coa).toEqual({
      pointsLiability: '850',
      giftCardLiability: '855',
    });
    expect(report.xero.lastPostedByType[LedgerEntryType.POINTS_LIABILITY]).toEqual({
      id: 'outbox-pl',
      periodDate: '2026-08-01',
      postedAt: '2026-08-02T12:00:00.000Z',
      xeroJournalId: 'xero-1',
    });
    expect(report.xero.lastPostedByType[LedgerEntryType.GC_BRIDGE_RECLASS]).toBeNull();
    expect(report.xero.lastPostedByType[LedgerEntryType.HOS_GIFT_CARDS]).toEqual({
      id: 'outbox-gc',
      periodDate: '2026-08-03',
      postedAt: null,
      xeroJournalId: null,
    });
    expect(report.notes.some((n) => /Lightspeed native Xero/i.test(n))).toBe(true);

    expect(prisma.loyaltyMembership.aggregate).toHaveBeenCalled();
    expect(prisma.loyaltyPosVoucher.aggregate).toHaveBeenCalledWith({
      where: { status: 'ISSUED' },
      _count: { _all: true },
      _sum: { amount: true },
    });
    expect(prisma.loyaltyPosVoucher.count).toHaveBeenCalledWith({
      where: { status: 'FAILED' },
    });
    expect(prisma.ledgerOutboxEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entryType: LedgerEntryType.POINTS_LIABILITY,
          status: LedgerOutboxStatus.POSTED,
        },
      }),
    );
    expect(accounting.getCoaMapping).toHaveBeenCalled();
    expect(xeroAuth.getConnectionStatus).toHaveBeenCalled();
  });

  it('defaults redeem value to 0.01 when unset', async () => {
    const { service } = createService({
      config: {
        get: jest.fn().mockReturnValue(undefined),
      },
    });

    const report = await service.getReport();
    expect(report.pointsLiability.redeemValuePerPoint).toBe(0.01);
    expect(report.pointsLiability.estimatedCurrencyLiability).toBe(100);
  });

  it('returns openDiscrepancyCount 0 when discrepancy query fails', async () => {
    const { service } = createService({
      prisma: {
        discrepancy: {
          count: jest.fn().mockRejectedValue(new Error('relation missing')),
        },
      },
    });

    const report = await service.getReport();
    expect(report.giftCards.openDiscrepancyCount).toBe(0);
  });
});
