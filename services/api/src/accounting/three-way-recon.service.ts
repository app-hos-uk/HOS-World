import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AccountingService } from './accounting.service';
import { XeroAuthService } from './xero-auth.service';
import { LedgerEntryType, LedgerOutboxStatus } from './accounting.types';

const RECON_ENTRY_TYPES = [
  LedgerEntryType.POINTS_LIABILITY,
  LedgerEntryType.GC_BRIDGE_RECLASS,
  LedgerEntryType.HOS_GIFT_CARDS,
] as const;

export type LastPostedSummary = {
  id: string;
  periodDate: string;
  postedAt: string | null;
  xeroJournalId: string | null;
};

export type ThreeWayReconReport = {
  asOf: string;
  pointsLiability: {
    totalPoints: number;
    redeemValuePerPoint: number;
    estimatedCurrencyLiability: number;
    currency: string;
  };
  giftCards: {
    issuedVoucherCount: number;
    issuedAmount: number;
    failedCount: number;
    openDiscrepancyCount: number;
  };
  xero: {
    accountingEnabled: boolean;
    connected: boolean;
    coa: { pointsLiability: string; giftCardLiability: string };
    lastPostedByType: Record<string, LastPostedSummary | null>;
  };
  notes: string[];
};

@Injectable()
export class ThreeWayReconService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private accounting: AccountingService,
    private xeroAuth: XeroAuthService,
  ) {}

  async getReport(): Promise<ThreeWayReconReport> {
    const asOf = new Date().toISOString();
    const redeemRaw = this.config.get<string | number>('LOYALTY_DEFAULT_REDEEM_VALUE');
    const redeemValuePerPoint =
      redeemRaw === undefined || redeemRaw === null || redeemRaw === ''
        ? 0.01
        : Number(redeemRaw) || 0.01;

    const [
      pointsAgg,
      issuedAgg,
      failedCount,
      openDiscrepancyCount,
      coa,
      connection,
      ...lastPostedRows
    ] = await Promise.all([
      this.prisma.loyaltyMembership.aggregate({
        _sum: { currentBalance: true },
      }),
      this.prisma.loyaltyPosVoucher.aggregate({
        where: { status: 'ISSUED' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.loyaltyPosVoucher.count({ where: { status: 'FAILED' } }),
      this.countOpenGiftCardDiscrepancies(),
      this.accounting.getCoaMapping(),
      this.xeroAuth.getConnectionStatus(),
      ...RECON_ENTRY_TYPES.map((entryType) => this.findLatestPosted(entryType)),
    ]);

    const totalPoints = pointsAgg._sum.currentBalance ?? 0;
    const estimatedCurrencyLiability =
      Math.round(totalPoints * redeemValuePerPoint * 100) / 100;

    const lastPostedByType: Record<string, LastPostedSummary | null> = {};
    RECON_ENTRY_TYPES.forEach((entryType, i) => {
      lastPostedByType[entryType] = lastPostedRows[i] as LastPostedSummary | null;
    });

    return {
      asOf,
      pointsLiability: {
        totalPoints,
        redeemValuePerPoint,
        estimatedCurrencyLiability,
        currency: coa.currency,
      },
      giftCards: {
        issuedVoucherCount: issuedAgg._count._all,
        issuedAmount: Number(issuedAgg._sum.amount ?? 0),
        failedCount,
        openDiscrepancyCount,
      },
      xero: {
        accountingEnabled: this.accounting.isEnabled(),
        connected: connection.connected,
        coa: {
          pointsLiability: coa.pointsLiability,
          giftCardLiability: coa.giftCardLiability,
        },
        lastPostedByType,
      },
      notes: [
        'In-store sales post via Lightspeed native Xero connector — not included here',
        'Points liability is estimated from LoyaltyMembership.currentBalance × redeem value',
        'Gift card issued totals reflect LoyaltyPosVoucher ISSUED status only',
      ],
    };
  }

  private async findLatestPosted(
    entryType: LedgerEntryType,
  ): Promise<LastPostedSummary | null> {
    const row = await this.prisma.ledgerOutboxEntry.findFirst({
      where: {
        entryType,
        status: LedgerOutboxStatus.POSTED,
      },
      orderBy: [{ periodDate: 'desc' }, { postedAt: 'desc' }],
      select: {
        id: true,
        periodDate: true,
        postedAt: true,
        xeroJournalId: true,
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      periodDate: this.toDateString(row.periodDate),
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      xeroJournalId: row.xeroJournalId,
    };
  }

  private toDateString(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /**
   * Gift-card recon writes SETTLEMENT discrepancies with gift-card language in description.
   * If the query fails (e.g. missing table in older envs), return 0.
   */
  private async countOpenGiftCardDiscrepancies(): Promise<number> {
    try {
      return await this.prisma.discrepancy.count({
        where: {
          status: 'OPEN',
          OR: [
            { description: { contains: 'gift card', mode: 'insensitive' } },
            { description: { contains: 'LoyaltyPosVoucher', mode: 'insensitive' } },
            { description: { contains: 'gift-card', mode: 'insensitive' } },
          ],
        },
      });
    } catch {
      return 0;
    }
  }
}
