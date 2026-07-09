import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const TIERS = [
  {
    name: 'Initiate',
    slug: 'initiate',
    level: 1,
    pointsThreshold: 0,
    multiplier: 1.0,
    inviteOnly: false,
    benefits: { freeShipping: false, earlyAccessHours: 0, eventAccess: false, personalShopper: false },
  },
  {
    name: 'Spellcaster',
    slug: 'spellcaster',
    level: 2,
    pointsThreshold: 1000,
    multiplier: 1.25,
    inviteOnly: false,
    benefits: { freeShipping: false, earlyAccessHours: 0, eventAccess: false, personalShopper: false },
  },
  {
    name: 'Enchanter',
    slug: 'enchanter',
    level: 3,
    pointsThreshold: 3000,
    multiplier: 1.5,
    inviteOnly: false,
    benefits: { freeShipping: false, earlyAccessHours: 24, eventAccess: false, personalShopper: false },
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

const EARN_RULES = [
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

const REWARDS = [
  { name: '£1 Discount', type: 'DISCOUNT', pointsCost: 100, value: 1.0 },
  { name: '£5 Discount', type: 'DISCOUNT', pointsCost: 500, value: 5.0 },
  { name: '£10 Discount', type: 'DISCOUNT', pointsCost: 1000, value: 10.0 },
  { name: 'Free Shipping Upgrade', type: 'FREE_SHIPPING', pointsCost: 200, value: null },
  { name: 'Raffle Entry', type: 'RAFFLE', pointsCost: 50, value: null },
  { name: '£5 Gift Card', type: 'GIFT_CARD', pointsCost: 500, value: 5.0 },
  { name: '£1 Charity Donation', type: 'CHARITY', pointsCost: 100, value: 1.0 },
  { name: 'Early Access Pass', type: 'EARLY_ACCESS', pointsCost: 300, value: null },
];

@Injectable()
export class AdminSeedService {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedLoyaltyData(): Promise<{
    tiers: { created: number; updated: number };
    earnRules: { created: number; updated: number };
    redemptionOptions: { created: number; skipped: number };
  }> {
    const result = {
      tiers: { created: 0, updated: 0 },
      earnRules: { created: 0, updated: 0 },
      redemptionOptions: { created: 0, skipped: 0 },
    };

    for (const t of TIERS) {
      const existing = await this.prisma.loyaltyTier.findUnique({ where: { slug: t.slug } });
      if (existing) {
        await this.prisma.loyaltyTier.update({
          where: { slug: t.slug },
          data: {
            pointsThreshold: t.pointsThreshold,
            multiplier: t.multiplier,
            benefits: t.benefits as object,
            inviteOnly: t.inviteOnly,
          },
        });
        result.tiers.updated++;
      } else {
        await this.prisma.loyaltyTier.create({
          data: {
            name: t.name,
            slug: t.slug,
            level: t.level,
            pointsThreshold: t.pointsThreshold,
            multiplier: t.multiplier,
            benefits: t.benefits as object,
            inviteOnly: t.inviteOnly,
            isActive: true,
          },
        });
        result.tiers.created++;
      }
    }

    for (const r of EARN_RULES) {
      const existing = await this.prisma.loyaltyEarnRule.findUnique({ where: { action: r.action } });
      if (existing) {
        await this.prisma.loyaltyEarnRule.update({
          where: { action: r.action },
          data: {
            name: r.name,
            pointsAmount: r.pointsAmount,
            pointsType: r.pointsType,
            multiplierStack: r.multiplierStack,
            maxPerDay: r.maxPerDay ?? undefined,
            maxPerMonth: r.maxPerMonth ?? undefined,
          },
        });
        result.earnRules.updated++;
      } else {
        await this.prisma.loyaltyEarnRule.create({
          data: {
            name: r.name,
            action: r.action,
            pointsAmount: r.pointsAmount,
            pointsType: r.pointsType,
            multiplierStack: r.multiplierStack,
            maxPerDay: r.maxPerDay ?? undefined,
            maxPerMonth: r.maxPerMonth ?? undefined,
            isActive: true,
          },
        });
        result.earnRules.created++;
      }
    }

    for (const rw of REWARDS) {
      const existing = await this.prisma.loyaltyRedemptionOption.findFirst({
        where: { name: rw.name },
      });
      if (existing) {
        result.redemptionOptions.skipped++;
      } else {
        await this.prisma.loyaltyRedemptionOption.create({
          data: {
            name: rw.name,
            type: rw.type,
            pointsCost: rw.pointsCost,
            value: rw.value ?? undefined,
            isActive: true,
          },
        });
        result.redemptionOptions.created++;
      }
    }

    this.logger.log(
      `Loyalty seed complete: ${result.tiers.created + result.tiers.updated} tiers, ` +
      `${result.earnRules.created + result.earnRules.updated} earn rules, ` +
      `${result.redemptionOptions.created} redemption options created`,
    );

    return result;
  }
}
