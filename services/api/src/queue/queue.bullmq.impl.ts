import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

export enum JobType {
  EMAIL_NOTIFICATION = 'email-notification',
  IMAGE_PROCESSING = 'image-processing',
  PRODUCT_INDEXING = 'product-indexing',
  PRODUCT_CACHE_WARMUP = 'product-cache-warmup',
  REPORT_GENERATION = 'report-generation',
  SETTLEMENT_CALCULATION = 'settlement-calculation',
  ORDER_CONFIRMATION = 'order-confirmation',
  INVENTORY_SYNC = 'inventory-sync',
  ANALYTICS_UPDATE = 'analytics-update',
  BULK_IMPORT = 'bulk-import',
}

export interface JobOptions {
  delay?: number;
  attempts?: number;
  priority?: number;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: InstanceType<typeof IORedis>;
  private queue: Queue;
  private worker: Worker;
  private processors: Map<JobType, (job: Job) => Promise<any>> = new Map();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // BullMQ requires maxRetriesPerRequest: null when using blocking commands (Worker)
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('jobs', { connection: this.connection });
  }

  async onModuleInit() {
    this.worker = new Worker(
      'jobs',
      async (job: Job) => {
        const jobType = job.name as JobType;
        const processor = this.processors.get(jobType);
        if (!processor) {
          this.logger.warn(`No processor registered for job type: ${jobType}`);
          return null;
        }
        return await processor(job);
      },
      { connection: this.connection, concurrency: 5 },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job completed: ${job.id} (${job.name})`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job failed: ${job?.id} (${job?.name}) - ${err.message}`);
    });

    this.logger.log('BullMQ worker initialized');
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
      await this.queue?.close();
      await this.connection?.quit();
    } catch (e) {
      this.logger.error('Error shutting down queue components', e);
    }
  }

  registerProcessor(jobType: JobType, processor: (job: Job) => Promise<any>): void {
    this.processors.set(jobType, processor);
    this.logger.log(`Registered processor for ${jobType}`);
  }

  async addJob(jobType: JobType, payload: any, options: JobOptions = {}): Promise<string> {
    const job = await this.queue.add(jobType, payload, {
      delay: options.delay,
      attempts: options.attempts || 3,
      priority: options.priority,
      removeOnComplete: { age: 604800 }, // 7 days
      removeOnFail: { age: 604800 },
    });
    this.logger.debug(`Added job ${job.id} (${jobType})`);
    return job.id;
  }

  async addBulk(jobType: JobType, payloads: any[], options: JobOptions = {}): Promise<string[]> {
    const ids: string[] = [];
    for (const payload of payloads) {
      const id = await this.addJob(jobType, payload, options);
      ids.push(id);
    }
    return ids;
  }

  async getJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }

  async getQueueStats() {
    return await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
  }

  // Convenience methods
  async queueEmail(to: string, subject: string, template: string, data: any) {
    return this.addJob(JobType.EMAIL_NOTIFICATION, { to, subject, template, data });
  }

  async queueProductIndex(productId: string, action: 'create' | 'update' | 'delete') {
    return this.addJob(JobType.PRODUCT_INDEXING, { productId, action });
  }

  async queueOrderConfirmation(orderId: string, customerEmail: string) {
    return this.addJob(JobType.ORDER_CONFIRMATION, { orderId, customerEmail });
  }

  async queueImageProcessing(imageUrl: string, transformations: any) {
    return this.addJob(JobType.IMAGE_PROCESSING, { imageUrl, transformations });
  }

  async queueReportGeneration(reportType: string, params: any) {
    return this.addJob(JobType.REPORT_GENERATION, { reportType, params });
  }

  async queueBulkImport(payload: any) {
    return this.addJob(JobType.BULK_IMPORT, payload);
  }
}
