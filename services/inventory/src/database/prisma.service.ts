import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../node_modules/.prisma/inventory-client';

@Injectable()
export class InventoryPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InventoryPrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Connected to database');
        return;
      } catch (error: any) {
        retries--;
        this.logger.warn(`Database connection failed (${5 - retries}/5): ${error?.message}`);
        if (retries === 0) {
          this.logger.error('Could not connect to database after 5 attempts');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
