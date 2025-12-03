import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Don't block startup - connect in background with timeout
    Promise.race([
      this.$connect().then(() => {
        this.logger.log('Database connected successfully');
      }).catch((error) => {
        this.logger.error('Failed to connect to database:', error.message);
        // Don't throw - allow app to start and retry connection
        // This helps with Railway deployments where DB might not be ready immediately
      }),
      new Promise((resolve) => setTimeout(resolve, 10000)), // 10 second timeout
    ]).then(() => {
      this.logger.debug('Database connection attempt completed (may still be connecting)');
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


