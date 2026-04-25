import { AmbassadorJobsService } from './ambassador.jobs';
import { JobType } from '../../queue/queue.service';

describe('AmbassadorJobsService', () => {
  it('registers tier review processor and schedules cron', async () => {
    const registerProcessor = jest.fn();
    const addRepeatable = jest.fn().mockResolvedValue(undefined);
    const queue = { registerProcessor, addRepeatable } as any;
    const config = { get: jest.fn((k: string, d: string) => d) } as any;
    const ambassador = {
      runDailyTierGuardsAndProgression: jest.fn().mockResolvedValue(undefined),
      runAchievementCheckAll: jest.fn().mockResolvedValue(undefined),
    } as any;
    const achievements = { checkAndAward: jest.fn().mockResolvedValue(undefined) } as any;

    const jobs = new AmbassadorJobsService(queue, config, ambassador, achievements);
    await jobs.onModuleInit();

    expect(registerProcessor).toHaveBeenCalledWith(
      JobType.AMBASSADOR_TIER_REVIEW,
      expect.any(Function),
    );
    expect(registerProcessor).toHaveBeenCalledWith(
      JobType.AMBASSADOR_ACHIEVEMENT_CHECK,
      expect.any(Function),
    );
    expect(addRepeatable).toHaveBeenCalledWith(
      JobType.AMBASSADOR_TIER_REVIEW,
      {},
      '0 4 * * *',
    );
  });

  it('tier review processor runs daily guard', async () => {
    const handlers = new Map<string, (job: any) => Promise<void>>();
    const queue = {
      registerProcessor: jest.fn((type: string, fn: any) => handlers.set(type, fn)),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    } as any;
    const ambassador = {
      runDailyTierGuardsAndProgression: jest.fn().mockResolvedValue(undefined),
      runAchievementCheckAll: jest.fn(),
    } as any;
    const jobs = new AmbassadorJobsService(
      queue,
      { get: jest.fn((_, d) => d) } as any,
      ambassador,
      { checkAndAward: jest.fn() } as any,
    );
    await jobs.onModuleInit();
    await handlers.get(JobType.AMBASSADOR_TIER_REVIEW)!({} as any);
    expect(ambassador.runDailyTierGuardsAndProgression).toHaveBeenCalled();
  });

  it('achievement processor runs check for single id', async () => {
    const handlers = new Map<string, (job: any) => Promise<void>>();
    const queue = {
      registerProcessor: jest.fn((type: string, fn: any) => handlers.set(type, fn)),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    } as any;
    const achievements = { checkAndAward: jest.fn().mockResolvedValue(undefined) } as any;
    const jobs = new AmbassadorJobsService(
      queue,
      { get: jest.fn((_, d) => d) } as any,
      { runDailyTierGuardsAndProgression: jest.fn(), runAchievementCheckAll: jest.fn() } as any,
      achievements,
    );
    await jobs.onModuleInit();
    await handlers.get(JobType.AMBASSADOR_ACHIEVEMENT_CHECK)!({
      data: { ambassadorId: 'a1' },
    } as any);
    expect(achievements.checkAndAward).toHaveBeenCalledWith('a1');
  });
});
