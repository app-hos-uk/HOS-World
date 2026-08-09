import { TaxService } from './tax.service';

describe('TaxService calculateTax origin propagation', () => {
  const configuredOrigin = {
    street: '1564 Broadway',
    city: 'New York',
    state: 'NY',
    postalCode: '10036',
    country: 'US',
  };

  function createService(opts: {
    taxOrigin: typeof configuredOrigin | null;
    currency?: string;
    country?: string;
    hasActiveProvider?: boolean;
    calculateTax?: jest.Mock;
  }) {
    const prisma = {
      taxZone: { findMany: jest.fn().mockResolvedValue([]) },
      taxRate: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const platformRegion = {
      getCurrency: jest.fn().mockResolvedValue(opts.currency ?? 'USD'),
      getTaxOrigin: jest.fn().mockResolvedValue(opts.taxOrigin),
      getCountry: jest.fn().mockResolvedValue(opts.country ?? 'US'),
    };
    const calculateTax =
      opts.calculateTax ??
      jest.fn().mockResolvedValue({
        totalTaxAmount: 8.25,
        totalAmount: 108.25,
      });
    const taxFactory = {
      hasActiveProvider: jest.fn().mockReturnValue(opts.hasActiveProvider ?? true),
      calculateTax,
    };

    const service = new TaxService(
      prisma as any,
      cache as any,
      platformRegion as any,
      taxFactory as any,
    );
    return { service, platformRegion, taxFactory, calculateTax, cache, prisma };
  }

  it('sends the region-configured tax origin to the active provider (not a hardcoded London address)', async () => {
    const { service, calculateTax, platformRegion } = createService({
      taxOrigin: configuredOrigin,
    });

    const result = await service.calculateTax(100, 'tax-class-1', {
      country: 'US',
      state: 'CA',
      city: 'Los Angeles',
      postalCode: '90001',
    });

    expect(platformRegion.getTaxOrigin).toHaveBeenCalled();
    expect(calculateTax).toHaveBeenCalledTimes(1);
    const request = calculateTax.mock.calls[0][0];
    expect(request.fromAddress).toEqual({
      street1: '1564 Broadway',
      city: 'New York',
      state: 'NY',
      postalCode: '10036',
      country: 'US',
    });
    expect(request.fromAddress.city).not.toBe('London');
    expect(request.currencyCode).toBe('USD');
    expect(request.toAddress.country).toBe('US');
    expect(result.tax).toBe(8.25);
  });

  it('falls back to DB tax zones in non-prod when tax origin is incomplete (does not invent an origin)', async () => {
    const calculateTax = jest.fn();
    const { service, prisma } = createService({
      taxOrigin: null,
      calculateTax,
    });

    const result = await service.calculateTax(50, 'tax-class-1', {
      country: 'US',
      state: 'NY',
      postalCode: '10001',
    });

    expect(calculateTax).not.toHaveBeenCalled();
    expect(prisma.taxZone.findMany).toHaveBeenCalled();
    expect(result).toEqual({
      amount: 50,
      tax: 0,
      total: 50,
      rate: 0,
      isInclusive: false,
    });
  });
});
