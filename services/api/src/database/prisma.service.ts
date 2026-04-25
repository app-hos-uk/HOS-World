import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function buildDatasourceUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;
  if (baseUrl.includes('connection_limit')) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  const poolSize = process.env.DB_POOL_SIZE || '20';
  const poolTimeout = process.env.DB_POOL_TIMEOUT || '10';
  return `${baseUrl}${separator}connection_limit=${poolSize}&pool_timeout=${poolTimeout}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasourceUrl: buildDatasourceUrl(),
    });
  }

  async onModuleInit() {
    try {
      await this.connectWithRetry();
      this.logger.log('Database connected successfully', 'PrismaService');

      if (process.env.NODE_ENV === 'production' && process.env.SYNC_DB_SCHEMA !== 'false') {
        this.syncDatabaseSchema().catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Database schema sync failed: ${msg}`, 'PrismaService');
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Database connection failed after retries: ${msg}`,
        'PrismaService',
      );
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      throw error;
    }
  }

  private async connectWithRetry(maxRetries = 5, initialDelay = 1000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log(`Database connected on attempt ${attempt}`, 'PrismaService');
        return;
      } catch (error: unknown) {
        if (attempt === maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, attempt - 1);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Database connection attempt ${attempt} failed, retrying in ${delay}ms: ${msg}`,
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('No pending migrations') || msg.includes('already applied')) {
        this.logger.log('Database is up to date - no pending migrations');
      } else if (msg.includes('P3005') || msg.includes('not empty')) {
        this.logger.warn('Database needs baselining. Run migration SQL manually.');
      } else {
        this.logger.warn('Migration check completed with warnings:', msg);
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
