import { Test } from '@nestjs/testing';
import { StoreAdminController } from './store-admin.controller';
import { StoreOnboardingService } from './store-onboarding.service';

describe('StoreAdminController', () => {
  let controller: StoreAdminController;
  const stores = {
    listStores: jest.fn().mockResolvedValue([]),
    createStore: jest.fn().mockResolvedValue({ id: 's1' }),
    getStore: jest.fn().mockResolvedValue({ id: 's1' }),
    updateStore: jest.fn().mockResolvedValue({ id: 's1' }),
    activateStore: jest.fn().mockResolvedValue({ id: 's1' }),
    deactivateStore: jest.fn().mockResolvedValue({ id: 's1' }),
    completeOnboardingStep: jest.fn().mockResolvedValue({ id: 's1' }),
    finishOnboarding: jest.fn().mockResolvedValue({ id: 's1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const m = await Test.createTestingModule({
      controllers: [StoreAdminController],
      providers: [{ provide: StoreOnboardingService, useValue: stores }],
    }).compile();
    controller = m.get(StoreAdminController);
  });

  it('list', async () => {
    await controller.list();
    expect(stores.listStores).toHaveBeenCalled();
  });

  it('create', async () => {
    await controller.create({ tenantId: 't1', name: 'A', code: 'B' } as any);
    expect(stores.createStore).toHaveBeenCalled();
  });

  it('activate', async () => {
    await controller.activate('s1');
    expect(stores.activateStore).toHaveBeenCalledWith('s1');
  });

  it('onboarding step', async () => {
    await controller.step('s1', { step: 'go_live' });
    expect(stores.completeOnboardingStep).toHaveBeenCalledWith('s1', 'go_live');
  });
});
