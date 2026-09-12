import {
  extractPaymentCardNumbers,
  salePaidWithLoyaltyVoucher,
  customerFacingPosStatus,
  countsTowardSpend,
  mapOnlineOrder,
  mapPosSale,
} from './purchase-history.util';

describe('purchase-history.util', () => {
  describe('extractPaymentCardNumbers', () => {
    it('finds nested Lightspeed gift card numbers', () => {
      expect(
        extractPaymentCardNumbers({
          payments: [{ payment_details: { gift_card_number: 'HOS-1111' } }],
        }),
      ).toEqual(['HOS-1111']);
    });
  });

  describe('salePaidWithLoyaltyVoucher', () => {
    const voucher = {
      cardNumber: 'HOS-ABCD',
      storeId: 'store-1',
      issuedAt: new Date('2026-09-11T14:00:00.000Z'),
      createdAt: new Date('2026-09-11T14:00:00.000Z'),
    };

    it('matches a payment line card number', () => {
      expect(
        salePaidWithLoyaltyVoucher(
          {
            storeId: 'store-1',
            saleDate: new Date('2026-09-11T15:00:00.000Z'),
            rawPayload: { payments: [{ gift_card_number: 'hos abcd' }] },
          },
          [voucher],
        ),
      ).toBe(true);
    });

    it('uses same-store timing when payments are missing', () => {
      expect(
        salePaidWithLoyaltyVoucher(
          {
            storeId: 'store-1',
            saleDate: new Date('2026-09-11T15:00:00.000Z'),
            rawPayload: {},
          },
          [voucher],
        ),
      ).toBe(true);
    });

    it('does not match cash tenders even with a nearby voucher', () => {
      expect(
        salePaidWithLoyaltyVoucher(
          {
            storeId: 'store-1',
            saleDate: new Date('2026-09-11T15:00:00.000Z'),
            rawPayload: { payments: [{ name: 'Cash' }] },
          },
          [voucher],
        ),
      ).toBe(false);
    });

    it('treats loyaltyPointsRedeemed as a positive signal', () => {
      expect(
        salePaidWithLoyaltyVoucher(
          {
            storeId: 'store-2',
            saleDate: new Date('2026-09-11T15:00:00.000Z'),
            loyaltyPointsRedeemed: 200,
            rawPayload: { payments: [{ name: 'Cash' }] },
          },
          [voucher],
        ),
      ).toBe(true);
    });
  });

  describe('customerFacingPosStatus', () => {
    it('maps processed sales to COMPLETED', () => {
      expect(customerFacingPosStatus('PROCESSED')).toBe('COMPLETED');
    });

    it('maps voided Lightspeed state to CANCELLED', () => {
      expect(customerFacingPosStatus('IMPORTED', { state: 'voided' })).toBe('CANCELLED');
    });
  });

  describe('countsTowardSpend', () => {
    it('excludes cancelled and refunded rows', () => {
      expect(countsTowardSpend({ type: 'online', status: 'CANCELLED' })).toBe(false);
      expect(countsTowardSpend({ type: 'in-store', status: 'CANCELLED' })).toBe(false);
    });

    it('includes delivered online and completed in-store', () => {
      expect(countsTowardSpend({ type: 'online', status: 'DELIVERED' })).toBe(true);
      expect(countsTowardSpend({ type: 'in-store', status: 'COMPLETED' })).toBe(true);
    });
  });

  describe('mappers', () => {
    it('maps an online order', () => {
      const row = mapOnlineOrder({
        id: 'o1',
        orderNumber: 'HOS-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        total: '12.50',
        currency: 'USD',
        status: 'DELIVERED',
        loyaltyPointsEarned: 12,
        loyaltyPointsRedeemed: 100,
        items: [{ quantity: 2, price: '6.25', product: { name: 'Charm' } }],
      });
      expect(row.type).toBe('online');
      expect(row.total).toBe(12.5);
      expect(row.items[0]).toEqual({ name: 'Charm', quantity: 2, price: 6.25 });
      expect(row.paidWithLoyaltyVoucher).toBe(true);
    });

    it('maps a POS sale with store name', () => {
      const row = mapPosSale(
        {
          id: 's1',
          saleDate: new Date('2026-01-02T00:00:00.000Z'),
          totalAmount: 9,
          currency: 'GBP',
          status: 'IMPORTED',
          loyaltyPointsEarned: 9,
          storeId: 'st',
          externalInvoice: 'INV-1',
          store: { name: 'Bath' },
          items: [{ name: 'Pin', quantity: 1, unitPrice: 9 }],
        },
        [],
      );
      expect(row).toMatchObject({
        type: 'in-store',
        storeName: 'Bath',
        orderNumber: 'INV-1',
        status: 'COMPLETED',
        currency: 'GBP',
      });
    });
  });
});
