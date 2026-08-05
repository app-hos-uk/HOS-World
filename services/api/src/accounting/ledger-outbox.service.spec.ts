import { BadRequestException } from '@nestjs/common';
import { LedgerOutboxService } from './ledger-outbox.service';
import { LedgerEntryType, LedgerOutboxStatus } from './accounting.types';

describe('LedgerOutboxService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createService(prismaOverrides: Record<string, unknown> = {}) {
    const store = new Map<string, any>();

    const prisma = {
      ledgerOutboxEntry: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.idempotencyKey) return store.get(where.idempotencyKey) ?? null;
          if (where.id) {
            for (const v of store.values()) if (v.id === where.id) return v;
          }
          return null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `id-${store.size + 1}`,
            attempts: 0,
            status: LedgerOutboxStatus.PENDING,
            lastError: null,
            xeroJournalId: null,
            postedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          store.set(row.idempotencyKey, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          let row =
            (where.idempotencyKey && store.get(where.idempotencyKey)) ||
            [...store.values()].find((r) => r.id === where.id);
          row = { ...row, ...data };
          store.set(row.idempotencyKey, row);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const row = [...store.values()].find((r) => r.id === where.id);
          if (!row || row.status !== where.status) return { count: 0 };
          Object.assign(row, {
            status: data.status,
            attempts: (row.attempts ?? 0) + (data.attempts?.increment ?? 0),
          });
          return { count: 1 };
        }),
        findMany: jest.fn(async ({ where }: any) =>
          [...store.values()].filter((r) => !where?.status || r.status === where.status),
        ),
        count: jest.fn(async () => store.size),
      },
      ...prismaOverrides,
    };

    const xeroApi = {
      postManualJournal: jest.fn(async () => ({
        manualJournalId: 'xero-mj-1',
        raw: {},
      })),
    };

    const xeroAuth = {
      getValidAccessToken: jest.fn(async () => ({
        accessToken: 'tok',
        tenantId: 'tenant-1',
      })),
    };

    const service = new LedgerOutboxService(prisma as any, xeroApi as any, xeroAuth as any);
    return { service, prisma, xeroApi, xeroAuth, store };
  }

  const samplePayload = {
    narration: 'HOS online sales daily summary 2026-08-01',
    date: '2026-08-01',
    journalLines: [
      { accountCode: '610', description: 'receivable', debit: 100 },
      { accountCode: '200', description: 'revenue', credit: 100 },
    ],
    meta: {
      entryType: LedgerEntryType.ONLINE_SALES,
      periodDate: '2026-08-01',
      source: 'HOS_ONLINE',
    },
  };

  it('enqueue upserts by idempotencyKey without duplicating', async () => {
    const { service, prisma, store } = createService();
    const key = 'ONLINE_SALES:2026-08-01';

    const first = await service.enqueue(
      LedgerEntryType.ONLINE_SALES,
      '2026-08-01',
      key,
      samplePayload,
    );
    expect(first.idempotencyKey).toBe(key);
    expect(prisma.ledgerOutboxEntry.create).toHaveBeenCalledTimes(1);

    const second = await service.enqueue(
      LedgerEntryType.ONLINE_SALES,
      '2026-08-01',
      key,
      { ...samplePayload, narration: 'updated' },
    );
    expect(prisma.ledgerOutboxEntry.create).toHaveBeenCalledTimes(1);
    expect(prisma.ledgerOutboxEntry.update).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);
    expect((second.payload as { narration: string }).narration).toBe('updated');
  });

  it('enqueue is a no-op when already POSTED', async () => {
    const { service, store } = createService();
    const key = 'ONLINE_SALES:2026-08-02';
    store.set(key, {
      id: 'posted-1',
      idempotencyKey: key,
      entryType: LedgerEntryType.ONLINE_SALES,
      status: LedgerOutboxStatus.POSTED,
      payload: samplePayload,
      xeroJournalId: 'existing',
    });

    const result = await service.enqueue(
      LedgerEntryType.ONLINE_SALES,
      '2026-08-02',
      key,
      samplePayload,
    );
    expect(result.xeroJournalId).toBe('existing');
    expect(result.status).toBe(LedgerOutboxStatus.POSTED);
  });

  it('drainPending posts with Idempotency-Key and marks POSTED', async () => {
    const { service, xeroApi, store } = createService();
    const key = 'ONLINE_SALES:2026-08-03';
    const payload = {
      ...samplePayload,
      date: '2026-08-03',
      meta: { ...samplePayload.meta, periodDate: '2026-08-03' },
    };
    await service.enqueue(LedgerEntryType.ONLINE_SALES, '2026-08-03', key, payload);

    // Ensure no real network — postManualJournal is mocked; also stub fetch
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('real fetch must not be called'));

    const result = await service.drainPending();
    expect(result.posted).toBe(1);
    expect(xeroApi.postManualJournal).toHaveBeenCalledWith(
      'tok',
      'tenant-1',
      expect.objectContaining({ date: '2026-08-03' }),
      key,
    );
    expect(store.get(key).status).toBe(LedgerOutboxStatus.POSTED);
    expect(store.get(key).xeroJournalId).toBe('xero-mj-1');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects enqueue of POSSale-derived payload', async () => {
    const { service, xeroApi } = createService();
    await expect(
      service.enqueue('POS_SALES', '2026-08-01', 'POS_SALES:2026-08-01', {
        posSaleId: 'sale-123',
        amount: 50,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(xeroApi.postManualJournal).not.toHaveBeenCalled();
  });
});
