import { PosGiftCardReconService } from './gift-card-recon.service';

function makeMocks() {
  const prisma: any = {
    loyaltyPosVoucher: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    pOSConnection: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const discrepancies: any = {
    createDiscrepancy: jest.fn().mockResolvedValue({}),
  };
  const adapter = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    listGiftCards: jest.fn().mockResolvedValue([]),
  };
  const factory: any = {
    create: jest.fn().mockReturnValue(adapter),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({ domainPrefix: 'demo' }),
  };
  const config: any = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'POS_ENABLED') return 'true';
      if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'true';
      return undefined;
    }),
  };
  const featureFlags: any = {
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const service = new PosGiftCardReconService(
    prisma,
    discrepancies,
    factory,
    encryption,
    config,
    featureFlags,
  );
  return { service, prisma, discrepancies, factory, encryption, config, featureFlags, adapter };
}

describe('PosGiftCardReconService', () => {
  it('skips when POS_ENABLED is not true', async () => {
    const { service, config, prisma, discrepancies } = makeMocks();
    config.get.mockImplementation((key: string) =>
      key === 'POS_ENABLED' ? 'false' : 'true',
    );
    const summary = await service.reconcile();
    expect(summary.discrepancies).toBe(0);
    expect(prisma.loyaltyPosVoucher.findMany).not.toHaveBeenCalled();
    expect(discrepancies.createDiscrepancy).not.toHaveBeenCalled();
  });

  it('skips when LOYALTY_POS_VOUCHER_ENABLED is not true', async () => {
    const { service, config, prisma, discrepancies } = makeMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'POS_ENABLED') return 'true';
      if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'false';
      return undefined;
    });
    const summary = await service.reconcile();
    expect(summary.discrepancies).toBe(0);
    expect(prisma.loyaltyPosVoucher.findMany).not.toHaveBeenCalled();
    expect(discrepancies.createDiscrepancy).not.toHaveBeenCalled();
  });

  it('records balance drift for ISSUED voucher matched by client_id', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([
      {
        id: 'v1',
        clientId: 'client-1',
        cardNumber: 'ABCD2345EFGH',
        amount: 10,
        status: 'ISSUED',
        storeId: 's1',
      },
    ]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([
      {
        id: 'gc-1',
        number: 'ABCD2345EFGH',
        balance: 7,
        status: 'ACTIVE',
        transactions: [{ id: 'tx-1', amount: 10, type: 'ACTIVATION', clientId: 'client-1' }],
      },
    ]);

    const summary = await service.reconcile();

    expect(summary.discrepancies).toBe(1);
    expect(discrepancies.createDiscrepancy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SETTLEMENT',
        expectedValue: expect.objectContaining({
          source: 'HOS',
          clientId: 'client-1',
          amount: 10,
        }),
        actualValue: expect.objectContaining({
          source: 'POS',
          balance: 7,
          balanceDrift: true,
        }),
      }),
    );
  });

  it('records status drift when LS card is VOIDED', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([
      {
        id: 'v1',
        clientId: 'client-1',
        cardNumber: 'CARDVOID0001',
        amount: 10,
        status: 'ISSUED',
        storeId: 's1',
      },
    ]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([
      {
        id: 'gc-v',
        number: 'CARDVOID0001',
        balance: 0,
        status: 'VOIDED',
        transactions: [{ id: 'tx-1', amount: 10, type: 'ACTIVATION', clientId: 'client-1' }],
      },
    ]);

    await service.reconcile();

    expect(discrepancies.createDiscrepancy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'HIGH',
        actualValue: expect.objectContaining({ status: 'VOIDED', statusDrift: true }),
      }),
    );
  });

  it('records orphan LS card when client_id has no voucher', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([
      {
        id: 'gc-orphan',
        number: 'ORPHAN123456',
        balance: 5,
        status: 'ACTIVE',
        transactions: [{ id: 'tx-o', amount: 5, type: 'RELOADING', clientId: 'unknown-client' }],
      },
    ]);

    const summary = await service.reconcile();

    expect(summary.discrepancies).toBe(1);
    expect(discrepancies.createDiscrepancy).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('no matching LoyaltyPosVoucher'),
        actualValue: expect.objectContaining({ number: 'ORPHAN123456' }),
      }),
    );
  });

  it('does not flag retail LS cards that have no client_id', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([
      {
        id: 'gc-retail',
        number: 'RETAIL999',
        balance: 25,
        status: 'ACTIVE',
        transactions: [{ id: 'tx-a', amount: 25, type: 'ACTIVATION', clientId: null }],
      },
    ]);

    const summary = await service.reconcile();
    expect(summary.discrepancies).toBe(0);
    expect(discrepancies.createDiscrepancy).not.toHaveBeenCalled();
  });

  it('records discrepancy when ISSUED voucher has no LS card', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([
      {
        id: 'v-missing',
        clientId: 'client-missing',
        cardNumber: 'MISSING000001',
        amount: 15,
        status: 'ISSUED',
        storeId: 's1',
      },
    ]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([]);

    const summary = await service.reconcile();

    expect(summary.discrepancies).toBe(1);
    expect(discrepancies.createDiscrepancy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'HIGH',
        description: expect.stringContaining('no matching Lightspeed gift card'),
        expectedValue: expect.objectContaining({ clientId: 'client-missing' }),
        actualValue: expect.objectContaining({ found: false }),
      }),
    );
  });

  it('matches activation-only cards by card number and records no drift when equal', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([
      {
        id: 'v1',
        clientId: 'client-1',
        cardNumber: 'ABCD2345EFGH',
        amount: 10,
        status: 'ISSUED',
        storeId: 's1',
      },
    ]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([
      {
        id: 'gc-1',
        number: 'ABCD2345EFGH',
        balance: 10,
        status: 'ACTIVE',
        transactions: [{ id: 'tx-1', amount: 10, type: 'ACTIVATION', clientId: null }],
      },
    ]);

    const summary = await service.reconcile();
    expect(summary.discrepancies).toBe(0);
    expect(discrepancies.createDiscrepancy).not.toHaveBeenCalled();
  });

  it('does not update balances (createDiscrepancy only — no voucher writes)', async () => {
    const { service, prisma, discrepancies, adapter } = makeMocks();
    prisma.loyaltyPosVoucher.update = jest.fn();
    prisma.loyaltyPosVoucher.findMany.mockResolvedValue([
      {
        id: 'v1',
        clientId: 'client-1',
        cardNumber: 'ABCD2345EFGH',
        amount: 10,
        status: 'ISSUED',
        storeId: 's1',
      },
    ]);
    prisma.pOSConnection.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'lightspeed',
        storeId: 's1',
        credentials: 'enc',
        isActive: true,
        store: { id: 's1', code: 'S1' },
      },
    ]);
    adapter.listGiftCards.mockResolvedValue([
      {
        id: 'gc-1',
        number: 'ABCD2345EFGH',
        balance: 3,
        status: 'ACTIVE',
        transactions: [{ id: 'tx-1', amount: 10, type: 'ACTIVATION', clientId: 'client-1' }],
      },
    ]);
    const loose = adapter as any;
    loose.giftCardTransaction = jest.fn();
    loose.updateInventory = jest.fn();

    await service.reconcile();

    expect(prisma.loyaltyPosVoucher.update).not.toHaveBeenCalled();
    expect(loose.giftCardTransaction).not.toHaveBeenCalled();
    expect(discrepancies.createDiscrepancy).toHaveBeenCalled();
  });
});
