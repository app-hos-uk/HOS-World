import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PosVoucherService } from './pos-voucher.service';

describe('PosVoucherService', () => {
  const membershipId = 'mem-1';
  const storeId = 'store-1';
  const redemptionId = 'red-1';
  const idempotencyKey = 'till-1:sale-4821';

  function build(overrides: {
    createGiftCard?: jest.Mock;
    getGiftCardByNumber?: jest.Mock;
    giftCardTransaction?: jest.Mock;
    processRedemption?: jest.Mock;
    voucherCreate?: jest.Mock;
    voucherUpdate?: jest.Mock;
    voucherFindUnique?: jest.Mock;
    configGet?: (key: string, def?: unknown) => unknown;
    applyDelta?: jest.Mock;
  }) {
    const adapter = {
      authenticate: jest.fn().mockResolvedValue(undefined),
      createGiftCard:
        overrides.createGiftCard ??
        jest.fn().mockResolvedValue({
          id: 'gc-1',
          number: 'ABCD2345EFGH',
          balance: 5,
          transactions: [{ id: 'tx-act', type: 'ACTIVATION', amount: 5 }],
        }),
      getGiftCardByNumber: overrides.getGiftCardByNumber ?? jest.fn().mockResolvedValue(null),
      giftCardTransaction: overrides.giftCardTransaction ?? jest.fn(),
      reverseGiftCardTransaction: jest.fn(),
      voidGiftCard: jest.fn(),
    };

    const voucherRow = {
      id: 'voucher-1',
      membershipId,
      redemptionId,
      storeId,
      cardNumber: 'ABCD2345EFGH',
      amount: new Decimal('5.00'),
      currency: 'GBP',
      clientId: redemptionId,
      status: 'PENDING',
      redemption: { pointsSpent: 500, status: 'COMPLETED' },
    };

    const prisma: any = {
      store: {
        findUnique: jest.fn().mockResolvedValue({
          id: storeId,
          isActive: true,
          currency: 'GBP',
          loyaltyRedeemValue: new Decimal('0.01'),
          posConnection: {
            isActive: true,
            provider: 'lightspeed',
            credentials: 'enc',
          },
        }),
      },
      loyaltyMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: membershipId }),
        update: jest.fn(),
      },
      loyaltyPosVoucher: {
        create: overrides.voucherCreate ?? jest.fn().mockResolvedValue(voucherRow),
        update: overrides.voucherUpdate ?? jest.fn().mockImplementation(({ data }) => ({
          ...voucherRow,
          ...data,
          redemption: voucherRow.redemption,
        })),
        findUnique:
          overrides.voucherFindUnique ??
          // Lookups by redemptionId probe for a replayed request; by id fetch the row.
          jest.fn().mockImplementation(({ where }: any) =>
            Promise.resolve(
              where?.redemptionId
                ? null
                : { ...voucherRow, redemption: voucherRow.redemption },
            ),
          ),
      },
      loyaltyRedemption: {
        findUnique: jest.fn().mockResolvedValue({ id: redemptionId, status: 'COMPLETED' }),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          loyaltyRedemption: {
            findUnique: jest.fn().mockResolvedValue({ id: redemptionId, status: 'COMPLETED' }),
            update: jest.fn(),
          },
          loyaltyMembership: { update: jest.fn() },
          loyaltyPosVoucher: { update: jest.fn() },
        }),
      ),
    };

    const config: any = {
      get: jest.fn((key: string, def?: unknown) => {
        if (overrides.configGet) return overrides.configGet(key, def);
        if (key === 'LOYALTY_ENABLED') return 'true';
        if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'true';
        if (key === 'LOYALTY_DEFAULT_REDEEM_VALUE') return '0.01';
        return def;
      }),
    };

    const featureFlags: any = { isEnabled: jest.fn().mockReturnValue(true) };
    const burn: any = {
      processRedemption:
        overrides.processRedemption ?? jest.fn().mockResolvedValue({ redemptionId }),
    };
    const wallet: any = {
      applyDelta: overrides.applyDelta ?? jest.fn().mockResolvedValue({}),
    };
    const factory: any = { create: jest.fn().mockReturnValue(adapter) };
    const encryption: any = {
      decryptJson: jest.fn().mockReturnValue({ domainPrefix: 'demo', accessToken: 't' }),
    };

    const svc = new PosVoucherService(
      prisma,
      config,
      featureFlags,
      burn,
      wallet,
      factory,
      encryption,
    );

    return { svc, adapter, prisma, burn, wallet, voucherRow };
  }

  it('generates 12+ alphanumeric non-sequential card numbers', () => {
    const { svc } = build({});
    const a = svc.generateCardNumber();
    const b = svc.generateCardNumber();
    expect(a).toHaveLength(12);
    expect(b).toHaveLength(12);
    expect(a).toMatch(/^[A-Z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it('feature-gates when LOYALTY_POS_VOUCHER_ENABLED is not true', async () => {
    const { svc } = build({
      configGet: (key, def) => {
        if (key === 'LOYALTY_ENABLED') return 'true';
        if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'false';
        return def;
      },
    });
    await expect(
      svc.redeemForVoucher({ points: 500, storeId, membershipId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a new redemption without an idempotency key', async () => {
    const { svc, burn } = build({});
    await expect(
      svc.redeemForVoucher({ points: 500, storeId, membershipId }),
    ).rejects.toThrow(/idempotencyKey of at least 8 characters is required/);
    expect(burn.processRedemption).not.toHaveBeenCalled();
  });

  it('replayed request resumes the existing voucher instead of issuing a second card', async () => {
    const issuedVoucher = {
      id: 'voucher-1',
      membershipId,
      redemptionId,
      storeId,
      cardNumber: 'ABCD2345EFGH',
      amount: new Decimal('5.00'),
      currency: 'GBP',
      clientId: redemptionId,
      status: 'ISSUED',
      redemption: { pointsSpent: 500, status: 'COMPLETED' },
      store: { posConnection: { isActive: true, provider: 'lightspeed', credentials: 'enc' } },
    };
    // Burn replay returns the original redemption; a voucher already exists for it.
    const voucherFindUnique = jest.fn().mockResolvedValue(issuedVoucher);
    const voucherCreate = jest.fn();
    const { svc, adapter } = build({ voucherFindUnique, voucherCreate });

    const result = await svc.redeemForVoucher({
      points: 500,
      storeId,
      membershipId,
      idempotencyKey,
    });

    expect(voucherCreate).not.toHaveBeenCalled();
    expect(adapter.createGiftCard).not.toHaveBeenCalled();
    expect(result.voucherId).toBe('voucher-1');
    expect(result.cardNumber).toBe('ABCD2345EFGH');
    expect(result.status).toBe('ISSUED');
  });

  it('burns points, creates PENDING voucher, issues gift card, returns card number', async () => {
    const createGiftCard = jest.fn().mockResolvedValue({
      id: 'gc-1',
      number: 'ABCD2345EFGH',
      balance: 5,
      transactions: [{ id: 'tx-act', type: 'ACTIVATION', amount: 5, clientId: null }],
    });
    const { svc, burn, adapter, prisma } = build({ createGiftCard });

    const result = await svc.redeemForVoucher({
      points: 500,
      storeId,
      membershipId,
      idempotencyKey,
    });

    expect(burn.processRedemption).toHaveBeenCalledWith({
      membershipId,
      points: 500,
      channel: 'HOS_OUTLET_POS',
      storeId,
      idempotencyKey,
    });
    expect(prisma.loyaltyPosVoucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: redemptionId,
          status: 'PENDING',
          amount: expect.any(Decimal),
        }),
      }),
    );
    expect(adapter.createGiftCard).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5, number: expect.any(String) }),
    );
    expect(result.status).toBe('ISSUED');
    expect(result.cardNumber).toBeTruthy();
    expect(result.amount).toBe(5);
    expect(result.redemptionId).toBe(redemptionId);
  });

  it('uses store.loyaltyRedeemValue for amount', async () => {
    const createGiftCard = jest.fn().mockResolvedValue({
      id: 'gc-1',
      number: 'X',
      balance: 10,
      transactions: [{ id: 'tx', type: 'ACTIVATION', amount: 10 }],
    });
    const voucherCreate = jest.fn().mockImplementation(({ data }) => ({
      id: 'voucher-1',
      ...data,
      redemption: { pointsSpent: 500, status: 'COMPLETED' },
    }));
    const voucherFindUnique = jest.fn().mockImplementation(({ where }: any) => {
      if (where?.redemptionId) return Promise.resolve(null);
      const created = voucherCreate.mock.results[0]?.value;
      return Promise.resolve({
        ...(created ?? {}),
        redemption: { pointsSpent: 500, status: 'COMPLETED' },
      });
    });
    const { svc, prisma, adapter } = build({
      createGiftCard,
      voucherCreate,
      voucherFindUnique,
    });
    prisma.store.findUnique.mockResolvedValue({
      id: storeId,
      isActive: true,
      currency: 'GBP',
      loyaltyRedeemValue: new Decimal('0.02'),
      posConnection: { isActive: true, provider: 'lightspeed', credentials: 'enc' },
    });

    await svc.redeemForVoucher({ points: 500, storeId, membershipId, idempotencyKey });
    expect(voucherCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: new Decimal('10.00') }),
      }),
    );
    expect(adapter.createGiftCard).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10 }),
    );
  });

  it('on gift card failure marks FAILED, reverses burn, keeps clientId', async () => {
    const createGiftCard = jest.fn().mockRejectedValue(new Error('Lightspeed API 500: boom'));
    const applyDelta = jest.fn().mockResolvedValue({});
    const { svc, wallet, prisma, voucherRow } = build({ createGiftCard, applyDelta });

    await expect(
      svc.redeemForVoucher({ points: 500, storeId, membershipId, idempotencyKey }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.loyaltyPosVoucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: voucherRow.id },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(wallet.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      membershipId,
      500,
      expect.anything(),
      expect.objectContaining({ source: 'POS_VOUCHER_REVERSAL', sourceId: redemptionId }),
    );
    // clientId never rewritten
    expect(prisma.loyaltyPosVoucher.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: expect.anything() }),
      }),
    );
  });

  it('retry FAILED voucher reuses same clientId and reloads when card exists', async () => {
    const giftCardTransaction = jest.fn().mockResolvedValue({
      id: 'tx-reload',
      amount: 5,
      type: 'RELOADING',
      clientId: redemptionId,
    });
    const getGiftCardByNumber = jest.fn().mockResolvedValue({
      id: 'gc-1',
      number: 'ABCD2345EFGH',
      balance: 0,
      transactions: [],
    });

    const failedVoucher = {
      id: 'voucher-1',
      membershipId,
      redemptionId,
      storeId,
      cardNumber: 'ABCD2345EFGH',
      amount: new Decimal('5.00'),
      currency: 'GBP',
      clientId: redemptionId,
      status: 'FAILED',
      redemption: { pointsSpent: 500, status: 'REVERSED' },
      store: {
        posConnection: { isActive: true, provider: 'lightspeed', credentials: 'enc' },
      },
    };

    const voucherFindUnique = jest
      .fn()
      .mockResolvedValueOnce(failedVoucher)
      .mockResolvedValueOnce({
        ...failedVoucher,
        status: 'PENDING',
        redemption: { pointsSpent: 500, status: 'COMPLETED' },
      });

    const { svc, adapter } = build({
      giftCardTransaction,
      getGiftCardByNumber,
      voucherFindUnique,
    });

    const result = await svc.redeemForVoucher({
      points: 500,
      storeId,
      membershipId,
      voucherId: 'voucher-1',
    });

    expect(adapter.giftCardTransaction).toHaveBeenCalledWith(
      'ABCD2345EFGH',
      expect.objectContaining({ type: 'RELOADING', clientId: redemptionId, amount: 5 }),
    );
    expect(result.status).toBe('ISSUED');
    expect(result.cardNumber).toBe('ABCD2345EFGH');
  });
});
