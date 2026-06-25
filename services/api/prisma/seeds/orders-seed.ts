/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/orders-seed.ts
 * Seeds paid sample orders across sellers for analytics/dashboard validation.
 */
import { PrismaClient, OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  const sellers = await prisma.seller.findMany({ take: 5, select: { id: true, userId: true } });
  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    take: 10,
    select: { id: true },
  });

  if (sellers.length === 0 || customers.length === 0) {
    console.log('Need at least one seller and customer. Run seed-all-roles first.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', sellerId: { in: sellers.map((s) => s.id) } },
    take: 30,
    select: { id: true, sellerId: true, price: true, currency: true, name: true },
  });

  if (products.length === 0) {
    console.log('No active products found for seeded sellers.');
    return;
  }

  let created = 0;
  for (let i = 0; i < 50; i++) {
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    const seller = sellers.find((s) => s.id === product.sellerId) || sellers[0];
    const qty = 1 + (i % 3);
    const subtotal = new Decimal(product.price).mul(qty);
    const total = subtotal;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        sellerId: seller.id,
        orderNumber: `SEED-${Date.now()}-${i}`,
        status: OrderStatus.DELIVERED,
        paymentStatus: 'PAID',
        subtotal,
        total,
        currency: product.currency || 'USD',
        items: {
          create: {
            productId: product.id,
            quantity: qty,
            price: product.price,
            subtotal,
          },
        },
      },
    });
    created++;
    if (i % 10 === 0) console.log(`Created order ${order.orderNumber}`);
  }

  console.log(`Seeded ${created} paid orders for analytics validation.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
