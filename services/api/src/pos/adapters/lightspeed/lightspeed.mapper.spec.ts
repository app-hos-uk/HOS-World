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

  describe('mapSaleFromVend', () => {
    it('maps full API 1.0 / webhook sale with register_sale_products and nested totals', () => {
      const sale = M.mapSaleFromVend(
        {
          id: 'sale-1.0',
          invoice_number: 'INV-100',
          sale_date: '2026-03-01T10:00:00Z',
          outlet_id: 'outlet-a',
          currency: 'GBP',
          totals: {
            total_price: 120,
            total_tax: 20,
            total_payment: 120,
            total_to_pay: 0,
          },
          customer: {
            id: 'cust-9',
            email: 'guest@example.com',
            mobile: '+447700900123',
          },
          register_sale_products: [
            {
              product_id: 'prod-a',
              sku: 'SKU-A',
              name: 'Cocktail',
              quantity: 2,
              price: 50,
              price_total: 100,
              tax: 10,
              tax_total: 16.67,
              tax_rate: 0.2,
            },
            {
              product_id: 'prod-b',
              sku: 'SKU-B',
              name: 'Snack',
              quantity: 1,
              price: 20,
              price_total: 20,
              tax_total: 3.33,
            },
          ],
          line_items: [],
        },
        'fallback-outlet',
      );

      expect(sale.externalId).toBe('sale-1.0');
      expect(sale.invoiceNumber).toBe('INV-100');
      expect(sale.outletId).toBe('outlet-a');
      expect(sale.saleDate.toISOString()).toBe('2026-03-01T10:00:00.000Z');
      expect(sale.currency).toBe('GBP');
      expect(sale.totalAmount).toBe(120);
      expect(sale.taxAmount).toBe(20);
      expect(sale.discountAmount).toBe(0);
      expect(sale.customer).toEqual({
        email: 'guest@example.com',
        phone: '+447700900123',
        externalId: 'cust-9',
      });
      expect(sale.items).toHaveLength(2);
      expect(sale.items[0]).toMatchObject({
        externalProductId: 'prod-a',
        sku: 'SKU-A',
        name: 'Cocktail',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        taxAmount: 16.67,
      });
      expect(sale.items[1]).toMatchObject({
        externalProductId: 'prod-b',
        quantity: 1,
        unitPrice: 20,
        totalPrice: 20,
        taxAmount: 3.33,
      });
    });

    it('maps full API 2.0 sale with line_items and top-level totals', () => {
      const sale = M.mapSaleFromVend(
        {
          id: 's1',
          invoice_number: 'INV-1',
          created_at: '2026-01-15T12:00:00Z',
          outlet_id: 'o1',
          total_payment: 100,
          total_tax: 20,
          total_discount: 5,
          total: 100,
          currency: 'GBP',
          customer: {
            id: 'c1',
            email: 'a@b.com',
            phone: '+441111',
          },
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
      expect(sale.invoiceNumber).toBe('INV-1');
      expect(sale.saleDate.toISOString()).toBe('2026-01-15T12:00:00.000Z');
      expect(sale.items).toHaveLength(1);
      expect(sale.items[0]).toMatchObject({
        externalProductId: 'p-ext',
        sku: 'SKU1',
        name: 'Wand',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        taxAmount: 20,
      });
      expect(sale.totalAmount).toBe(100);
      expect(sale.taxAmount).toBe(20);
      expect(sale.discountAmount).toBe(5);
      expect(sale.customer).toEqual({
        email: 'a@b.com',
        phone: '+441111',
        externalId: 'c1',
      });
    });

    it('prefers register_sale_products when line_items is empty', () => {
      const sale = M.mapSaleFromVend(
        {
          id: 'sale-pref',
          totals: { total_payment: 30, total_tax: 5 },
          line_items: [],
          register_sale_products: [
            {
              product_id: 'p1',
              name: 'Beer',
              quantity: 1,
              price_total: 30,
              tax_total: 5,
            },
          ],
        },
        'o1',
      );

      expect(sale.items).toHaveLength(1);
      expect(sale.items[0].externalProductId).toBe('p1');
      expect(sale.items[0].totalPrice).toBe(30);
      expect(sale.totalAmount).toBe(30);
      expect(sale.taxAmount).toBe(5);
    });

    it('defaults missing currency to the region currency', () => {
      const sale = M.mapSaleFromVend(
        {
          id: 'sale-usd',
          total_payment: 10,
          line_items: [{ product_id: 'p', name: 'X', quantity: 1, price: 10 }],
        },
        'o1',
        'USD',
      );
      expect(sale.currency).toBe('USD');
    });

    it('uses nested totals over top-level zeros when totals are present', () => {
      const sale = M.mapSaleFromVend(
        {
          id: 'sale-totals',
          total_payment: 0,
          total_tax: 0,
          totals: {
            total_price: 80,
            total_tax: 13.33,
            total_payment: 80,
          },
          register_sale_products: [
            { product_id: 'p', name: 'Item', quantity: 1, price_total: 80, tax: 13.33 },
          ],
        },
        'o1',
      );
      expect(sale.totalAmount).toBe(80);
      expect(sale.taxAmount).toBe(13.33);
      expect(sale.items[0].taxAmount).toBe(13.33);
    });
  });
});
