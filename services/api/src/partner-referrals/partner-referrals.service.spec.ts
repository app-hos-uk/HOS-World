import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PartnerReferralsService } from './partner-referrals.service';
import { PartnerUrlService } from './services/partner-url.service';

describe('PartnerReferralsService', () => {
  const prisma = {
    referralPartner: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    referralPartnerLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    brandPartnership: {
      findUnique: jest.fn(),
    },
  };

  const urlService = {
    generateFullUrl: jest.fn().mockReturnValue('https://houseofspells.com/ref/CODE'),
    generateQrData: jest.fn().mockReturnValue('https://houseofspells.com/ref/CODE'),
    generatePartnerCode: jest.fn().mockReturnValue('PARTNER-HOTELS-NYC-ABCD'),
  };

  let service: PartnerReferralsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnerReferralsService(prisma as any, urlService as unknown as PartnerUrlService);
  });

  it('createPartner rejects inverted contract dates', async () => {
    await expect(
      service.createPartner({
        name: 'Hotels NYC',
        contractStart: '2026-12-01',
        contractEnd: '2026-01-01',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createPartner requires brandPartnershipId for BRAND_PARTNER', async () => {
    await expect(
      service.createPartner({ name: 'Brand Co', type: 'BRAND_PARTNER' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createPartner creates with a slug from the name', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue(null);
    prisma.referralPartner.create.mockResolvedValue({
      id: 'p1',
      name: 'Hotels NYC',
      slug: 'hotels-nyc',
    });
    const r = await service.createPartner({ name: 'Hotels NYC' } as any);
    expect(r.id).toBe('p1');
    expect(prisma.referralPartner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Hotels NYC', slug: 'hotels-nyc', type: 'EXTERNAL' }),
      }),
    );
  });

  it('archivePartner sets ARCHIVED', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue({ id: 'p1', status: 'ACTIVE' });
    prisma.referralPartner.update.mockResolvedValue({ id: 'p1', status: 'ARCHIVED' });
    const r = await service.archivePartner('p1');
    expect(r.status).toBe('ARCHIVED');
  });

  it('createLink rejects a non-ACTIVE partner', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue({ id: 'p1', status: 'PAUSED', slug: 'x' });
    await expect(
      service.createLink('p1', { name: 'Desk', utmSource: 'hotels' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createLink auto-generates a code when omitted', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'ACTIVE',
      slug: 'hotels-nyc',
    });
    prisma.referralPartnerLink.findUnique.mockResolvedValue(null);
    prisma.referralPartnerLink.create.mockResolvedValue({ id: 'l1', code: 'PARTNER-HOTELS-NYC-ABCD' });
    const r = await service.createLink('p1', { name: 'Front Desk', utmSource: 'hotels' } as any);
    expect(urlService.generatePartnerCode).toHaveBeenCalled();
    expect(r.code).toBe('PARTNER-HOTELS-NYC-ABCD');
  });

  it('createLink rejects a custom code that is not PARTNER-prefixed', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue({ id: 'p1', status: 'ACTIVE', slug: 'x' });
    await expect(
      service.createLink('p1', { name: 'Desk', utmSource: 'hotels', code: 'HILTON' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createLink rejects a duplicate custom code', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'ACTIVE',
      slug: 'hotels-nyc',
    });
    prisma.referralPartnerLink.findUnique.mockResolvedValue({ id: 'other' });
    await expect(
      service.createLink('p1', { name: 'Desk', utmSource: 'hotels', code: 'PARTNER-TAKEN' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('getPartner 404s when missing', async () => {
    prisma.referralPartner.findUnique.mockResolvedValue(null);
    await expect(service.getPartner('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listPartners returns pagination metadata', async () => {
    prisma.referralPartner.findMany.mockResolvedValue([]);
    prisma.referralPartner.count.mockResolvedValue(0);
    const r = await service.listPartners({ page: 2, limit: 10 });
    expect(r).toEqual({ items: [], total: 0, page: 2, limit: 10 });
  });

  it('resolveLink increments clicks and returns landing data', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue({
      id: 'l1',
      code: 'PARTNER-HOTELS-NYC',
      name: 'Front Desk',
      targetUrl: '/register',
      isActive: true,
      expiresAt: null,
      signupBonusPoints: 100,
      pointsMultiplier: null,
      multiplierDays: null,
      couponCode: 'WELCOME',
      discountPercent: null,
      discountFixedAmount: null,
      utmSource: 'hotels',
      utmMedium: 'referral',
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      partner: {
        id: 'p1',
        name: 'Hotels NYC',
        slug: 'hotels-nyc',
        logoUrl: null,
        description: null,
        status: 'ACTIVE',
      },
    });
    prisma.referralPartnerLink.update.mockResolvedValue({ totalClicks: 4 });
    const data = (await service.resolveLink('PARTNER-HOTELS-NYC')) as any;
    expect(prisma.referralPartnerLink.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { totalClicks: { increment: 1 } },
    });
    expect(data.partner.name).toBe('Hotels NYC');
    expect(data.offer.signupBonusPoints).toBe(100);
    expect(data.offer.couponCode).toBe('WELCOME');
  });

  it('resolveLink rejects inactive links', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue({
      id: 'l1',
      isActive: false,
      expiresAt: null,
      partner: { status: 'ACTIVE' },
    });
    await expect(service.resolveLink('X')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.referralPartnerLink.update).not.toHaveBeenCalled();
  });

  it('getLinkFullUrl delegates to PartnerUrlService', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue({
      id: 'l1',
      code: 'CODE',
      targetUrl: '/register',
      utmSource: 's',
      utmMedium: 'referral',
    });
    await expect(service.getLinkFullUrl('l1')).resolves.toBe('https://houseofspells.com/ref/CODE');
    expect(urlService.generateFullUrl).toHaveBeenCalled();
  });
});
