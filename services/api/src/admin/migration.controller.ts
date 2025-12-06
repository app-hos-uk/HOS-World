import { Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../database/prisma.service';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller('api/admin/migration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('run-global-features')
  async runGlobalFeaturesMigration() {
    try {
      this.logger.log('🔄 Starting global features migration...');

      // Read the migration SQL file
      const migrationPath = join(
        process.cwd(),
        'prisma/migrations/run_and_baseline.sql',
      );
      const sql = readFileSync(migrationPath, 'utf-8');

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
            if (
              errorMessage.includes('already exists') ||
              errorMessage.includes('duplicate') ||
              errorMessage.includes('does not exist') ||
              errorMessage.includes('ON CONFLICT')
            ) {
              // These are expected for idempotent operations
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
                error: errorMessage,
              });
              this.logger.warn(`Migration statement error: ${errorMessage}`);
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

  @Post('verify')
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

