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
  LOYALTY_TIER_REVIEW = 'loyalty:tier-review',
  LOYALTY_POINTS_EXPIRY = 'loyalty:points-expiry',
  LOYALTY_BIRTHDAY_BONUS = 'loyalty:birthday-bonus',
  FANDOM_PROFILE_RECOMPUTE = 'loyalty:fandom-profile-recompute',
  POS_PRODUCT_SYNC = 'pos:product-sync',
  POS_INVENTORY_SYNC = 'pos:inventory-sync',
  POS_SALE_IMPORT = 'pos:sale-import',
  POS_NIGHTLY_RECON = 'pos:nightly-reconciliation',
  POS_CUSTOMER_SYNC = 'pos:customer-sync',
  POS_SALES_POLL = 'pos:sales-poll',
  JOURNEY_STEP_PROCESS = 'marketing:journey-step-process',
  ABANDONED_CART_SCAN = 'marketing:abandoned-cart-scan',
  INACTIVITY_SCAN = 'marketing:inactivity-scan',
  MESSAGE_SEND = 'marketing:message-send',
  MARKETING_POINTS_EXPIRY_WARNING = 'marketing:points-expiry-warning',
  EVENT_REMINDER = 'events:reminder',
  EVENT_ATTENDANCE_RECONCILE = 'events:attendance-reconcile',
  SEGMENT_REFRESH = 'segmentation:refresh',
  SEGMENT_REFRESH_ALL = 'segmentation:refresh-all',
  AMBASSADOR_TIER_REVIEW = 'ambassador:tier-review',
  AMBASSADOR_ACHIEVEMENT_CHECK = 'ambassador:achievement-check',
  BRAND_CAMPAIGN_ACTIVATE = 'brand:campaign-activate',
  BRAND_CAMPAIGN_EXPIRE = 'brand:campaign-expire',
  BRAND_CAMPAIGN_REPORT = 'brand:campaign-report',
  LOYALTY_ANALYTICS_SNAPSHOT = 'loyalty:analytics-snapshot',
  LOYALTY_CLV_RECOMPUTE = 'loyalty:clv-recompute',
  CAMPAIGN_ATTRIBUTION_COMPUTE = 'loyalty:campaign-attribution',
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
  private dlq: Queue;
  private worker: Worker;
  private processors: Map<JobType, (job: Job) => Promise<any>> = new Map();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('jobs', { connection: this.connection });
    this.dlq = new Queue('jobs-dlq', { connection: this.connection });
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
      if (!job) return;
      const maxAttempts = job.opts?.attempts ?? 3;
      if (job.attemptsMade >= maxAttempts) {
        this.moveToDLQ(job).catch((dlqErr) =>
          this.logger.error(`Failed to move job ${job.id} to DLQ: ${dlqErr.message}`),
        );
      }
      this.logger.error(
        `Job failed: ${job.id} (${job.name}) attempt ${job.attemptsMade}/${maxAttempts} - ${err.message}`,
      );
    });

    this.logger.log('BullMQ worker initialized with exponential backoff and DLQ');
  }

  private async moveToDLQ(job: Job): Promise<void> {
    await this.dlq.add(job.name, job.data, {
      removeOnComplete: false,
      removeOnFail: false,
    });
    this.logger.warn(
      `Job ${job.id} (${job.name}) moved to DLQ after exhausting all retries`,
    );
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
      await this.queue?.close();
      await this.dlq?.close();
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
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 604800 },
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
    const main = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    const dlqCounts = await this.dlq.getJobCounts('waiting', 'failed');
    return { ...main, dlq: dlqCounts.waiting + dlqCounts.failed };
  }

  async getDLQJobs(start = 0, end = 20) {
    return this.dlq.getJobs(['waiting', 'failed'], start, end);
  }

  async retryDLQJob(jobId: string): Promise<boolean> {
    const job = await this.dlq.getJob(jobId);
    if (!job) return false;
    await this.addJob(job.name as JobType, job.data);
    await job.remove();
    this.logger.log(`DLQ job ${jobId} re-queued as ${job.name}`);
    return true;
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

  async addRepeatable(
    jobType: JobType,
    payload: any,
    pattern: string,
  ): Promise<void> {
    await this.queue.add(jobType, payload, {
      repeat: { pattern },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800 },
    });
    this.logger.log(`Registered repeatable job ${jobType} with pattern ${pattern}`);
  }
}
