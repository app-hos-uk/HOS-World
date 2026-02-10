import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Base Prisma Service
 *
 * Provides a reusable PrismaClient wrapper with:
 * - Connection retry logic with exponential backoff
 * - Graceful shutdown
 * - Health check support
 *
 * Each microservice extends this class with its own PrismaClient generated
 * from its service-specific Prisma schema.
 *
 * Usage in a microservice:
 *   @Injectable()
 *   export class OrderPrismaService extends BasePrismaService {
 *     constructor() {
 *       super('OrderService');
 *     }
 *   }
 */
@Injectable()
export class BasePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger: Logger;

  constructor(serviceName: string = 'PrismaService') {
    super();
    this.logger = new Logger(serviceName);
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.logger.log('Database connected successfully');
  }

  /**
   * Connect to database with exponential backoff retry
   */
  private async connectWithRetry(
    maxRetries = 5,
    initialDelay = 1000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log(`Database connected on attempt ${attempt}`);
        return;
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Database connection attempt ${attempt} failed, retrying in ${delay}ms: ${error?.message || 'Unknown error'}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Health check -- returns true if the database is reachable.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
