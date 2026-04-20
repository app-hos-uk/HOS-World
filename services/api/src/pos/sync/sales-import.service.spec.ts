import { PosSalesImportService } from './sales-import.service';
import { Decimal } from '@prisma/client/runtime/library';

function makeMocks() {
  const prisma: any = {
    pOSSale: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'sale-new' }),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    externalEntityMapping: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    pOSConnection: {
      findFirst: jest.fn(),
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
      getSales: jest.fn().mockResolvedValue([]),
    }),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({}),
  };

  const service = new PosSalesImportService(
    prisma,
    inventorySync,
    earnEngine,
    factory,
    encryption,
  );
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

    it('handles loyalty earn failure gracefully', async () => {
      const { service, prisma, earnEngine } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);
      earnEngine.processPosSale.mockRejectedValue(new Error('earn fail'));

      const result = await service.importParsedSale('s1', 'lightspeed', mockParsedSale);

      expect(result.duplicate).toBe(false);
      expect(prisma.pOSSale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('resolves customer by phone when email not found', async () => {
      const { service, prisma } = makeMocks();
      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-phone' });
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);

      const saleWithPhone = {
        ...mockParsedSale,
        customer: { email: 'nobody@test.com', phone: '+1234567890' },
      };
      await service.importParsedSale('s1', 'ls', saleWithPhone);

      expect(prisma.pOSSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'user-phone' }),
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
    });

    it('imports fetched sales and counts non-duplicates', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: '{}',
        externalOutletId: 'out-1',
        store: { externalStoreId: null },
      });
      const adapter = {
        authenticate: jest.fn(),
        getSales: jest.fn().mockResolvedValue([mockParsedSale]),
      };
      factory.create.mockReturnValue(adapter);

      prisma.pOSSale.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      prisma.product.findFirst.mockResolvedValue(null);

      const count = await service.pollStoreSales('s1', 12);
      expect(count).toBe(1);
    });
  });
});
