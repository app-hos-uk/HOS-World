/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/ambassador-seed.ts
 * Seeds welcome-ambassador journey (Phase 7).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.marketingJourney.upsert({
    where: { slug: 'welcome-ambassador' },
    create: {
      slug: 'welcome-ambassador',
      name: 'Welcome ambassador',
      description: 'Onboarding after AMBASSADOR_ENROLLED — welcome, UGC nudge, follow-up',
      triggerEvent: 'AMBASSADOR_ENROLLED',
      steps: [
        { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'ambassador_welcome' },
        { stepIndex: 1, type: 'WAIT', delayMinutes: 4320 },
        {
          stepIndex: 2,
          type: 'SEND',
          channel: 'EMAIL',
          templateSlug: 'ambassador_submit_ugc',
        },
        { stepIndex: 3, type: 'WAIT', delayMinutes: 10080 },
        {
          stepIndex: 4,
          type: 'CONDITION',
          condition: { field: 'metadata.hasUgc', operator: 'eq', value: true },
          skipToStep: 6,
        },
        {
          stepIndex: 5,
          type: 'SEND',
          channel: 'USER_PREFERRED',
          templateSlug: 'ambassador_ugc_reminder',
        },
        {
          stepIndex: 6,
          type: 'SEND',
          channel: 'EMAIL',
          templateSlug: 'ambassador_great_job',
        },
      ] as object,
      isActive: true,
      regionCodes: [],
      channelCodes: [],
    },
    update: {
      name: 'Welcome ambassador',
      description: 'Onboarding after AMBASSADOR_ENROLLED — welcome, UGC nudge, follow-up',
      triggerEvent: 'AMBASSADOR_ENROLLED',
      steps: [
        { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'ambassador_welcome' },
        { stepIndex: 1, type: 'WAIT', delayMinutes: 4320 },
        {
          stepIndex: 2,
          type: 'SEND',
          channel: 'EMAIL',
          templateSlug: 'ambassador_submit_ugc',
        },
        { stepIndex: 3, type: 'WAIT', delayMinutes: 10080 },
        {
          stepIndex: 4,
          type: 'CONDITION',
          condition: { field: 'metadata.hasUgc', operator: 'eq', value: true },
          skipToStep: 6,
        },
        {
          stepIndex: 5,
          type: 'SEND',
          channel: 'USER_PREFERRED',
          templateSlug: 'ambassador_ugc_reminder',
        },
        {
          stepIndex: 6,
          type: 'SEND',
          channel: 'EMAIL',
          templateSlug: 'ambassador_great_job',
        },
      ] as object,
      isActive: true,
    },
  });
  console.log('Ambassador journey upserted: welcome-ambassador');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
