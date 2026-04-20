import { SegmentJobsService } from './segment.jobs';
import { JobType } from '../../queue/queue.service';

describe('SegmentJobsService', () => {
  it('registers processors and schedules cron', async () => {
    const queue = {
      registerProcessor: jest.fn(),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    };
    const config = { get: jest.fn((k: string, def: string) => (k === 'SEGMENT_REFRESH_CRON' ? '0 3 * * *' : def)) };
    const segmentation = {
      evaluateSegment: jest.fn().mockResolvedValue(undefined),
      evaluateAllActive: jest.fn().mockResolvedValue({ evaluated: 1, errors: 0 }),
    };
    const jobs = new SegmentJobsService(queue as any, config as any, segmentation as any);
    await jobs.onModuleInit();
    expect(queue.registerProcessor).toHaveBeenCalledWith(JobType.SEGMENT_REFRESH, expect.any(Function));
    expect(queue.registerProcessor).toHaveBeenCalledWith(JobType.SEGMENT_REFRESH_ALL, expect.any(Function));
    expect(queue.addRepeatable).toHaveBeenCalledWith(JobType.SEGMENT_REFRESH_ALL, {}, '0 3 * * *');
  });

  it('SEGMENT_REFRESH processor evaluates segment', async () => {
    const processors = new Map<string, (job: any) => Promise<void>>();
    const queue = {
      registerProcessor: jest.fn((type: string, fn: any) => processors.set(type, fn)),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    };
    const config = { get: jest.fn(() => '0 3 * * *') };
    const segmentation = { evaluateSegment: jest.fn().mockResolvedValue(undefined), evaluateAllActive: jest.fn() };
    const jobs = new SegmentJobsService(queue as any, config as any, segmentation as any);
    await jobs.onModuleInit();
    await processors.get(JobType.SEGMENT_REFRESH)!({ data: { segmentId: 's1' } });
    expect(segmentation.evaluateSegment).toHaveBeenCalledWith('s1');
  });

  it('SEGMENT_REFRESH_ALL processor runs evaluateAllActive', async () => {
    const processors = new Map<string, () => Promise<void>>();
    const queue = {
      registerProcessor: jest.fn((type: string, fn: any) => processors.set(type, fn)),
      addRepeatable: jest.fn().mockResolvedValue(undefined),
    };
    const config = { get: jest.fn(() => '0 3 * * *') };
    const segmentation = { evaluateSegment: jest.fn(), evaluateAllActive: jest.fn().mockResolvedValue({ evaluated: 2, errors: 0 }) };
    const jobs = new SegmentJobsService(queue as any, config as any, segmentation as any);
    await jobs.onModuleInit();
    await processors.get(JobType.SEGMENT_REFRESH_ALL)!();
    expect(segmentation.evaluateAllActive).toHaveBeenCalled();
  });
});
