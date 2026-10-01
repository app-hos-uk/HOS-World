import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PosPromoCodeService } from './pos-promo-code.service';

describe('PosPromoCodeService', () => {
  const membershipId = 'mem-1';
  const storeId = 'store-1';
  const redemptionId = 'red-1';
  const idempotencyKey = 'till-1:sale-4821';

  function build(overrides: {
    createPromotion?: jest.Mock;
    processRedemption?: jest.Mock;
    voucherCreate?: jest.Mock;
    voucherFindUnique?: jest.Mock;
    voucherUpdate?: jest.Mock;
  }) {
    const adapter = {
      authenticate: jest.fn().mockResolvedValue(undefined),
      createPromotion:
        overrides.createPromotion ??
        jest.fn().mockResolvedValue({ id: 'promo-ls-1', name: 'HOS Loyalty', status: 'active' }),
      getPromotion: jest.fn().mockResolvedValue(null),
      archivePromotion: jest.fn().mockResolvedValue({ id: 'promo-ls-1', status: 'archived' }),
    };

    const voucherRow = {
      id: 'voucher-1',
      membershipId,
      redemptionId,
      storeId,
      type: 'PROMO_CODE',
      cardNumber: 'HOS-LYL-ABCD2345',
      promoCode: 'HOS-LYL-ABCD2345',
      amount: new Decimal('5.00'),
      currency: 'GBP',
      clientId: redemptionId,
      status: 'PENDING',
      ttlExpiresAt: new Date(Date.now() + 3_600_000),
      redemption: { pointsSpent: 500, status: 'COMPLETED' },
      store: {
        timezone: 'America/New_York',
        posConnection: {
          isActive: true,
          provider: 'lightspeed',
          credentials: 'enc',
          externalOutletId: 'outlet-1',
        },
      },
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
            externalOutletId: 'outlet-1',
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
          jest.fn().mockImplementation(({ where }: any) =>
            Promise.resolve(where?.redemptionId ? null : { ...voucherRow }),
          ),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      loyaltyTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ storeId }) },
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
        }),
      ),
    };

    const config: any = {
      get: jest.fn((key: string, def?: unknown) => {
        if (key === 'LOYALTY_ENABLED') return 'true';
        return def;
      }),
    };
    const featureFlags: any = { isEnabled: jest.fn().mockReturnValue(true) };
    const burn: any = {
      processRedemption:
        overrides.processRedemption ?? jest.fn().mockResolvedValue({ redemptionId }),
    };
    const wallet: any = {
      applyDelta: jest.fn().mockResolvedValue({ applied: true }),
    };
    const factory: any = { create: jest.fn().mockReturnValue(adapter) };
    const encryption: any = {
      decryptJson: jest.fn().mockReturnValue({ domainPrefix: 'demo', accessToken: 't' }),
    };
    const loyaltySettings: any = {
      getResolved: jest.fn().mockResolvedValue({
        settings: {
          posVoucherEnabled: true,
          posRedemptionMethod: 'PROMO_CODE',
          defaultRedeemValue: 0.01,
          posVoucherMinAmount: 1,
          posVoucherMaxAmount: 500,
        },
      }),
    };
    const platformRegion: any = { getCurrency: jest.fn().mockResolvedValue('GBP') };

    const metrics: any = { incrementCounter: jest.fn() };

    const svc = new PosPromoCodeService(
      prisma,
      config,
      featureFlags,
      burn,
      wallet,
      factory,
      encryption,
      loyaltySettings,
      platformRegion,
      metrics,
    );
    return { svc, adapter, prisma, burn, wallet };
  }

  it('generates HOS-LYL- promo codes', () => {
    const { svc } = build({});
    const code = svc.generatePromoCode();
    expect(code).toMatch(/^HOS-LYL-[A-Z0-9]{8}$/);
  });

  it('toLightspeedTime strips millis and Z, and backdates when requested', () => {
    const { svc } = build({});
    const d = new Date('2026-10-01T14:30:00.123Z');
    expect(svc.toLightspeedTime(d)).toBe('2026-10-01T14:30:00');
    expect(svc.toLightspeedTime(d, 5 * 60 * 1000)).toBe('2026-10-01T14:25:00');
  });

  it('toLightspeedTime converts to store local timezone when provided', () => {
    const { svc } = build({});
    const d = new Date('2026-10-01T14:30:00.000Z');
    expect(svc.toLightspeedTime(d, 0, 'America/New_York')).toBe('2026-10-01T10:30:00');
    expect(svc.toLightspeedTime(d, 0, 'Europe/London')).toBe('2026-10-01T15:30:00');
    expect(svc.toLightspeedTime(d, 5 * 60 * 1000, 'America/New_York')).toBe('2026-10-01T10:25:00');
  });

  it('burns points and creates a Lightspeed promotion with start time in store timezone', async () => {
    const { svc, adapter, burn } = build({});
    const result = await svc.redeemForPromoCode({
      points: 500,
      storeId,
      membershipId,
      idempotencyKey,
    });
    expect(burn.processRedemption).toHaveBeenCalled();
    expect(adapter.createPromotion).toHaveBeenCalledWith(
      expect.objectContaining({
        promoCode: 'HOS-LYL-ABCD2345',
        discountValue: 5,
        loyaltyMultiplier: 0,
        promoCodeLimit: 1,
      }),
    );
    const call = adapter.createPromotion.mock.calls[0][0];
    const startLocal = call.startTime;
    const endLocal = call.endTime;
    expect(startLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(endLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

    const nowNY = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
    );
    const startDate = new Date(startLocal);
    expect(startDate.getTime()).toBeLessThanOrEqual(nowNY.getTime());

    expect(result.type).toBe('PROMO_CODE');
    expect(result.status).toBe('ISSUED');
    expect(result.promoCode).toBe('HOS-LYL-ABCD2345');
  });

  it('rejects a new redemption without an idempotency key', async () => {
    const { svc, burn } = build({});
    await expect(
      svc.redeemForPromoCode({ points: 500, storeId, membershipId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(burn.processRedemption).not.toHaveBeenCalled();
  });

  it('restores points when Lightspeed promotion create fails', async () => {
    const { svc, wallet } = build({
      createPromotion: jest.fn().mockRejectedValue(new Error('Lightspeed API 403: not authorized')),
    });
    await expect(
      svc.redeemForPromoCode({
        points: 500,
        storeId,
        membershipId,
        idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(wallet.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      membershipId,
      500,
      expect.anything(),
      expect.objectContaining({ source: 'POS_VOUCHER_REVERSAL' }),
    );
  });

  it('does not restore points if Lightspeed created the promo but HOS persist fails', async () => {
    const voucherUpdate = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue({
        id: 'voucher-1',
        type: 'PROMO_CODE',
        externalPromotionId: 'promo-ls-1',
        redemption: { pointsSpent: 500 },
      });
    const { svc, wallet } = build({ voucherUpdate });
    await expect(
      svc.redeemForPromoCode({
        points: 500,
        storeId,
        membershipId,
        idempotencyKey,
      }),
    ).rejects.toThrow(/Points were not restored/);
    expect(wallet.applyDelta).not.toHaveBeenCalled();
    expect(voucherUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalPromotionId: 'promo-ls-1' }),
      }),
    );
  });
});
