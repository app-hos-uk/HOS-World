import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from '../cache/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Readable } from 'stream';

export enum JobType {
  EMAIL_NOTIFICATION = 'email-notification',
  IMAGE_PROCESSING = 'image-processing',
  PRODUCT_INDEXING = 'product-indexing',
  REPORT_GENERATION = 'report-generation',
  SETTLEMENT_CALCULATION = 'settlement-calculation',
}

export interface JobData {
  type: JobType;
  payload: any;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  type?: 'invitation' | 'order-confirmation' | 'order-shipped' | 'order-delivered';
  data?: any;
}

export interface ImageProcessingJobPayload {
  imageUrl: string;
  productId?: string; // Optional: product ID to update in database
  operations: {
    resize?: { width?: number; height?: number };
    optimize?: boolean;
    format?: 'jpg' | 'png' | 'webp';
  };
}

export interface ProductIndexingJobPayload {
  productId: string;
  action: 'index' | 'delete' | 'update';
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private connection: any;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private notificationsService: NotificationsService,
    private searchService: SearchService,
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    
    try {
      const redisClient = this.redisService.getClient();

      const parsed = this.parseRedisUrl(redisUrl);
      // NOTE: BullMQ uses ioredis connection options. Include username for ACL-based Redis providers.
      // Also include TLS for rediss:// URLs.
      this.connection = {
        host: parsed.host || 'localhost',
        port: parsed.port || 6379,
        username: parsed.username,
        password: parsed.password,
        ...(parsed.tls ? { tls: {} } : {}),
      };

      // Single startup log (no secrets) to prove correct parsing in Railway logs
      this.logger.log(
        `Redis connection parsed for BullMQ: host=${this.connection.host} port=${this.connection.port} username=${this.connection.username ? 'set' : 'unset'} tls=${parsed.tls ? 'on' : 'off'}`,
      );

      await this.initializeQueues();
      await this.initializeWorkers();
      
      this.logger.log('✅ Queue system initialized successfully');
    } catch (error: any) {
      this.logger.warn(`⚠️ Queue system initialization failed: ${error?.message || 'Unknown error'}`);
      this.logger.warn('Queue operations will use fallback Redis storage');
      this.logger.debug(error?.stack);
    }
  }

  async onModuleDestroy() {
    // Close all workers
    for (const [name, worker] of this.workers.entries()) {
      await worker.close();
      this.logger.log(`Closed worker: ${name}`);
    }

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      this.logger.log(`Closed queue: ${name}`);
    }
  }

  private extractHostFromUrl(url: string): string | undefined {
    try {
      const match = url.match(/:\/\/([^:]+)/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private extractPortFromUrl(url: string): number | undefined {
    try {
      const match = url.match(/:(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    } catch {
      return undefined;
    }
  }

  private extractPasswordFromUrl(url: string): string | undefined {
    try {
      const match = url.match(/:\/\/[^:]+:([^@]+)@/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private parseRedisUrl(url: string): {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    tls?: boolean;
  } {
    try {
      // Handles URLs like:
      // - redis://localhost:6379
      // - redis://:password@host:port
      // - redis://default:password@host:port   (common: username is "default")
      // - rediss://default:password@host:port  (TLS)
      const u = new URL(url);
      const port = u.port ? Number(u.port) : undefined;
      return {
        host: u.hostname || undefined,
        port: Number.isFinite(port) ? port : undefined,
        username: u.username || undefined,
        password: u.password || undefined,
        tls: u.protocol === 'rediss:',
      };
    } catch {
      // Non-URL fallback (legacy). This preserves previous behavior for simple strings.
      return {
        host: this.extractHostFromUrl(url),
        port: this.extractPortFromUrl(url),
        password: this.extractPasswordFromUrl(url),
        tls: false,
      };
    }
  }

  private async initializeQueues() {
    const queueNames = Object.values(JobType);
    
    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
          },
        },
      });

      this.queues.set(queueName, queue);
      this.logger.log(`✅ Initialized queue: ${queueName}`);
    }
  }

  private async initializeWorkers() {
    // Email notification worker
    const emailWorker = new Worker(
      JobType.EMAIL_NOTIFICATION,
      async (job: Job<EmailJobPayload>) => {
        this.logger.log(`Processing email job: ${job.id}`);
        await this.processEmailNotification(job.data);
      },
      {
        connection: this.connection,
        concurrency: 5, // Process 5 emails concurrently
      },
    );

    emailWorker.on('completed', (job) => {
      this.logger.log(`Email job ${job.id} completed`);
    });

    emailWorker.on('failed', (job, err) => {
      this.logger.error(`Email job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(JobType.EMAIL_NOTIFICATION, emailWorker);

    // Image processing worker
    const imageWorker = new Worker(
      JobType.IMAGE_PROCESSING,
      async (job: Job<ImageProcessingJobPayload>) => {
        this.logger.log(`Processing image job: ${job.id}`);
        await this.processImageProcessing(job.data);
      },
      {
        connection: this.connection,
        concurrency: 3, // Process 3 images concurrently
      },
    );

    imageWorker.on('completed', (job) => {
      this.logger.log(`Image job ${job.id} completed`);
    });

    imageWorker.on('failed', (job, err) => {
      this.logger.error(`Image job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(JobType.IMAGE_PROCESSING, imageWorker);

    // Product indexing worker
    const indexingWorker = new Worker(
      JobType.PRODUCT_INDEXING,
      async (job: Job<ProductIndexingJobPayload>) => {
        this.logger.log(`Processing indexing job: ${job.id}`);
        await this.processProductIndexing(job.data);
      },
      {
        connection: this.connection,
        concurrency: 10, // Process 10 indexing jobs concurrently
      },
    );

    indexingWorker.on('completed', (job) => {
      this.logger.log(`Indexing job ${job.id} completed`);
    });

    indexingWorker.on('failed', (job, err) => {
      this.logger.error(`Indexing job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(JobType.PRODUCT_INDEXING, indexingWorker);

    // Report generation worker
    const reportWorker = new Worker(
      JobType.REPORT_GENERATION,
      async (job: Job<any>) => {
        this.logger.log(`Processing report job: ${job.id}`);
        await this.processReportGeneration(job.data);
      },
      {
        connection: this.connection,
        concurrency: 2, // Process 2 reports concurrently
      },
    );

    reportWorker.on('completed', (job) => {
      this.logger.log(`Report job ${job.id} completed`);
    });

    reportWorker.on('failed', (job, err) => {
      this.logger.error(`Report job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(JobType.REPORT_GENERATION, reportWorker);

    // Settlement calculation worker
    const settlementWorker = new Worker(
      JobType.SETTLEMENT_CALCULATION,
      async (job: Job<any>) => {
        this.logger.log(`Processing settlement job: ${job.id}`);
        await this.processSettlementCalculation(job.data);
      },
      {
        connection: this.connection,
        concurrency: 1, // Process settlements sequentially
      },
    );

    settlementWorker.on('completed', (job) => {
      this.logger.log(`Settlement job ${job.id} completed`);
    });

    settlementWorker.on('failed', (job, err) => {
      this.logger.error(`Settlement job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(JobType.SETTLEMENT_CALCULATION, settlementWorker);

    this.logger.log(`✅ Initialized ${this.workers.size} workers`);
  }

  /**
   * Get queue by job type
   */
  private getQueue(jobType: JobType): Queue {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue not found for job type: ${jobType}`);
    }
    return queue;
  }

  /**
   * Add job to queue
   */
  async addJob(
    jobType: JobType,
    payload: any,
    options?: { delay?: number; attempts?: number; priority?: number },
  ): Promise<string> {
    try {
      const queue = this.getQueue(jobType);
      const job = await queue.add(jobType, payload, {
        delay: options?.delay,
        attempts: options?.attempts || 3,
        priority: options?.priority,
      });
      this.logger.log(`✅ Added job ${job.id} to queue: ${jobType}`);
      return job.id!;
    } catch (error: any) {
      this.logger.error(`Failed to add job to queue ${jobType}: ${error?.message}`);
      // Fallback to Redis storage
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.redisService.set(`job:${jobId}`, JSON.stringify({ type: jobType, payload }), 3600);
      return jobId;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string, jobType: JobType): Promise<any> {
    try {
      const queue = this.getQueue(jobType);
      const job = await queue.getJob(jobId);
      
      if (!job) {
        // Check fallback Redis storage
        const jobData = await this.redisService.get(`job:${jobId}`);
        return jobData ? { id: jobId, status: 'pending', data: JSON.parse(jobData) } : null;
      }

      const state = await job.getState();
      const progress = job.progress || 0;
      
      return {
        id: job.id,
        status: state,
        progress,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get job status ${jobId}: ${error?.message}`);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(jobType: JobType): Promise<any> {
    try {
      const queue = this.getQueue(jobType);
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get queue stats for ${jobType}: ${error?.message}`);
      return null;
    }
  }

  /**
   * Process email notification job
   */
  private async processEmailNotification(jobData: EmailJobPayload): Promise<void> {
    try {
      if (jobData.type === 'invitation') {
        await this.notificationsService.sendSellerInvitation(jobData.to, {
          sellerType: jobData.data?.sellerType || 'B2C_SELLER',
          invitationLink: jobData.data?.invitationLink || '',
          message: jobData.data?.message,
        });
      } else if (jobData.type === 'order-confirmation' && jobData.data?.orderId) {
        await this.notificationsService.sendOrderConfirmation(jobData.data.orderId);
      } else if (jobData.type === 'order-shipped' && jobData.data?.orderId && jobData.data?.trackingCode) {
        await this.notificationsService.sendOrderShipped(jobData.data.orderId, jobData.data.trackingCode);
      } else if (jobData.type === 'order-delivered' && jobData.data?.orderId) {
        await this.notificationsService.sendOrderDelivered(jobData.data.orderId);
      } else {
        // For generic emails, we need to use the private sendEmail method
        // This is a limitation - we should add a public sendEmail method to NotificationsService
        this.logger.warn(`Generic email sending not directly supported. Type: ${jobData.type}`);
        this.logger.warn(`Email would be sent to ${jobData.to}: ${jobData.subject}`);
      }
      this.logger.log(`✅ Email processed for ${jobData.to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${jobData.to}: ${error?.message}`);
      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Process image processing job
   * Downloads image, applies transformations, and re-uploads using StorageService
   */
  private async processImageProcessing(jobData: ImageProcessingJobPayload): Promise<void> {
    try {
      this.logger.log(`Processing image: ${jobData.imageUrl}`);
      this.logger.log(`Operations: ${JSON.stringify(jobData.operations)}`);
      
      // Download the image using fetch (Node.js 18+)
      const response = await fetch(jobData.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Determine file extension from format or content type
      let extension = 'jpg';
      if (jobData.operations.format) {
        extension = jobData.operations.format;
      } else if (contentType.includes('png')) {
        extension = 'png';
      } else if (contentType.includes('webp')) {
        extension = 'webp';
      }
      
      // Create a mock Multer file object for StorageService
      const processedFile: Express.Multer.File = {
        fieldname: 'image',
        originalname: `processed-${Date.now()}.${extension}`,
        encoding: '7bit',
        mimetype: contentType,
        size: buffer.length,
        buffer: buffer,
        destination: '',
        filename: '',
        path: '',
        stream: Readable.from(buffer),
      };
      
      // Apply transformations using StorageService
      // For Cloudinary, transformations are applied during upload
      // For S3/MinIO, basic operations are supported
      const uploadOptions: any = {};
      
      if (jobData.operations.optimize) {
        uploadOptions.optimize = true;
      }
      
      if (jobData.operations.resize) {
        uploadOptions.resize = jobData.operations.resize;
      }
      
      // Upload processed image to storage
      const result = await this.storageService.uploadFile(
        processedFile,
        'processed',
        uploadOptions,
      );
      
      this.logger.log(`✅ Image processed and uploaded: ${result.url}`);
      
      // If productId is provided in jobData, update the product in database
      if (jobData.productId) {
        try {
          await this.prisma.productImage.updateMany({
            where: {
              url: jobData.imageUrl,
            },
            data: {
              url: result.url,
            },
          });
          this.logger.log(`Updated product image URL in database`);
        } catch (dbError: any) {
          // Don't fail the job if database update fails
          this.logger.warn(`Failed to update database: ${dbError?.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to process image ${jobData.imageUrl}: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Process product indexing job
   */
  private async processProductIndexing(jobData: ProductIndexingJobPayload): Promise<void> {
    try {
      if (jobData.action === 'delete') {
        // Delete from Elasticsearch
        await this.searchService.deleteProduct(jobData.productId);
        this.logger.log(`✅ Deleted product from index: ${jobData.productId}`);
      } else {
        // Index or update product
        const product = await this.prisma.product.findUnique({
          where: { id: jobData.productId },
          include: {
            seller: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            images: true,
            reviews: {
              select: {
                rating: true,
              },
            },
          },
        });

        if (product) {
          await this.searchService.indexProduct(product);
          this.logger.log(`✅ Indexed product: ${jobData.productId}`);
        } else {
          this.logger.warn(`Product not found for indexing: ${jobData.productId}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to index product ${jobData.productId}: ${error?.message}`);
      // Don't throw - allow job to complete even if Elasticsearch is unavailable
      if (error?.message?.includes('Elasticsearch')) {
        this.logger.warn('Elasticsearch unavailable, skipping indexing');
      } else {
        throw error;
      }
    }
  }

  /**
   * Process report generation job
   */
  private async processReportGeneration(jobData: any): Promise<void> {
    try {
      this.logger.log(`Generating report: ${jobData.reportType}`);
      
      const { reportType, filters, sellerId, startDate, endDate } = jobData;
      
      let reportData: any = {};
      let reportContent: string = '';
      
      switch (reportType) {
        case 'sales':
          reportData = await this.generateSalesReport(filters, sellerId, startDate, endDate);
          reportContent = this.formatSalesReportAsCSV(reportData);
          break;
        case 'orders':
          reportData = await this.generateOrdersReport(filters, sellerId, startDate, endDate);
          reportContent = this.formatOrdersReportAsCSV(reportData);
          break;
        case 'products':
          reportData = await this.generateProductsReport(filters, sellerId);
          reportContent = this.formatProductsReportAsCSV(reportData);
          break;
        case 'settlements':
          reportData = await this.generateSettlementsReport(filters, sellerId, startDate, endDate);
          reportContent = this.formatSettlementsReportAsCSV(reportData);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      // Store report in storage (could be S3, local, etc.)
      const reportFileName = `${reportType}_${sellerId || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      const reportBuffer = Buffer.from(reportContent, 'utf-8');
      
      // Upload report file
      const reportFile = {
        fieldname: 'report',
        originalname: reportFileName,
        encoding: '7bit',
        mimetype: 'text/csv',
        size: reportBuffer.length,
        buffer: reportBuffer,
        destination: '',
        filename: reportFileName,
        path: '',
        stream: Readable.from(reportBuffer),
      } as Express.Multer.File;
      
      const storageResult = await this.storageService.uploadFile(
        reportFile,
        'reports',
        { optimize: false },
      );
      
      this.logger.log(`✅ Report generated: ${reportType} - ${storageResult.url}`);
      
      // Optionally send notification with report link
      // Note: Using queue's email job instead of direct email call
      if (jobData.notifyEmail) {
        await this.addJob(JobType.EMAIL_NOTIFICATION, {
          to: jobData.notifyEmail,
          subject: `Report Generated: ${reportType}`,
          html: `<p>Your ${reportType} report has been generated and is available at: <a href="${storageResult.url}">${storageResult.url}</a></p>`,
          type: 'order-confirmation',
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to generate report: ${error?.message}`);
      throw error;
    }
  }
  
  private async generateSalesReport(filters: any, sellerId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const whereClause: any = {
      paymentStatus: 'PAID',
    };
    
    if (sellerId) {
      const seller = await this.prisma.seller.findUnique({ where: { userId: sellerId } });
      if (seller) {
        whereClause.sellerId = seller.id;
      }
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }
    
    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return {
      orders,
      totalSales: orders.reduce((sum, order) => sum + Number(order.total), 0),
      totalOrders: orders.length,
      period: { startDate, endDate },
    };
  }
  
  private async generateOrdersReport(filters: any, sellerId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const whereClause: any = {};
    
    if (sellerId) {
      const seller = await this.prisma.seller.findUnique({ where: { userId: sellerId } });
      if (seller) {
        whereClause.sellerId = seller.id;
      }
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }
    
    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        items: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return { orders, totalOrders: orders.length };
  }
  
  private async generateProductsReport(filters: any, sellerId?: string): Promise<any> {
    const whereClause: any = {};
    
    if (sellerId) {
      const seller = await this.prisma.seller.findUnique({ where: { userId: sellerId } });
      if (seller) {
        whereClause.sellerId = seller.id;
      }
    }
    
    const products = await this.prisma.product.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return { products, totalProducts: products.length };
  }
  
  private async generateSettlementsReport(filters: any, sellerId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const whereClause: any = {};
    
    if (sellerId) {
      const seller = await this.prisma.seller.findUnique({ where: { userId: sellerId } });
      if (seller) {
        whereClause.sellerId = seller.id;
      }
    }
    
    if (startDate || endDate) {
      whereClause.periodStart = {};
      if (startDate) whereClause.periodStart.gte = startDate;
      if (endDate) whereClause.periodEnd = { lte: endDate };
    }
    
    const settlements = await this.prisma.settlement.findMany({
      where: whereClause,
      include: {
        orderSettlements: {
          include: {
            order: true,
          },
        },
      },
      orderBy: { periodStart: 'desc' },
    });
    
    return { settlements, totalSettlements: settlements.length };
  }
  
  private formatSalesReportAsCSV(data: any): string {
    const headers = ['Order Number', 'Date', 'Customer Email', 'Product', 'Quantity', 'Price', 'Total'];
    const rows = [headers.join(',')];
    
    data.orders.forEach((order: any) => {
      order.items.forEach((item: any) => {
        rows.push([
          order.orderNumber,
          order.createdAt.toISOString().split('T')[0],
          order.user?.email || '',
          item.product?.name || 'N/A',
          item.quantity,
          item.price,
          (Number(item.price) * item.quantity).toFixed(2),
        ].join(','));
      });
    });
    
    return rows.join('\n');
  }
  
  private formatOrdersReportAsCSV(data: any): string {
    const headers = ['Order Number', 'Date', 'Status', 'Payment Status', 'Customer', 'Total'];
    const rows = [headers.join(',')];
    
    data.orders.forEach((order: any) => {
      rows.push([
        order.orderNumber,
        order.createdAt.toISOString().split('T')[0],
        order.status,
        order.paymentStatus,
        `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || order.user?.email || '',
        order.total,
      ].join(','));
    });
    
    return rows.join('\n');
  }
  
  private formatProductsReportAsCSV(data: any): string {
    const headers = ['Product Name', 'SKU', 'Price', 'Stock', 'Orders', 'Reviews', 'Status'];
    const rows = [headers.join(',')];
    
    data.products.forEach((product: any) => {
      rows.push([
        product.name,
        product.sku || '',
        product.price,
        product.stock || 0,
        product._count.orderItems || 0,
        product._count.reviews || 0,
        product.status || 'ACTIVE',
      ].join(','));
    });
    
    return rows.join('\n');
  }
  
  private formatSettlementsReportAsCSV(data: any): string {
    const headers = ['Settlement ID', 'Period Start', 'Period End', 'Total Sales', 'Platform Fee', 'Net Amount', 'Status'];
    const rows = [headers.join(',')];
    
    data.settlements.forEach((settlement: any) => {
      rows.push([
        settlement.id,
        settlement.periodStart.toISOString().split('T')[0],
        settlement.periodEnd.toISOString().split('T')[0],
        settlement.totalSales,
        settlement.platformFee,
        settlement.netAmount,
        settlement.status,
      ].join(','));
    });
    
    return rows.join('\n');
  }

  /**
   * Process settlement calculation job
   */
  private async processSettlementCalculation(jobData: any): Promise<void> {
    try {
      const { sellerId, periodStart, periodEnd, platformFeeRate = 0.15 } = jobData;
      
      this.logger.log(`Calculating settlement for seller: ${sellerId} from ${periodStart} to ${periodEnd}`);
      
      // Find seller
      const seller = await this.prisma.seller.findUnique({
        where: { userId: sellerId },
      });
      
      if (!seller) {
        throw new Error(`Seller not found: ${sellerId}`);
      }
      
      // Get all paid orders in the period
      const orders = await this.prisma.order.findMany({
        where: {
          sellerId: seller.id,
          paymentStatus: 'PAID',
          createdAt: {
            gte: new Date(periodStart),
            lte: new Date(periodEnd),
          },
        },
        include: {
          items: true,
        },
      });
      
      // Calculate totals
      const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);
      const totalOrders = orders.length;
      const platformFee = totalSales * platformFeeRate;
      const netAmount = totalSales - platformFee;
      
      // Check if settlement already exists
      const existingSettlement = await this.prisma.settlement.findFirst({
        where: {
          sellerId: seller.id,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
        },
      });
      
      let settlement;
      
      if (existingSettlement) {
        // Update existing settlement
        settlement = await this.prisma.settlement.update({
          where: { id: existingSettlement.id },
          data: {
            totalSales,
            totalOrders,
            platformFee,
            netAmount,
            status: 'PENDING',
          },
        });
        
        // Remove old order settlements
        await this.prisma.orderSettlement.deleteMany({
          where: { settlementId: settlement.id },
        });
      } else {
        // Create new settlement
        settlement = await this.prisma.settlement.create({
          data: {
            sellerId: seller.id,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            totalSales,
            totalOrders,
            platformFee,
            netAmount,
            status: 'PENDING',
            currency: 'GBP',
          },
        });
      }
      
      // Create order settlements
      for (const order of orders) {
        const orderPlatformFee = Number(order.total) * platformFeeRate;
        const orderNetAmount = Number(order.total) - orderPlatformFee;
        
        await this.prisma.orderSettlement.create({
          data: {
            settlementId: settlement.id,
            orderId: order.id,
            amount: orderNetAmount,
            platformFee: orderPlatformFee,
          },
        });
      }
      
      this.logger.log(`✅ Settlement calculated for seller: ${sellerId}`);
      this.logger.log(`   Total Sales: ${totalSales}, Platform Fee: ${platformFee}, Net Amount: ${netAmount}`);
      
      // Send notification to seller
      const sellerUser = await this.prisma.user.findUnique({
        where: { id: seller.userId },
      });
      
      if (sellerUser?.email) {
        // Use queue's email job instead of direct email call
        await this.addJob(JobType.EMAIL_NOTIFICATION, {
          to: sellerUser.email,
          subject: `Settlement Calculated - Period ${periodStart} to ${periodEnd}`,
          html: `
            <h2>Settlement Summary</h2>
            <p>Period: ${periodStart} to ${periodEnd}</p>
            <p>Total Sales: £${totalSales.toFixed(2)}</p>
            <p>Platform Fee: £${platformFee.toFixed(2)}</p>
            <p>Net Amount: £${netAmount.toFixed(2)}</p>
            <p>Status: ${settlement.status}</p>
          `,
          type: 'order-confirmation',
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to calculate settlement: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string, jobType: JobType): Promise<void> {
    try {
      const queue = this.getQueue(jobType);
      const job = await queue.getJob(jobId);
      
      if (job) {
        await job.retry();
        this.logger.log(`✅ Retried job: ${jobId}`);
      } else {
        throw new Error(`Job not found: ${jobId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to retry job ${jobId}: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Remove job from queue
   */
  async removeJob(jobId: string, jobType: JobType): Promise<void> {
    try {
      const queue = this.getQueue(jobType);
      const job = await queue.getJob(jobId);
      
      if (job) {
        await job.remove();
        this.logger.log(`✅ Removed job: ${jobId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to remove job ${jobId}: ${error?.message}`);
    }
  }
}
