/**
 * Run from repo root:
 *   cd services/api && pnpm exec ts-node prisma/seeds/shipping-seed.ts
 */
import { PrismaClient, ShippingMethodType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding shipping methods...');

  // Create Standard Shipping method
  const standardMethod = await prisma.shippingMethod.upsert({
    where: { id: 'standard-shipping' },
    create: {
      id: 'standard-shipping',
      name: 'Standard Shipping',
      description: 'Delivery within 5-7 business days',
      type: ShippingMethodType.FLAT_RATE,
      isActive: true,
    },
    update: {
      name: 'Standard Shipping',
      description: 'Delivery within 5-7 business days',
      isActive: true,
    },
  });

  // Create Express Shipping method
  const expressMethod = await prisma.shippingMethod.upsert({
    where: { id: 'express-shipping' },
    create: {
      id: 'express-shipping',
      name: 'Express Shipping',
      description: 'Delivery within 2-3 business days',
      type: ShippingMethodType.FLAT_RATE,
      isActive: true,
    },
    update: {
      name: 'Express Shipping',
      description: 'Delivery within 2-3 business days',
      isActive: true,
    },
  });

  // Create Free Shipping method (for orders over threshold)
  const freeShippingMethod = await prisma.shippingMethod.upsert({
    where: { id: 'free-shipping' },
    create: {
      id: 'free-shipping',
      name: 'Free Shipping',
      description: 'Free shipping on orders over $100',
      type: ShippingMethodType.FREE_SHIPPING,
      isActive: true,
    },
    update: {
      name: 'Free Shipping',
      description: 'Free shipping on orders over $100',
      isActive: true,
    },
  });

  // Create shipping rules for Standard Shipping
  await prisma.shippingRule.upsert({
    where: { id: 'standard-domestic' },
    create: {
      id: 'standard-domestic',
      shippingMethodId: standardMethod.id,
      name: 'Domestic Standard',
      priority: 10,
      conditions: {
        countries: ['US', 'USA', 'GB', 'GBR', 'UK'],
      },
      rate: new Decimal(5.99),
      freeShippingThreshold: new Decimal(100),
      estimatedDays: 7,
      isActive: true,
    },
    update: {
      priority: 10,
      conditions: {
        countries: ['US', 'USA', 'GB', 'GBR', 'UK'],
      },
      rate: new Decimal(5.99),
      freeShippingThreshold: new Decimal(100),
      estimatedDays: 7,
      isActive: true,
    },
  });

  await prisma.shippingRule.upsert({
    where: { id: 'standard-international' },
    create: {
      id: 'standard-international',
      shippingMethodId: standardMethod.id,
      name: 'International Standard',
      priority: 5,
      conditions: {},
      rate: new Decimal(12.99),
      freeShippingThreshold: new Decimal(150),
      estimatedDays: 14,
      isActive: true,
    },
    update: {
      priority: 5,
      conditions: {},
      rate: new Decimal(12.99),
      freeShippingThreshold: new Decimal(150),
      estimatedDays: 14,
      isActive: true,
    },
  });

  // Create shipping rules for Express Shipping
  await prisma.shippingRule.upsert({
    where: { id: 'express-domestic' },
    create: {
      id: 'express-domestic',
      shippingMethodId: expressMethod.id,
      name: 'Domestic Express',
      priority: 10,
      conditions: {
        countries: ['US', 'USA', 'GB', 'GBR', 'UK'],
      },
      rate: new Decimal(14.99),
      estimatedDays: 3,
      isActive: true,
    },
    update: {
      priority: 10,
      conditions: {
        countries: ['US', 'USA', 'GB', 'GBR', 'UK'],
      },
      rate: new Decimal(14.99),
      estimatedDays: 3,
      isActive: true,
    },
  });

  await prisma.shippingRule.upsert({
    where: { id: 'express-international' },
    create: {
      id: 'express-international',
      shippingMethodId: expressMethod.id,
      name: 'International Express',
      priority: 5,
      conditions: {},
      rate: new Decimal(29.99),
      estimatedDays: 5,
      isActive: true,
    },
    update: {
      priority: 5,
      conditions: {},
      rate: new Decimal(29.99),
      estimatedDays: 5,
      isActive: true,
    },
  });

  // Create shipping rule for Free Shipping
  await prisma.shippingRule.upsert({
    where: { id: 'free-over-threshold' },
    create: {
      id: 'free-over-threshold',
      shippingMethodId: freeShippingMethod.id,
      name: 'Free Over $100',
      priority: 100,
      conditions: {
        minCartValue: 100,
      },
      rate: new Decimal(0),
      estimatedDays: 7,
      isActive: true,
    },
    update: {
      priority: 100,
      conditions: {
        minCartValue: 100,
      },
      rate: new Decimal(0),
      estimatedDays: 7,
      isActive: true,
    },
  });

  console.log('Shipping methods and rules seeded successfully!');
  console.log('Created methods:', [standardMethod.name, expressMethod.name, freeShippingMethod.name]);
}

main()
  .catch((e) => {
    console.error('Error seeding shipping data:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
