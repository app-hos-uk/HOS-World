import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../node_modules/.prisma/influencer-client';

@Injectable()
export class InfluencerPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfluencerPrismaService.name);

  constructor() { super({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] }); }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try { await this.$connect(); this.logger.log('Connected to database'); return; }
      catch (error: any) { retries--; this.logger.warn(`DB connection failed (${5 - retries}/5): ${error?.message}`); if (retries === 0) throw error; await new Promise((r) => setTimeout(r, 3000)); }
    }
  }

  async onModuleDestroy() { await this.$disconnect(); }
  async healthCheck(): Promise<boolean> { try { await this.$queryRaw`SELECT 1`; return true; } catch { return false; } }
}
