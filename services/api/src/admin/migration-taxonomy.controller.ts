import {
  Controller,
  Post,
  Get,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('admin/migration-taxonomy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationTaxonomyController {
  private readonly logger = new Logger(MigrationTaxonomyController.name);

  constructor(private prisma: PrismaService) {}

  @Post('run-sql')
  async runSQLMigration(): Promise<ApiResponse<any>> {
    try {
      this.logger.log('🔄 Running taxonomy system migration...');

      // Read SQL file
      const sqlPath = path.join(
        process.cwd(),
        'prisma',
        'migrations',
        'add_taxonomy_system.sql',
      );

      let sqlContent: string;
      try {
        sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      } catch (error) {
        this.logger.error('❌ Failed to read SQL file:', error);
        return {
          data: null,
          message: 'Failed to read SQL migration file',
          error: 'SQL file not found',
        };
      }

      // Split SQL into statements, handling DO blocks properly
      const statements = this.splitSQLStatements(sqlContent);

      this.logger.log(`📝 Found ${statements.length} SQL statements to execute`);

      const results: any[] = [];
      let successful = 0;
      let errors = 0;

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (!statement || statement.startsWith('--')) {
          continue;
        }

        try {
          await this.prisma.$executeRawUnsafe(statement);
          successful++;
          results.push({
            statement: statement.substring(0, 100) + '...',
            status: 'success',
          });
          this.logger.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error: any) {
          errors++;
          results.push({
            statement: statement.substring(0, 100) + '...',
            status: 'error',
            error: error.message,
          });
          this.logger.error(`❌ Statement ${i + 1}/${statements.length} failed:`, error.message);
        }
      }

      this.logger.log(`✅ Migration completed: ${successful} successful, ${errors} errors`);

      return {
        data: {
          totalStatements: statements.length,
          successful,
          errors,
          results,
          verification: await this.verifyMigrationInternal(),
        },
        message:
          errors === 0
            ? 'Taxonomy migration completed successfully'
            : `Taxonomy migration completed with ${errors} errors`,
      };
    } catch (error: any) {
      this.logger.error('❌ Migration failed:', error.message);
      return {
        data: null,
        message: 'Migration failed',
        error: error.message,
      };
    }
  }

  @Get('verify')
  async verifyMigrationStatus(): Promise<ApiResponse<any>> {
    const verification = await this.verifyMigrationInternal();
    return {
      data: verification,
      message: 'Taxonomy migration verification completed',
    };
  }

  private async verifyMigrationInternal() {
    const checks: Record<string, boolean> = {};

    // Check if all new tables exist
    const tables = [
      'categories',
      'attributes',
      'attribute_values',
      'product_attributes',
      'tags',
      'product_tags',
    ];

    for (const table of tables) {
      try {
        const result = await this.prisma.$queryRawUnsafe(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
          );`,
        );
        checks[`${table}TableExists`] = (result as any)[0]?.exists || false;
      } catch (error) {
        this.logger.error(`Error checking table ${table}:`, error);
        checks[`${table}TableExists`] = false;
      }
    }

    // Check if categoryId column exists in products table
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'products' 
          AND column_name = 'categoryId'
        );`,
      );
      checks['productCategoryIdColumnExists'] = (result as any)[0]?.exists || false;
    } catch (error) {
      this.logger.error('Error checking categoryId column:', error);
      checks['productCategoryIdColumnExists'] = false;
    }

    // Check if enums exist
    const enums = ['AttributeType', 'TagCategory'];
    for (const enumName of enums) {
      try {
        const result = await this.prisma.$queryRawUnsafe(
          `SELECT EXISTS (
            SELECT FROM pg_type 
            WHERE typname = '${enumName}'
          );`,
        );
        checks[`${enumName}EnumExists`] = (result as any)[0]?.exists || false;
      } catch (error) {
        this.logger.error(`Error checking enum ${enumName}:`, error);
        checks[`${enumName}EnumExists`] = false;
      }
    }

    return checks;
  }

  private splitSQLStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inDoBlock = false;
    let doBlockDepth = 0;

    const lines = sql.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('--')) {
        continue;
      }

      // Check for DO $$ BEGIN blocks
      if (trimmed.toUpperCase().includes('DO $$ BEGIN')) {
        inDoBlock = true;
        doBlockDepth = 1;
        currentStatement += line + '\n';
        continue;
      }

      if (inDoBlock) {
        currentStatement += line + '\n';

        // Count nested BEGIN/END
        const beginMatches = (line.match(/\bBEGIN\b/gi) || []).length;
        const endMatches = (line.match(/\bEND\s*\$\$/gi) || []).length;

        doBlockDepth += beginMatches;
        doBlockDepth -= endMatches;

        if (doBlockDepth === 0) {
          inDoBlock = false;
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        continue;
      }

      // Regular statements
      currentStatement += line + '\n';

      // Check for statement end (semicolon not in string)
      if (trimmed.endsWith(';') && !this.isInString(currentStatement)) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements.filter((s) => s.length > 0);
  }

  private isInString(sql: string): boolean {
    let inString = false;
    let escapeNext = false;
    let quoteChar = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if ((char === "'" || char === '"') && !inString) {
        inString = true;
        quoteChar = char;
        continue;
      }

      if (char === quoteChar && inString) {
        inString = false;
        quoteChar = '';
      }
    }

    return inString;
  }
}

