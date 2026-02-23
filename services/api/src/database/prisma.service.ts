import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.connectWithRetry()
      .then(async () => {
        this.logger.log('Database connected successfully', 'PrismaService');

        if (process.env.NODE_ENV === 'production' && process.env.SYNC_DB_SCHEMA !== 'false') {
          this.syncDatabaseSchema().catch((error: any) => {
            this.logger.warn(
              `Database schema sync failed: ${error?.message || 'Unknown error'}`,
              'PrismaService',
            );
          });
        }
      })
      .catch((error: any) => {
        this.logger.error(
          `Database connection failed after retries: ${error?.message || 'Unknown error'}`,
          'PrismaService',
        );
      });
  }

  private async connectWithRetry(maxRetries = 5, initialDelay = 1000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log(`Database connected on attempt ${attempt}`, 'PrismaService');
        return;
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Database connection attempt ${attempt} failed, retrying in ${delay}ms: ${error?.message || 'Unknown error'}`,
          'PrismaService',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async syncDatabaseSchema() {
    try {
      this.logger.log('Running database migrations...');

      const migrationsTableExists = await this.checkMigrationsTableExists();
      if (!migrationsTableExists) {
        this.logger.log('Prisma migrations table not found. Database may need baselining.');
        return;
      }

      const { stdout, stderr } = await execAsync('pnpm prisma migrate deploy', {
        cwd: process.cwd(),
        env: process.env,
      });
      if (stdout) this.logger.log(stdout);
      if (stderr && !stderr.includes('Warning')) this.logger.warn(stderr);
      this.logger.log('Database migrations applied successfully');
    } catch (error: any) {
      if (
        error.message?.includes('No pending migrations') ||
        error.message?.includes('already applied')
      ) {
        this.logger.log('Database is up to date - no pending migrations');
      } else if (error.message?.includes('P3005') || error.message?.includes('not empty')) {
        this.logger.warn('Database needs baselining. Run migration SQL manually.');
      } else {
        this.logger.warn('Migration check completed with warnings:', error.message);
      }
    }
  }

  private async checkMigrationsTableExists(): Promise<boolean> {
    try {
      const result = await this.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        );
      `;
      return (result as any[])[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
