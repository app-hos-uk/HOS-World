import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { BrandPartnershipsController } from './brand-partnerships.controller';
import { BrandPartnershipsService } from './brand-partnerships.service';

describe('BrandPartnershipsController', () => {
  let controller: BrandPartnershipsController;
  const brand = {
    getActivePublicCampaigns: jest.fn().mockResolvedValue([]),
    getCampaignProducts: jest.fn().mockResolvedValue([]),
  };
  const prisma = {
    loyaltyMembership: {
      findUnique: jest.fn().mockResolvedValue({ tier: { level: 3 } }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [BrandPartnershipsController],
      providers: [
        { provide: BrandPartnershipsService, useValue: brand },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    controller = moduleRef.get(BrandPartnershipsController);
  });

  it('GET list calls service with tier level', async () => {
    const r = await controller.list({ user: { id: 'u1' } } as any);
    expect(brand.getActivePublicCampaigns).toHaveBeenCalledWith('u1', 3);
    expect(r.data).toEqual([]);
  });

  it('GET products', async () => {
    await controller.products('camp-1', '10');
    expect(brand.getCampaignProducts).toHaveBeenCalledWith('camp-1', 10);
  });
});
