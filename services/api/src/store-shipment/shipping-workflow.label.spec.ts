import { BadRequestException } from '@nestjs/common';
import { ShippingWorkflowService } from './shipping-workflow.service';

function packedGroup() {
  return {
    id: 'g1',
    status: 'PACKED',
    recipientName: 'Ada',
    recipientPhone: null,
    recipientEmail: null,
    destinationSnapshot: {
      street: '1 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10036',
      country: 'US',
    },
    actualWeightKg: 1.2,
    actualLengthCm: 30,
    actualWidthCm: 20,
    actualHeightCm: 10,
    boxSize: { lengthCm: 30, widthCm: 20, heightCm: 10 },
    items: [{ name: 'Wand', sku: 'W1', quantity: 1 }],
    shippingOrder: {
      id: 'ship-1',
      storeId: 'store-1',
      hosOrderNumber: 'HOS-1',
      invoiceNumber: 'INV-1',
      customerPhone: null,
      claimEmail: 'ada@example.com',
      status: 'PACKED',
      store: {
        name: 'Soho',
        address: '123 Store St',
        city: 'New York',
        state: 'NY',
        postalCode: '10012',
        country: 'US',
        countryCode: 'US',
        contactPhone: '555',
        contactEmail: 'store@example.com',
      },
      posSale: { items: [] },
    },
  };
}

function makeService() {
  const group = packedGroup();
  const courierFactory = {
    getDefaultProvider: jest.fn().mockReturnValue({ providerId: 'shippo' }),
    getRates: jest.fn().mockResolvedValue([
      {
        serviceCode: 'rate_obj_1',
        serviceName: 'UPS Ground',
        providerName: 'Shippo',
        rate: 12.5,
        currency: 'USD',
        estimatedDays: 3,
        metadata: { carrier: 'UPS', serviceToken: 'ups_ground' },
      },
      {
        serviceCode: 'rate_obj_2',
        serviceName: 'FedEx Home',
        providerName: 'Shippo',
        rate: 18,
        currency: 'USD',
        estimatedDays: 2,
        metadata: { carrier: 'FedEx', serviceToken: 'fedex_home' },
      },
    ]),
    createShipment: jest.fn(),
  };
  const prisma: any = {
    shipmentGroup: {
      findUnique: jest.fn().mockResolvedValue(group),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    storeShipmentRequest: {
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'ship-1',
        storeId: 'store-1',
        status: 'PACKED',
        currency: 'USD',
        groups: [],
        posSale: { items: [] },
        user: null,
      }),
    },
  };
  const boxSizes = {
    list: jest.fn().mockResolvedValue([]),
    pricesForCountry: jest.fn().mockResolvedValue({ tier: 'default', prices: [] }),
    recommendName: jest.fn().mockReturnValue('Medium'),
    normalizeCountry: jest.fn().mockReturnValue('US'),
  };
  const featureFlags = { isEnabled: jest.fn().mockReturnValue(false) };
  const service = new ShippingWorkflowService(
    prisma,
    boxSizes as any,
    {} as any,
    courierFactory as any,
    {} as any,
    {} as any,
    { get: jest.fn() } as any,
    featureFlags as any,
    {} as any,
  );
  return { service, prisma, courierFactory, group };
}

describe('ShippingWorkflowService label rates', () => {
  const staff = { id: 'staff-1', storeId: 'store-1', role: 'STORE_STAFF' };

  it('returns carrier rates for a packed weighed box', async () => {
    const { service, courierFactory } = makeService();
    const result = await service.quoteLabelRates('g1', staff);
    expect(courierFactory.getRates).toHaveBeenCalled();
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0]).toMatchObject({
      carrier: 'UPS',
      serviceCode: 'ups_ground',
      rate: 12.5,
    });
  });

  it('refuses to generate a label without a selected carrier', async () => {
    const { service, courierFactory } = makeService();
    await expect(service.generateLabel('g1', staff, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.generateLabel('g1', staff, { serviceCode: 'auto' })).rejects.toThrow(
      /Select a carrier/,
    );
    expect(courierFactory.createShipment).not.toHaveBeenCalled();
  });

  it('stores carrier tracking URL separately from the label PDF', async () => {
    const { service, prisma, courierFactory } = makeService();
    courierFactory.createShipment.mockResolvedValue({
      trackingNumber: '1Z999',
      trackingUrl: 'https://carrier.example/track/1Z999',
      labels: [{ url: 'https://shippo.example/label.pdf' }],
      rate: 12.5,
      serviceCode: 'ups_ground',
      serviceName: 'UPS Ground',
      providerName: 'Shippo',
      metadata: { carrier: 'UPS' },
    });
    prisma.shipmentGroup.findMany.mockResolvedValue([{ id: 'g1', status: 'PACKED', carrierCost: 0 }]);

    await service.generateLabel('g1', staff, { serviceCode: 'ups_ground' });

    expect(prisma.shipmentGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labelUrl: 'https://shippo.example/label.pdf',
          trackingUrl: 'https://carrier.example/track/1Z999',
          trackingCode: '1Z999',
        }),
      }),
    );
  });

  it('requires packed weight before quoting', async () => {
    const { service, prisma } = makeService();
    prisma.shipmentGroup.findUnique.mockResolvedValue({
      ...packedGroup(),
      actualWeightKg: 0,
    });
    await expect(service.quoteLabelRates('g1', staff)).rejects.toThrow(/packed weight/);
  });
});
