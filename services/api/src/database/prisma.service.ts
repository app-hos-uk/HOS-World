import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Don't block startup - connect in background
    // Return immediately so NestJS doesn't wait
    this.$connect()
      .then(async () => {
        this.logger.log('Database connected successfully');
        
        // Sync database schema if needed (for production deployments)
        if (process.env.NODE_ENV === 'production' && process.env.SYNC_DB_SCHEMA !== 'false') {
          try {
            this.logger.log('🔄 Syncing database schema...');
            const { execSync } = require('child_process');
            execSync('pnpm prisma db push --accept-data-loss --skip-generate', {
              cwd: process.cwd(),
              stdio: 'inherit',
              env: process.env,
            });
            this.logger.log('✅ Database schema synced successfully');
          } catch (error) {
            this.logger.warn('⚠️ Database schema sync failed:', error.message);
            // Continue anyway - app can still run
          }
        }
      })
      .catch((error) => {
        this.logger.error('Failed to connect to database:', error.message);
        // Don't throw - allow app to start and retry connection
        // This helps with Railway deployments where DB might not be ready immediately
      });
    // Return immediately - don't wait for connection
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


