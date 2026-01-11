import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueService, JobType } from './queue.service';
import { RedisService } from '../cache/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';
import { PrismaService } from '../database/prisma.service';

// Mock BullMQ - use manual mocks to avoid module resolution issues
const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  close: jest.fn(),
  getWaitingCount: jest.fn().mockResolvedValue(0),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getCompletedCount: jest.fn().mockResolvedValue(0),
  getFailedCount: jest.fn().mockResolvedValue(0),
  getDelayedCount: jest.fn().mockResolvedValue(0),
};

const mockWorker = {
  on: jest.fn(),
  close: jest.fn(),
};

jest.mock('bullmq', () => {
  const mockQueueConstructor = jest.fn().mockImplementation(() => mockQueue);
  const mockWorkerConstructor = jest.fn().mockImplementation(() => mockWorker);
  return {
    Queue: mockQueueConstructor,
    Worker: mockWorkerConstructor,
  };
});

// Import after mocks are set up
import { Queue } from 'bullmq';

describe('QueueService', () => {
  let service: QueueService;
  let configService: ConfigService;
  let redisService: RedisService;
  let notificationsService: NotificationsService;
  let searchService: SearchService;
  let prismaService: PrismaService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'REDIS_URL') return 'redis://localhost:6379';
      return undefined;
    }),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({}),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockNotificationsService = {
    sendSellerInvitation: jest.fn(),
    sendOrderConfirmation: jest.fn(),
    sendOrderShipped: jest.fn(),
    sendOrderDelivered: jest.fn(),
  };

  const mockSearchService = {
    deleteProduct: jest.fn(),
    indexProduct: jest.fn(),
  };

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    searchService = module.get<SearchService>(SearchService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize queues and workers', async () => {
      await service.onModuleInit();
      
      // Verify queues are initialized
      expect(Queue).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock Queue to throw error
      const { Queue } = require('bullmq');
      (Queue as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue successfully', async () => {
      const mockJob = {
        id: 'job-123',
      };
      const mockQueue = {
        add: jest.fn().mockResolvedValue(mockJob),
      };
      
      // Access private queues map through reflection or make it testable
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      const jobId = await service.addJob(JobType.EMAIL_NOTIFICATION, {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockQueue.add).toHaveBeenCalled();
      expect(jobId).toBe('job-123');
    });

    it('should fallback to Redis storage if queue fails', async () => {
      const mockQueue = {
        add: jest.fn().mockRejectedValue(new Error('Queue error')),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      const jobId = await service.addJob(JobType.EMAIL_NOTIFICATION, {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockRedisService.set).toHaveBeenCalled();
      expect(jobId).toContain('job-');
    });
  });

  describe('getJobStatus', () => {
    it('should get job status from queue', async () => {
      const mockJob = {
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        data: { test: 'data' },
        returnvalue: { result: 'success' },
        failedReason: null,
        timestamp: Date.now(),
        processedOn: Date.now(),
        finishedOn: Date.now(),
      };
      
      const mockQueue = {
        getJob: jest.fn().mockResolvedValue(mockJob),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      const status = await service.getJobStatus('job-123', JobType.EMAIL_NOTIFICATION);

      expect(status).toHaveProperty('id', 'job-123');
      expect(status).toHaveProperty('status', 'completed');
      expect(status).toHaveProperty('progress', 100);
    });

    it('should check Redis fallback if job not found in queue', async () => {
      const mockQueue = {
        getJob: jest.fn().mockResolvedValue(null),
      };
      
      const mockJobData = JSON.stringify({
        type: JobType.EMAIL_NOTIFICATION,
        payload: { test: 'data' },
      });
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);
      mockRedisService.get.mockResolvedValue(mockJobData);

      const status = await service.getJobStatus('job-123', JobType.EMAIL_NOTIFICATION);

      expect(mockRedisService.get).toHaveBeenCalledWith('job:job-123');
      expect(status).toHaveProperty('status', 'pending');
    });
  });

  describe('getQueueStats', () => {
    it('should get queue statistics', async () => {
      const mockQueue = {
        getWaitingCount: jest.fn().mockResolvedValue(5),
        getActiveCount: jest.fn().mockResolvedValue(2),
        getCompletedCount: jest.fn().mockResolvedValue(100),
        getFailedCount: jest.fn().mockResolvedValue(3),
        getDelayedCount: jest.fn().mockResolvedValue(1),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      const stats = await service.getQueueStats(JobType.EMAIL_NOTIFICATION);

      expect(stats).toHaveProperty('waiting', 5);
      expect(stats).toHaveProperty('active', 2);
      expect(stats).toHaveProperty('completed', 100);
      expect(stats).toHaveProperty('failed', 3);
      expect(stats).toHaveProperty('delayed', 1);
      expect(stats).toHaveProperty('total', 111);
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job', async () => {
      const mockJob = {
        id: 'job-123',
        retry: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockQueue = {
        getJob: jest.fn().mockResolvedValue(mockJob),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      await service.retryJob('job-123', JobType.EMAIL_NOTIFICATION);

      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should throw error if job not found', async () => {
      const mockQueue = {
        getJob: jest.fn().mockResolvedValue(null),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      await expect(
        service.retryJob('job-123', JobType.EMAIL_NOTIFICATION),
      ).rejects.toThrow('Job not found');
    });
  });

  describe('removeJob', () => {
    it('should remove a job from queue', async () => {
      const mockJob = {
        id: 'job-123',
        remove: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockQueue = {
        getJob: jest.fn().mockResolvedValue(mockJob),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      await service.removeJob('job-123', JobType.EMAIL_NOTIFICATION);

      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should handle job not found gracefully', async () => {
      const mockQueue = {
        getJob: jest.fn().mockResolvedValue(null),
      };
      
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      await expect(
        service.removeJob('job-123', JobType.EMAIL_NOTIFICATION),
      ).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all workers and queues', async () => {
      const mockWorker = {
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockQueue = {
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      (service as any).workers.set(JobType.EMAIL_NOTIFICATION, mockWorker);
      (service as any).queues.set(JobType.EMAIL_NOTIFICATION, mockQueue);

      await service.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
