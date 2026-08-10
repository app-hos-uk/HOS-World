import { BadRequestException } from '@nestjs/common';
import { StoreOnboardingService } from './store-onboarding.service';

describe('StoreOnboardingService', () => {
  let service: StoreOnboardingService;
  let prisma: any;
  let platformSeller: any;
  let encryption: any;
  let config: any;
  let featureFlags: any;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1' }) },
      store: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 's1' }),
        update: jest.fn(),
      },
      storeOnboardingChecklist: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pOSConnection: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
        fn({
          store: prisma.store,
          storeOnboardingChecklist: prisma.storeOnboardingChecklist,
          pOSConnection: prisma.pOSConnection,
        }),
      ),
    };
    const region = {
      getRegion: jest.fn().mockResolvedValue({
        currency: 'USD',
        country: 'US',
        locale: 'en-US',
        timezone: 'America/New_York',
        taxOrigin: null,
      }),
    };
    platformSeller = {
      resolvePlatformRetailSellerId: jest.fn().mockResolvedValue('seller-platform'),
    };
    encryption = {
      encrypt: jest.fn().mockReturnValue('enc-blob'),
    };
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'POS_ENABLED') return 'true';
        if (key === 'LOYALTY_ENABLED') return 'true';
        return undefined;
      }),
    };
    featureFlags = {
      isEnabled: jest.fn().mockReturnValue(true),
    };
    service = new StoreOnboardingService(
      prisma,
      region as any,
      platformSeller,
      encryption,
      config,
      featureFlags,
    );
  });

  it('createStore rejects missing tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(
      service.createStore({
        tenantId: 'bad',
        name: 'A',
        code: 'B',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createStore rejects duplicate code', async () => {
    prisma.store.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.createStore({
        tenantId: 't1',
        name: 'A',
        code: 'B',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createStore auto-resolves platform seller and creates checklist', async () => {
    prisma.store.findUnique.mockResolvedValueOnce(null).mockResolvedValue({
      id: 's1',
      onboardingChecklist: { steps: [], status: 'IN_PROGRESS' },
      tenant: { id: 't1', name: 'T' },
      posConnection: null,
    });
    prisma.store.create.mockResolvedValue({ id: 's1' });
    prisma.storeOnboardingChecklist.create.mockResolvedValue({});
    await service.createStore({ tenantId: 't1', name: 'A', code: 'NEW' } as any);
    expect(platformSeller.resolvePlatformRetailSellerId).toHaveBeenCalled();
    expect(prisma.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'seller-platform',
          isActive: false,
        }),
      }),
    );
    expect(prisma.storeOnboardingChecklist.create).toHaveBeenCalled();
  });

  it('createStore with lightspeed creates POS connection and activates store', async () => {
    prisma.store.findUnique.mockResolvedValueOnce(null).mockResolvedValue({
      id: 's1',
      onboardingChecklist: { steps: [], status: 'COMPLETED' },
      tenant: { id: 't1', name: 'T' },
      posConnection: { id: 'pos1' },
    });
    prisma.store.create.mockResolvedValue({ id: 's1' });
    prisma.storeOnboardingChecklist.create.mockResolvedValue({});
    prisma.pOSConnection.create.mockResolvedValue({});

    await service.createStore({
      tenantId: 't1',
      name: 'A',
      code: 'NEW',
      lightspeed: {
        domainPrefix: 'demo',
        clientId: 'cid',
        clientSecret: 'csec',
        accessToken: 'at',
        refreshToken: 'rt',
        externalOutletId: 'outlet-1',
      },
    } as any);

    expect(prisma.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: true }),
      }),
    );
    expect(encryption.encrypt).toHaveBeenCalled();
    expect(prisma.pOSConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'lightspeed',
          autoSyncProducts: false,
          autoSyncInventory: false,
          externalOutletId: 'outlet-1',
          credentials: 'enc-blob',
        }),
      }),
    );
  });

  it('getReadiness returns loyalty-relevant checks', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 's1',
      sellerId: 'seller-1',
      externalStoreId: null,
      posConnection: {
        id: 'pos1',
        isActive: true,
        credentials: 'enc',
        externalOutletId: 'o1',
        lastSaleImportedAt: new Date(),
      },
      posSales: [{ id: 'sale1' }],
    });

    const result = await service.getReadiness('s1');
    expect(result.checks.map((c) => c.key)).toEqual([
      'pos_runtime',
      'loyalty_runtime',
      'pos_connection',
      'pos_active',
      'credentials',
      'outlet_mapped',
      'sales_flowing',
    ]);
    expect(result.allPassed).toBe(true);
  });

  it('finishOnboarding rejects incomplete steps', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 's1',
      onboardingChecklist: {
        id: 'o1',
        status: 'IN_PROGRESS',
        steps: [{ key: 'a', label: 'A', completedAt: null, completedBy: null }],
      },
      tenant: {},
      posConnection: null,
    });
    await expect(service.finishOnboarding('s1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completeOnboardingStep marks step', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce({
        id: 's1',
        onboardingChecklist: {
          id: 'o1',
          storeId: 's1',
          status: 'IN_PROGRESS',
          steps: [
            { key: 'store_created', label: 'x', completedAt: null, completedBy: null },
            { key: 'go_live', label: 'y', completedAt: null, completedBy: null },
          ],
        },
        tenant: {},
        posConnection: null,
      })
      .mockResolvedValue({
        id: 's1',
        onboardingChecklist: { steps: [], status: 'IN_PROGRESS' },
        tenant: {},
        posConnection: null,
      });
    prisma.storeOnboardingChecklist.update.mockResolvedValue({});
    await service.completeOnboardingStep('s1', 'store_created');
    expect(prisma.storeOnboardingChecklist.update).toHaveBeenCalled();
  });
});
