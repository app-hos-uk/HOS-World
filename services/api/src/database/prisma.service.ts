import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { marketScopeExtension } from './prisma-market-scope';

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

  /**
   * Client with the market-scope extension applied. `$extends` returns a new
   * client instead of mutating, so the model delegates and `$transaction` on
   * this service are re-pointed at it below. That keeps `PrismaService`
   * assignable to `PrismaClient` for the rest of the codebase while ensuring
   * every query — including those issued inside an interactive transaction —
   * passes through the extension.
   */
  private readonly scoped: ReturnType<typeof PrismaService.prototype.$extends>;

  constructor() {
    super({
      datasourceUrl: buildDatasourceUrl(),
    });
    this.scoped = this.$extends(marketScopeExtension) as never;
    this.routeThroughScopedClient();
  }

  private routeThroughScopedClient(): void {
    const scoped = this.scoped as unknown as Record<string, any>;
    const self = this as unknown as Record<string, any>;

    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1);
      if (scoped[delegate]) {
        self[delegate] = scoped[delegate];
      }
    }

    // Interactive transactions must come from the extended client, otherwise
    // the `tx` handed to callbacks bypasses the extension entirely.
    // Bind rather than wrapping with rest-spread so Prisma's overload
    // dispatch (array vs callback vs options object) sees the original this.
    self.$transaction = scoped.$transaction.bind(scoped);
  }

  async onModuleInit() {
    try {
      await this.connectWithRetry();
      this.logger.log('Database connected successfully', 'PrismaService');

      // Only run in-app migration when explicitly opted-in.
      // The docker-entrypoint.sh already runs `prisma migrate deploy` before boot,
      // so running it again here doubles the migration time and can cause lock contention.
      if (process.env.NODE_ENV === 'production' && process.env.SYNC_DB_SCHEMA === 'true') {
        this.syncDatabaseSchema().catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Database schema sync failed: ${msg}`, 'PrismaService');
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database connection failed after retries: ${msg}`, 'PrismaService');
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
