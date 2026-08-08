import { JobType } from '../../queue/queue.service';
import { MarketingJobsService } from './marketing.jobs';

type Processor = () => Promise<unknown>;

/**
 * The warning scan must use the same expiry horizon as the sweep, otherwise
 * members are warned about points that are not expiring (or never warned).
 */
describe('Points expiry warning scan horizon', () => {
  const DAY = 24 * 60 * 60 * 1000;

  async function run(opts: { settingsMonths?: number; envMonths?: number; earnedDaysAgo: number }) {
    const processors = new Map<string, Processor>();
    const queue = {
      registerProcessor: jest.fn((type: string, fn: Processor) => processors.set(type, fn)),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      loyaltyTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            points: 300,
            membershipId: 'mem-1',
            createdAt: new Date(Date.now() - opts.earnedDaysAgo * DAY),
            membership: { userId: 'user-1', user: { id: 'user-1' } },
          },
        ]),
      },
      journeyEnrollment: { findFirst: jest.fn().mockResolvedValue(null) },
      cart: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const bus = { emit: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'LOYALTY_POINTS_EXPIRY_MONTHS' ? (opts.envMonths ?? fallback) : fallback,
      ),
    };
    const settings =
      opts.settingsMonths === undefined
        ? undefined
        : {
            getResolved: jest.fn().mockResolvedValue({
              settings: { pointsExpiryMonths: opts.settingsMonths },
              source: 'database',
            }),
          };

    const service = new MarketingJobsService(
      queue as any,
      prisma as any,
      config as any,
      { processDueEnrollments: jest.fn().mockResolvedValue(0) } as any,
      bus as any,
      settings as any,
    );
    await service.onModuleInit();

    const processor = processors.get(JobType.MARKETING_POINTS_EXPIRY_WARNING);
    expect(processor).toBeDefined();
    await processor!();
    return { prisma, bus, settings };
  }

  it('warns on the horizon configured in admin Settings', async () => {
    const { bus, settings } = await run({ settingsMonths: 12, earnedDaysAgo: 350 });

    expect(settings!.getResolved).toHaveBeenCalled();
    expect(bus.emit).toHaveBeenCalledWith(
      'POINTS_EXPIRY_WARNING',
      'user-1',
      expect.objectContaining({ expiringPoints: 300, membershipId: 'mem-1' }),
    );
  });

  it('stays silent when Settings disable expiry even though env still has a value', async () => {
    const { prisma, bus } = await run({ settingsMonths: 0, envMonths: 24, earnedDaysAgo: 350 });

    expect(prisma.loyaltyTransaction.findMany).not.toHaveBeenCalled();
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it('does not warn when the points are nowhere near expiry', async () => {
    const { bus } = await run({ settingsMonths: 24, earnedDaysAgo: 350 });
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it('falls back to the env horizon when settings are unavailable', async () => {
    const { bus } = await run({ envMonths: 12, earnedDaysAgo: 350 });
    expect(bus.emit).toHaveBeenCalled();
  });
});
