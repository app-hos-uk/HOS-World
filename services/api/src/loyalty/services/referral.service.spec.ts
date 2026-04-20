import { LoyaltyReferralService } from './referral.service';

describe('LoyaltyReferralService', () => {
  it('returns existing pending code', async () => {
    const prisma: any = {
      loyaltyReferral: {
        findFirst: jest.fn().mockResolvedValue({ referralCode: 'HOS-EXIST-AA' }),
        create: jest.fn(),
      },
    };
    const config: any = { get: jest.fn().mockReturnValue('HOS') };
    const svc = new LoyaltyReferralService(prisma, config);
    const code = await svc.ensureReferralCode('mem1', 'Alice');
    expect(code).toBe('HOS-EXIST-AA');
    expect(prisma.loyaltyReferral.create).not.toHaveBeenCalled();
  });

  it('creates branded code with prefix from config', async () => {
    const prisma: any = {
      loyaltyReferral: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const config: any = { get: jest.fn().mockReturnValue('EC') };
    const svc = new LoyaltyReferralService(prisma, config);
    const code = await svc.ensureReferralCode('mem1', 'Bob');
    expect(code).toMatch(/^EC-BOB-[0-9A-F]{4}$/);
    expect(prisma.loyaltyReferral.create).toHaveBeenCalled();
  });
});
