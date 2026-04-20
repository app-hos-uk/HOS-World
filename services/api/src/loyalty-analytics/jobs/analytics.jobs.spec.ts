import { JobType } from '../../queue/queue.service';
import { AnalyticsJobsService } from './analytics.jobs';

describe('AnalyticsJobsService', () => {
  it('registers and runs snapshot + CLV + attribution handlers', async () => {
    const handlers = new Map<string, () => Promise<unknown>>();
    const queue = {
      registerProcessor: jest.fn((name: JobType, fn: () => Promise<unknown>) => {
        handlers.set(name, fn);
      }),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn().mockImplementation((_k: string, def?: string) => def ?? '0 * * * *'),
    };
    const analytics = {
      computeDailySnapshot: jest.fn().mockResolvedValue({}),
      recomputeAllClv: jest.fn().mockResolvedValue({ computed: 3, errors: 0 }),
      computeAttributionForDate: jest.fn().mockResolvedValue(2),
    };

    const svc = new AnalyticsJobsService(queue as any, config as any, analytics as any);
    await svc.onModuleInit();

    expect(queue.registerProcessor).toHaveBeenCalledTimes(3);
    expect(handlers.get(JobType.LOYALTY_ANALYTICS_SNAPSHOT)).toBeDefined();
    await handlers.get(JobType.LOYALTY_ANALYTICS_SNAPSHOT)!();
    expect(analytics.computeDailySnapshot).toHaveBeenCalled();
    await handlers.get(JobType.LOYALTY_CLV_RECOMPUTE)!();
    expect(analytics.recomputeAllClv).toHaveBeenCalled();
    await handlers.get(JobType.CAMPAIGN_ATTRIBUTION_COMPUTE)!();
    expect(analytics.computeAttributionForDate).toHaveBeenCalled();
  });
});
