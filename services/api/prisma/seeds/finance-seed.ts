/**
 * Run: cd services/api && pnpm exec ts-node prisma/seeds/finance-seed.ts
 * Seeds paid orders + Transaction records for finance dashboard validation.
 * Idempotent: skips if transactions already exist.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.transaction.count();
  if (existing > 0) {
    console.log(`Finance data already seeded (${existing} transactions exist). Skipping.`);
    return;
  }

  const sellers = await prisma.seller.findMany({ take: 5, select: { id: true } });
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, take: 5, select: { id: true } });

  if (sellers.length === 0 || customers.length === 0) {
    console.log('Need at least one seller and one customer. Run seed-all-roles first.');
    return;
  }

  const sellerId = sellers[0].id;
  const seller2Id = sellers[1]?.id || sellerId;
  const customerId = customers[0].id;

  let shippingAddr = await prisma.address.findFirst({ where: { userId: customerId } });
  if (!shippingAddr) {
    shippingAddr = await prisma.address.create({
      data: {
        userId: customerId,
        firstName: 'Test',
        lastName: 'Customer',
        street: '123 Magic Lane',
        city: 'London',
        state: 'England',
        postalCode: 'SW1A 1AA',
        country: 'GB',
      },
    });
  }

  let billingAddr = await prisma.address.findFirst({
    where: { userId: customerId, id: { not: shippingAddr.id } },
  });
  if (!billingAddr) {
    billingAddr = await prisma.address.create({
      data: {
        userId: customerId,
        firstName: 'Test',
        lastName: 'Customer',
        street: '123 Magic Lane',
        city: 'London',
        state: 'England',
        postalCode: 'SW1A 1AA',
        country: 'GB',
        label: 'Billing',
      },
    });
  }

  let products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, sellerId: true, price: true },
  });

  if (products.length === 0) {
    const productData = [
      { name: 'Elder Wand Replica', price: 49.99, sid: sellerId },
      { name: 'Invisibility Cloak', price: 129.99, sid: sellerId },
      { name: 'Time-Turner Necklace', price: 34.99, sid: sellerId },
      { name: 'Marauders Map Poster', price: 24.99, sid: seller2Id },
      { name: 'Sorting Hat Plush', price: 39.99, sid: seller2Id },
      { name: 'Phoenix Feather Quill', price: 19.99, sid: sellerId },
      { name: 'Broomstick Display Model', price: 89.99, sid: seller2Id },
      { name: 'Spell Book Journal', price: 14.99, sid: sellerId },
    ];
    for (const p of productData) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const product = await prisma.product.create({
        data: {
          name: p.name,
          slug,
          description: `Premium ${p.name} from House of Spells`,
          price: p.price,
          currency: 'USD',
          sellerId: p.sid,
          status: 'ACTIVE',
          stock: 100,
          sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
      });
      products.push({ id: product.id, sellerId: product.sellerId, price: product.price });
    }
  }

  const now = Date.now();
  let created = 0;

  for (let i = 0; i < 35; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const orderDate = new Date(now - daysAgo * 86400000);
    const product = products[i % products.length];
    const qty = 1 + (i % 3);
    const price = Number(product.price);
    const subtotal = Number((price * qty).toFixed(2));
    const tax = Number((subtotal * 0.05).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const order = await prisma.order.create({
      data: {
        userId: customerId,
        sellerId: product.sellerId,
        orderNumber: `HOS-${String(now).slice(-8)}-${String(i).padStart(3, '0')}`,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        subtotal,
        tax,
        total,
        currency: 'USD',
        shippingAddressId: shippingAddr.id,
        billingAddressId: billingAddr.id,
        createdAt: orderDate,
        items: { create: { productId: product.id, quantity: qty, price } },
        payments: {
          create: {
            stripePaymentId: `pi_seed_${now}_${i}`,
            amount: total,
            currency: 'USD',
            status: 'PAID',
            paymentMethod: 'card',
          },
        },
      },
    });

    await prisma.transaction.create({
      data: {
        type: 'PAYMENT',
        amount: total,
        currency: 'USD',
        status: 'COMPLETED',
        customerId,
        sellerId: product.sellerId,
        orderId: order.id,
        description: `Payment for order ${order.orderNumber}`,
        metadata: { seeded: true },
        createdAt: orderDate,
      },
    });
    created++;
  }

  // Sample refunds
  for (let i = 0; i < 3; i++) {
    await prisma.transaction.create({
      data: {
        type: 'REFUND',
        amount: 25 + i * 10,
        currency: 'USD',
        status: 'COMPLETED',
        customerId,
        sellerId,
        description: 'Refund for damaged item',
        metadata: { seeded: true },
        createdAt: new Date(now - (5 + i * 7) * 86400000),
      },
    });
  }

  // Platform fee
  await prisma.transaction.create({
    data: {
      type: 'FEE',
      amount: 150,
      currency: 'USD',
      status: 'COMPLETED',
      sellerId,
      description: 'Monthly platform fee',
      metadata: { seeded: true },
      createdAt: new Date(now - 15 * 86400000),
    },
  });

  console.log(`Seeded ${created} paid orders with Transaction records for finance dashboard.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
