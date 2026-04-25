/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/analytics-seed.ts
 * Backfills firstPurchaseAt/lastPurchaseAt and triggers initial CLV for all members.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  const members = await prisma.loyaltyMembership.findMany({
    select: { id: true, userId: true },
  });

  let backfilled = 0;
  for (const m of members) {
    const orders = await prisma.order.findMany({
      where: { userId: m.userId, parentOrderId: null, status: { not: 'CANCELLED' } },
      select: { createdAt: true, subtotal: true },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) continue;

    const first = orders[0].createdAt;
    const last = orders[orders.length - 1].createdAt;
    const totalSpend = orders.reduce(
      (s, o) => s + new Decimal(o.subtotal).toNumber(),
      0,
    );
    const avgOv = totalSpend / orders.length;

    await prisma.loyaltyMembership.update({
      where: { id: m.id },
      data: {
        firstPurchaseAt: first,
        lastPurchaseAt: last,
        avgOrderValue: new Decimal(avgOv),
      },
    });
    backfilled++;
  }

  console.log(`Backfilled ${backfilled} memberships with purchase dates.`);
  console.log('Run CLV recompute via POST /admin/loyalty-analytics/clv/recompute or the weekly cron.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
