import { PosSalesImportService } from './sales-import.service';

function makeMocks() {
  const prisma: any = {
    pOSSale: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'sale-new' }),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    loyaltyMembership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    externalEntityMapping: {
      findFirst: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
    identityMatchReview: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'review-1' }),
    },
    store: {
      findUnique: jest.fn().mockResolvedValue({ country: 'GB', defaultRegionCode: 'GB' }),
    },
    product: { findFirst: jest.fn() },
    pOSConnection: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const inventorySync: any = {
    applyPosSaleToInventory: jest.fn(),
  };
  const earnEngine: any = {
    processPosSale: jest.fn(),
  };
  const factory: any = {
    create: jest.fn().mockReturnValue({
      authenticate: jest.fn(),
      getSales: jest.fn().mockResolvedValue({ sales: [], maxVersion: null }),
    }),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({}),
    encryptJson: jest.fn().mockReturnValue('encrypted'),
  };

  const service = new PosSalesImportService(prisma, inventorySync, earnEngine, factory, encryption);
  return { service, prisma, inventorySync, earnEngine, factory };
}

const mockParsedSale = {
  externalId: 'ext-sale-1',
  invoiceNumber: 'INV-001',
  saleDate: new Date('2026-04-10'),
  outletId: 'out-1',
  totalAmount: 100,
  currency: 'USD',
  taxAmount: 10,
  discountAmount: 5,
  state: 'closed',
  version: 100,
  rawPayload: {},
  customer: { email: 'test@example.com', phone: null },
  items: [
    {
      externalProductId: 'ext-p1',
      sku: 'SKU-1',
      name: 'Item 1',
      quantity: 2,
      unitPrice: 25,
      totalPrice: 50,
      taxAmount: 5,
    },
    {
      externalProductId: null,
      sku: 'SKU-2',
      name: 'Item 2',
      quantity: 1,
      unitPrice: 50,
      totalPrice: 50,
      taxAmount: 5,
    },
  ],
};

describe('PosSalesImportService', () => {
  describe('importParsedSale', () => {
    it('deduplicates by provider + externalSaleId', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue({ id: 'existing-1' });

      const result = await service.importParsedSale('s1', 'lightspeed', mockParsedSale);

      expect(result).toEqual({ id: 'existing-1', duplicate: true });
      expect(prisma.pOSSale.create).not.toHaveBeenCalled();
    });

    it('skips non-closed sales', async () => {
      const { service, prisma } = makeMocks();
      const parked = { ...mockParsedSale, state: 'pending' };
      const result = await service.importParsedSale('s1', 'lightspeed', parked);
      expect(result.skipped).toBe(true);
      expect(prisma.pOSSale.create).not.toHaveBeenCalled();
    });

    it('marks existing sale VOIDED when void webhook arrives', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue({ id: 'existing-1' });
      const voided = { ...mockParsedSale, state: 'voided' };
      const result = await service.importParsedSale('s1', 'lightspeed', voided);
      expect(result.duplicate).toBe(true);
      expect(prisma.pOSSale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-1' },
          data: expect.objectContaining({ status: 'VOIDED' }),
        }),
      );
    });

    it('creates sale with resolved customer and products', async () => {
      const { service, prisma, inventorySync, earnEngine } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.externalEntityMapping.findFirst.mockResolvedValue({
        internalId: 'prod-1',
      });
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-2' });

      const result = await service.importParsedSale('s1', 'lightspeed', mockParsedSale);

      expect(result.duplicate).toBe(false);
      expect(result.id).toBe('sale-new');

      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 's1',
            externalSaleId: 'ext-sale-1',
            provider: 'lightspeed',
            customerId: 'user-1',
            status: 'IMPORTED',
          }),
        }),
      );

      expect(inventorySync.applyPosSaleToInventory).toHaveBeenCalledWith('s1', 'sale-new');
      expect(earnEngine.processPosSale).toHaveBeenCalledWith('sale-new');

      expect(prisma.pOSSale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-new' },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('leaves sale IMPORTED when loyalty earn fails so retries can re-earn', async () => {
      const { service, prisma, earnEngine } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);
      earnEngine.processPosSale.mockRejectedValue(new Error('earn fail'));

      const result = await service.importParsedSale('s1', 'lightspeed', mockParsedSale);

      expect(result.duplicate).toBe(false);
      expect(prisma.pOSSale.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('matches via ExternalEntityMapping before email', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst
        .mockResolvedValueOnce({ internalId: 'mem-ext' }) // CUSTOMER
        .mockResolvedValue(null); // PRODUCT
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ userId: 'user-mapped' });
      prisma.product.findFirst.mockResolvedValue(null);

      const sale = {
        ...mockParsedSale,
        customer: {
          email: 'other@example.com',
          phone: null,
          externalId: 'ls-cust-1',
        },
      };
      await service.importParsedSale('s1', 'lightspeed', sale);

      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'user-mapped' }),
        }),
      );
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('matches via customer_code → LoyaltyMembership.id', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ userId: 'user-code' });
      prisma.product.findFirst.mockResolvedValue(null);

      const sale = {
        ...mockParsedSale,
        customer: { email: null, phone: null },
        rawPayload: { customer_code: 'mem-abc' },
      };
      await service.importParsedSale('s1', 'lightspeed', sale);

      expect(prisma.loyaltyMembership.findUnique).toHaveBeenCalledWith({
        where: { id: 'mem-abc' },
        select: { userId: true },
      });
      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'user-code' }),
        }),
      );
    });

    it('resolves customer by unambiguous phoneNormalized when email not found', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null); // email miss
      prisma.user.findMany.mockResolvedValue([{ id: 'user-phone' }]);
      prisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-phone' });
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);

      const saleWithPhone = {
        ...mockParsedSale,
        customer: {
          email: 'nobody@test.com',
          phone: '+447700900123',
          externalId: 'ls-99',
        },
      };
      await service.importParsedSale('s1', 'ls', saleWithPhone);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phoneNormalized: '+447700900123' },
        }),
      );
      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'user-phone' }),
        }),
      );
      expect(prisma.externalEntityMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            entityType: 'CUSTOMER',
            internalId: 'mem-phone',
            externalId: 'ls-99',
            storeId: '',
          }),
        }),
      );
    });

    it('creates IdentityMatchReview and leaves customerId null on ambiguous phone', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);

      const saleWithPhone = {
        ...mockParsedSale,
        customer: { email: null, phone: '07700900123', externalId: 'ls-amb' },
      };
      await service.importParsedSale('s1', 'lightspeed', saleWithPhone);

      expect(prisma.identityMatchReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'AMBIGUOUS_PHONE',
            phoneNormalized: '+447700900123',
            candidateInternalIds: ['u1', 'u2'],
            lightspeedCustomerId: 'ls-amb',
          }),
        }),
      );
      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: null }),
        }),
      );
    });

    it('never matches on customer name alone', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);

      const sale = {
        ...mockParsedSale,
        customer: { email: null, phone: null },
        rawPayload: { customer: { name: 'Hermione Granger' } },
      };
      await service.importParsedSale('s1', 'lightspeed', sale);

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: null }),
        }),
      );
    });
  });

  describe('pollStoreSales', () => {
    it('returns 0 when no active connection', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue(null);
      const result = await service.pollStoreSales('s1');
      expect(result).toBe(0);
      expect(prisma.pOSConnection.update).not.toHaveBeenCalled();
    });

    it('imports fetched sales and persists version cursor', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        provider: 'lightspeed',
        credentials: '{}',
        externalOutletId: 'out-1',
        lastSaleImportedAt: null,
        settings: {},
        store: { externalStoreId: null },
      });
      const adapter = {
        authenticate: jest.fn(),
        getSales: jest.fn().mockResolvedValue({
          sales: [mockParsedSale],
          maxVersion: 100,
        }),
      };
      factory.create.mockReturnValue(adapter);

      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);

      const count = await service.pollStoreSales('s1');
      expect(count).toBe(1);
      expect(adapter.getSales).toHaveBeenCalledWith({
        afterVersion: undefined,
        outletId: 'out-1',
      });
      expect(prisma.pOSConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({
          lastSaleImportedAt: mockParsedSale.saleDate,
          settings: { lastSaleVersion: 100 },
        }),
      });
    });

    it('passes lastSaleVersion from settings as afterVersion', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        provider: 'lightspeed',
        credentials: '{}',
        externalOutletId: 'out-1',
        lastSaleImportedAt: new Date('2026-04-10T12:00:00.000Z'),
        settings: { lastSaleVersion: 42 },
        store: { externalStoreId: null },
      });
      const adapter = {
        authenticate: jest.fn(),
        getSales: jest.fn().mockResolvedValue({ sales: [], maxVersion: null }),
      };
      factory.create.mockReturnValue(adapter);

      await service.pollStoreSales('s1');

      expect(adapter.getSales).toHaveBeenCalledWith({
        afterVersion: 42,
        outletId: 'out-1',
      });
    });

    it('does not advance cursor when getSales throws', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        provider: 'lightspeed',
        credentials: '{}',
        externalOutletId: 'out-1',
        lastSaleImportedAt: new Date('2026-04-01T00:00:00.000Z'),
        settings: { lastSaleVersion: 10 },
        store: { externalStoreId: null },
      });
      const adapter = {
        authenticate: jest.fn(),
        getSales: jest.fn().mockRejectedValue(new Error('api down')),
      };
      factory.create.mockReturnValue(adapter);

      await expect(service.pollStoreSales('s1')).rejects.toThrow('api down');
      expect(prisma.pOSConnection.update).not.toHaveBeenCalled();
    });
  });
});
