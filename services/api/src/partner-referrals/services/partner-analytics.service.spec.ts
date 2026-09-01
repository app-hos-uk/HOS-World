import { NotFoundException } from '@nestjs/common';
import { PartnerAnalyticsService } from './partner-analytics.service';

describe('PartnerAnalyticsService', () => {
  const prisma: any = {
    referralPartner: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    referralPartnerLink: {
      findUnique: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    partnerReferralConversion: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
  };

  let svc: PartnerAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new PartnerAnalyticsService(prisma);
  });

  it('getPartnerReport 404s when missing', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue(null);
    await expect(svc.getPartnerReport('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getDashboard aggregates programme KPIs and top partners', async () => {
    prisma.referralPartner.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    prisma.referralPartnerLink.count.mockResolvedValue(7);
    prisma.referralPartnerLink.aggregate.mockResolvedValue({
      _sum: { totalClicks: 100, totalRegistrations: 20, totalConversions: 8 },
    });
    prisma.referralPartnerLink.groupBy.mockResolvedValue([
      {
        partnerId: 'p1',
        _sum: { totalRegistrations: 12, totalConversions: 3, totalClicks: 40 },
      },
    ]);
    prisma.referralPartner.findMany.mockResolvedValue([
      { id: 'p1', name: 'Hotels NYC', slug: 'hotels-nyc', status: 'ACTIVE', type: 'EXTERNAL' },
    ]);

    const data = (await svc.getDashboard()) as any;
    expect(data.totalPartners).toBe(5);
    expect(data.activePartners).toBe(4);
    expect(data.activeLinks).toBe(7);
    expect(data.totalRegistrations).toBe(20);
    expect(data.totalConversions).toBe(8);
    expect(data.topPartners[0].name).toBe('Hotels NYC');
    expect(data.topPartners[0].registrations).toBe(12);
  });
});
