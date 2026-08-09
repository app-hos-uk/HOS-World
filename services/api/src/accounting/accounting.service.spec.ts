import { ServiceUnavailableException } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { DEFAULT_COA_MAPPING, LedgerEntryType } from './accounting.types';

function buildService(overrides?: {
  accountingEnabled?: string;
  featureFlagEnabled?: boolean;
  findUnique?: jest.Mock;
  create?: jest.Mock;
  update?: jest.Mock;
  getConnectionStatus?: jest.Mock;
  getValidAccessToken?: jest.Mock;
  getAccounts?: jest.Mock;
  enqueue?: jest.Mock;
  encryptJson?: jest.Mock;
}) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ACCOUNTING_ENABLED') return overrides?.accountingEnabled ?? 'true';
      return undefined;
    }),
  } as any;

  const featureFlags = {
    isEnabled: jest.fn().mockReturnValue(overrides?.featureFlagEnabled ?? true),
  } as any;

  const prisma = {
    integrationConfig: {
      findUnique: overrides?.findUnique ?? jest.fn().mockResolvedValue(null),
      create: overrides?.create ?? jest.fn().mockResolvedValue({}),
      update: overrides?.update ?? jest.fn().mockResolvedValue({}),
    },
  } as any;

  const encryption = {
    encryptJson: overrides?.encryptJson ?? jest.fn().mockReturnValue('enc'),
  } as any;

  const journals = {
    buildOnlineSales: jest.fn().mockReturnValue({ lines: [] }),
  } as any;

  const outbox = {
    enqueue: overrides?.enqueue ?? jest.fn().mockResolvedValue({ id: 'outbox-1' }),
  } as any;

  const xeroAuth = {
    getConnectionStatus:
      overrides?.getConnectionStatus ??
      jest.fn().mockResolvedValue({
        connected: true,
        hasRefreshToken: true,
        tenantId: 't',
        expiresAt: null,
      }),
    getValidAccessToken:
      overrides?.getValidAccessToken ??
      jest.fn().mockResolvedValue({ accessToken: 'at', tenantId: 'tid' }),
  } as any;

  const xeroApi = {
    getAccounts: overrides?.getAccounts ?? jest.fn().mockResolvedValue({ Accounts: [] }),
  } as any;

  const service = new AccountingService(
    config,
    featureFlags,
    prisma,
    encryption,
    journals,
    outbox,
    xeroAuth,
    xeroApi,
  );

  return { service, config, featureFlags, prisma, encryption, journals, outbox, xeroAuth, xeroApi };
}

describe('AccountingService', () => {
  describe('isEnabled', () => {
    it('returns true when both ACCOUNTING_ENABLED and feature flag are on', () => {
      const { service } = buildService();
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when ACCOUNTING_ENABLED is off', () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      expect(service.isEnabled()).toBe(false);
    });

    it('returns false when feature flag is off', () => {
      const { service } = buildService({ featureFlagEnabled: false });
      expect(service.isEnabled()).toBe(false);
    });

    it('returns false when both are off', () => {
      const { service } = buildService({ accountingEnabled: '', featureFlagEnabled: false });
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('assertEnabled', () => {
    it('does not throw when enabled', () => {
      const { service } = buildService();
      expect(() => service.assertEnabled()).not.toThrow();
    });

    it('throws ServiceUnavailableException when disabled', () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      expect(() => service.assertEnabled()).toThrow(ServiceUnavailableException);
    });
  });

  describe('getStatus', () => {
    it('returns full status including connection and CoA mapping', async () => {
      const { service } = buildService();
      const status = await service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.accountingEnabledEnv).toBe(true);
      expect(status.featureFlag).toBe(true);
      expect(status.connection).toBeDefined();
      expect(status.coaMapping).toEqual(DEFAULT_COA_MAPPING);
    });

    it('reflects disabled state', async () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      const status = await service.getStatus();
      expect(status.enabled).toBe(false);
    });
  });

  describe('getCoaMapping', () => {
    it('returns DEFAULT_COA_MAPPING when no row exists', async () => {
      const { service } = buildService();
      const mapping = await service.getCoaMapping();
      expect(mapping).toEqual(DEFAULT_COA_MAPPING);
    });

    it('returns DEFAULT_COA_MAPPING when row has no settings', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ settings: null }),
      });
      const mapping = await service.getCoaMapping();
      expect(mapping).toEqual(DEFAULT_COA_MAPPING);
    });

    it('merges stored mapping over defaults', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({
          settings: { chartOfAccounts: { onlineRevenue: '999' } },
        }),
      });
      const mapping = await service.getCoaMapping();
      expect(mapping.onlineRevenue).toBe('999');
      expect(mapping.onlineTax).toBe(DEFAULT_COA_MAPPING.onlineTax);
    });
  });

  describe('updateCoaMapping', () => {
    it('throws when accounting is disabled', async () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      await expect(service.updateCoaMapping({ onlineRevenue: '300' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('creates a new integration row when none exists', async () => {
      const create = jest.fn().mockResolvedValue({});
      const findUnique = jest.fn().mockResolvedValue(null);
      const { service } = buildService({ findUnique, create });

      const result = await service.updateCoaMapping({ onlineRevenue: '300' });
      expect(result.onlineRevenue).toBe('300');
      expect(result.onlineTax).toBe(DEFAULT_COA_MAPPING.onlineTax);
      expect(create).toHaveBeenCalled();
    });

    it('updates existing integration row', async () => {
      const existingRow = {
        id: 'int-1',
        settings: { chartOfAccounts: { onlineRevenue: '200' } },
      };
      const findUnique = jest.fn().mockResolvedValue(existingRow);
      const update = jest.fn().mockResolvedValue({});
      const { service } = buildService({ findUnique, update });

      const result = await service.updateCoaMapping({ onlineRevenue: '300' });
      expect(result.onlineRevenue).toBe('300');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'int-1' },
        }),
      );
    });
  });

  describe('fetchRemoteAccounts', () => {
    it('throws when disabled', async () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      await expect(service.fetchRemoteAccounts()).rejects.toThrow(ServiceUnavailableException);
    });

    it('returns accounts and mapping when enabled', async () => {
      const accounts = { Accounts: [{ Code: '200', Name: 'Revenue' }] };
      const { service } = buildService({
        getAccounts: jest.fn().mockResolvedValue(accounts),
      });

      const result = await service.fetchRemoteAccounts();
      expect(result.accounts).toEqual(accounts);
      expect(result.mapping).toEqual(DEFAULT_COA_MAPPING);
    });
  });

  describe('enqueueDailyJournal', () => {
    it('throws when disabled', async () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      await expect(
        service.enqueueDailyJournal(LedgerEntryType.ONLINE_SALES, '2026-08-01', {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('enqueues with correct idempotency key', async () => {
      const enqueue = jest.fn().mockResolvedValue({ id: 'out-1' });
      const { service } = buildService({ enqueue });

      await service.enqueueDailyJournal(LedgerEntryType.ONLINE_SALES, '2026-08-01', { total: 100 });
      expect(enqueue).toHaveBeenCalledWith(
        LedgerEntryType.ONLINE_SALES,
        '2026-08-01',
        'ONLINE_SALES:2026-08-01',
        { total: 100 },
      );
    });
  });

  describe('enqueueBuilt', () => {
    it('throws when disabled', async () => {
      const { service } = buildService({ accountingEnabled: 'false' });
      await expect(
        service.enqueueBuilt(LedgerEntryType.REFUNDS, '2026-08-01', () => ({}) as any),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('calls the build function and enqueues', async () => {
      const enqueue = jest.fn().mockResolvedValue({ id: 'out-2' });
      const { service } = buildService({ enqueue });

      const buildFn = jest.fn().mockReturnValue({ lines: [] });
      await service.enqueueBuilt(LedgerEntryType.REFUNDS, '2026-08-01', buildFn);

      expect(buildFn).toHaveBeenCalled();
      expect(enqueue).toHaveBeenCalledWith(
        LedgerEntryType.REFUNDS,
        '2026-08-01',
        'REFUNDS:2026-08-01',
        { lines: [] },
      );
    });
  });

  describe('getJournalBuilder / getOutbox', () => {
    it('returns the journal builder instance', () => {
      const { service, journals } = buildService();
      expect(service.getJournalBuilder()).toBe(journals);
    });

    it('returns the outbox instance', () => {
      const { service, outbox } = buildService();
      expect(service.getOutbox()).toBe(outbox);
    });
  });
});
