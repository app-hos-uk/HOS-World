import { Test } from '@nestjs/testing';
import { BrandPartnershipsAdminController } from './brand-partnerships-admin.controller';
import { BrandPartnershipsService } from './brand-partnerships.service';

describe('BrandPartnershipsAdminController', () => {
  let controller: BrandPartnershipsAdminController;
  const brand = {
    getDashboard: jest.fn().mockResolvedValue({ totalPartnerships: 1 }),
    listPartnerships: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    createPartnership: jest.fn().mockResolvedValue({ id: 'p1' }),
    getPartnership: jest.fn().mockResolvedValue({ id: 'p1', campaigns: [] }),
    updatePartnership: jest.fn().mockResolvedValue({ id: 'p1' }),
    archivePartnership: jest.fn().mockResolvedValue({ id: 'p1' }),
    getPartnershipReport: jest.fn().mockResolvedValue({}),
    createCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    listCampaigns: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    updateCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    activateCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    pauseCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    completeCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    cancelCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
    getCampaignReport: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [BrandPartnershipsAdminController],
      providers: [{ provide: BrandPartnershipsService, useValue: brand }],
    }).compile();
    controller = moduleRef.get(BrandPartnershipsAdminController);
  });

  it('dashboard', async () => {
    const r = await controller.dashboard();
    expect(brand.getDashboard).toHaveBeenCalled();
    expect(r.data).toEqual({ totalPartnerships: 1 });
  });

  it('list partnerships', async () => {
    await controller.list();
    expect(brand.listPartnerships).toHaveBeenCalled();
  });

  it('create partnership', async () => {
    await controller.create({
      name: 'A',
      contractStart: new Date().toISOString(),
      contractEnd: new Date(Date.now() + 86400000).toISOString(),
    } as any);
    expect(brand.createPartnership).toHaveBeenCalled();
  });

  it('campaign activate', async () => {
    await controller.activate('c1');
    expect(brand.activateCampaign).toHaveBeenCalledWith('c1');
  });

  it('campaign report', async () => {
    await controller.campaignReport('c1');
    expect(brand.getCampaignReport).toHaveBeenCalledWith('c1');
  });

  it('partnership report', async () => {
    await controller.report('p1');
    expect(brand.getPartnershipReport).toHaveBeenCalledWith('p1');
  });
});
