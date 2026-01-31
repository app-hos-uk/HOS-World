import { Test, TestingModule } from '@nestjs/testing';
import { QueueService, JobType } from './queue.service';

const mockConnection = {
  quit: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  getJobCounts: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockWorker = {
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockConnection),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue),
  Worker: jest.fn().mockImplementation(() => mockWorker),
}));

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueService],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('onModuleInit', () => {
    it('should initialize worker', async () => {
      await service.onModuleInit();
      const { Worker } = require('bullmq');
      expect(Worker).toHaveBeenCalledWith(
        'jobs',
        expect.any(Function),
        expect.objectContaining({ connection: expect.anything(), concurrency: 5 }),
      );
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue successfully', async () => {
      const payload = { to: 'test@example.com', subject: 'Test', template: 'welcome', data: {} };
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      const jobId = await service.addJob(JobType.EMAIL_NOTIFICATION, payload, {});

      expect(mockQueue.add).toHaveBeenCalledWith(
        JobType.EMAIL_NOTIFICATION,
        payload,
        expect.objectContaining({
          attempts: 3,
          removeOnComplete: { age: 604800 },
          removeOnFail: { age: 604800 },
        }),
      );
      expect(jobId).toBe('job-123');
    });

    it('should pass options to add', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-456' });

      await service.addJob(JobType.PRODUCT_INDEXING, { productId: 'p1', action: 'create' }, {
        delay: 1000,
        attempts: 5,
        priority: 1,
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        JobType.PRODUCT_INDEXING,
        { productId: 'p1', action: 'create' },
        expect.objectContaining({
          delay: 1000,
          attempts: 5,
          priority: 1,
        }),
      );
    });
  });

  describe('getJob', () => {
    it('should return job info when job exists', async () => {
      const mockJob = {
        id: 'job-123',
        name: JobType.EMAIL_NOTIFICATION,
        data: { to: 'test@example.com' },
        attemptsMade: 0,
        timestamp: 12345,
        processedOn: 12346,
        finishedOn: 12347,
        failedReason: null,
        returnvalue: { ok: true },
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJob('job-123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(result).toEqual({
        id: 'job-123',
        name: JobType.EMAIL_NOTIFICATION,
        data: { to: 'test@example.com' },
        attemptsMade: 0,
        timestamp: 12345,
        processedOn: 12346,
        finishedOn: 12347,
        failedReason: null,
        returnvalue: { ok: true },
      });
    });

    it('should return null when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJob('missing');

      expect(result).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue counts', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
      });

      const stats = await service.getQueueStats();

      expect(mockQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
      );
      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should close worker, queue and connection', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockConnection.quit).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    it('queueEmail should call addJob with email payload', async () => {
      mockQueue.add.mockResolvedValue({ id: 'email-1' });

      await service.queueEmail('u@example.com', 'Hi', 'welcome', { name: 'User' });

      expect(mockQueue.add).toHaveBeenCalledWith(
        JobType.EMAIL_NOTIFICATION,
        { to: 'u@example.com', subject: 'Hi', template: 'welcome', data: { name: 'User' } },
        expect.any(Object),
      );
    });

    it('queueProductIndex should call addJob with product payload', async () => {
      mockQueue.add.mockResolvedValue({ id: 'idx-1' });

      await service.queueProductIndex('product-id', 'update');

      expect(mockQueue.add).toHaveBeenCalledWith(
        JobType.PRODUCT_INDEXING,
        { productId: 'product-id', action: 'update' },
        expect.any(Object),
      );
    });
  });
});
