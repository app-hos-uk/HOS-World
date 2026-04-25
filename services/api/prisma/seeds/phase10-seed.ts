/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/phase10-seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_STEPS = [
  { key: 'store_created', label: 'Store record created with address, timezone, currency' },
  { key: 'pos_connected', label: 'POS connection established and tested' },
  { key: 'products_assigned', label: 'Products assigned to store channel with local pricing' },
  { key: 'product_sync', label: 'Initial product sync to POS completed' },
  { key: 'inventory_loaded', label: 'Opening inventory loaded and synced' },
  { key: 'staff_trained', label: 'Staff trained on loyalty QR scan and point redemption' },
  { key: 'test_transaction', label: 'Test loyalty transaction processed end-to-end' },
  { key: 'signage_installed', label: 'Loyalty QR code signage installed in-store' },
  { key: 'marketing_configured', label: 'Tourist welcome journey configured for store region' },
  { key: 'go_live', label: 'Store marked active and visible to customers' },
].map((s) => ({ ...s, completedAt: null, completedBy: null }));

async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, name: true } });
  let checklists = 0;
  for (const s of stores) {
    const existing = await prisma.storeOnboardingChecklist.findUnique({ where: { storeId: s.id } });
    if (existing) continue;
    await prisma.storeOnboardingChecklist.create({
      data: {
        storeId: s.id,
        steps: DEFAULT_STEPS as unknown as object,
        status: 'IN_PROGRESS',
      },
    });
    checklists++;
  }
  console.log(`Created ${checklists} onboarding checklist(s) for existing stores.`);

  const startsAt = new Date();
  const endsAt = new Date(Date.now() + 90 * 86400000);
  await prisma.productCampaign.upsert({
    where: { slug: 'double-points-hp-wands-draft' },
    create: {
      name: 'Double Points on Harry Potter Wands',
      slug: 'double-points-hp-wands-draft',
      description: 'Sample loyalty product campaign (draft)',
      type: 'BONUS_POINTS',
      status: 'DRAFT',
      startsAt,
      endsAt,
      fandomFilter: ['Harry Potter'],
      bonusPoints: 50,
      minTierLevel: 0,
    },
    update: {},
  });
  console.log('Upserted sample product campaign (draft).');

  await prisma.marketingJourney.upsert({
    where: { slug: 'click-collect-ready' },
    create: {
      slug: 'click-collect-ready',
      name: 'Click & collect — ready for pickup',
      description: 'Notify customer when BOPIS order is ready',
      triggerEvent: 'CLICK_COLLECT_READY',
      steps: [
        {
          stepIndex: 0,
          type: 'SEND',
          channel: 'USER_PREFERRED',
          templateSlug: 'click_collect_ready',
        },
      ] as unknown as object,
      isActive: true,
    },
    update: {
      triggerEvent: 'CLICK_COLLECT_READY',
    },
  });

  await prisma.marketingJourney.upsert({
    where: { slug: 'click-collect-reminder' },
    create: {
      slug: 'click-collect-reminder',
      name: 'Click & collect — pickup reminder',
      description: 'Reminder before BOPIS order expires',
      triggerEvent: 'CLICK_COLLECT_REMINDER',
      steps: [
        {
          stepIndex: 0,
          type: 'SEND',
          channel: 'PUSH',
          templateSlug: 'click_collect_reminder',
        },
      ] as unknown as object,
      isActive: true,
    },
    update: {
      triggerEvent: 'CLICK_COLLECT_REMINDER',
    },
  });
  console.log('Upserted click-collect marketing journeys.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
