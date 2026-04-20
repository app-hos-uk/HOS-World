import { Test } from '@nestjs/testing';
import { AmbassadorAdminController } from './ambassador-admin.controller';
import { AmbassadorService } from './ambassador.service';

describe('AmbassadorAdminController', () => {
  const ambassador = {
    adminDashboard: jest.fn().mockResolvedValue({ totalAmbassadors: 1 }),
    getLeaderboard: jest.fn().mockResolvedValue([]),
    listAllUgcAdmin: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    reviewUgc: jest.fn().mockResolvedValue({ id: 's1' }),
    adminListAmbassadors: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    adminGetAmbassador: jest.fn().mockResolvedValue({ id: 'a1' }),
    suspendAmbassador: jest.fn().mockResolvedValue({ status: 'SUSPENDED' }),
    reactivateAmbassador: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
  };

  let controller: AmbassadorAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const m = await Test.createTestingModule({
      controllers: [AmbassadorAdminController],
      providers: [{ provide: AmbassadorService, useValue: ambassador }],
    }).compile();
    controller = m.get(AmbassadorAdminController);
  });

  it('GET dashboard', async () => {
    const r = await controller.dashboard();
    expect(ambassador.adminDashboard).toHaveBeenCalled();
    expect(r.data).toEqual({ totalAmbassadors: 1 });
  });

  it('GET list', async () => {
    await controller.list();
    expect(ambassador.adminListAmbassadors).toHaveBeenCalled();
  });

  it('GET detail', async () => {
    await controller.getOne('00000000-0000-4000-8000-000000000001');
    expect(ambassador.adminGetAmbassador).toHaveBeenCalled();
  });

  it('POST suspend', async () => {
    await controller.suspend('00000000-0000-4000-8000-000000000001');
    expect(ambassador.suspendAmbassador).toHaveBeenCalled();
  });

  it('POST reactivate', async () => {
    await controller.reactivate('00000000-0000-4000-8000-000000000001');
    expect(ambassador.reactivateAmbassador).toHaveBeenCalled();
  });

  it('GET ugc queue', async () => {
    await controller.listUgc();
    expect(ambassador.listAllUgcAdmin).toHaveBeenCalled();
  });

  it('POST review ugc', async () => {
    await controller.reviewUgc(
      { user: { id: 'admin' } } as any,
      '00000000-0000-4000-8000-000000000002',
      { status: 'APPROVED' } as any,
    );
    expect(ambassador.reviewUgc).toHaveBeenCalled();
  });
});
