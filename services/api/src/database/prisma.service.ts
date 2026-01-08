import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log('[DEBUG] Hypothesis A: PrismaService onModuleInit - checking RefreshToken model...');
    // Check if RefreshToken model exists in Prisma client
    try {
      // PrismaClient exposes models as properties (e.g., this.user, this.refreshToken)
      // Check both camelCase (refreshToken) and the actual property
      const hasRefreshToken = typeof (this as any).refreshToken !== 'undefined';
      const hasRefreshTokenAlt = typeof (this as any).refresh_token !== 'undefined';
      const hasRefreshTokenCheck = 'refreshToken' in this || 'refresh_token' in this;
      
      this.logger.log(`[DEBUG] Hypothesis A: Prisma client check - hasRefreshToken (camelCase): ${hasRefreshToken}`);
      this.logger.log(`[DEBUG] Hypothesis A: Prisma client check - hasRefreshToken (snake_case): ${hasRefreshTokenAlt}`);
      this.logger.log(`[DEBUG] Hypothesis A: Prisma client check - 'refreshToken' in this: ${hasRefreshTokenCheck}`);
      
      // Also check if we can access it via the model name from schema
      const allKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).concat(Object.keys(this));
      const refreshTokenKeys = allKeys.filter(k => k.toLowerCase().includes('refreshtoken') || k.toLowerCase().includes('refresh_token'));
      this.logger.log(`[DEBUG] Hypothesis A: Keys containing 'refreshToken': ${refreshTokenKeys.join(', ') || 'none'}`);
      
      // Check known models to verify Prisma client is working
      const hasUser = typeof (this as any).user !== 'undefined';
      const hasProduct = typeof (this as any).product !== 'undefined';
      this.logger.log(`[DEBUG] Hypothesis A: Known models - user: ${hasUser}, product: ${hasProduct}`);
      
      if (hasRefreshToken || hasRefreshTokenAlt || hasRefreshTokenCheck) {
        this.logger.log('[DEBUG] Hypothesis A: ✅ RefreshToken model found in Prisma client');
      } else {
        this.logger.error('[DEBUG] Hypothesis A: ❌ RefreshToken model NOT found in Prisma client!');
        this.logger.error('[DEBUG] Hypothesis A: Available Prisma models (first 20):', Object.keys(this).filter(k => !k.startsWith('$') && !k.startsWith('_') && k !== 'logger').slice(0, 20).join(', '));
        this.logger.error('[DEBUG] Hypothesis A: This will cause crashes when auth methods try to use refreshToken!');
        this.logger.error('[DEBUG] Hypothesis A: Solution: Ensure Prisma client is regenerated with: pnpm db:generate');
        this.logger.error('[DEBUG] Hypothesis A: Also verify schema.prisma contains: model RefreshToken');
      }
    } catch (error: any) {
      this.logger.error('[DEBUG] Hypothesis A: ❌ Error checking RefreshToken model:', error?.message || error);
      this.logger.error('[DEBUG] Hypothesis A: Error stack:', error?.stack);
    }
    // Don't block startup - connect in background with retry logic
    // Return immediately so NestJS doesn't wait
    this.connectWithRetry()
      .then(async () => {
        this.logger.log('✅ Database connected successfully', 'PrismaService');
        
        // Sync database schema if needed (for production deployments)
        if (process.env.NODE_ENV === 'production' && process.env.SYNC_DB_SCHEMA !== 'false') {
          // Run schema sync in background - don't block
          this.syncDatabaseSchema().catch((error: any) => {
            this.logger.warn(`⚠️ Database schema sync failed: ${error?.message || 'Unknown error'}`, 'PrismaService');
            this.logger.debug(error?.stack, 'PrismaService');
          });
        }
      })
      .catch((error: any) => {
        this.logger.error(`❌ Database connection failed after retries: ${error?.message || 'Unknown error'}`, 'PrismaService');
        this.logger.debug(error?.stack, 'PrismaService');
        // Don't throw - allow app to start and retry connection
        // This helps with Railway deployments where DB might not be ready immediately
      });
    // Return immediately - don't wait for connection
  }

  /**
   * Connect to database with exponential backoff retry
   */
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
      this.logger.log('🔄 Running database migrations...');
      
      // First, check if _prisma_migrations table exists
      const migrationsTableExists = await this.checkMigrationsTableExists();
      
      if (!migrationsTableExists) {
        this.logger.log('⚠️ Prisma migrations table not found. Database may need baselining.');
        this.logger.log('💡 Run the migration SQL manually or use: pnpm db:run-migration-sql');
        // Don't try to run migrate deploy if table doesn't exist - it will fail
        return;
      }
      
      // Use migrate deploy for production (applies pending migrations)
      const { stdout, stderr } = await execAsync('pnpm prisma migrate deploy', {
        cwd: process.cwd(),
        env: process.env,
      });
      if (stdout) this.logger.log(stdout);
      if (stderr && !stderr.includes('Warning')) this.logger.warn(stderr);
      this.logger.log('✅ Database migrations applied successfully');
    } catch (error: any) {
      // If no migrations to apply, that's okay
      if (error.message?.includes('No pending migrations') || error.message?.includes('already applied')) {
        this.logger.log('✅ Database is up to date - no pending migrations');
      } else if (error.message?.includes('P3005') || error.message?.includes('not empty')) {
        this.logger.warn('⚠️ Database needs baselining. Run migration SQL manually.');
        this.logger.warn('💡 See: services/api/prisma/migrations/run_and_baseline.sql');
      } else {
        // Log error but don't throw - allow app to continue
        this.logger.warn('⚠️ Migration check completed with warnings:', error.message);
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


