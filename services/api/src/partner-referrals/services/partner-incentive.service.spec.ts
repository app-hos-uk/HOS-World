import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PartnerIncentiveService } from './partner-incentive.service';

describe('PartnerIncentiveService', () => {
  const prisma: any = {
    referralPartnerLink: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    partnerReferralConversion: { findFirst: jest.fn(), create: jest.fn() },
    loyaltyMembership: { findUnique: jest.fn(), update: jest.fn() },
    loyaltyTransaction: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };

  const activeLink = {
    id: 'l1',
    partnerId: 'p1',
    isActive: true,
    expiresAt: null,
    maxRedemptions: 100,
    totalRegistrations: 2,
    signupBonusPoints: 50,
    pointsMultiplier: 2,
    multiplierDays: 30,
    couponCode: 'HOTEL50',
    utmSource: 'hotels',
    utmMedium: 'referral',
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    partner: { id: 'p1', name: 'Hotels NYC', status: 'ACTIVE' },
  };

  let svc: PartnerIncentiveService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.referralPartnerLink.findUnique.mockResolvedValue(activeLink);
    prisma.referralPartnerLink.updateMany.mockResolvedValue({ count: 1 });
    prisma.referralPartnerLink.update.mockResolvedValue({ totalRegistrations: 3 });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.partnerReferralConversion.findFirst.mockResolvedValue(null);
    prisma.partnerReferralConversion.create.mockResolvedValue({ id: 'c1' });
    prisma.loyaltyMembership.findUnique.mockResolvedValue({
      id: 'm1',
      currentBalance: 10,
    });
    prisma.loyaltyTransaction.findUnique.mockResolvedValue(null);
    prisma.loyaltyTransaction.create.mockResolvedValue({});
    prisma.loyaltyMembership.update.mockResolvedValue({});
    svc = new PartnerIncentiveService(prisma);
  });

  it('404s when the link does not exist', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue(null);
    await expect(svc.applySignupIncentives('u1', 'MISSING')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applyPartnerIncentives returns null for unknown codes (Enchanted Circle, etc.)', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue(null);
    await expect(svc.applyPartnerIncentives('u1', 'HOS-FRIEND-AA')).resolves.toBeNull();
  });

  it('rejects expired or inactive links', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue({
      ...activeLink,
      isActive: false,
    });
    await expect(svc.applySignupIncentives('u1', 'CODE')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when max redemptions are reached', async () => {
    prisma.referralPartnerLink.findUnique.mockResolvedValue({
      ...activeLink,
      maxRedemptions: 2,
      totalRegistrations: 2,
    });
    await expect(svc.applySignupIncentives('u1', 'CODE')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the existing conversion instead of rejecting a second attribution', async () => {
    prisma.partnerReferralConversion.findFirst.mockResolvedValue({
      id: 'existing',
      partnerId: 'p1',
      linkId: 'l1',
      signupBonusAwarded: 50,
      multiplierApplied: true,
      multiplierExpiresAt: new Date(),
      couponApplied: 'HOTEL50',
    });
    const result = await svc.applySignupIncentives('u1', 'CODE');
    expect(result.conversionId).toBe('existing');
    expect(prisma.partnerReferralConversion.create).not.toHaveBeenCalled();
  });

  it('awards bonus points, records conversion, and increments registrations', async () => {
    const result = await svc.applySignupIncentives('u1', 'CODE', { landingPage: '/ref/CODE' });
    expect(result.signupBonusAwarded).toBe(50);
    expect(result.multiplierApplied).toBe(true);
    expect(result.couponApplied).toBe('HOTEL50');
    expect(prisma.loyaltyMembership.update).toHaveBeenCalled();
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'BONUS',
          source: 'PARTNER_REFERRAL',
          points: 50,
        }),
      }),
    );
    expect(prisma.partnerReferralConversion.create).toHaveBeenCalled();
    expect(prisma.referralPartnerLink.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { totalRegistrations: { increment: 1 } },
    });
  });

  it('skips the points award when the user has no membership', async () => {
    prisma.loyaltyMembership.findUnique.mockResolvedValue(null);
    const result = await svc.applySignupIncentives('u1', 'CODE');
    expect(result.signupBonusAwarded).toBe(0);
    expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(prisma.partnerReferralConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signupBonusAwarded: 0 }),
      }),
    );
  });
});
