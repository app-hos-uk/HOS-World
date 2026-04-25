import * as M from './lightspeed.mapper';

describe('lightspeed.mapper', () => {
  it('mapOutletFromVend maps fields', () => {
    const o = M.mapOutletFromVend({
      id: 'o1',
      name: 'Soho',
      physical_address_1: '1 St',
      city: 'London',
      country_id: 'GB',
      time_zone: 'Europe/London',
      deleted_at: null,
    });
    expect(o.externalId).toBe('o1');
    expect(o.name).toBe('Soho');
    expect(o.isActive).toBe(true);
  });

  it('mapSaleFromVend builds items', () => {
    const sale = M.mapSaleFromVend(
      {
        id: 's1',
        invoice_number: 'INV-1',
        created_at: '2026-01-15T12:00:00Z',
        outlet_id: 'o1',
        total_payment: 100,
        total_tax: 20,
        total_discount: 0,
        currency: 'GBP',
        line_items: [
          {
            product_id: 'p-ext',
            sku: 'SKU1',
            name: 'Wand',
            quantity: 2,
            price_total: 100,
            tax_total: 20,
          },
        ],
      },
      'o1',
    );
    expect(sale.externalId).toBe('s1');
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0].quantity).toBe(2);
    expect(sale.totalAmount).toBe(100);
  });
});
