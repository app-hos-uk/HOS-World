import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
          // Run schema sync in background - don't block
          this.syncDatabaseSchema().catch((error) => {
            this.logger.warn('⚠️ Database schema sync failed:', error.message);
          });
        }
      })
      .catch((error) => {
        this.logger.error('Failed to connect to database:', error.message);
        // Don't throw - allow app to start and retry connection
        // This helps with Railway deployments where DB might not be ready immediately
      });
    // Return immediately - don't wait for connection
  }

  private async syncDatabaseSchema() {
    try {
      this.logger.log('🔄 Running database migrations...');
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
      } else {
        // Log error but don't throw - allow app to continue
        this.logger.warn('⚠️ Migration check completed with warnings:', error.message);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


