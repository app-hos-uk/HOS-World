import { BoxSizeService } from './box-size.service';

function makeService() {
  const prisma: any = {
    boxSize: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
    },
    shippingRateTier: {
      count: jest.fn().mockResolvedValue(4),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    boxSizeRate: {
      findMany: jest.fn().mockResolvedValue([{ boxSizeId: 'small', tierId: 't1' }]),
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { service: new BoxSizeService(prisma), prisma };
}

const tiers = [
  {
    id: 't1',
    code: 'TIER_1',
    name: 'Domestic (US)',
    description: '',
    countryCodes: ['US', 'PR'],
    isCatchAll: false,
    currency: 'USD',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 't2',
    code: 'TIER_2',
    name: 'Near-International',
    description: '',
    countryCodes: ['CA', 'MX'],
    isCatchAll: false,
    currency: 'USD',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 't3',
    code: 'TIER_3',
    name: 'Western Europe & UK',
    description: '',
    countryCodes: ['GB', 'DE', 'FR', 'IE', 'IT'],
    isCatchAll: false,
    currency: 'USD',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 't4',
    code: 'TIER_4',
    name: 'Rest of World',
    description: '',
    countryCodes: [],
    isCatchAll: true,
    currency: 'USD',
    isActive: true,
    sortOrder: 4,
  },
];

const boxes = [
  {
    id: 'small',
    name: 'SMALL',
    label: 'Small',
    customerPrice: 9.99,
    packagingCost: 1,
    currency: 'USD',
    rates: [
      { tierId: 't1', customerPrice: 10 },
      { tierId: 't2', customerPrice: 15 },
      { tierId: 't3', customerPrice: 20 },
      { tierId: 't4', customerPrice: 25 },
    ],
  },
];

describe('BoxSizeService geographic rates', () => {
  it('prices a US or Puerto Rico destination at tier 1', async () => {
    const { service, prisma } = makeService();
    prisma.boxSize.findMany.mockResolvedValue(boxes);
    prisma.shippingRateTier.findMany.mockResolvedValue(tiers);

    const us = await service.pricesForCountry('United States');
    expect(us.tier?.code).toBe('TIER_1');
    expect(us.prices.small).toBe(10);

    const pr = await service.pricesForCountry('PR');
    expect(pr.tier?.code).toBe('TIER_1');
  });

  it('prices Canada/Mexico at tier 2 and UK/Germany at tier 3', async () => {
    const { service, prisma } = makeService();
    prisma.boxSize.findMany.mockResolvedValue(boxes);
    prisma.shippingRateTier.findMany.mockResolvedValue(tiers);

    expect((await service.pricesForCountry('CA')).tier?.code).toBe('TIER_2');
    expect((await service.pricesForCountry('Mexico')).tier?.code).toBe('TIER_2');
    expect((await service.pricesForCountry('UK')).tier?.code).toBe('TIER_3');
    expect((await service.pricesForCountry('DE')).tier?.code).toBe('TIER_3');
  });

  it('falls back to rest-of-world for Asia and unknown names', async () => {
    const { service, prisma } = makeService();
    prisma.boxSize.findMany.mockResolvedValue(boxes);
    prisma.shippingRateTier.findMany.mockResolvedValue(tiers);

    const jp = await service.pricesForCountry('Japan');
    expect(jp.tier?.code).toBe('TIER_4');
    expect(jp.prices.small).toBe(25);

    const unknown = await service.pricesForCountry('Freedonia');
    expect(unknown.tier?.code).toBe('TIER_4');
  });

  it('resolveRate uses the destination tier price for the selected box', async () => {
    const { service, prisma } = makeService();
    prisma.boxSize.findMany.mockResolvedValue(boxes);
    prisma.boxSize.findUnique.mockResolvedValue(boxes[0]);
    prisma.shippingRateTier.findMany.mockResolvedValue(tiers);

    const quoted = await service.resolveRate('small', 'GB');
    expect(quoted.price).toBe(20);
    expect(quoted.tier?.code).toBe('TIER_3');
  });
});
