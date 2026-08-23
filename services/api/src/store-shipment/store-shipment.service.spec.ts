import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StoreShipmentService } from './store-shipment.service';

function makeService() {
  const prisma: any = {
    storeShipmentRequest: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'ship-1' }),
      create: jest.fn().mockResolvedValue({ id: 'ship-new' }),
    },
    pOSSale: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    gDPRConsentLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const adapter = {
    providerName: 'lightspeed',
    authenticate: jest.fn(),
    setRequestDeadline: jest.fn(),
    getSaleByInvoice: jest.fn(),
    getSaleById: jest.fn(),
  };
  const factory = { create: jest.fn().mockReturnValue(adapter) };
  const encryption = { decryptJson: jest.fn().mockReturnValue({}) };
  const skuCustoms = {
    enrichSaleItems: jest.fn(),
  };
  const salesImport = { importParsedSale: jest.fn() };
  const notifications = {
    sendStoreShipmentClaimEmail: jest.fn().mockResolvedValue(undefined),
  };
  const service = new StoreShipmentService(
    prisma,
    factory as any,
    encryption as any,
    skuCustoms as any,
    {} as any,
    { get: jest.fn().mockReturnValue('https://hos.example') } as any,
    notifications as any,
    {} as any,
    salesImport as any,
  );
  return { service, prisma, factory, adapter, skuCustoms, salesImport, notifications };
}

const shipmentBase = {
  id: 'ship-1',
  userId: 'user-1',
  storeId: 'store-1',
  invoiceNumber: 'HOS-22',
  posSaleId: null,
  posSale: null,
  store: {
    name: 'Soho',
    isActive: true,
    externalStoreId: 'out-1',
    posConnection: {
      isActive: true,
      credentials: 'enc',
      provider: 'lightspeed',
      externalOutletId: 'out-1',
    },
  },
};

const closedRemoteSale = {
  externalId: 'ls-sale',
  invoiceNumber: 'HOS-22',
  state: 'closed',
  totalAmount: 45,
  currency: 'GBP',
  saleDate: new Date('2026-08-23T10:00:00.000Z'),
  items: [],
};

describe('StoreShipmentService.resolveSaleForShipment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports the Lightspeed sale and lets the customer continue when customs are still pending', async () => {
    const { service, prisma, adapter, skuCustoms, salesImport } = makeService();
    prisma.storeShipmentRequest.findUnique.mockResolvedValue(shipmentBase);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    adapter.getSaleByInvoice.mockResolvedValue({
      externalId: 'ls-sale',
      invoiceNumber: 'HOS-22',
      state: 'closed',
      items: [{ sku: 'WAND-1', name: 'Wand', quantity: 1, externalProductId: 'prod-1' }],
    });
    salesImport.importParsedSale.mockResolvedValue({ id: 'pos-1', duplicate: false });
    prisma.pOSSale.findUnique.mockResolvedValue({
      id: 'pos-1',
      status: 'PROCESSED',
      externalSaleId: 'ls-sale',
      items: [
        {
          sku: 'WAND-1',
          productId: null,
          name: 'Wand',
          quantity: 1,
          externalProductId: 'prod-1',
        },
      ],
    });
    skuCustoms.enrichSaleItems.mockResolvedValue({
      allReady: false,
      anyBlocked: false,
      results: [{ sku: 'WAND-1', status: 'PENDING' }],
    });

    const result = await service.resolveSaleForShipment('ship-1', 'user-1');

    expect(adapter.getSaleByInvoice).toHaveBeenCalledWith({
      invoiceNumber: 'HOS-22',
      outletId: 'out-1',
    });
    expect(salesImport.importParsedSale).toHaveBeenCalledWith(
      'store-1',
      'lightspeed',
      expect.objectContaining({ externalId: 'ls-sale' }),
      { refreshItems: true },
    );
    expect(result).toMatchObject({ status: 'DRAFT', allReady: true });
    expect(prisma.storeShipmentRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ship-1' },
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });

  it('re-fetches Lightspeed when a linked sale has no SKUs', async () => {
    const { service, prisma, adapter, skuCustoms, salesImport } = makeService();
    prisma.storeShipmentRequest.findUnique.mockResolvedValue({
      ...shipmentBase,
      posSaleId: 'pos-old',
      posSale: {
        id: 'pos-old',
        status: 'PROCESSED',
        externalSaleId: 'ls-sale',
        items: [{ sku: null, productId: null, name: 'Item', quantity: 1 }],
      },
    });
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    adapter.getSaleByInvoice.mockResolvedValue({
      externalId: 'ls-sale',
      state: 'closed',
      items: [{ sku: 'FIG-1', name: 'Figure', quantity: 1, externalProductId: 'p1' }],
    });
    salesImport.importParsedSale.mockResolvedValue({ id: 'pos-old', duplicate: true });
    prisma.pOSSale.findUnique.mockResolvedValue({
      id: 'pos-old',
      status: 'PROCESSED',
      externalSaleId: 'ls-sale',
      items: [{ sku: 'FIG-1', productId: null, name: 'Figure', quantity: 1, externalProductId: 'p1' }],
    });
    skuCustoms.enrichSaleItems.mockResolvedValue({
      allReady: true,
      anyBlocked: false,
      results: [{ sku: 'FIG-1', status: 'READY' }],
    });

    const result = await service.resolveSaleForShipment('ship-1', 'user-1');

    expect(adapter.getSaleByInvoice).toHaveBeenCalled();
    expect(salesImport.importParsedSale).toHaveBeenCalledWith(
      'store-1',
      'lightspeed',
      expect.any(Object),
      { refreshItems: true },
    );
    expect(result.allReady).toBe(true);
    expect(result.status).toBe('DRAFT');
  });

  it('tells the customer the till sale is unfinished when Lightspeed returns a non-closed sale', async () => {
    const { service, prisma, adapter, salesImport } = makeService();
    prisma.storeShipmentRequest.findUnique.mockResolvedValue(shipmentBase);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    adapter.getSaleByInvoice.mockResolvedValue({
      externalId: 'ls-sale',
      state: 'pending',
      items: [],
    });
    salesImport.importParsedSale.mockResolvedValue({ id: '', duplicate: false, skipped: true });

    await expect(service.resolveSaleForShipment('ship-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('StoreShipmentService.createClaimFromTill', () => {
  const claimInput = {
    storeId: 'store-1',
    invoiceNumber: 'HOS-22',
    email: 'guest@example.com',
    shippingConsent: true,
    staffUserId: 'staff-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not email or persist a claim when Lightspeed has no matching sale', async () => {
    const { service, prisma, adapter, notifications } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    adapter.getSaleByInvoice.mockResolvedValue(null);

    await expect(service.createClaimFromTill(claimInput)).rejects.toThrow(/No Lightspeed sale found/);
    expect(prisma.gDPRConsentLog.create).not.toHaveBeenCalled();
    expect(prisma.storeShipmentRequest.create).not.toHaveBeenCalled();
    expect(notifications.sendStoreShipmentClaimEmail).not.toHaveBeenCalled();
  });

  it('rejects an unfinished till sale before sending email', async () => {
    const { service, prisma, adapter, notifications } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    adapter.getSaleByInvoice.mockResolvedValue({ ...closedRemoteSale, state: 'pending' });

    await expect(service.createClaimFromTill(claimInput)).rejects.toThrow(/not completed/);
    expect(notifications.sendStoreShipmentClaimEmail).not.toHaveBeenCalled();
  });

  it('rejects a voided sale before sending email', async () => {
    const { service, prisma, adapter, notifications } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    adapter.getSaleByInvoice.mockResolvedValue({ ...closedRemoteSale, state: 'voided' });

    await expect(service.createClaimFromTill(claimInput)).rejects.toThrow(/voided/);
    expect(notifications.sendStoreShipmentClaimEmail).not.toHaveBeenCalled();
  });

  it('confirms the invoice then emails the claim link without importing line items', async () => {
    const { service, prisma, adapter, notifications, salesImport } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    adapter.getSaleByInvoice.mockResolvedValue(closedRemoteSale);

    const result = await service.createClaimFromTill(claimInput);

    expect(adapter.getSaleByInvoice).toHaveBeenCalledWith({
      invoiceNumber: 'HOS-22',
      outletId: 'out-1',
      hydrateProducts: false,
    });
    expect(salesImport.importParsedSale).not.toHaveBeenCalled();
    expect(prisma.gDPRConsentLog.create).toHaveBeenCalled();
    expect(prisma.storeShipmentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceNumber: 'HOS-22',
          posExternalSaleId: 'ls-sale',
          claimEmail: 'guest@example.com',
        }),
      }),
    );
    expect(notifications.sendStoreShipmentClaimEmail).toHaveBeenCalled();
    expect(result.emailQueued).toBe(true);
    expect(result.confirmedInvoice).toMatchObject({ number: 'HOS-22', totalAmount: 45 });
    expect(result.claimUrl).toContain('/ship/claim/');
  });

  it('binds store staff to their assigned store', async () => {
    const { service } = makeService();
    await expect(
      service.createClaimFromTill({
        ...claimInput,
        storeId: 'other-store',
        assignedStoreId: 'store-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not send a second claim when a shipment is already in progress', async () => {
    const { service, prisma, adapter, notifications } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue(null);
    adapter.getSaleByInvoice.mockResolvedValue(closedRemoteSale);
    prisma.storeShipmentRequest.findFirst.mockResolvedValue({
      id: 'ship-old',
      status: 'LABEL_PURCHASED',
      claimEmail: 'guest@example.com',
      userId: 'user-1',
    });

    await expect(service.createClaimFromTill(claimInput)).rejects.toThrow(/already in progress/);
    expect(notifications.sendStoreShipmentClaimEmail).not.toHaveBeenCalled();
  });

  it('does not confirm a local sale when Lightspeed lookup fails', async () => {
    const { service, prisma, adapter, notifications } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue({
      id: 'pos-old',
      externalSaleId: 'ls-sale',
      externalInvoice: 'HOS-22',
      totalAmount: 45,
      currency: 'GBP',
      saleDate: new Date('2026-08-23T10:00:00.000Z'),
      status: 'PROCESSED',
    });
    adapter.getSaleByInvoice.mockRejectedValue(new Error('Lightspeed API 503: unavailable'));

    await expect(service.createClaimFromTill(claimInput)).rejects.toThrow(
      /Could not confirm this invoice with Lightspeed/,
    );
    expect(notifications.sendStoreShipmentClaimEmail).not.toHaveBeenCalled();
    expect(prisma.storeShipmentRequest.create).not.toHaveBeenCalled();
  });

  it('can confirm from a local sale when Lightspeed returns no matching invoice', async () => {
    const { service, prisma, adapter, notifications } = makeService();
    prisma.store.findUnique.mockResolvedValue(shipmentBase.store);
    prisma.pOSSale.findFirst.mockResolvedValue({
      id: 'pos-old',
      externalSaleId: 'ls-sale',
      externalInvoice: 'HOS-22',
      totalAmount: 45,
      currency: 'GBP',
      saleDate: new Date('2026-08-23T10:00:00.000Z'),
      status: 'PROCESSED',
    });
    adapter.getSaleByInvoice.mockResolvedValue(null);

    const result = await service.createClaimFromTill(claimInput);

    expect(result.confirmedInvoice).toMatchObject({ number: 'HOS-22', totalAmount: 45 });
    expect(notifications.sendStoreShipmentClaimEmail).toHaveBeenCalled();
  });
});
