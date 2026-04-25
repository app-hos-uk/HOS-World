/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/brand-partnership-seed.ts
 * Phase 8 sample partnerships, draft campaigns, and brand-campaign-notify journey.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  const start = new Date();
  const end = new Date(start.getTime() + 365 * 86400000);

  const wb = await prisma.brandPartnership.upsert({
    where: { slug: 'warner-bros-sample' },
    create: {
      name: 'Warner Bros. (sample)',
      slug: 'warner-bros-sample',
      description: 'Sample partnership for Harry Potter promotions',
      status: 'ACTIVE',
      contractStart: start,
      contractEnd: end,
      totalBudget: new Decimal(50000),
      spentBudget: new Decimal(0),
      currency: 'GBP',
    },
    update: {
      status: 'ACTIVE',
      contractEnd: end,
    },
  });

  await prisma.brandCampaign.upsert({
    where: { slug: 'wb-hp-2x-sample' },
    create: {
      partnershipId: wb.id,
      name: '2× Harry Potter (sample)',
      slug: 'wb-hp-2x-sample',
      type: 'MULTIPLIER',
      status: 'DRAFT',
      startsAt: start,
      endsAt: end,
      multiplier: new Decimal(2),
      targetFandoms: ['Harry Potter'],
      regionCodes: [],
    },
    update: {
      name: '2× Harry Potter (sample)',
      type: 'MULTIPLIER',
      multiplier: new Decimal(2),
      targetFandoms: ['Harry Potter'],
    },
  });

  const nc = await prisma.brandPartnership.upsert({
    where: { slug: 'noble-collection-sample' },
    create: {
      name: 'Noble Collection (sample)',
      slug: 'noble-collection-sample',
      status: 'ACTIVE',
      contractStart: start,
      contractEnd: end,
      totalBudget: new Decimal(10000),
      spentBudget: new Decimal(0),
      currency: 'GBP',
    },
    update: { contractEnd: end },
  });

  await prisma.brandCampaign.upsert({
    where: { slug: 'noble-bonus-50-sample' },
    create: {
      partnershipId: nc.id,
      name: '+50 pts Noble Collection (sample)',
      slug: 'noble-bonus-50-sample',
      type: 'BONUS_POINTS',
      status: 'DRAFT',
      startsAt: start,
      endsAt: end,
      bonusPoints: 50,
      targetBrands: ['Noble Collection'],
      regionCodes: [],
    },
    update: {
      bonusPoints: 50,
      targetBrands: ['Noble Collection'],
    },
  });

  await prisma.marketingJourney.upsert({
    where: { slug: 'brand-campaign-notify' },
    create: {
      slug: 'brand-campaign-notify',
      name: 'Brand campaign notify',
      description: 'Email on BRAND_CAMPAIGN_STARTED → wait → push reminder',
      triggerEvent: 'BRAND_CAMPAIGN_STARTED',
      steps: [
        { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'brand_campaign_started' },
        { stepIndex: 1, type: 'WAIT', delayMinutes: 1440 },
        { stepIndex: 2, type: 'SEND', channel: 'PUSH', templateSlug: 'brand_campaign_reminder' },
      ] as object,
      isActive: false,
      regionCodes: [],
      channelCodes: [],
    },
    update: {
      triggerEvent: 'BRAND_CAMPAIGN_STARTED',
      steps: [
        { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'brand_campaign_started' },
        { stepIndex: 1, type: 'WAIT', delayMinutes: 1440 },
        { stepIndex: 2, type: 'SEND', channel: 'PUSH', templateSlug: 'brand_campaign_reminder' },
      ] as object,
    },
  });

  console.log('Brand partnership seed done (partnerships + draft campaigns + journey template).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
