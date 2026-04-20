/**
 * Run from repo root:
 *   cd services/api && pnpm exec ts-node prisma/seeds/loyalty-seed.ts
 */
import { PrismaClient, LoyaltyTxType, SellerType, VendorStatus, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const tiers = [
    {
      name: 'Initiate',
      slug: 'initiate',
      level: 1,
      pointsThreshold: 0,
      multiplier: 1.0,
      inviteOnly: false,
      benefits: {
        freeShipping: false,
        earlyAccessHours: 0,
        eventAccess: false,
        personalShopper: false,
      },
    },
    {
      name: 'Spellcaster',
      slug: 'spellcaster',
      level: 2,
      pointsThreshold: 1000,
      multiplier: 1.25,
      inviteOnly: false,
      benefits: {
        freeShipping: false,
        earlyAccessHours: 0,
        eventAccess: false,
        personalShopper: false,
      },
    },
    {
      name: 'Enchanter',
      slug: 'enchanter',
      level: 3,
      pointsThreshold: 3000,
      multiplier: 1.5,
      inviteOnly: false,
      benefits: {
        freeShipping: false,
        earlyAccessHours: 24,
        eventAccess: false,
        personalShopper: false,
      },
    },
    {
      name: 'Dragon Keeper',
      slug: 'dragon-keeper',
      level: 4,
      pointsThreshold: 7500,
      multiplier: 2.0,
      inviteOnly: false,
      benefits: {
        freeShipping: true,
        shippingType: 'worldwide',
        earlyAccessHours: 48,
        eventAccess: true,
        personalShopper: false,
        exclusiveProducts: true,
      },
    },
    {
      name: 'Archmage Circle',
      slug: 'archmage-circle',
      level: 5,
      pointsThreshold: 15000,
      multiplier: 2.5,
      inviteOnly: false,
      benefits: {
        freeShipping: true,
        shippingType: 'worldwide',
        earlyAccessHours: 60,
        eventAccess: true,
        personalShopper: false,
        exclusiveProducts: true,
      },
    },
    {
      name: 'Council of Realms',
      slug: 'council-of-realms',
      level: 6,
      pointsThreshold: 0,
      multiplier: 3.0,
      inviteOnly: true,
      benefits: {
        freeShipping: true,
        shippingType: 'worldwide',
        earlyAccessHours: 72,
        eventAccess: true,
        personalShopper: true,
        exclusiveProducts: true,
        coCreation: true,
        dedicatedManager: true,
      },
    },
  ];

  for (const t of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { slug: t.slug },
      create: {
        name: t.name,
        slug: t.slug,
        level: t.level,
        pointsThreshold: t.pointsThreshold,
        multiplier: t.multiplier,
        benefits: t.benefits as object,
        inviteOnly: t.inviteOnly,
        isActive: true,
      },
      update: {
        pointsThreshold: t.pointsThreshold,
        multiplier: t.multiplier,
        benefits: t.benefits as object,
        inviteOnly: t.inviteOnly,
      },
    });
  }

  const earnRules: Array<{
    action: string;
    name: string;
    pointsAmount: number;
    pointsType: string;
    multiplierStack: boolean;
    maxPerDay: number | null;
    maxPerMonth: number | null;
  }> = [
    { action: 'PURCHASE', name: 'Purchase Points', pointsAmount: 1, pointsType: 'PER_CURRENCY_UNIT', multiplierStack: true, maxPerDay: null, maxPerMonth: null },
    { action: 'SIGNUP', name: 'Welcome Bonus', pointsAmount: 100, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'PROFILE_COMPLETE', name: 'Profile Completion', pointsAmount: 50, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'REVIEW', name: 'Product Review', pointsAmount: 25, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: 3 },
    { action: 'PHOTO_REVIEW', name: 'Photo Review', pointsAmount: 50, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: 3 },
    { action: 'SOCIAL_SHARE', name: 'Social Share', pointsAmount: 10, pointsType: 'FIXED', multiplierStack: false, maxPerDay: 5, maxPerMonth: null },
    { action: 'REFERRAL_REFERRER', name: 'Referral (Referrer)', pointsAmount: 500, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'REFERRAL_REFEREE', name: 'Referral (Referee)', pointsAmount: 200, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'QUEST', name: 'Quest Completion', pointsAmount: 0, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'BIRTHDAY', name: 'Birthday Bonus', pointsAmount: 200, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'CHECK_IN', name: 'Store Check-in', pointsAmount: 15, pointsType: 'FIXED', multiplierStack: false, maxPerDay: 1, maxPerMonth: null },
    { action: 'QUIZ', name: 'Fandom Quiz', pointsAmount: 25, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: 4 },
    { action: 'ANNIVERSARY', name: 'Membership Anniversary', pointsAmount: 150, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
    { action: 'EVENT_ATTENDANCE', name: 'Event Attendance', pointsAmount: 100, pointsType: 'FIXED', multiplierStack: false, maxPerDay: null, maxPerMonth: null },
  ];

  for (const r of earnRules) {
    await prisma.loyaltyEarnRule.upsert({
      where: { action: r.action },
      create: {
        name: r.name,
        action: r.action,
        pointsAmount: r.pointsAmount,
        pointsType: r.pointsType,
        multiplierStack: r.multiplierStack,
        maxPerDay: r.maxPerDay ?? undefined,
        maxPerMonth: r.maxPerMonth ?? undefined,
        isActive: true,
      },
      update: {
        name: r.name,
        pointsAmount: r.pointsAmount,
        pointsType: r.pointsType,
        multiplierStack: r.multiplierStack,
        maxPerDay: r.maxPerDay ?? undefined,
        maxPerMonth: r.maxPerMonth ?? undefined,
      },
    });
  }

  const rewards = [
    { name: '£1 Discount', type: 'DISCOUNT', pointsCost: 100, value: 1.0 },
    { name: '£5 Discount', type: 'DISCOUNT', pointsCost: 500, value: 5.0 },
    { name: '£10 Discount', type: 'DISCOUNT', pointsCost: 1000, value: 10.0 },
    { name: 'Free Shipping Upgrade', type: 'FREE_SHIPPING', pointsCost: 200, value: null },
    { name: 'Raffle Entry', type: 'RAFFLE', pointsCost: 50, value: null },
    { name: '£5 Gift Card', type: 'GIFT_CARD', pointsCost: 500, value: 5.0 },
    { name: '£1 Charity Donation', type: 'CHARITY', pointsCost: 100, value: 1.0 },
    { name: 'Early Access Pass', type: 'EARLY_ACCESS', pointsCost: 300, value: null },
  ];

  for (const rw of rewards) {
    const existing = await prisma.loyaltyRedemptionOption.findFirst({ where: { name: rw.name } });
    if (!existing) {
      await prisma.loyaltyRedemptionOption.create({
        data: {
          name: rw.name,
          type: rw.type,
          pointsCost: rw.pointsCost,
          value: rw.value ?? undefined,
          isActive: true,
        },
      });
    }
  }

  const initiate = await prisma.loyaltyTier.findFirst({ where: { slug: 'initiate' } });
  if (!initiate) throw new Error('Initiate tier missing');

  const users = await prisma.user.findMany({
    where: { loyaltyPoints: { gt: 0 }, loyaltyMembership: null },
    select: { id: true, loyaltyPoints: true },
  });

  for (const u of users) {
    const tier = await prisma.loyaltyTier.findFirst({
      where: {
        isActive: true,
        inviteOnly: false,
        pointsThreshold: { lte: u.loyaltyPoints },
      },
      orderBy: { level: 'desc' },
    });
    const m = await prisma.loyaltyMembership.create({
      data: {
        userId: u.id,
        tierId: tier?.id ?? initiate.id,
        totalPointsEarned: u.loyaltyPoints,
        currentBalance: u.loyaltyPoints,
        cardNumber: `HOS-MIGR-${randomBytes(4).toString('hex').toUpperCase()}`,
      },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        membershipId: m.id,
        type: LoyaltyTxType.ADJUST,
        points: u.loyaltyPoints,
        balanceBefore: 0,
        balanceAfter: u.loyaltyPoints,
        source: 'SYSTEM',
        channel: 'SYSTEM',
        description: 'Migrated from legacy system',
      },
    });
  }

  const email = 'platform-retail@houseofspells.internal';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password: randomBytes(16).toString('hex'),
        firstName: 'House',
        lastName: 'Platform',
        role: UserRole.B2C_SELLER,
        country: 'GB',
        currencyPreference: 'GBP',
      },
    });
  }

  let seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) {
    seller = await prisma.seller.create({
      data: {
        userId: user.id,
        storeName: 'House of Spells Official',
        slug: 'house-of-spells-official',
        country: 'GB',
        sellerType: SellerType.PLATFORM_RETAIL,
        verified: true,
        vendorStatus: VendorStatus.APPROVED,
        loyaltyEnabled: true,
        loyaltyFundingModel: 'PLATFORM_FUNDED',
        commissionRate: 0,
      },
    });
  }

  console.log('Set HOS_SELLER_ID=' + seller.id);
  console.log('Loyalty seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
