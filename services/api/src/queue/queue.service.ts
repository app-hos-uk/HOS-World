import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { RedisService } from '../cache/redis.service';

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
}

export interface Job<T = any> {
  id: string;
  type: JobType;
  payload: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;  // Stored priority for retry consistency
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export interface JobOptions {
  delay?: number;         // Delay in ms before processing
  attempts?: number;      // Max retry attempts
  priority?: number;      // Higher = processed first
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  priority: 0,
  removeOnComplete: false,
  removeOnFail: false,
};

/**
 * Parse a job from JSON string, properly converting date strings back to Date objects.
 * JSON.parse() deserializes dates as ISO strings, so we need to convert them back.
 */
function parseJobFromJson(jsonString: string): Job {
  const job = JSON.parse(jsonString);
  
  // Convert date strings back to Date objects
  if (job.createdAt) {
    job.createdAt = new Date(job.createdAt);
  }
  if (job.processedAt) {
    job.processedAt = new Date(job.processedAt);
  }
  if (job.completedAt) {
    job.completedAt = new Date(job.completedAt);
  }
  
  return job as Job;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private isProcessing = false;
  private isProcessingJob = false; // Lock to prevent concurrent job processing within this process
  private processingInterval: NodeJS.Timeout | null = null;
  private redisCheckInterval: NodeJS.Timeout | null = null;
  private readonly QUEUE_KEY = 'job-queue';
  private readonly PROCESSING_KEY = 'job-processing';
  private readonly COMPLETED_KEY = 'job-completed';
  private readonly FAILED_KEY = 'job-failed';
  private readonly JOB_LOCK_PREFIX = 'job-lock:'; // Distributed lock prefix
  private readonly JOB_LOCK_TTL = 300; // 5 minutes lock TTL to prevent deadlocks
  private processors: Map<JobType, (job: Job) => Promise<any>> = new Map();
  
  // Unique worker ID for this instance (used for distributed locking)
  private readonly workerId = `worker-${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Priority counter to ensure deterministic ordering within the same millisecond
  // Increments for each job added, wraps at 999999 to stay within safe floating point precision
  private priorityCounter = 0;
  
  // In-memory job storage for fallback when Redis is not connected
  // This ensures job state is preserved even without Redis
  private inMemoryJobs: Map<string, Job> = new Map();
  private readonly IN_MEMORY_JOB_TTL = 3600000; // 1 hour TTL for in-memory jobs

  // Flag to track if external processors have been registered
  // This helps identify when stub processors are being used in production
  private externalProcessorsRegistered: Set<JobType> = new Set();

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // Register default processors
    this.registerDefaultProcessors();
    
    // Start processing jobs if Redis is already connected
    if (this.redisService.isRedisConnected()) {
      this.startProcessing();
      this.logger.log('Queue service initialized with Redis backend');
    } else {
      // Redis connects asynchronously in the background, so we need to poll
      // for connection readiness rather than assuming it's unavailable
      this.logger.log('Waiting for Redis connection...');
      this.waitForRedisConnection();
    }
  }

  /**
   * Poll for Redis connection readiness.
   * RedisService connects asynchronously, so we check periodically until connected
   * or give up after a timeout.
   */
  private waitForRedisConnection(): void {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds (50 * 100ms)

    this.redisCheckInterval = setInterval(() => {
      attempts++;

      if (this.redisService.isRedisConnected()) {
        // Redis is now connected, start processing
        if (this.redisCheckInterval) {
          clearInterval(this.redisCheckInterval);
          this.redisCheckInterval = null;
        }
        this.startProcessing();
        this.logger.log('Queue service initialized with Redis backend (delayed connection)');
      } else if (attempts >= maxAttempts) {
        // Give up waiting
        if (this.redisCheckInterval) {
          clearInterval(this.redisCheckInterval);
          this.redisCheckInterval = null;
        }
        this.logger.warn('Queue service running without Redis - jobs will not be persisted');
      }
    }, 100);
  }

  async onModuleDestroy() {
    this.stopProcessing();
  }

  /**
   * Register a job processor
   */
  registerProcessor(jobType: JobType, processor: (job: Job) => Promise<any>): void {
    this.processors.set(jobType, processor);
    this.logger.debug(`Registered processor for ${jobType}`);
  }

  /**
   * Add job to queue
   */
  async addJob<T>(
    jobType: JobType,
    payload: T,
    options: JobOptions = {},
  ): Promise<string> {
    const opts = { ...DEFAULT_JOB_OPTIONS, ...options };
    
    const job: Job<T> = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: jobType,
      payload,
      status: 'pending',
      priority: opts.priority || 0,  // Store priority for retry consistency
      attempts: 0,
      maxAttempts: opts.attempts || 3,
      createdAt: new Date(),
    };

    if (this.redisService.isRedisConnected()) {
      // Calculate score for sorted set
      // Score = processAt timestamp with sub-millisecond adjustments for priority and ordering
      // 
      // Structure: processAt + priorityAdjustment (0.000-0.999) + counterAdjustment (0.000000001-0.000999999)
      // - Priority uses 3 decimal places: 0.XXX (range 0.000-0.999)
      // - Counter uses 9 decimal places: 0.000000XXX (range 0.000000001-0.000999999)
      // - Counter is always < priority's smallest unit (0.001), so priority dominates
      // 
      // This ensures:
      // 1. Delay is respected (processAt)
      // 2. Higher priority jobs (higher number) get processed first (lower score)
      // 3. Jobs with same priority/delay maintain FIFO order via counter
      const processAt = Date.now() + (opts.delay || 0);
      
      // Get deterministic counter for ordering within same millisecond
      this.priorityCounter = (this.priorityCounter + 1) % 1000000;
      
      // Priority adjustment: higher priority = lower score = processed first
      // Scale: priority 0-999 maps to 0.999-0.000 adjustment
      const priorityValue = Math.min(Math.max(opts.priority || 0, 0), 999);
      const priorityAdjustment = (999 - priorityValue) / 1000; // Invert so higher priority = lower
      
      // Counter adjustment: ensures FIFO within same priority/millisecond
      // Max counter (999999/1000000000 = 0.000999999) is LESS THAN priority's smallest unit (0.001)
      // This guarantees priority always dominates:
      //   - Priority diff of 1: 0.001 adjustment difference
      //   - Max counter: 0.000999999 (always smaller than 0.001)
      // Example: priority=998 (adj=0.001) beats priority=999 (adj=0.000) even with max counter
      const counterAdjustment = this.priorityCounter / 1000000000; // Max: 0.000999999 < 0.001
      
      // Final score: processAt + priority fraction + counter fraction
      const score = processAt + priorityAdjustment + counterAdjustment;
      
      // Store job data
      await this.redisService.set(
        `job:${job.id}`,
        JSON.stringify(job),
        opts.removeOnComplete ? 86400 : 604800, // 1 day or 7 days TTL
      );
      
      // Add to queue with score
      await this.redisService.zadd(this.QUEUE_KEY, score, job.id);
      
      this.logger.debug(`Added job ${job.id} (${jobType}) to queue with delay=${opts.delay || 0}ms, priority=${opts.priority || 0}`);
    } else {
      // Fallback: process immediately (await to ensure proper error handling)
      await this.processJobImmediate(job);
    }

    return job.id;
  }

  /**
   * Add multiple jobs in order.
   * 
   * Jobs are added sequentially to guarantee FIFO ordering within the batch.
   * While JavaScript's single-threaded event loop would likely preserve order
   * with Promise.all (since counter increment is sync before any await),
   * sequential processing makes this guarantee explicit and robust against
   * future code changes that might alter the timing.
   */
  async addBulk<T>(
    jobType: JobType,
    payloads: T[],
    options: JobOptions = {},
  ): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const payload of payloads) {
      const jobId = await this.addJob(jobType, payload, options);
      jobIds.push(jobId);
    }
    
    return jobIds;
  }

  /**
   * Get job status
   * First checks Redis, then falls back to in-memory storage
   */
  async getJob(jobId: string): Promise<Job | null> {
    // First, try to get from Redis if connected
    if (this.redisService.isRedisConnected()) {
      const jobData = await this.redisService.get(`job:${jobId}`);
      if (jobData) {
        return parseJobFromJson(jobData);
      }
    }
    
    // Fallback to in-memory storage (for jobs processed when Redis was unavailable)
    const inMemoryJob = this.inMemoryJobs.get(jobId);
    if (inMemoryJob) {
      return { ...inMemoryJob }; // Return a copy to prevent mutation
    }

    return null;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    if (!this.redisService.isRedisConnected()) {
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const [pending, processing, completed, failed] = await Promise.all([
      this.redisService.zcard(this.QUEUE_KEY),
      this.redisService.zcard(this.PROCESSING_KEY),
      this.redisService.zcard(this.COMPLETED_KEY),
      this.redisService.zcard(this.FAILED_KEY),
    ]);

    return { pending, processing, completed, failed };
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      // Use void to explicitly ignore the promise, but the lock inside
      // processNextJob prevents concurrent execution
      void this.processNextJob();
    }, 100); // Check every 100ms
  }

  /**
   * Stop processing jobs
   */
  private stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    if (this.redisCheckInterval) {
      clearInterval(this.redisCheckInterval);
      this.redisCheckInterval = null;
    }
  }

  /**
   * Acquire a distributed lock for a job using Redis SETNX pattern.
   * 
   * This prevents multiple workers from processing the same job in horizontally
   * scaled deployments.
   * 
   * @returns 'acquired' if lock was obtained, 'contended' if another worker holds it,
   *          'unavailable' if Redis is not connected (critical failure)
   */
  private async acquireJobLock(jobId: string): Promise<'acquired' | 'contended' | 'unavailable'> {
    // Check Redis connectivity first - this is a critical failure case
    // distinct from normal lock contention
    if (!this.redisService.isRedisConnected()) {
      this.logger.error(`Cannot acquire lock for job ${jobId}: Redis is unavailable`);
      return 'unavailable';
    }
    
    const lockKey = `${this.JOB_LOCK_PREFIX}${jobId}`;
    const lockValue = `${this.workerId}:${Date.now()}`;
    
    // Use Redis SET with NX (only set if not exists) and EX (expire time)
    // This is atomic and prevents race conditions
    const acquired = await this.redisService.setNX(lockKey, lockValue, this.JOB_LOCK_TTL);
    
    if (acquired) {
      this.logger.debug(`Worker ${this.workerId} acquired lock for job ${jobId}`);
      return 'acquired';
    }
    
    // Lock is held by another worker - this is normal in a multi-worker environment
    return 'contended';
  }

  /**
   * Release a distributed lock for a job.
   * Only releases if this worker owns the lock (prevents releasing another worker's lock).
   */
  private async releaseJobLock(jobId: string): Promise<void> {
    const lockKey = `${this.JOB_LOCK_PREFIX}${jobId}`;
    
    // Get the current lock value to verify ownership
    const currentValue = await this.redisService.get(lockKey);
    if (currentValue && currentValue.startsWith(`${this.workerId}:`)) {
      await this.redisService.del(lockKey);
      this.logger.debug(`Worker ${this.workerId} released lock for job ${jobId}`);
    }
  }

  /**
   * Process next job in queue
   * Uses both local and distributed locks to prevent concurrent job processing:
   * 1. Local lock (isProcessingJob) - prevents overlapping interval calls within this process
   * 2. Distributed lock (Redis SETNX) - prevents multiple workers from processing same job
   */
  private async processNextJob(): Promise<void> {
    // Prevent concurrent processing within this process
    if (this.isProcessingJob) return;
    if (!this.redisService.isRedisConnected()) return;

    // Acquire the local processing lock
    this.isProcessingJob = true;

    try {
      // Get next job from queue (with current timestamp as max score)
      const jobIds = await this.redisService.zrangebyscore(
        this.QUEUE_KEY,
        0,
        Date.now(),
        0,
        1,
      );

      if (!jobIds || jobIds.length === 0) return;

      const jobId = jobIds[0];
      
      // Try to acquire distributed lock BEFORE removing from queue
      // This prevents race conditions in horizontally scaled deployments
      const lockResult = await this.acquireJobLock(jobId);
      
      if (lockResult === 'unavailable') {
        // Redis connectivity lost - this is a critical failure
        // Stop processing and let the system recover
        this.logger.error(`Job processing halted: Redis unavailable while acquiring lock for job ${jobId}`);
        return;
      }
      
      if (lockResult === 'contended') {
        // Another worker is processing this job, skip it
        // The other worker will remove it from the queue
        this.logger.debug(`Job ${jobId} is locked by another worker, skipping`);
        return;
      }

      try {
        // Now atomically move to processing set
        // Check if job still exists in queue (could have been taken by another worker
        // in the small window between our lock check and now)
        const removed = await this.redisService.zrem(this.QUEUE_KEY, jobId);
        if (removed === 0) {
          // Job was already removed by another worker, release lock and skip
          await this.releaseJobLock(jobId);
          this.logger.debug(`Job ${jobId} was already removed from queue, skipping`);
          return;
        }
        
        await this.redisService.zadd(this.PROCESSING_KEY, Date.now(), jobId);

        // Get job data
        const jobData = await this.redisService.get(`job:${jobId}`);
        if (!jobData) {
          // Job ID exists in queue but job data is missing (orphaned job)
          // This can happen if job data expired or was manually deleted
          // Move to failed queue for tracking and investigation
          this.logger.warn(
            `Orphaned job detected: ${jobId} exists in queue but job data is missing. ` +
            `Moving to failed queue for tracking.`
          );
          await this.redisService.zrem(this.PROCESSING_KEY, jobId);
          await this.redisService.zadd(this.FAILED_KEY, Date.now(), jobId);
          
          // Create a minimal job record so this failure can be tracked
          const orphanedJobRecord: Job = {
            id: jobId,
            type: JobType.EMAIL_NOTIFICATION, // Unknown type, using default
            payload: { orphaned: true, reason: 'Job data missing from Redis' },
            status: 'failed',
            priority: 0,  // Unknown priority, using default
            attempts: 0,
            maxAttempts: 0,
            createdAt: new Date(),
            error: 'Job data was not found in Redis. The job may have expired or been manually deleted.',
          };
          await this.redisService.set(`job:${jobId}`, JSON.stringify(orphanedJobRecord), 86400); // 1 day TTL
          await this.releaseJobLock(jobId);
          return;
        }

        const job: Job = parseJobFromJson(jobData);
        job.status = 'processing';
        job.processedAt = new Date();
        job.attempts++;

        await this.redisService.set(`job:${jobId}`, JSON.stringify(job), 604800);

        // Process the job
        const processor = this.processors.get(job.type);
        if (!processor) {
          this.logger.warn(`No processor found for job type: ${job.type}`);
          await this.completeJob(job, null);
          await this.releaseJobLock(jobId);
          return;
        }

        try {
          const result = await processor(job);
          await this.completeJob(job, result);
        } catch (error: any) {
          await this.failJob(job, error.message);
        } finally {
          // Always release the distributed lock after processing
          await this.releaseJobLock(jobId);
        }
      } catch (lockError) {
        // Error occurred while holding the lock, try to release it
        this.logger.error(`Error processing job ${jobId} with lock:`, lockError);
        try {
          await this.releaseJobLock(jobId);
        } catch {
          // Ignore release errors - the lock will expire via TTL
        }
      }
    } catch (error) {
      this.logger.error('Error in job processing loop:', error);
    } finally {
      // Always release the local processing lock so the next interval can process jobs
      this.isProcessingJob = false;
    }
  }

  /**
   * Mark job as completed
   */
  private async completeJob(job: Job, result: any): Promise<void> {
    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;

    await this.redisService.zrem(this.PROCESSING_KEY, job.id);
    await this.redisService.zadd(this.COMPLETED_KEY, Date.now(), job.id);
    await this.redisService.set(`job:${job.id}`, JSON.stringify(job), 86400);

    this.logger.debug(`Job ${job.id} completed`);
  }

  /**
   * Calculate queue score for a job with priority adjustment.
   * This ensures consistent priority handling for both new jobs and retries.
   * 
   * @param processAt - Timestamp when job should be eligible for processing
   * @param priority - Job priority (0-999, higher = processed first)
   * @param incrementCounter - Whether to increment the FIFO counter (default: true)
   *                          Set to false for retries to avoid changing relative ordering
   * @returns Score for Redis sorted set (lower score = processed first)
   */
  private calculateQueueScore(processAt: number, priority: number, incrementCounter: boolean = true): number {
    // Priority adjustment: higher priority = lower score = processed first
    const priorityValue = Math.min(Math.max(priority, 0), 999);
    const priorityAdjustment = (999 - priorityValue) / 1000;
    
    // Counter for FIFO within same priority/millisecond
    // Only increment for new jobs, not retries, to preserve original ordering intent
    // For retries, the exponential backoff delay provides sufficient time separation
    let counterAdjustment: number;
    if (incrementCounter) {
      this.priorityCounter = (this.priorityCounter + 1) % 1000000;
      counterAdjustment = this.priorityCounter / 1000000000;
    } else {
      // For retries, use a small fixed offset to avoid score collisions
      // but don't consume counter values that should be reserved for new jobs
      counterAdjustment = 0.0000001; // Minimal offset, less than counter's smallest unit
    }
    
    return processAt + priorityAdjustment + counterAdjustment;
  }

  /**
   * Mark job as failed (with retry logic)
   */
  private async failJob(job: Job, error: string): Promise<void> {
    job.error = error;

    if (job.attempts < job.maxAttempts) {
      // Retry with exponential backoff
      // Use (attempts - 1) because attempts was already incremented in processNextJob
      // before the job processor ran. This gives the standard sequence:
      // 1st retry (attempts=1): 2^0 * 1000 = 1 second
      // 2nd retry (attempts=2): 2^1 * 1000 = 2 seconds
      // 3rd retry (attempts=3): 2^2 * 1000 = 4 seconds
      const delay = Math.pow(2, job.attempts - 1) * 1000;
      job.status = 'pending';
      
      // Calculate score with original priority preserved
      // This ensures high-priority jobs maintain their priority after retries
      // Pass false to skip counter increment - retries shouldn't consume counter values
      // that could affect ordering of newly added jobs
      const retryScore = this.calculateQueueScore(Date.now() + delay, job.priority, false);
      
      await this.redisService.zrem(this.PROCESSING_KEY, job.id);
      await this.redisService.zadd(this.QUEUE_KEY, retryScore, job.id);
      await this.redisService.set(`job:${job.id}`, JSON.stringify(job), 604800);

      this.logger.debug(`Job ${job.id} failed, retrying in ${delay}ms with priority ${job.priority} (attempt ${job.attempts}/${job.maxAttempts})`);
    } else {
      job.status = 'failed';
      
      await this.redisService.zrem(this.PROCESSING_KEY, job.id);
      await this.redisService.zadd(this.FAILED_KEY, Date.now(), job.id);
      await this.redisService.set(`job:${job.id}`, JSON.stringify(job), 604800);

      this.logger.error(`Job ${job.id} failed permanently: ${error}`);
    }
  }

  /**
   * Process job immediately (fallback when Redis is not available)
   */
  private async processJobImmediate(job: Job): Promise<void> {
    const processor = this.processors.get(job.type);
    
    // Store job in memory before processing so getJob() can find it
    job.status = 'processing';
    job.processedAt = new Date();
    job.attempts++;  // Increment attempts for consistency with Redis-based processing
    this.inMemoryJobs.set(job.id, { ...job });
    
    if (!processor) {
      this.logger.warn(`No processor found for job type: ${job.type}`);
      job.status = 'completed';
      job.completedAt = new Date();
      this.inMemoryJobs.set(job.id, { ...job });
      this.scheduleInMemoryCleanup(job.id);
      return;
    }

    try {
      const result = await processor(job);
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      this.inMemoryJobs.set(job.id, { ...job });
      this.logger.debug(`Job ${job.id} processed immediately`);
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      this.inMemoryJobs.set(job.id, { ...job });
      this.logger.error(`Immediate job processing failed:`, error);
    }
    
    // Schedule cleanup of in-memory job after TTL
    this.scheduleInMemoryCleanup(job.id);
  }
  
  /**
   * Schedule cleanup of an in-memory job after TTL expires
   */
  private scheduleInMemoryCleanup(jobId: string): void {
    setTimeout(() => {
      this.inMemoryJobs.delete(jobId);
    }, this.IN_MEMORY_JOB_TTL);
  }

  /**
   * Register default job processors
   * All JobType enum values must have a corresponding processor registered here.
   */
  /**
   * Register default job processors.
   * 
   * These processors attempt to resolve the actual service implementations via ModuleRef.
   * If a service is not available, the processor will log a warning and return a stub response.
   * 
   * External services can override these by calling registerProcessor() with their own
   * implementation, which is the recommended approach for production use.
   */
  private registerDefaultProcessors(): void {
    // Email notification processor - tries to use NotificationsService
    this.registerProcessor(JobType.EMAIL_NOTIFICATION, async (job) => {
      const { to, subject, template, data } = job.payload;
      
      try {
        // Lazy-load NotificationsService to avoid circular dependencies
        const notificationsService = await this.tryResolveService('NotificationsService');
        if (notificationsService && typeof notificationsService.sendEmail === 'function') {
          await notificationsService.sendEmail(to, subject, template, data);
          this.logger.log(`Email sent to ${to}: ${subject}`);
          return { sent: true, to, subject, via: 'NotificationsService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve NotificationsService: ${error.message}`);
      }
      
      // Fallback: Log warning and return stub (useful for development/testing)
      this.logStubWarning(JobType.EMAIL_NOTIFICATION, `email to ${to}`);
      return { sent: false, stub: true, to, subject, message: 'NotificationsService not available' };
    });

    // Image processing - tries to use StorageService/CloudinaryService
    this.registerProcessor(JobType.IMAGE_PROCESSING, async (job) => {
      const { imageUrl, transformations } = job.payload;
      
      try {
        const storageService = await this.tryResolveService('StorageService');
        if (storageService && typeof storageService.processImage === 'function') {
          const result = await storageService.processImage(imageUrl, transformations);
          this.logger.log(`Image processed: ${imageUrl}`);
          return { processed: true, imageUrl, result, via: 'StorageService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve StorageService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.IMAGE_PROCESSING, `image ${imageUrl}`);
      return { processed: false, stub: true, imageUrl, message: 'StorageService not available' };
    });

    // Product indexing - tries to use SearchService
    this.registerProcessor(JobType.PRODUCT_INDEXING, async (job) => {
      const { productId, action } = job.payload;
      
      try {
        const searchService = await this.tryResolveService('SearchService');
        if (searchService) {
          if (action === 'delete' && typeof searchService.removeFromIndex === 'function') {
            await searchService.removeFromIndex(productId);
          } else if (typeof searchService.indexProduct === 'function') {
            await searchService.indexProduct(productId);
          }
          this.logger.log(`Product ${productId} ${action}d in search index`);
          return { indexed: true, productId, action, via: 'SearchService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve SearchService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.PRODUCT_INDEXING, `product ${productId}`);
      return { indexed: false, stub: true, productId, action, message: 'SearchService not available' };
    });

    // Product cache warmup - tries to use CacheService
    this.registerProcessor(JobType.PRODUCT_CACHE_WARMUP, async (job) => {
      const { productIds, cacheType } = job.payload;
      
      try {
        const cacheService = await this.tryResolveService('CacheService');
        if (cacheService && typeof cacheService.warmProductCache === 'function') {
          await cacheService.warmProductCache(productIds, cacheType);
          this.logger.log(`Cache warmed for ${productIds?.length || 0} products`);
          return { warmedUp: true, productCount: productIds?.length || 0, via: 'CacheService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve CacheService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.PRODUCT_CACHE_WARMUP, `${productIds?.length || 0} products`);
      return { warmedUp: false, stub: true, productCount: productIds?.length || 0, message: 'CacheService not available' };
    });

    // Report generation - tries to use ReportsService
    this.registerProcessor(JobType.REPORT_GENERATION, async (job) => {
      const { reportType, dateRange, format } = job.payload;
      
      try {
        const reportsService = await this.tryResolveService('ReportsService');
        if (reportsService && typeof reportsService.generateReport === 'function') {
          const result = await reportsService.generateReport(reportType, dateRange, format);
          this.logger.log(`Report generated: ${reportType}`);
          return { generated: true, reportType, format: format || 'pdf', result, via: 'ReportsService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve ReportsService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.REPORT_GENERATION, `report ${reportType}`);
      return { generated: false, stub: true, reportType, format: format || 'pdf', message: 'ReportsService not available' };
    });

    // Settlement calculation - tries to use SettlementsService
    this.registerProcessor(JobType.SETTLEMENT_CALCULATION, async (job) => {
      const { sellerId, period, startDate, endDate } = job.payload;
      
      try {
        const settlementsService = await this.tryResolveService('SettlementsService');
        if (settlementsService && typeof settlementsService.calculateSettlement === 'function') {
          const result = await settlementsService.calculateSettlement(sellerId, { period, startDate, endDate });
          this.logger.log(`Settlement calculated for seller ${sellerId}`);
          return { calculated: true, sellerId, period, result, via: 'SettlementsService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve SettlementsService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.SETTLEMENT_CALCULATION, `seller ${sellerId}`);
      return { calculated: false, stub: true, sellerId, period, message: 'SettlementsService not available' };
    });

    // Order confirmation - tries to use NotificationsService
    this.registerProcessor(JobType.ORDER_CONFIRMATION, async (job) => {
      const { orderId, customerEmail } = job.payload;
      
      try {
        const notificationsService = await this.tryResolveService('NotificationsService');
        if (notificationsService && typeof notificationsService.sendOrderConfirmation === 'function') {
          await notificationsService.sendOrderConfirmation(orderId, customerEmail);
          this.logger.log(`Order confirmation sent for ${orderId}`);
          return { sent: true, orderId, via: 'NotificationsService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve NotificationsService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.ORDER_CONFIRMATION, `order ${orderId}`);
      return { sent: false, stub: true, orderId, message: 'NotificationsService not available' };
    });

    // Inventory sync - tries to use InventoryService
    this.registerProcessor(JobType.INVENTORY_SYNC, async (job) => {
      const { warehouseId, productIds, syncType } = job.payload;
      
      try {
        const inventoryService = await this.tryResolveService('InventoryService');
        if (inventoryService && typeof inventoryService.syncInventory === 'function') {
          await inventoryService.syncInventory(warehouseId, productIds, syncType);
          this.logger.log(`Inventory synced for warehouse ${warehouseId}`);
          return { synced: true, warehouseId, productCount: productIds?.length || 0, via: 'InventoryService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve InventoryService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.INVENTORY_SYNC, `warehouse ${warehouseId}`);
      return { synced: false, stub: true, warehouseId, productCount: productIds?.length || 0, message: 'InventoryService not available' };
    });

    // Analytics update - tries to use AnalyticsService
    this.registerProcessor(JobType.ANALYTICS_UPDATE, async (job) => {
      const { event, data } = job.payload;
      
      try {
        const analyticsService = await this.tryResolveService('AnalyticsService');
        if (analyticsService && typeof analyticsService.trackEvent === 'function') {
          await analyticsService.trackEvent(event, data);
          this.logger.log(`Analytics event tracked: ${event}`);
          return { updated: true, event, via: 'AnalyticsService' };
        }
      } catch (error: any) {
        this.logger.debug(`Could not resolve AnalyticsService: ${error.message}`);
      }
      
      this.logStubWarning(JobType.ANALYTICS_UPDATE, `event ${event}`);
      return { updated: false, stub: true, event, message: 'AnalyticsService not available' };
    });
  }

  /**
   * Try to resolve a service by name using ModuleRef.
   * Returns null if the service is not available (avoids throwing).
   */
  private async tryResolveService(serviceName: string): Promise<any> {
    try {
      // Try to get the service from the module context
      // This uses dynamic resolution to avoid hard dependencies
      const ServiceClass = await this.getServiceClass(serviceName);
      if (ServiceClass) {
        return this.moduleRef.get(ServiceClass, { strict: false });
      }
    } catch {
      // Service not available in this context
    }
    return null;
  }

  /**
   * Map service names to their classes for dynamic resolution.
   * This avoids importing all services directly which would cause circular dependencies.
   */
  private async getServiceClass(serviceName: string): Promise<any> {
    // We can't statically import these due to potential circular dependencies
    // Instead, we use dynamic imports or return null if not needed
    switch (serviceName) {
      case 'NotificationsService':
        try {
          const module = await import('../notifications/notifications.service');
          return module.NotificationsService;
        } catch { return null; }
      case 'StorageService':
        try {
          const module = await import('../storage/storage.service');
          return module.StorageService;
        } catch { return null; }
      case 'SearchService':
        try {
          const module = await import('../search/search.service');
          return module.SearchService;
        } catch { return null; }
      case 'SettlementsService':
        try {
          const module = await import('../settlements/settlements.service');
          return module.SettlementsService;
        } catch { return null; }
      case 'InventoryService':
        try {
          const module = await import('../inventory/inventory.service');
          return module.InventoryService;
        } catch { return null; }
      case 'AnalyticsService':
        try {
          const module = await import('../analytics/analytics.service');
          return module.AnalyticsService;
        } catch { return null; }
      default:
        return null;
    }
  }

  /**
   * Log a warning when a stub processor is used.
   * In production, this helps identify missing service integrations.
   */
  private logStubWarning(jobType: JobType, description: string): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    if (isProduction) {
      this.logger.warn(
        `[STUB PROCESSOR] Job ${jobType} for ${description} completed with stub. ` +
        `Register a real processor or ensure the required service is available.`
      );
    } else {
      this.logger.debug(`[STUB] ${jobType} for ${description} - no service available`);
    }
  }

  /**
   * Register an external processor for a job type.
   * This will override any default stub processor.
   */
  registerExternalProcessor(jobType: JobType, processor: (job: Job) => Promise<any>): void {
    this.externalProcessorsRegistered.add(jobType);
    this.registerProcessor(jobType, processor);
    this.logger.log(`External processor registered for ${jobType}`);
  }

  // Convenience methods for common jobs
  async queueEmail(to: string, subject: string, template: string, data: any): Promise<string> {
    return this.addJob(JobType.EMAIL_NOTIFICATION, { to, subject, template, data });
  }

  async queueProductIndex(productId: string, action: 'create' | 'update' | 'delete'): Promise<string> {
    return this.addJob(JobType.PRODUCT_INDEXING, { productId, action });
  }

  async queueOrderConfirmation(orderId: string, customerEmail: string): Promise<string> {
    return this.addJob(JobType.ORDER_CONFIRMATION, { orderId, customerEmail });
  }

  async queueImageProcessing(imageUrl: string, transformations: any): Promise<string> {
    return this.addJob(JobType.IMAGE_PROCESSING, { imageUrl, transformations });
  }
}