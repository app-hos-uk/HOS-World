/**
 * cd services/api && pnpm exec ts-node prisma/seeds/segment-seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    slug: 'vip-at-risk',
    name: 'VIP at risk',
    description: 'High-tier members inactive for 30+ days',
    templateSlug: 'vip-at-risk',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'gte', value: 4 },
        { dimension: 'activity.lastAt', operator: 'days_ago_gt', value: 30 },
      ],
    },
  },
  {
    slug: 'rising-stars',
    name: 'Rising stars',
    description: 'New members with strong early engagement',
    templateSlug: 'rising-stars',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'lte', value: 2 },
        { dimension: 'purchase.count', operator: 'gte', value: 3 },
        { dimension: 'activity.enrolledAt', operator: 'days_ago_lt', value: 90 },
      ],
    },
  },
  {
    slug: 'fandom-enthusiasts-hp',
    name: 'Harry Potter enthusiasts',
    description: 'Engaged Harry Potter fans',
    templateSlug: 'fandom-enthusiasts-hp',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'fandom.favorites', operator: 'contains', value: 'harry-potter' },
        { dimension: 'engagement.count', operator: 'gte', value: 5 },
      ],
    },
  },
  {
    slug: 'high-spenders',
    name: 'High spenders',
    description: 'Members with significant spend history',
    templateSlug: 'high-spenders',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'spend.total', operator: 'gte', value: 200 },
        { dimension: 'purchase.count', operator: 'gte', value: 5 },
      ],
    },
  },
  {
    slug: 'inactive-members',
    name: 'Inactive members',
    description: 'Dormant members with unspent points',
    templateSlug: 'inactive-members',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'activity.lastAt', operator: 'days_ago_gt', value: 60 },
        { dimension: 'points.balance', operator: 'gt', value: 0 },
      ],
    },
  },
  {
    slug: 'event-regulars',
    name: 'Event regulars',
    description: 'Members who attend events frequently',
    templateSlug: 'event-regulars',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [{ dimension: 'events.attendanceCount', operator: 'gte', value: 3 }],
    },
  },
  {
    slug: 'in-store-signups',
    name: 'In-store signups',
    description: 'Members who enrolled at a physical store',
    templateSlug: 'in-store-signups',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [{ dimension: 'enrollment.channel', operator: 'eq', value: 'POS' }],
    },
  },
  {
    slug: 'tourists',
    name: 'Tourist visitors',
    description: 'International customers who signed up in-store',
    templateSlug: 'tourists',
    isTemplate: true,
    type: 'DYNAMIC',
    rules: {
      operator: 'AND',
      rules: [
        { dimension: 'geo.country', operator: 'not_in', value: ['GB'] },
        { dimension: 'enrollment.channel', operator: 'eq', value: 'POS' },
        { dimension: 'purchase.count', operator: 'lte', value: 2 },
      ],
    },
  },
];

async function main() {
  for (const t of templates) {
    await prisma.audienceSegment.upsert({
      where: { templateSlug: t.templateSlug },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        templateSlug: t.templateSlug,
        isTemplate: t.isTemplate,
        type: t.type,
        status: 'ACTIVE',
        rules: t.rules as object,
      },
      update: {
        name: t.name,
        description: t.description,
        rules: t.rules as object,
        isTemplate: true,
        type: t.type,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`Upserted ${templates.length} template segments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
