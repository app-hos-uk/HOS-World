import {
  buildReturnItemsPlainText,
  buildReturnNotifyPlainBody,
} from './return-notify.util';

describe('return-notify.util', () => {
  it('lists all lines when items are provided', () => {
    expect(
      buildReturnItemsPlainText([
        { name: 'Wand', quantity: 1, unitPrice: 29.99, currency: 'GBP' },
      ]),
    ).toContain('Wand × 1');
  });

  it('uses entire purchase when no line items selected', () => {
    expect(buildReturnItemsPlainText([])).toMatch(/entire purchase/i);
  });

  it('includes store and in-store refund hint', () => {
    const body = buildReturnNotifyPlainBody({
      sourceLabel: 'INV-123',
      storeName: 'House of Spells Bath',
      reason: 'DEFECTIVE',
      refundMethod: 'IN_STORE',
      items: [{ name: 'Pin', quantity: 2, unitPrice: 5 }],
      isInStore: true,
    });
    expect(body).toContain('House of Spells Bath');
    expect(body).toContain('In-store refund');
    expect(body).toContain('Pin × 2');
  });
});
