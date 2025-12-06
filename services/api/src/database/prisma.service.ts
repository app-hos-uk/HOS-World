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


