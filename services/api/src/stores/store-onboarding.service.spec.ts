import { BadRequestException } from '@nestjs/common';
import { StoreOnboardingService } from './store-onboarding.service';

describe('StoreOnboardingService', () => {
  let service: StoreOnboardingService;
  let prisma: any;

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
    };
    service = new StoreOnboardingService(prisma);
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

  it('createStore creates checklist', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 's1',
        onboardingChecklist: { steps: [], status: 'IN_PROGRESS' },
        tenant: { id: 't1', name: 'T' },
        posConnection: null,
      });
    prisma.store.create.mockResolvedValue({ id: 's1' });
    prisma.storeOnboardingChecklist.create.mockResolvedValue({});
    await service.createStore({ tenantId: 't1', name: 'A', code: 'NEW' } as any);
    expect(prisma.storeOnboardingChecklist.create).toHaveBeenCalled();
  });

  it('createStore always sets isActive false regardless of dto', async () => {
    prisma.store.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 's1',
        onboardingChecklist: { steps: [], status: 'IN_PROGRESS' },
        tenant: { id: 't1', name: 'T' },
        posConnection: null,
      });
    prisma.store.create.mockResolvedValue({ id: 's1' });
    prisma.storeOnboardingChecklist.create.mockResolvedValue({});
    await service.createStore({ tenantId: 't1', name: 'A', code: 'NEW', isActive: true } as any);
    expect(prisma.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('updateStore rejects isActive true without completed onboarding', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 's1',
      onboardingChecklist: { status: 'IN_PROGRESS' },
      tenant: {},
      posConnection: null,
    });
    await expect(service.updateStore('s1', { isActive: true } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('activateStore requires completed onboarding', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 's1',
      onboardingChecklist: { status: 'IN_PROGRESS' },
      tenant: {},
      posConnection: null,
    });
    await expect(service.activateStore('s1')).rejects.toBeInstanceOf(BadRequestException);
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
