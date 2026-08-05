import { Injectable, BadRequestException } from '@nestjs/common';
import {
  LedgerEntryType,
  type ChartOfAccountsMapping,
  type XeroManualJournalPayload,
  type XeroJournalLine,
  DEFAULT_COA_MAPPING,
} from './accounting.types';
import { assertNoPosSaleInLedger } from './pos-sale.guard';

export interface OnlineSalesSummary {
  periodDate: string; // YYYY-MM-DD
  grossRevenue: number;
  taxAmount: number;
  stripeFees: number;
  giftCardRedeemed: number;
  loyaltyDiscount: number;
  netReceivable: number;
}

export interface RefundsSummary {
  periodDate: string;
  refundTotal: number;
  taxReversed: number;
}

export interface PointsLiabilitySummary {
  periodDate: string;
  pointsEarnedValue: number;
  pointsBurnedValue: number;
  breakageRecognised: number;
}

export interface GcBridgeReclassSummary {
  periodDate: string;
  /** Points liability moved into Lightspeed gift-card liability */
  reclassAmount: number;
}

export interface HosGiftCardsSummary {
  periodDate: string;
  issuedAmount: number;
  redeemedAmount: number;
  expiredAmount: number;
}

/**
 * Builds balanced daily-summary ManualJournal payloads.
 * Never accepts per-order or POSSale-sourced inputs.
 */
@Injectable()
export class JournalBuilderService {
  buildOnlineSales(
    summary: OnlineSalesSummary,
    coa: ChartOfAccountsMapping = DEFAULT_COA_MAPPING,
  ): XeroManualJournalPayload {
    const lines: XeroJournalLine[] = [
      {
        accountCode: coa.stripeReceivable,
        description: 'Stripe receivable (online)',
        debit: round2(summary.netReceivable),
      },
    ];
    if (summary.stripeFees > 0) {
      lines.push({
        accountCode: coa.stripeFees,
        description: 'Stripe processing fees',
        debit: round2(summary.stripeFees),
      });
    }

    if (summary.giftCardRedeemed > 0) {
      lines.push({
        accountCode: coa.giftCardLiability,
        description: 'HOS gift card redemptions',
        debit: round2(summary.giftCardRedeemed),
      });
    }
    if (summary.loyaltyDiscount > 0) {
      lines.push({
        accountCode: coa.loyaltyDiscount,
        description: 'Loyalty discount',
        debit: round2(summary.loyaltyDiscount),
      });
    }

    lines.push({
      accountCode: coa.onlineRevenue,
      description: 'Online sales revenue',
      credit: round2(summary.grossRevenue),
    });
    if (summary.taxAmount > 0) {
      lines.push({
        accountCode: coa.onlineTax,
        description: 'Online sales tax',
        credit: round2(summary.taxAmount),
      });
    }

    return this.finalize(
      LedgerEntryType.ONLINE_SALES,
      summary.periodDate,
      'HOS online sales daily summary',
      lines,
      'HOS_ONLINE',
    );
  }

  buildRefunds(
    summary: RefundsSummary,
    coa: ChartOfAccountsMapping = DEFAULT_COA_MAPPING,
  ): XeroManualJournalPayload {
    const lines: XeroJournalLine[] = [
      {
        accountCode: coa.refunds,
        description: 'Online refunds / returns',
        debit: round2(summary.refundTotal),
      },
      {
        accountCode: coa.stripeReceivable,
        description: 'Stripe receivable reduction (refunds)',
        credit: round2(summary.refundTotal - summary.taxReversed),
      },
    ];
    if (summary.taxReversed > 0) {
      lines.push({
        accountCode: coa.onlineTax,
        description: 'Tax reversed on refunds',
        credit: round2(summary.taxReversed),
      });
    }

    return this.finalize(
      LedgerEntryType.REFUNDS,
      summary.periodDate,
      'HOS online refunds daily summary',
      lines,
      'HOS_ONLINE',
    );
  }

  buildPointsLiability(
    summary: PointsLiabilitySummary,
    coa: ChartOfAccountsMapping = DEFAULT_COA_MAPPING,
  ): XeroManualJournalPayload {
    const lines: XeroJournalLine[] = [];

    if (summary.pointsEarnedValue > 0) {
      lines.push(
        {
          accountCode: coa.loyaltyDiscount,
          description: 'Points accrued (contra / deferred)',
          debit: round2(summary.pointsEarnedValue),
        },
        {
          accountCode: coa.pointsLiability,
          description: 'Points liability accrual',
          credit: round2(summary.pointsEarnedValue),
        },
      );
    }
    if (summary.pointsBurnedValue > 0) {
      lines.push(
        {
          accountCode: coa.pointsLiability,
          description: 'Points liability relief (burn)',
          debit: round2(summary.pointsBurnedValue),
        },
        {
          accountCode: coa.loyaltyDiscount,
          description: 'Points redeemed',
          credit: round2(summary.pointsBurnedValue),
        },
      );
    }
    if (summary.breakageRecognised > 0) {
      lines.push(
        {
          accountCode: coa.pointsLiability,
          description: 'Points breakage',
          debit: round2(summary.breakageRecognised),
        },
        {
          accountCode: coa.pointsBreakage,
          description: 'Breakage revenue',
          credit: round2(summary.breakageRecognised),
        },
      );
    }

    if (lines.length === 0) {
      throw new BadRequestException('Points liability summary has no movements');
    }

    return this.finalize(
      LedgerEntryType.POINTS_LIABILITY,
      summary.periodDate,
      'HOS loyalty points liability daily summary',
      lines,
      'HOS_LOYALTY',
    );
  }

  buildGcBridgeReclass(
    summary: GcBridgeReclassSummary,
    coa: ChartOfAccountsMapping = DEFAULT_COA_MAPPING,
  ): XeroManualJournalPayload {
    if (summary.reclassAmount <= 0) {
      throw new BadRequestException('GC bridge reclass amount must be positive');
    }

    const lines: XeroJournalLine[] = [
      {
        accountCode: coa.pointsLiability,
        description: 'Points→GC bridge: relieve points liability',
        debit: round2(summary.reclassAmount),
      },
      {
        accountCode: coa.giftCardLiability,
        description: 'Points→GC bridge: gift card liability',
        credit: round2(summary.reclassAmount),
      },
    ];

    return this.finalize(
      LedgerEntryType.GC_BRIDGE_RECLASS,
      summary.periodDate,
      'HOS points→gift-card liability reclass',
      lines,
      'HOS_LOYALTY',
    );
  }

  buildHosGiftCards(
    summary: HosGiftCardsSummary,
    coa: ChartOfAccountsMapping = DEFAULT_COA_MAPPING,
  ): XeroManualJournalPayload {
    const lines: XeroJournalLine[] = [];

    if (summary.issuedAmount > 0) {
      lines.push(
        {
          accountCode: coa.stripeReceivable,
          description: 'HOS gift card sales (cash/receivable)',
          debit: round2(summary.issuedAmount),
        },
        {
          accountCode: coa.giftCardLiability,
          description: 'HOS gift card liability issued',
          credit: round2(summary.issuedAmount),
        },
      );
    }
    if (summary.redeemedAmount > 0) {
      lines.push(
        {
          accountCode: coa.giftCardLiability,
          description: 'HOS gift card redemptions',
          debit: round2(summary.redeemedAmount),
        },
        {
          accountCode: coa.onlineRevenue,
          description: 'Revenue on gift card redemption',
          credit: round2(summary.redeemedAmount),
        },
      );
    }
    if (summary.expiredAmount > 0) {
      lines.push(
        {
          accountCode: coa.giftCardLiability,
          description: 'HOS gift card expiry',
          debit: round2(summary.expiredAmount),
        },
        {
          accountCode: coa.giftCardExpiryRevenue,
          description: 'Gift card expiry revenue',
          credit: round2(summary.expiredAmount),
        },
      );
    }

    if (lines.length === 0) {
      throw new BadRequestException('HOS gift card summary has no movements');
    }

    return this.finalize(
      LedgerEntryType.HOS_GIFT_CARDS,
      summary.periodDate,
      'HOS gift cards daily summary',
      lines,
      'HOS_GIFT_CARDS',
    );
  }

  /**
   * Reject any attempt to build a POS-derived journal (hard guard + unit-tested).
   */
  rejectPosSaleJournal(entryType: string, payload: unknown): never {
    assertNoPosSaleInLedger(entryType, payload);
    throw new BadRequestException(
      `POSSale amounts must never be posted to Xero from HOS (entryType=${entryType})`,
    );
  }

  private finalize(
    entryType: LedgerEntryType,
    periodDate: string,
    narration: string,
    lines: XeroJournalLine[],
    source: XeroManualJournalPayload['meta']['source'],
  ): XeroManualJournalPayload {
    assertBalanced(lines);

    const payload: XeroManualJournalPayload = {
      narration: `${narration} ${periodDate}`,
      date: periodDate,
      lineAmountTypes: 'NoTax',
      status: 'POSTED',
      journalLines: lines,
      meta: { entryType, periodDate, source },
    };

    assertNoPosSaleInLedger(entryType, payload);
    return payload;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function assertBalanced(lines: XeroJournalLine[]): void {
  const debit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(round2(debit) - round2(credit)) > 0.009) {
    throw new BadRequestException(
      `Journal lines do not balance: debit=${debit} credit=${credit}`,
    );
  }
}
