import * as crypto from 'crypto';
import { LightspeedAdapter } from './lightspeed.adapter';

describe('LightspeedAdapter', () => {
  const creds = {
    domainPrefix: 'demo',
    accessToken: 'tok',
    clientSecret: 'oauth-secret',
  };

  describe('validateWebhook', () => {
    it('accepts valid X-Signature over raw body', () => {
      const adapter = new LightspeedAdapter(creds);
      const raw = 'payload=%7B%22id%22%3A%221%22%7D&type=sale.update';
      const hex = crypto.createHmac('sha256', 'oauth-secret').update(raw).digest('hex');
      const header = `signature=${hex},algorithm=HMAC-SHA256`;
      expect(adapter.validateWebhook(raw, header, 'oauth-secret')).toBe(true);
    });

    it('rejects wrong HMAC', () => {
      const adapter = new LightspeedAdapter(creds);
      const raw = 'payload=x';
      const header = 'signature=deadbeef,algorithm=HMAC-SHA256';
      expect(adapter.validateWebhook(raw, header, 'oauth-secret')).toBe(false);
    });

    it('rejects non HMAC-SHA256 algorithm', () => {
      const adapter = new LightspeedAdapter(creds);
      const raw = 'payload=x';
      const hex = crypto.createHmac('sha256', 'oauth-secret').update(raw).digest('hex');
      expect(
        adapter.validateWebhook(raw, `signature=${hex},algorithm=HMAC-SHA1`, 'oauth-secret'),
      ).toBe(false);
    });

    it('rejects re-serialized object payload (must be raw string/buffer)', () => {
      const adapter = new LightspeedAdapter(creds);
      expect(adapter.validateWebhook({ a: 1 }, 'signature=abc,algorithm=HMAC-SHA256', 's')).toBe(
        false,
      );
    });
  });

  describe('parseWebhookSale', () => {
    it('JSON.parses string payload field', () => {
      const adapter = new LightspeedAdapter(creds);
      const sale = adapter.parseWebhookSale({
        type: 'sale.update',
        payload: JSON.stringify({
          id: 'sale-1',
          state: 'closed',
          outlet_id: 'out-1',
          register_sale_products: [
            { product_id: 'p1', name: 'Hat', quantity: 1, price: 10, tax: 1 },
          ],
          totals: { total_price: 10, total_tax: 1 },
        }),
      });
      expect(sale.externalId).toBe('sale-1');
      expect(sale.items).toHaveLength(1);
      expect(sale.totalAmount).toBe(10);
      expect(sale.state).toBe('closed');
    });
  });

  describe('syncCustomer', () => {
    const customer = {
      internalId: 'mem-abc',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+44111',
      loyaltyCardNumber: 'CARD-1',
    };

    function mockClientRequest(adapter: LightspeedAdapter) {
      const request = jest.fn();
      (adapter as any).client.request = request;
      return request;
    }

    it('PUTs when customer_code search finds a verified existing customer', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request
        .mockResolvedValueOnce({
          status: 200,
          data: {
            data: [{ id: 'ls-existing', email: 'ada@example.com', customer_code: 'mem-abc' }],
          },
        })
        .mockResolvedValueOnce({ status: 200, data: { data: { id: 'ls-existing' } } });

      const id = await adapter.syncCustomer(customer);
      expect(id).toBe('ls-existing');
      expect(request.mock.calls[0][0]).toBe('GET');
      expect(request.mock.calls[0][1]).toContain('/search?');
      expect(request.mock.calls[0][1]).toContain('customer_code=mem-abc');
      expect(request.mock.calls[1][0]).toBe('PUT');
      expect(request.mock.calls[1][1]).toBe('/customers/ls-existing');
      expect(request.mock.calls[1][2]).toMatchObject({
        phone: '+44111',
        mobile: '+44111',
        customer_code: 'mem-abc',
        custom_field_1: 'CARD-1',
      });
      // Sparse body — no blank first_name wipe when provided
      expect(request.mock.calls[1][2].first_name).toBe('Ada');
    });

    it('ignores unverified search hits and continues', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request
        // customer_code search returns wrong code — must not PUT
        .mockResolvedValueOnce({
          status: 200,
          data: { data: [{ id: 'wrong', customer_code: 'other', email: 'x@y.com' }] },
        })
        // email search verified
        .mockResolvedValueOnce({
          status: 200,
          data: { data: [{ id: 'ls-by-email', email: 'ada@example.com' }] },
        })
        .mockResolvedValueOnce({ status: 200, data: { data: { id: 'ls-by-email' } } });

      const id = await adapter.syncCustomer(customer);
      expect(id).toBe('ls-by-email');
      expect(request.mock.calls.some((c) => c[0] === 'PUT' && c[1] === '/customers/ls-by-email')).toBe(
        true,
      );
      expect(request.mock.calls.some((c) => c[0] === 'PUT' && c[1] === '/customers/wrong')).toBe(
        false,
      );
    });

    it('searches by email then PUTs when customer_code miss', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request
        .mockResolvedValueOnce({ status: 200, data: { data: [] } })
        .mockResolvedValueOnce({
          status: 200,
          data: { data: [{ id: 'ls-by-email', email: 'ada@example.com' }] },
        })
        .mockResolvedValueOnce({ status: 200, data: { data: { id: 'ls-by-email' } } });

      const id = await adapter.syncCustomer(customer);
      expect(id).toBe('ls-by-email');
      expect(request.mock.calls[1][1]).toContain('email=ada');
      expect(request.mock.calls[2][0]).toBe('PUT');
    });

    it('omits empty optional fields on PUT so merchant data is not blanked', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request
        .mockResolvedValueOnce({
          status: 200,
          data: {
            data: [{ id: 'ls-1', customer_code: 'mem-abc', email: 'ada@example.com' }],
          },
        })
        .mockResolvedValueOnce({ status: 200, data: { data: { id: 'ls-1' } } });

      await adapter.syncCustomer({
        internalId: 'mem-abc',
        email: 'ada@example.com',
        // no firstName / lastName / phone
      });

      const putBody = request.mock.calls.find((c) => c[0] === 'PUT')?.[2] as Record<string, unknown>;
      expect(putBody).toEqual({
        customer_code: 'mem-abc',
        email: 'ada@example.com',
      });
      expect(putBody).not.toHaveProperty('first_name');
      expect(putBody).not.toHaveProperty('phone');
    });

    it('POSTs when neither customer_code nor email match', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request
        .mockResolvedValueOnce({ status: 200, data: { data: [] } }) // code search
        .mockResolvedValueOnce({ status: 200, data: { data: [] } }) // email search
        .mockResolvedValueOnce({ status: 200, data: { data: [] } }) // email list fallback
        .mockResolvedValueOnce({ status: 200, data: { data: { id: 'ls-new' } } });

      const id = await adapter.syncCustomer(customer);
      expect(id).toBe('ls-new');
      expect(request.mock.calls[3][0]).toBe('POST');
      expect(request.mock.calls[3][1]).toBe('/customers');
    });
  });

  describe('getSales', () => {
    it('pages /sales with after cursor until short page', async () => {
      const adapter = new LightspeedAdapter(creds);
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            data: [
              {
                id: 's1',
                version: 1,
                state: 'closed',
                outlet_id: 'out-1',
                line_items: [{ product_id: 'p', name: 'A', quantity: 1, price: 5 }],
                total_price: 5,
              },
            ],
            version: { min: 1, max: 1 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            data: [
              {
                id: 's2',
                version: 2,
                state: 'closed',
                outlet_id: 'out-1',
                line_items: [{ product_id: 'p', name: 'B', quantity: 1, price: 7 }],
                total_price: 7,
              },
            ],
            version: { min: 2, max: 2 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ data: [], version: { min: 2, max: 2 } }),
        });
      (globalThis as any).fetch = fetchMock;

      // Force pageSize behaviour: second page length < 100 ends loop after 2 pages
      // First call returns 1 item (< 100) so only one request — adjust mock to return full pages
      fetchMock.mockReset();
      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        id: `s${i}`,
        version: i + 1,
        state: 'closed',
        outlet_id: 'out-1',
        line_items: [{ product_id: 'p', name: 'A', quantity: 1, price: 1 }],
        total_price: 1,
      }));
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ data: fullPage, version: { min: 1, max: 100 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            data: [
              {
                id: 'last',
                version: 101,
                state: 'closed',
                outlet_id: 'out-1',
                line_items: [{ product_id: 'p', name: 'Z', quantity: 1, price: 1 }],
                total_price: 1,
              },
            ],
            version: { min: 101, max: 101 },
          }),
        });

      const page = await adapter.getSales({ afterVersion: 0, outletId: 'out-1' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0][0])).toContain('/api/2.0/sales?');
      expect(String(fetchMock.mock.calls[0][0])).toContain('after=0');
      expect(String(fetchMock.mock.calls[1][0])).toContain('after=100');
      expect(page.maxVersion).toBe(101);
      expect(page.sales.length).toBe(101);
    });
  });

  describe('gift cards', () => {
    function mockClientRequest(adapter: LightspeedAdapter) {
      const request = jest.fn();
      (adapter as any).client.request = request;
      return request;
    }

    it('listGiftCards pages GET /gift_cards with before cursor', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      const page = Array.from({ length: 100 }, (_, i) => ({
        id: `gc-${i}`,
        number: `CARD${String(i).padStart(8, '0')}`,
        balance: '1.00',
        status: 'ACTIVE',
      }));
      request
        .mockResolvedValueOnce({ status: 200, data: { data: page } })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            data: [{ id: 'gc-last', number: 'CARDLAST0001', balance: '2.00', status: 'ACTIVE' }],
          },
        });

      const cards = await adapter.listGiftCards({ pageSize: 100 });
      expect(request).toHaveBeenCalledWith('GET', '/gift_cards?page_size=100');
      expect(request).toHaveBeenCalledWith(
        'GET',
        '/gift_cards?page_size=100&before=gc-99',
      );
      expect(cards).toHaveLength(101);
      expect(cards[0].number).toBe('CARD00000000');
      expect(cards[100].id).toBe('gc-last');
    });

    it('createGiftCard POSTs /gift_cards', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request.mockResolvedValueOnce({
        status: 201,
        data: {
          data: {
            id: 'gc-1',
            number: 'ABCD2345EFGH',
            balance: '10.00',
            gift_card_transactions: [{ id: 'tx-1', amount: '10.00', type: 'ACTIVATION' }],
          },
        },
      });

      const card = await adapter.createGiftCard({ number: 'ABCD2345EFGH', amount: 10 });
      expect(request).toHaveBeenCalledWith('POST', '/gift_cards', {
        amount: 10,
        number: 'ABCD2345EFGH',
      });
      expect(card.number).toBe('ABCD2345EFGH');
      expect(card.balance).toBe(10);
      expect(card.transactions?.[0].type).toBe('ACTIVATION');
    });

    it('giftCardTransaction sends negative amount for REDEEMING', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request.mockResolvedValueOnce({
        status: 201,
        data: {
          data: {
            id: 'tx-r',
            amount: '-5.00',
            type: 'REDEEMING',
            client_id: 'client-1',
          },
        },
      });

      const tx = await adapter.giftCardTransaction('ABCD2345EFGH', {
        amount: 5,
        type: 'REDEEMING',
        clientId: 'client-1',
      });
      expect(request).toHaveBeenCalledWith('POST', '/gift_cards/ABCD2345EFGH/transactions', {
        amount: -5,
        type: 'REDEEMING',
        client_id: 'client-1',
      });
      expect(tx.clientId).toBe('client-1');
    });

    it('getGiftCardByNumber returns null on 404', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request.mockRejectedValueOnce(new Error('Lightspeed API 404: not found'));
      await expect(adapter.getGiftCardByNumber('MISSING')).resolves.toBeNull();
    });

    it('reverseGiftCardTransaction DELETEs transaction id', async () => {
      const adapter = new LightspeedAdapter(creds);
      const request = mockClientRequest(adapter);
      request.mockResolvedValueOnce({
        status: 200,
        data: { data: { id: 'tx-rev', amount: '5.00', type: 'REVERSING' } },
      });
      await adapter.reverseGiftCardTransaction('tx-r');
      expect(request).toHaveBeenCalledWith('DELETE', '/gift_cards/transactions/tx-r');
    });
  });
});
