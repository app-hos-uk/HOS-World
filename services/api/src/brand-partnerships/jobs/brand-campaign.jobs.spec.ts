import { JobType } from '../../queue/queue.service';
import { BrandCampaignJobsService } from './brand-campaign.jobs';

describe('BrandCampaignJobsService', () => {
  it('registers processors and runs activate + expire handlers', async () => {
    const handlers = new Map<string, (job?: unknown) => Promise<unknown>>();
    const queue = {
      registerProcessor: jest.fn((name: JobType, fn: (job?: unknown) => Promise<unknown>) => {
        handlers.set(name, fn);
      }),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn().mockImplementation((_k: string, def?: string) => def ?? '0 * * * *'),
    };
    const brand = {
      runScheduledActivations: jest.fn().mockResolvedValue(2),
      runExpiredAndEndingSoon: jest.fn().mockResolvedValue({ completed: 1, endingNotified: 0 }),
      runReportJob: jest.fn().mockResolvedValue({ ok: true }),
    };
    const svc = new BrandCampaignJobsService(queue as any, config as any, brand as any);
    await svc.onModuleInit();
    expect(queue.registerProcessor).toHaveBeenCalled();
    expect(handlers.get(JobType.BRAND_CAMPAIGN_ACTIVATE)).toBeDefined();
    await handlers.get(JobType.BRAND_CAMPAIGN_ACTIVATE)!();
    expect(brand.runScheduledActivations).toHaveBeenCalled();
    await handlers.get(JobType.BRAND_CAMPAIGN_EXPIRE)!();
    expect(brand.runExpiredAndEndingSoon).toHaveBeenCalled();
    await handlers.get(JobType.BRAND_CAMPAIGN_REPORT)!();
    expect(brand.runReportJob).toHaveBeenCalled();
  });
});
