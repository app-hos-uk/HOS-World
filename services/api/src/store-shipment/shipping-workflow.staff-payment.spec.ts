import { BadRequestException } from '@nestjs/common';
import { ShippingWorkflowService } from './shipping-workflow.service';

function makeService(opts?: { onlinePayment?: boolean; stripeStatus?: string }) {
  const order = {
    id: 'ship-1',
    status: 'AWAITING_PAYMENT',
    storeId: 'store-1',
    claimEmail: 'guest@example.com',
    hosOrderNumber: 'HOS-NYC-270826-0001',
    totalCustomerCharge: 25,
    shippingAmount: 25,
    currency: 'USD',
    paymentMethod: null,
    stripePaymentIntentId: 'pi_1',
    userId: 'user-1',
    store: { id: 'store-1', name: 'Soho', code: 'NYC', currency: 'USD' },
    posSale: { items: [] },
    groups: [],
    user: null,
    invoiceNumber: 'INV-1',
    customerName: 'Ada',
    customerPhone: null,
    selectedItems: null,
    specialInstructions: null,
    receivedByEmployee: null,
    receivedAt: null,
    totalCarrierCost: 0,
    totalPackagingCost: 0,
  };

  const storeShipmentRequest = {
    findUnique: jest.fn().mockResolvedValue(order),
    update: jest.fn().mockResolvedValue({ ...order, status: 'PAID', paymentMethod: 'CASH' }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const shipmentGroup = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const prisma: any = {
    storeShipmentRequest,
    shipmentGroup,
    store: { findUnique: jest.fn().mockResolvedValue({ name: 'Soho' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'guest@example.com' }) },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
      fn({ storeShipmentRequest, shipmentGroup }),
    ),
  };
  const boxSizes = {
    list: jest.fn().mockResolvedValue([]),
    pricesForCountry: jest.fn().mockResolvedValue({ tier: null, prices: {} }),
    recommendName: jest.fn().mockReturnValue('MEDIUM'),
    normalizeCountry: jest.fn().mockReturnValue('US'),
  };
  const notifications = { sendStoreShipmentPaidEmail: jest.fn().mockResolvedValue(undefined) };
  const featureFlags = { isEnabled: jest.fn().mockReturnValue(Boolean(opts?.onlinePayment)) };
  const paymentProvider = {
    getProvider: jest.fn().mockReturnValue({
      getPaymentStatus: jest.fn().mockResolvedValue(opts?.stripeStatus || 'succeeded'),
    }),
  };
  const service = new ShippingWorkflowService(
    prisma,
    boxSizes as any,
    {} as any,
    {} as any,
    notifications as any,
    paymentProvider as any,
    { get: jest.fn().mockReturnValue('https://hos.example') } as any,
    featureFlags as any,
    {} as any,
  );
  return { service, prisma, notifications, order, paymentProvider };
}

describe('ShippingWorkflowService.staffConfirmPayment', () => {
  it('rejects an unknown payment method', async () => {
    const { service } = makeService();
    await expect(
      service.staffConfirmPayment('ship-1', { id: 'staff-1', storeId: 'store-1', role: 'STORE_STAFF' }, { method: 'VENMO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects confirmation before the quote is finalized', async () => {
    const { service, prisma, order } = makeService();
    prisma.storeShipmentRequest.findUnique.mockResolvedValue({ ...order, status: 'CUSTOMER_DETAILS_REQUIRED' });
    await expect(
      service.staffConfirmPayment('ship-1', { id: 'staff-1', storeId: 'store-1', role: 'STORE_STAFF' }, { method: 'CASH' }),
    ).rejects.toThrow(/Finalize the shipping quote/);
  });

  it('marks the order paid with the chosen counter method', async () => {
    const { service, prisma, notifications } = makeService();
    await service.staffConfirmPayment(
      'ship-1',
      { id: 'staff-1', storeId: 'store-1', role: 'STORE_STAFF' },
      { method: 'cash' },
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.storeShipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'ship-1', status: 'AWAITING_PAYMENT' },
      data: {
        status: 'PAID',
        paymentMethod: 'CASH',
        shippingSlipUrl: '/store-shipment/ship-1/slip',
      },
    });
    expect(prisma.shipmentGroup.updateMany).toHaveBeenCalledWith({
      where: { shippingOrderId: 'ship-1' },
      data: { status: 'PAID' },
    });
    expect(notifications.sendStoreShipmentPaidEmail).toHaveBeenCalled();
  });

  it('does not re-send the paid email if the order is already paid', async () => {
    const { service, prisma, notifications, order } = makeService();
    prisma.storeShipmentRequest.findUnique.mockResolvedValue({ ...order, status: 'PAID' });
    await service.staffConfirmPayment(
      'ship-1',
      { id: 'staff-1', storeId: 'store-1', role: 'STORE_STAFF' },
      { method: 'CASH' },
    );
    expect(prisma.shipmentGroup.updateMany).not.toHaveBeenCalled();
    expect(notifications.sendStoreShipmentPaidEmail).not.toHaveBeenCalled();
  });
});

describe('ShippingWorkflowService.confirmPayment', () => {
  it('does not re-send the paid email if the order is already paid', async () => {
    const { service, prisma, notifications, order, paymentProvider } = makeService({
      onlinePayment: true,
    });
    prisma.storeShipmentRequest.findUnique.mockResolvedValue({ ...order, status: 'PAID' });
    await service.confirmPayment('ship-1', 'user-1');
    expect(paymentProvider.getProvider).not.toHaveBeenCalled();
    expect(prisma.shipmentGroup.updateMany).not.toHaveBeenCalled();
    expect(notifications.sendStoreShipmentPaidEmail).not.toHaveBeenCalled();
  });

  it('marks paid once Stripe has succeeded', async () => {
    const { service, prisma, notifications } = makeService({ onlinePayment: true });
    await service.confirmPayment('ship-1', 'user-1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.storeShipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'ship-1', status: 'AWAITING_PAYMENT' },
      data: {
        status: 'PAID',
        paymentMethod: 'CARD',
        shippingSlipUrl: '/store-shipment/ship-1/slip',
      },
    });
    expect(notifications.sendStoreShipmentPaidEmail).toHaveBeenCalledTimes(1);
  });

  it('still records a succeeded Stripe charge if the online-payment flag was turned off', async () => {
    const { service, prisma, notifications } = makeService({ onlinePayment: false });
    await service.confirmPayment('ship-1', 'user-1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.storeShipmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'ship-1', status: 'AWAITING_PAYMENT' },
      data: {
        status: 'PAID',
        paymentMethod: 'CARD',
        shippingSlipUrl: '/store-shipment/ship-1/slip',
      },
    });
    expect(notifications.sendStoreShipmentPaidEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a new online confirm when the flag is off and no PaymentIntent exists', async () => {
    const { service, prisma, order } = makeService({ onlinePayment: false });
    prisma.storeShipmentRequest.findUnique.mockResolvedValue({
      ...order,
      stripePaymentIntentId: null,
    });
    await expect(service.confirmPayment('ship-1', 'user-1')).rejects.toThrow(
      /Online payment is disabled/,
    );
  });
});
