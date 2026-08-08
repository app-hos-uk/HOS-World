import { LoyaltyReversalService } from './loyalty-reversal.service';

describe('LoyaltyReversalService', () => {
  const membershipId = 'mem-1';
  const userId = 'user-1';

  function build(overrides: {
    membership?: Record<string, unknown>;
    priorTransactions?: Array<{ source: string; points: number }>;
    applyDelta?: jest.Mock;
  }) {
    const membership = {
      id: membershipId,
      userId,
      currentBalance: 500,
      totalPointsEarned: 1000,
      totalPointsRedeemed: 800,
      ...(overrides.membership ?? {}),
    };

    const membershipUpdate = jest.fn().mockResolvedValue(membership);

    const prisma: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId,
          orderNumber: 'HOS-1',
          total: 100,
          loyaltyPointsEarned: 200,
          loyaltyPointsRedeemed: 300,
          parentOrderId: null,
        }),
      },
      loyaltyMembership: {
        findUnique: jest.fn().mockResolvedValue(membership),
        update: membershipUpdate,
      },
      loyaltyTransaction: {
        findMany: jest.fn().mockResolvedValue(overrides.priorTransactions ?? []),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };

    const applyDelta = overrides.applyDelta ?? jest.fn().mockResolvedValue({ applied: true });
    const wallet: any = {
      applyDelta,
      lockMembership: jest.fn().mockResolvedValue(undefined),
    };

    const settings: any = {
      getResolved: jest.fn().mockResolvedValue({
        settings: {
          clawEarnOnReturn: true,
          restoreBurnOnReturn: true,
          clawEarnOnCancel: true,
          restoreBurnOnCancel: true,
        },
      }),
    };

    const config: any = { get: jest.fn().mockReturnValue('true') };
    const featureFlags: any = { isEnabled: jest.fn().mockReturnValue(true) };
    const tiers: any = { recalculateTier: jest.fn().mockResolvedValue(undefined) };

    const service = new LoyaltyReversalService(
      prisma,
      wallet,
      settings,
      config,
      featureFlags,
      tiers,
    );

    return { service, prisma, wallet, applyDelta, membershipUpdate, tiers };
  }

  describe('onReturnRefunded — earn clawback', () => {
    it('tops up a clawback that an earlier thin balance capped', async () => {
      // Target is 200 points; 50 came back on the first pass.
      const { service, applyDelta } = build({
        priorTransactions: [{ source: 'RETURN_REFUND', points: -50 }],
        membership: { currentBalance: 500 },
      });

      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });

      expect(applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        membershipId,
        -150,
        expect.anything(),
        expect.objectContaining({
          idempotencyKey: 'reverse:RETURN_EARN:ret-1:200:50',
        }),
      );
    });

    it('reuses the same key when Stripe redelivers an identical refund', async () => {
      const { service, applyDelta } = build({ priorTransactions: [] });

      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });
      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });

      const keys = applyDelta.mock.calls
        .map((call) => call[4]?.idempotencyKey)
        .filter((key: string) => key?.startsWith('reverse:RETURN_EARN'));
      expect(keys).toEqual(['reverse:RETURN_EARN:ret-1:200:0', 'reverse:RETURN_EARN:ret-1:200:0']);
    });

    it('claws back only what the member still holds', async () => {
      const { service, applyDelta, membershipUpdate } = build({
        membership: { currentBalance: 40 },
      });

      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });

      const clawCall = applyDelta.mock.calls.find((call) => call[4]?.source === 'RETURN_REFUND');
      expect(clawCall?.[2]).toBe(-40);
      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalPointsEarned: { decrement: 40 } },
        }),
      );
    });
  });

  describe('onReturnRefunded — burn restore', () => {
    it('un-spends the restored points on the lifetime redeemed total', async () => {
      const { service, membershipUpdate } = build({});

      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });

      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalPointsRedeemed: { decrement: 300 } },
        }),
      );
    });

    it('never drives lifetime redeemed below zero', async () => {
      const { service, membershipUpdate } = build({
        membership: { totalPointsRedeemed: 120 },
      });

      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });

      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalPointsRedeemed: { decrement: 120 } },
        }),
      );
    });

    it('leaves the counters alone when the wallet treats the restore as a replay', async () => {
      const applyDelta = jest.fn().mockResolvedValue({ applied: false });
      const { service, membershipUpdate } = build({ applyDelta });

      await service.onReturnRefunded({ returnId: 'ret-1', orderId: 'order-1', refundAmount: 100 });

      expect(membershipUpdate).not.toHaveBeenCalled();
    });
  });
});
