import { XeroApiClient, XeroRateLimitError } from './xero-api.client';
import type { XeroManualJournalPayload } from './accounting.types';
import { LedgerEntryType } from './accounting.types';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

jest.useFakeTimers();

function flushSleep() {
  return jest.runAllTimersAsync();
}

const client = new XeroApiClient();

const sampleJournal: XeroManualJournalPayload = {
  narration: 'Daily summary',
  date: '2026-08-01',
  journalLines: [
    { accountCode: '200', description: 'Revenue', debit: 100 },
    { accountCode: '610', description: 'Receivable', credit: 100 },
  ],
  meta: {
    entryType: LedgerEntryType.ONLINE_SALES,
    periodDate: '2026-08-01',
    source: 'HOS_ONLINE',
  },
};

afterEach(() => {
  mockFetch.mockReset();
});

describe('XeroApiClient', () => {
  describe('postManualJournal', () => {
    it('posts a manual journal and returns the id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ManualJournals: [{ ManualJournalID: 'mj-1' }],
        }),
      });

      const result = await client.postManualJournal(
        'token',
        'tenant',
        sampleJournal,
        'idem-key',
      );
      expect(result.manualJournalId).toBe('mj-1');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/ManualJournals');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Idempotency-Key']).toBe('idem-key');
      expect(opts.headers['Xero-tenant-id']).toBe('tenant');

      const body = JSON.parse(opts.body);
      expect(body.ManualJournals[0].Narration).toBe('Daily summary');
      expect(body.ManualJournals[0].JournalLines).toHaveLength(2);
      expect(body.ManualJournals[0].JournalLines[0].LineAmount).toBe(100);
      expect(body.ManualJournals[0].JournalLines[1].LineAmount).toBe(-100);
    });

    it('throws when ManualJournalID is missing from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ManualJournals: [{}] }),
      });

      await expect(
        client.postManualJournal('token', 'tenant', sampleJournal, 'key'),
      ).rejects.toThrow('missing ManualJournalID');
    });

    it('uses debit value when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ManualJournals: [{ ManualJournalID: 'mj-2' }],
        }),
      });

      const journal: XeroManualJournalPayload = {
        ...sampleJournal,
        journalLines: [
          { accountCode: '200', description: 'Rev', debit: 50 },
        ],
      };
      await client.postManualJournal('token', 'tenant', journal, 'key');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ManualJournals[0].JournalLines[0].LineAmount).toBe(50);
    });

    it('defaults lineAmountTypes and status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ManualJournals: [{ ManualJournalID: 'mj-3' }],
        }),
      });

      await client.postManualJournal('token', 'tenant', sampleJournal, 'key');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ManualJournals[0].LineAmountTypes).toBe('NoTax');
      expect(body.ManualJournals[0].Status).toBe('POSTED');
    });
  });

  describe('getAccounts', () => {
    it('fetches accounts list', async () => {
      const accounts = { Accounts: [{ Code: '200' }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => accounts,
      });

      const result = await client.getAccounts('token', 'tenant');
      expect(result).toEqual(accounts);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/Accounts');
      expect(opts.method).toBe('GET');
      expect(opts.headers['Idempotency-Key']).toBeUndefined();
    });
  });

  describe('request — retry & error handling', () => {
    it('retries on 429 then succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: (h: string) => (h === 'retry-after' ? '1' : null) },
          text: async () => '',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });

      const promise = client.request('GET', '/test', 'token', 'tenant');
      await flushSleep();
      const result = await promise;
      expect(result.data).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws XeroRateLimitError after max retries on 429', async () => {
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => '1' },
          text: async () => '',
        });
      }

      let caughtError: Error | undefined;
      const promise = client.request('GET', '/test', 'token', 'tenant').catch((e) => {
        caughtError = e;
      });
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(61_000);
      }
      await promise;
      expect(caughtError).toBeInstanceOf(XeroRateLimitError);
      expect((caughtError as XeroRateLimitError).retryAfterSeconds).toBe(1);
    });

    it('retries on 5xx and then succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ recovered: true }),
        });

      const promise = client.request('GET', '/test', 'token', 'tenant');
      await flushSleep();
      const result = await promise;
      expect(result.data).toEqual({ recovered: true });
    });

    it('throws on 4xx error (no retry)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(
        client.request('GET', '/test', 'token', 'tenant'),
      ).rejects.toThrow('Xero API 400');
    });

    it('retries on network error then succeeds', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('network failure'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });

      const promise = client.request('GET', '/test', 'token', 'tenant');
      await flushSleep();
      const result = await promise;
      expect(result.data).toEqual({ ok: true });
    });

    it('does not add Idempotency-Key for GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.request('GET', '/test', 'token', 'tenant', undefined, 'key');
      expect(mockFetch.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined();
    });

    it('adds Idempotency-Key for POST requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.request('POST', '/test', 'token', 'tenant', {}, 'my-key');
      expect(mockFetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('my-key');
    });

    it('normalises path without leading slash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.request('GET', 'NoLeadingSlash', 'token', 'tenant');
      expect(mockFetch.mock.calls[0][0]).toContain('/NoLeadingSlash');
    });

    it('uses default retry-after of 60s when header is missing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => null },
          text: async () => '',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });

      const promise = client.request('GET', '/test', 'token', 'tenant');
      await flushSleep();
      await promise;
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('XeroRateLimitError', () => {
    it('has the correct name and retryAfterSeconds', () => {
      const err = new XeroRateLimitError('rate limited', 30);
      expect(err.name).toBe('XeroRateLimitError');
      expect(err.retryAfterSeconds).toBe(30);
      expect(err.message).toBe('rate limited');
    });
  });
});
