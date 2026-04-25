import { Test } from '@nestjs/testing';
import { ProductCampaignsController } from './product-campaigns.controller';
import { ProductCampaignsService } from './product-campaigns.service';

describe('ProductCampaignsController', () => {
  let controller: ProductCampaignsController;
  const svc = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: '1' }),
    get: jest.fn().mockResolvedValue({ id: '1' }),
    update: jest.fn().mockResolvedValue({ id: '1' }),
    activate: jest.fn().mockResolvedValue({ id: '1' }),
    complete: jest.fn().mockResolvedValue({ id: '1' }),
    cancel: jest.fn().mockResolvedValue({ id: '1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const m = await Test.createTestingModule({
      controllers: [ProductCampaignsController],
      providers: [{ provide: ProductCampaignsService, useValue: svc }],
    }).compile();
    controller = m.get(ProductCampaignsController);
  });

  it('list', async () => {
    await controller.list('ACTIVE');
    expect(svc.list).toHaveBeenCalledWith({ status: 'ACTIVE' });
  });

  it('create', async () => {
    await controller.create({
      name: 'A',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    } as any);
    expect(svc.create).toHaveBeenCalled();
  });

  it('activate', async () => {
    await controller.activate('x');
    expect(svc.activate).toHaveBeenCalledWith('x');
  });

  it('complete', async () => {
    await controller.complete('x');
    expect(svc.complete).toHaveBeenCalledWith('x');
  });
});
