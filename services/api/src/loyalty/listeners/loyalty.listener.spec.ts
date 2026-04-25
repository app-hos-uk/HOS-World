import { LoyaltyListener } from './loyalty.listener';
import { LoyaltyTxType } from '@prisma/client';

function makeMocks() {
  const prisma: any = {
    loyaltyReferral: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    loyaltyMembership: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    loyaltyEarnRule: { findFirst: jest.fn() },
    loyaltyTransaction: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    productReview: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };
  const wallet: any = {
    applyDelta: jest.fn().mockResolvedValue({ balanceBefore: 0, balanceAfter: 10 }),
  };
  const tiers: any = {
    recalculateTier: jest.fn().mockResolvedValue({ upgraded: false, tierId: 't1' }),
  };
  const config: any = {
    get: jest.fn((k: string) => {
      if (k === 'LOYALTY_ENABLED') return 'true';
      if (k === 'LOYALTY_REFERRAL_REFEREE_BONUS') return 100;
      if (k === 'LOYALTY_REFERRAL_REFERRER_BONUS') return 200;
      return undefined;
    }),
  };
  const segmentation = { touchActivity: jest.fn().mockResolvedValue(undefined) };
  const ambassador = { onLoyaltyReferralConverted: jest.fn().mockResolvedValue(undefined) };
  const listener = new LoyaltyListener(
    prisma,
    wallet,
    tiers,
    config,
    segmentation as any,
    ambassador as any,
  );
  return { listener, prisma, wallet, tiers, config, segmentation, ambassador };
}

describe('LoyaltyListener', () => {
  it('onUserRegistered skips without referral code', async () => {
    const { listener, prisma } = makeMocks();
    await listener.onUserRegistered('u1');
    expect(prisma.loyaltyReferral.findFirst).not.toHaveBeenCalled();
  });

  it('onUserRegistered converts referral and credits both', async () => {
    const { listener, prisma, wallet } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-new' });
    prisma.loyaltyReferral.findFirst.mockResolvedValue({
      id: 'ref1',
      status: 'PENDING',
      referrerId: 'mem-ref',
      referrer: {},
    });
    await listener.onUserRegistered('u1', 'HOS-TEST-AB');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(wallet.applyDelta).toHaveBeenCalled();
  });

  it('onUserRegistered skips when user has no membership yet', async () => {
    const { listener, prisma } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue(null);
    await listener.onUserRegistered('u1', 'HOS-TEST-AB');
    expect(prisma.loyaltyReferral.findFirst).not.toHaveBeenCalled();
  });

  it('onUserRegistered skips self-referral', async () => {
    const { listener, prisma, wallet } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'same-mem' });
    prisma.loyaltyReferral.findFirst.mockResolvedValue({
      id: 'ref1',
      status: 'PENDING',
      referrerId: 'same-mem',
      referrer: {},
    });
    await listener.onUserRegistered('u1', 'HOS-SELF');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(wallet.applyDelta).not.toHaveBeenCalled();
  });

  it('onUserRegistered skips non-pending referral', async () => {
    const { listener, prisma, wallet } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-new' });
    prisma.loyaltyReferral.findFirst.mockResolvedValue({
      id: 'ref1',
      status: 'CONVERTED',
      referrerId: 'mem-ref',
      referrer: {},
    });
    await listener.onUserRegistered('u1', 'HOS-OLD');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(wallet.applyDelta).not.toHaveBeenCalled();
  });

  it('onReviewSubmitted skips when no membership', async () => {
    const { listener, prisma } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue(null);
    const n = await listener.onReviewSubmitted('u1', 'r1');
    expect(n).toBe(0);
  });

  it('onReviewSubmitted skips duplicate review earn', async () => {
    const { listener, prisma } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.productReview.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'APPROVED',
      comment: 'Nice',
      title: null,
    });
    prisma.loyaltyTransaction.findFirst.mockResolvedValueOnce({ id: 'tx1' });
    const n = await listener.onReviewSubmitted('u1', 'r1');
    expect(n).toBe(0);
  });

  it('onReviewSubmitted awards PHOTO_REVIEW when image URL in comment', async () => {
    const { listener, prisma, wallet } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.productReview.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'APPROVED',
      comment: 'See https://cdn.example.com/pic.png',
      title: null,
    });
    prisma.loyaltyTransaction.findFirst.mockResolvedValue(null);
    prisma.loyaltyEarnRule.findFirst.mockResolvedValue({
      id: 'rule1',
      action: 'PHOTO_REVIEW',
      pointsAmount: 50,
      maxPerDay: null,
      maxPerMonth: 3,
    });
    prisma.loyaltyTransaction.count.mockResolvedValue(0);
    const n = await listener.onReviewSubmitted('u1', 'r1');
    expect(n).toBe(50);
    expect(wallet.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      'm1',
      50,
      LoyaltyTxType.EARN,
      expect.objectContaining({ source: 'PHOTO_REVIEW', sourceId: 'r1' }),
    );
  });

  it('onSocialShare respects maxPerDay', async () => {
    const { listener, prisma } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.loyaltyEarnRule.findFirst.mockResolvedValue({
      pointsAmount: 10,
      maxPerDay: 5,
      maxPerMonth: null,
    });
    prisma.loyaltyTransaction.count.mockResolvedValue(5);
    const n = await listener.onSocialShare('u1', 'twitter');
    expect(n).toBe(0);
  });

  it('onQuestCompleted is idempotent', async () => {
    const { listener, prisma } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({ id: 'x' });
    const n = await listener.onQuestCompleted('u1', 'q1', 100);
    expect(n).toBe(0);
  });

  it('onQuizCompleted skips duplicate', async () => {
    const { listener, prisma } = makeMocks();
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.loyaltyTransaction.findFirst.mockResolvedValue({ id: 'x' });
    const n = await listener.onQuizCompleted('u1', 'quiz1', 25);
    expect(n).toBe(0);
  });

  it('onEventAttended is no-op', async () => {
    const { listener } = makeMocks();
    await expect(listener.onEventAttended('u1', 'e1')).resolves.toBeUndefined();
  });
});
