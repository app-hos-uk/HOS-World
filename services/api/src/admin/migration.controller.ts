import { Controller, Post, Get, UseGuards, Logger, ForbiddenException Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('admin/migration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if admin migrations are enabled
   */
  private checkMigrationsEnabled(): void {
    const enabled = this.configService.get<string>('ENABLE_ADMIN_MIGRATIONS') === 'true';
    if (!enabled) {
      this.logger.warn('Admin migration endpoint called but ENABLE_ADMIN_MIGRATIONS is not set to "true"');
      throw new ForbiddenException('Admin migrations are disabled in production. Set ENABLE_ADMIN_MIGRATIONS=true to enable.');
    }
  }

  @Post('run-global-features')
  @ApiOperation({ summary: 'Run global features migration', description: 'Runs the global features migration SQL. Requires ENABLE_ADMIN_MIGRATIONS=true. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Migration completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required or migrations disabled' })
  async runGlobalFeaturesMigration() {
    this.checkMigrationsEnabled();
    
    try {
      this.logger.log('🔄 Starting global features migration...');

      // Read the migration SQL file - try multiple possible paths
      let migrationPath: string;
      const possiblePaths = [
        join(process.cwd(), 'prisma/migrations/run_and_baseline.sql'),
        join(process.cwd(), 'services/api/prisma/migrations/run_and_baseline.sql'),
        join(__dirname, '../../prisma/migrations/run_and_baseline.sql'),
        join(__dirname, '../../../prisma/migrations/run_and_baseline.sql'),
      ];

      let sql: string;
      let foundPath: string | null = null;

      for (const path of possiblePaths) {
        try {
          sql = readFileSync(path, 'utf-8');
          foundPath = path;
          this.logger.log(`✅ Found migration file at: ${path}`);
          break;
        } catch (error) {
          // Try next path
          continue;
        }
      }

      if (!foundPath || !sql) {
        this.logger.error('❌ Migration SQL file not found. Tried paths:');
        possiblePaths.forEach(p => this.logger.error(`   - ${p}`));
        throw new Error('Migration SQL file not found');
      }

      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.prisma.$executeRawUnsafe(statement);
            successCount++;
            results.push({
              statement: statement.substring(0, 100) + '...',
              status: 'success',
            });
          } catch (error: any) {
            // Ignore errors for IF NOT EXISTS statements
            const errorMessage = error.message || '';
            const errorCode = error.code || '';
            
            // Log all errors for debugging
            this.logger.warn(`SQL Statement error: ${errorMessage.substring(0, 200)}`);
            this.logger.warn(`Statement: ${statement.substring(0, 200)}...`);
            
            if (
              errorMessage.includes('already exists') ||
              errorMessage.includes('duplicate') ||
              errorMessage.includes('ON CONFLICT') ||
              errorCode === '42P07' // PostgreSQL: duplicate_table
            ) {
              // These are expected for idempotent operations
              successCount++;
              results.push({
                statement: statement.substring(0, 100) + '...',
                status: 'skipped (already exists)',
              });
            } else if (
              errorMessage.includes('does not exist') &&
              errorMessage.includes('DROP')
            ) {
              // DROP IF EXISTS errors are okay
              successCount++;
              results.push({
                statement: statement.substring(0, 100) + '...',
                status: 'skipped (does not exist)',
              });
            } else {
              errorCount++;
              results.push({
                statement: statement.substring(0, 100) + '...',
                status: 'error',
                error: errorMessage,
                code: errorCode,
              });
              this.logger.error(`❌ Migration statement failed: ${errorMessage}`);
            }
          }
        }
      }

      // Verify migration
      const usersTableCheck = await this.prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'country';
      `;

      const hasCountryColumn = (usersTableCheck as any[]).length > 0;

      this.logger.log(`✅ Migration completed: ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        message: 'Migration completed',
        summary: {
          totalStatements: statements.length,
          successful: successCount,
          errors: errorCount,
        },
        verification: {
          countryColumnExists: hasCountryColumn,
        },
        details: results,
      };
    } catch (error: any) {
      this.logger.error('❌ Migration failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Migration failed. Check logs for details.',
      };
    }
  }

  @Post('run-sql-direct')
  @ApiOperation({ summary: 'Run SQL migration directly', description: 'Runs embedded SQL migration directly. Requires ENABLE_ADMIN_MIGRATIONS=true. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Migration completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required or migrations disabled' })
  async runSQLDirect() {
    this.checkMigrationsEnabled();
    
    try {
      this.logger.log('🔄 Running SQL migration directly (embedded SQL)...');

      // Embedded SQL as fallback - this ensures it always works
      // Execute statements one by one to ensure proper execution
      const sqlStatements = [
        // Add columns to users table - execute as separate statements
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredCommunicationMethod" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currencyPreference" TEXT DEFAULT 'GBP'`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gdprConsent" BOOLEAN DEFAULT false`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gdprConsentDate" TIMESTAMP`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dataProcessingConsent" JSONB`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "countryDetectedAt" TIMESTAMP`,
        
        // Add columns to customers table
        `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "country" TEXT`,
        `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "currencyPreference" TEXT DEFAULT 'GBP'`,
        
        // Create CurrencyExchangeRate table
        `CREATE TABLE IF NOT EXISTS "currency_exchange_rates" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "baseCurrency" TEXT NOT NULL DEFAULT 'GBP',
          "targetCurrency" TEXT NOT NULL,
          "rate" DECIMAL(10, 6) NOT NULL,
          "cachedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP NOT NULL,
          CONSTRAINT "currency_exchange_rates_baseCurrency_targetCurrency_key" UNIQUE ("baseCurrency", "targetCurrency")
        )`,
        
        // Create GDPRConsentLog table
        `CREATE TABLE IF NOT EXISTS "gdpr_consent_logs" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "consentType" TEXT NOT NULL,
          "granted" BOOLEAN NOT NULL,
          "grantedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "revokedAt" TIMESTAMP,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          CONSTRAINT "gdpr_consent_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )`,
        
        // Create indexes (only after tables exist)
        `CREATE INDEX IF NOT EXISTS "currency_exchange_rates_baseCurrency_idx" ON "currency_exchange_rates"("baseCurrency")`,
        `CREATE INDEX IF NOT EXISTS "currency_exchange_rates_targetCurrency_idx" ON "currency_exchange_rates"("targetCurrency")`,
        `CREATE INDEX IF NOT EXISTS "currency_exchange_rates_expiresAt_idx" ON "currency_exchange_rates"("expiresAt")`,
        `CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_userId_idx" ON "gdpr_consent_logs"("userId")`,
        `CREATE INDEX IF NOT EXISTS "gdpr_consent_logs_consentType_idx" ON "gdpr_consent_logs"("consentType")`,
        `CREATE INDEX IF NOT EXISTS "users_country_idx" ON "users"("country")`,
        `CREATE INDEX IF NOT EXISTS "users_currencyPreference_idx" ON "users"("currencyPreference")`,
        
        // Update default currency
        `ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'GBP'`,
        `ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'GBP'`,
        `ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'GBP'`,
        `ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'GBP'`,
        
        // Backfill currency preference
        `UPDATE "users" SET "currencyPreference" = 'GBP' WHERE "currencyPreference" IS NULL`,
        
        // Initialize default exchange rates
        `INSERT INTO "currency_exchange_rates" ("id", "baseCurrency", "targetCurrency", "rate", "cachedAt", "expiresAt")
         VALUES 
           (gen_random_uuid()::text, 'GBP', 'GBP', 1.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
           (gen_random_uuid()::text, 'GBP', 'USD', 1.27, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
           (gen_random_uuid()::text, 'GBP', 'EUR', 1.17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
           (gen_random_uuid()::text, 'GBP', 'AED', 4.67, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour')
         ON CONFLICT ("baseCurrency", "targetCurrency") DO NOTHING`,
      ];

      // Use pre-defined statements array (already properly split)
      const statements = sqlStatements.map(s => s.trim()).filter(s => s.length > 0);

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.prisma.$executeRawUnsafe(statement);
            successCount++;
            results.push({
              statement: statement.substring(0, 100) + '...',
              status: 'success',
            });
          } catch (error: any) {
            const errorMessage = error.message || '';
            const errorCode = error.code || '';
            
            this.logger.warn(`SQL Statement: ${statement.substring(0, 100)}...`);
            this.logger.warn(`Error: ${errorMessage.substring(0, 200)}`);
            
            if (
              errorMessage.includes('already exists') ||
              errorMessage.includes('duplicate') ||
              errorMessage.includes('ON CONFLICT') ||
              errorCode === '42P07'
            ) {
              successCount++;
              results.push({
                statement: statement.substring(0, 100) + '...',
                status: 'skipped (already exists)',
              });
            } else {
              errorCount++;
              results.push({
                statement: statement.substring(0, 100) + '...',
                status: 'error',
                error: errorMessage.substring(0, 200),
                code: errorCode,
              });
              this.logger.error(`❌ Failed: ${errorMessage}`);
            }
          }
        }
      }

      // Verify migration
      const usersColumns = await this.prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('country', 'currencyPreference', 'gdprConsent');
      `;

      const currencyTable = await this.prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'currency_exchange_rates';
      `;

      const hasCurrencyPreference = (usersColumns as any[]).some((c: any) => c.column_name === 'currencyPreference');
      const hasCurrencyTable = (currencyTable as any[]).length > 0;

      this.logger.log(`✅ Direct SQL migration completed: ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        message: 'Migration completed',
        summary: {
          totalStatements: statements.length,
          successful: successCount,
          errors: errorCount,
        },
        verification: {
          currencyPreferenceColumnExists: hasCurrencyPreference,
          currencyExchangeRatesTableExists: hasCurrencyTable,
          allColumns: (usersColumns as any[]).map((c: any) => c.column_name),
        },
        details: results.slice(0, 20), // Limit details to first 20
      };
    } catch (error: any) {
      this.logger.error('❌ Direct SQL migration failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Migration failed. Check logs for details.',
      };
    }
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify migration', description: 'Verifies that migration was successful by checking for new columns and tables. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Migration verification completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async verifyMigration() {
    try {
      // Check if new columns exist
      const usersColumns = await this.prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('country', 'currencyPreference', 'gdprConsent');
      `;

      // Check if new tables exist
      const newTables = await this.prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name IN ('currency_exchange_rates', 'gdpr_consent_logs');
      `;

      // Check if migrations table exists
      const migrationsTable = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        ) as exists;
      `;

      const hasMigrationsTable = (migrationsTable as any[])[0]?.exists || false;

      return {
        success: true,
        usersColumns: (usersColumns as any[]).map((c) => c.column_name),
        newTables: (newTables as any[]).map((t) => t.table_name),
        migrationsTableExists: hasMigrationsTable,
        allColumnsPresent:
          (usersColumns as any[]).length >= 3 &&
          (newTables as any[]).length >= 2,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

