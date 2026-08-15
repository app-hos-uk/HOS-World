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
        update:
          overrides.voucherUpdate ??
          jest.fn().mockImplementation(({ data }) => ({
            ...voucherRow,
            ...data,
            redemption: voucherRow.redemption,
          })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique:
          overrides.voucherFindUnique ??
          // Lookups by redemptionId probe for a replayed request; by id fetch the row.
          jest
            .fn()
            .mockImplementation(({ where }: any) =>
              Promise.resolve(
                where?.redemptionId ? null : { ...voucherRow, redemption: voucherRow.redemption },
              ),
            ),
      },
      loyaltyTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
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
          loyaltyTransaction: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
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
      applyDelta:
        overrides.applyDelta ??
        jest.fn().mockResolvedValue({ applied: true, balanceBefore: 0, balanceAfter: 0 }),
    };
    const factory: any = { create: jest.fn().mockReturnValue(adapter) };
    const encryption: any = {
      decryptJson: jest.fn().mockReturnValue({ domainPrefix: 'demo', accessToken: 't' }),
    };

    const metrics: any = {
      incrementCounter: jest.fn(),
    };

    const posVoucherEnabled = (() => {
      if (overrides.configGet) {
        const v = overrides.configGet('LOYALTY_POS_VOUCHER_ENABLED', undefined);
        if (v === 'false' || v === false) return false;
        if (v === 'true' || v === true) return true;
      }
      return true;
    })();

    const loyaltySettings: any = {
      getResolved: jest.fn().mockResolvedValue({
        settings: {
          posVoucherEnabled,
          defaultRedeemValue: 0.01,
          posVoucherMinAmount: Number(
            (overrides.configGet?.('POS_GIFT_CARD_MIN_AMOUNT', 1) as number) ?? 1,
          ),
          posVoucherMaxAmount: Number(
            (overrides.configGet?.('POS_GIFT_CARD_MAX_AMOUNT', 500) as number) ?? 500,
          ),
        },
        source: 'env',
      }),
    };

    const platformRegion: any = {
      getCurrency: jest.fn().mockResolvedValue('USD'),
    };

    const svc = new PosVoucherService(
      prisma,
      config,
      featureFlags,
      burn,
      wallet,
      factory,
      encryption,
      metrics,
      loyaltySettings,
      platformRegion,
    );

    return { svc, adapter, prisma, burn, wallet, voucherRow, metrics, loyaltySettings };
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
    await expect(svc.redeemForVoucher({ points: 500, storeId, membershipId })).rejects.toThrow(
      /idempotencyKey of at least 8 characters is required/,
    );
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
    const voucherFindUnique = jest.fn().mockResolvedValue(issuedVoucher);
    const voucherCreate = jest.fn();
    const { svc, adapter, prisma, burn } = build({ voucherFindUnique, voucherCreate });
    // Prior wallet transaction exists for this idempotency key
    prisma.loyaltyTransaction.findUnique.mockResolvedValue({ sourceId: redemptionId });

    const result = await svc.redeemForVoucher({
      points: 500,
      storeId,
      membershipId,
      idempotencyKey,
    });

    expect(burn.processRedemption).not.toHaveBeenCalled();
    expect(voucherCreate).not.toHaveBeenCalled();
    expect(adapter.createGiftCard).not.toHaveBeenCalled();
    expect(result.voucherId).toBe('voucher-1');
    expect(result.cardNumber).toBe('ABCD2345EFGH');
    expect(result.status).toBe('ISSUED');
  });

  it('recovers when burn exists but voucher row is missing (crash between burn and create)', async () => {
    const createGiftCard = jest.fn().mockResolvedValue({
      id: 'gc-1',
      number: 'NEWCARD12345',
      balance: 5,
      transactions: [{ id: 'tx-act', type: 'ACTIVATION', amount: 5 }],
    });
    const voucherCreate = jest.fn().mockImplementation(({ data }) => ({
      id: 'voucher-new',
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
    const { svc, prisma, burn } = build({ createGiftCard, voucherCreate, voucherFindUnique });
    // Prior wallet tx exists, but no voucher for that redemptionId
    prisma.loyaltyTransaction.findUnique.mockResolvedValue({ sourceId: redemptionId });

    const result = await svc.redeemForVoucher({
      points: 500,
      storeId,
      membershipId,
      idempotencyKey,
    });

    expect(burn.processRedemption).not.toHaveBeenCalled();
    expect(voucherCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          redemptionId,
          clientId: redemptionId,
          status: 'PENDING',
        }),
      }),
    );
    expect(result.status).toBe('ISSUED');
  });

  it('does not recover when burn was reversed — re-burns via normal flow', async () => {
    const createGiftCard = jest.fn().mockResolvedValue({
      id: 'gc-1',
      number: 'NEWCARD12345',
      balance: 5,
      transactions: [{ id: 'tx-act', type: 'ACTIVATION', amount: 5 }],
    });
    const voucherCreate = jest.fn().mockImplementation(({ data }) => ({
      id: 'voucher-new',
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
    const { svc, prisma, burn } = build({ createGiftCard, voucherCreate, voucherFindUnique });
    // Prior wallet tx exists, but redemption was REVERSED
    prisma.loyaltyTransaction.findUnique.mockResolvedValue({ sourceId: redemptionId });
    prisma.loyaltyRedemption.findUnique.mockResolvedValue({ status: 'REVERSED' });

    const result = await svc.redeemForVoucher({
      points: 500,
      storeId,
      membershipId,
      idempotencyKey,
    });

    // Should fall through to burn engine instead of recovery path
    expect(burn.processRedemption).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId,
        points: 500,
        idempotencyKey,
      }),
    );
    expect(result.status).toBe('ISSUED');
  });

  it('replayed request bypasses gift card amount limits', async () => {
    const issuedVoucher = {
      id: 'voucher-1',
      membershipId,
      redemptionId,
      storeId,
      cardNumber: 'ABCD2345EFGH',
      amount: new Decimal('0.50'),
      currency: 'GBP',
      clientId: redemptionId,
      status: 'ISSUED',
      redemption: { pointsSpent: 50, status: 'COMPLETED' },
      store: { posConnection: { isActive: true, provider: 'lightspeed', credentials: 'enc' } },
    };
    const voucherFindUnique = jest.fn().mockResolvedValue(issuedVoucher);
    const { svc, prisma, burn } = build({
      voucherFindUnique,
      configGet: (key, def) => {
        if (key === 'LOYALTY_ENABLED') return 'true';
        if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'true';
        if (key === 'LOYALTY_DEFAULT_REDEEM_VALUE') return '0.01';
        if (key === 'POS_GIFT_CARD_MIN_AMOUNT') return '5';
        return def;
      },
    });
    prisma.loyaltyTransaction.findUnique.mockResolvedValue({ sourceId: redemptionId });

    // Amount 0.50 < min 5, but replay should still succeed
    const result = await svc.redeemForVoucher({
      points: 50,
      storeId,
      membershipId,
      idempotencyKey,
    });

    expect(burn.processRedemption).not.toHaveBeenCalled();
    expect(result.voucherId).toBe('voucher-1');
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
    expect(adapter.createGiftCard).toHaveBeenCalledWith(expect.objectContaining({ amount: 10 }));
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

  it('keeps the burn and flags review when funding cannot be verified after a failure', async () => {
    const createGiftCard = jest.fn().mockRejectedValue(new Error('Lightspeed API 500: boom'));
    // Card absent on the pre-create probe, then Lightspeed unreachable for the
    // post-failure funding check.
    const getGiftCardByNumber = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValue(new Error('Lightspeed API deadline exceeded'));
    const applyDelta = jest.fn().mockResolvedValue({});
    const { svc, wallet, adapter, prisma, voucherRow } = build({
      createGiftCard,
      getGiftCardByNumber,
      applyDelta,
    });

    await expect(
      svc.redeemForVoucher({ points: 500, storeId, membershipId, idempotencyKey }),
    ).rejects.toThrow(/points were NOT restored/);

    expect(prisma.loyaltyPosVoucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: voucherRow.id },
        data: expect.objectContaining({
          status: 'FAILED',
          metadata: expect.objectContaining({ needsManualReview: true }),
        }),
      }),
    );
    // Points stay burned and the card is left intact — a retry resolves either outcome.
    expect(wallet.applyDelta).not.toHaveBeenCalled();
    expect(adapter.voidGiftCard).not.toHaveBeenCalled();
  });

  it('rejects when computed amount is below POS_GIFT_CARD_MIN_AMOUNT', async () => {
    const { svc, burn } = build({
      configGet: (key, def) => {
        if (key === 'LOYALTY_ENABLED') return 'true';
        if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'true';
        if (key === 'LOYALTY_DEFAULT_REDEEM_VALUE') return '0.01';
        if (key === 'POS_GIFT_CARD_MIN_AMOUNT') return '5';
        return def;
      },
    });
    await expect(
      svc.redeemForVoucher({ points: 100, storeId, membershipId, idempotencyKey }),
    ).rejects.toThrow(/below the minimum/);
    expect(burn.processRedemption).not.toHaveBeenCalled();
  });

  it('rejects when computed amount exceeds POS_GIFT_CARD_MAX_AMOUNT', async () => {
    const { svc, burn } = build({
      configGet: (key, def) => {
        if (key === 'LOYALTY_ENABLED') return 'true';
        if (key === 'LOYALTY_POS_VOUCHER_ENABLED') return 'true';
        if (key === 'LOYALTY_DEFAULT_REDEEM_VALUE') return '0.01';
        if (key === 'POS_GIFT_CARD_MAX_AMOUNT') return '3';
        return def;
      },
    });
    await expect(
      svc.redeemForVoucher({ points: 500, storeId, membershipId, idempotencyKey }),
    ).rejects.toThrow(/exceeds the maximum/);
    expect(burn.processRedemption).not.toHaveBeenCalled();
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

    const { svc, adapter, prisma } = build({
      giftCardTransaction,
      getGiftCardByNumber,
      voucherFindUnique,
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        loyaltyRedemption: {
          findUnique: jest.fn().mockResolvedValue({ id: redemptionId, status: 'REVERSED' }),
          update: jest.fn(),
        },
        loyaltyMembership: { update: jest.fn() },
        loyaltyPosVoucher: { update: jest.fn() },
        loyaltyTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
      }),
    );

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

  /**
   * The controller pins storeId for STORE_STAFF, but the retry and idempotent-replay paths
   * used to look a voucher up by id alone and return it — including its cardNumber, which is
   * bearer value spendable at any till. Idempotency keys are client-supplied and predictable
   * (`terminalId:tillSaleRef`), so replay was reachable without knowing a voucher id.
   */
  describe('store scoping on retry and replay', () => {
    const OTHER_STORE = 'store-2';

    /** A voucher that belongs to store-1 and has already been issued. */
    const issuedElsewhere = {
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

    const findIssuedElsewhere = () =>
      jest
        .fn()
        .mockImplementation(({ where }: any) =>
          Promise.resolve(where?.redemptionId ? null : issuedElsewhere),
        );

    it('refuses a direct retry of another store\u2019s voucher', async () => {
      const { svc } = build({ voucherFindUnique: findIssuedElsewhere() });

      await expect(svc.retryFailedVoucher('voucher-1', OTHER_STORE)).rejects.toThrow(
        // Same error as a missing voucher, so existence cannot be probed.
        'Voucher not found',
      );
    });

    it('allows an admin retry with no store scope', async () => {
      const { svc } = build({ voucherFindUnique: findIssuedElsewhere() });

      const result = await svc.retryFailedVoucher('voucher-1');
      expect(result.cardNumber).toBe('ABCD2345EFGH');
    });

    it('refuses redeem-for-voucher retry across stores without leaking the card number', async () => {
      const { svc } = build({ voucherFindUnique: findIssuedElsewhere() });

      const attempt = svc.redeemForVoucher({
        points: 500,
        storeId: OTHER_STORE,
        membershipId,
        voucherId: 'voucher-1',
      });

      await expect(attempt).rejects.toThrow('Voucher not found');
      await expect(attempt).rejects.not.toThrow('ABCD2345EFGH');
    });

    it('refuses an idempotency-key replay that resolves to another store\u2019s voucher', async () => {
      const { svc, prisma } = build({ voucherFindUnique: findIssuedElsewhere() });
      // A prior burn exists for this membership + guessed key, pointing at store-1's voucher.
      prisma.loyaltyTransaction.findUnique.mockResolvedValue({ sourceId: redemptionId });
      prisma.loyaltyPosVoucher.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.redemptionId ? { id: 'voucher-1' } : issuedElsewhere),
      );

      await expect(
        svc.redeemForVoucher({
          points: 500,
          storeId: OTHER_STORE,
          membershipId,
          idempotencyKey,
        }),
      ).rejects.toThrow('Voucher not found');
    });

    it('still serves a replay for the voucher\u2019s own store', async () => {
      const { svc, prisma } = build({ voucherFindUnique: findIssuedElsewhere() });
      prisma.loyaltyTransaction.findUnique.mockResolvedValue({ sourceId: redemptionId });
      prisma.loyaltyPosVoucher.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.redemptionId ? { id: 'voucher-1' } : issuedElsewhere),
      );

      const result = await svc.redeemForVoucher({
        points: 500,
        storeId,
        membershipId,
        idempotencyKey,
      });

      expect(result.status).toBe('ISSUED');
      expect(result.cardNumber).toBe('ABCD2345EFGH');
    });
  });
});
