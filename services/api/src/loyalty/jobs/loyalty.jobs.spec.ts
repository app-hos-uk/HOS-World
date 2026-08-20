import { LoyaltyTxType } from '@prisma/client';
import { JobType } from '../../queue/queue.service';
import { LoyaltyJobsService } from './loyalty.jobs';

type Processor = () => Promise<unknown>;

describe('LoyaltyJobsService points expiry', () => {
  const processors = new Map<string, Processor>();

  const queue = {
    registerProcessor: jest.fn((type: string, fn: Processor) => {
      processors.set(type, fn);
    }),
    addRepeatable: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    loyaltyTransaction: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    loyaltyMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const wallet = { applyDelta: jest.fn().mockResolvedValue({ applied: true }) };
  const settings = { getResolved: jest.fn() };

  const posVouchers = { expireUnusedVouchers: jest.fn().mockResolvedValue(0) };
  const posOtp = { purgeExpired: jest.fn().mockResolvedValue(0) };

  async function runExpiry(opts: {
    expirable: Array<{ id: string; membershipId: string; points: number; createdAt: Date }>;
    agedCredits: number;
    debits: number;
    balance: number;
    expiryMonths?: number;
  }) {
    processors.clear();
    jest.clearAllMocks();

    settings.getResolved.mockResolvedValue({
      settings: { pointsExpiryMonths: opts.expiryMonths ?? 12 },
      source: 'database',
    });
    prisma.loyaltyTransaction.findMany.mockResolvedValue(opts.expirable);
    prisma.loyaltyTransaction.aggregate.mockImplementation(async ({ where }: any) =>
      where?.points?.gt !== undefined
        ? { _sum: { points: opts.agedCredits } }
        : { _sum: { points: -Math.abs(opts.debits) } },
    );
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ currentBalance: opts.balance });

    const service = new LoyaltyJobsService(
      queue as any,
      prisma as any,
      { recalculateTier: jest.fn() } as any,
      wallet as any,
      { get: (key: string) => (key === 'LOYALTY_ENABLED' ? 'true' : undefined) } as any,
      { isEnabled: () => true } as any,
      { recomputeAll: jest.fn() } as any,
      settings as any,
      posVouchers as any,
      posOtp as any,
    );

    await service.onModuleInit();
    const processor = processors.get(JobType.LOYALTY_POINTS_EXPIRY);
    expect(processor).toBeDefined();
    await processor!();
  }

  const oldEarn = {
    id: 'tx-old',
    membershipId: 'member-1',
    points: 500,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  it('expires only the aged points that were never spent', async () => {
    // Earned 500 long ago plus 500 recently, spent 300 → only 200 of the old
    // earn is still unspent, so expiring the full 500 would take points twice.
    await runExpiry({ expirable: [oldEarn], agedCredits: 500, debits: 300, balance: 700 });

    expect(wallet.applyDelta).toHaveBeenCalledTimes(1);
    expect(wallet.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      'member-1',
      -200,
      LoyaltyTxType.EXPIRE,
      expect.objectContaining({ idempotencyKey: 'expire:tx-old' }),
    );
    expect(prisma.loyaltyTransaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-old' },
      data: { expiresAt: expect.any(Date) },
    });
  });

  it('stamps a fully spent earn without debiting so it is not rescanned forever', async () => {
    await runExpiry({ expirable: [oldEarn], agedCredits: 500, debits: 500, balance: 200 });

    expect(wallet.applyDelta).not.toHaveBeenCalled();
    expect(prisma.loyaltyTransaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-old' },
      data: { expiresAt: expect.any(Date) },
    });
  });

  it('never expires more than the live balance', async () => {
    await runExpiry({ expirable: [oldEarn], agedCredits: 500, debits: 0, balance: 120 });

    expect(wallet.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      'member-1',
      -120,
      LoyaltyTxType.EXPIRE,
      expect.anything(),
    );
  });

  it('spends the budget oldest-first across several earns', async () => {
    const newerEarn = {
      id: 'tx-newer',
      membershipId: 'member-1',
      points: 300,
      createdAt: new Date('2024-06-01T00:00:00.000Z'),
    };
    await runExpiry({
      expirable: [oldEarn, newerEarn],
      agedCredits: 800,
      debits: 400,
      balance: 900,
    });

    const amounts = wallet.applyDelta.mock.calls.map((call) => call[2]);
    expect(amounts).toEqual([-400]);
    expect(prisma.loyaltyTransaction.update).toHaveBeenCalledTimes(2);
  });

  it('skips the sweep when expiry is disabled in settings', async () => {
    await runExpiry({
      expirable: [oldEarn],
      agedCredits: 500,
      debits: 0,
      balance: 500,
      expiryMonths: 0,
    });

    expect(prisma.loyaltyTransaction.findMany).not.toHaveBeenCalled();
    expect(wallet.applyDelta).not.toHaveBeenCalled();
  });
});

describe('LoyaltyJobsService birthday bonus', () => {
  const processors = new Map<string, Processor>();

  const queue = {
    registerProcessor: jest.fn((type: string, fn: Processor) => {
      processors.set(type, fn);
    }),
    addRepeatable: jest.fn().mockResolvedValue(undefined),
  };

  async function runBirthday(opts: { alreadyAwardedThisYear: number; inTxDuplicate?: number }) {
    processors.clear();
    jest.clearAllMocks();

    const today = new Date();
    const membershipUpdate = jest.fn();
    const wallet = {
      applyDelta: jest.fn().mockResolvedValue({ applied: true }),
      lockMembership: jest.fn().mockResolvedValue(undefined),
    };
    const prisma: any = {
      loyaltyEarnRule: { findUnique: jest.fn().mockResolvedValue(null) },
      loyaltyTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(opts.alreadyAwardedThisYear),
      },
      loyaltyMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'member-1',
            userId: 'user-1',
            birthday: null,
            user: { firstName: 'Ada', birthday: today },
          },
        ]),
        findUnique: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn(async (fn: any) =>
      fn({
        loyaltyTransaction: {
          count: jest.fn().mockResolvedValue(opts.inTxDuplicate ?? 0),
        },
        loyaltyMembership: { update: membershipUpdate },
      }),
    );

    const service = new LoyaltyJobsService(
      queue as any,
      prisma as any,
      { recalculateTier: jest.fn() } as any,
      wallet as any,
      {
        get: (key: string, fallback?: unknown) =>
          key === 'LOYALTY_ENABLED' ? 'true' : (fallback as any),
      } as any,
      { isEnabled: () => true } as any,
      { recomputeAll: jest.fn() } as any,
      { getResolved: jest.fn().mockResolvedValue({ settings: { pointsExpiryMonths: 0 } }) } as any,
      { expireUnusedVouchers: jest.fn().mockResolvedValue(0) } as any,
      { purgeExpired: jest.fn().mockResolvedValue(0) } as any,
    );

    await service.onModuleInit();
    const processor = processors.get(JobType.LOYALTY_BIRTHDAY_BONUS);
    expect(processor).toBeDefined();
    await processor!();
    return { wallet, membershipUpdate, year: today.getUTCFullYear() };
  }

  it('awards with a per-year idempotency key', async () => {
    const { wallet, membershipUpdate, year } = await runBirthday({ alreadyAwardedThisYear: 0 });

    expect(wallet.applyDelta).toHaveBeenCalledWith(
      expect.anything(),
      'member-1',
      200,
      LoyaltyTxType.BONUS,
      expect.objectContaining({ idempotencyKey: `bonus:BIRTHDAY:member-1:${year}` }),
    );
    expect(membershipUpdate).toHaveBeenCalled();
  });

  it('does not award twice in the same year', async () => {
    const { wallet } = await runBirthday({ alreadyAwardedThisYear: 1 });
    expect(wallet.applyDelta).not.toHaveBeenCalled();
  });

  it('re-checks inside the transaction so a concurrent run cannot double-award', async () => {
    const { wallet, membershipUpdate } = await runBirthday({
      alreadyAwardedThisYear: 0,
      inTxDuplicate: 1,
    });
    expect(wallet.applyDelta).not.toHaveBeenCalled();
    expect(membershipUpdate).not.toHaveBeenCalled();
  });
});
