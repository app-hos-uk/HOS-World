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
      this.logger.log('🔄 Syncing database schema...');
      const { stdout, stderr } = await execAsync('pnpm prisma db push --accept-data-loss --skip-generate', {
        cwd: process.cwd(),
        env: process.env,
      });
      if (stdout) this.logger.log(stdout);
      if (stderr && !stderr.includes('Warning')) this.logger.warn(stderr);
      this.logger.log('✅ Database schema synced successfully');
    } catch (error: any) {
      // If error is just about no changes, that's okay
      if (error.message?.includes('already in sync') || error.message?.includes('unchanged')) {
        this.logger.log('✅ Database schema is already in sync');
      } else {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


