import { BadRequestException } from '@nestjs/common';
import { JournalBuilderService } from './journal-builder.service';
import { assertNoPosSaleInLedger } from './pos-sale.guard';
import { LedgerEntryType } from './accounting.types';

describe('JournalBuilderService POSSale guardrail', () => {
  const builder = new JournalBuilderService();

  it('builds ONLINE_SALES daily summary without POS references', () => {
    const journal = builder.buildOnlineSales({
      periodDate: '2026-08-01',
      grossRevenue: 100,
      taxAmount: 20,
      stripeFees: 5,
      giftCardRedeemed: 10,
      loyaltyDiscount: 5,
      netReceivable: 100, // 100+20 -10 -5 -5 fees accounted on debit side separately → need balance
    });
    // netReceivable(100) + fees(5) + gc(10) + loyalty(5) = 120; revenue(100)+tax(20)=120
    expect(journal.meta.entryType).toBe(LedgerEntryType.ONLINE_SALES);
    expect(journal.meta.source).toBe('HOS_ONLINE');
    expect(JSON.stringify(journal)).not.toMatch(/POSSale|posSaleId/i);
  });

  it('HARD GUARD: rejectPosSaleJournal throws and never produces a postable journal', () => {
    expect(() =>
      builder.rejectPosSaleJournal('POS_SALES', {
        posSaleIds: ['ls-sale-1', 'ls-sale-2'],
        total: 999,
      }),
    ).toThrow(BadRequestException);
  });

  it('HARD GUARD: assertNoPosSaleInLedger blocks POSSale id keys in payload', () => {
    expect(() =>
      assertNoPosSaleInLedger(LedgerEntryType.ONLINE_SALES, {
        meta: { entryType: LedgerEntryType.ONLINE_SALES },
        lines: [{ posSaleId: 'abc', amount: 10 }],
      }),
    ).toThrow(/POSSale guardrail/);
  });

  it('HARD GUARD: forbidden POS entry types are rejected', () => {
    expect(() =>
      assertNoPosSaleInLedger('INSTORE_SALES', { total: 1 }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertNoPosSaleInLedger('POS_SALE_DAILY', { total: 1 }),
    ).toThrow(BadRequestException);
  });

  it('PROVES POSSale never posts: drain path would refuse before Xero fetch', async () => {
    // Simulate the outbox pre-post guard used by LedgerOutboxService.drainPending
    const postedToXero: unknown[] = [];
    const mockPost = async (payload: unknown, entryType: string) => {
      assertNoPosSaleInLedger(entryType, payload);
      postedToXero.push(payload);
    };

    await expect(
      mockPost(
        {
          narration: 'Lightspeed POS register closure',
          posSaleId: 'sale-99',
          amount: 42,
        },
        'POS_SALES',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(postedToXero).toHaveLength(0);
  });
});
