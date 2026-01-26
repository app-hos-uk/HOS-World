import {
  Controller,
  Post,
  Get,
  UseGuards,
  Logger,
  ForbiddenException,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('admin/migration-features')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationFeaturesController {
  private readonly logger = new Logger(MigrationFeaturesController.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private checkMigrationsEnabled(): void {
    const enabled = this.configService.get<string>('ENABLE_ADMIN_MIGRATIONS') === 'true';
    if (!enabled) {
      this.logger.warn('Admin migration endpoint called but ENABLE_ADMIN_MIGRATIONS is not set to "true"');
      throw new ForbiddenException('Admin migrations are disabled in production. Set ENABLE_ADMIN_MIGRATIONS=true to enable.');
    }
  }

  @Post('run-sql')
  @ApiOperation({ summary: 'Run features migration', description: 'Runs comprehensive features migration SQL. Requires ENABLE_ADMIN_MIGRATIONS=true. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Migration completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required or migrations disabled' })
  async runSQLMigration(): Promise<ApiResponse<any>> {
    this.checkMigrationsEnabled();
    
    try {
      this.logger.log('🔄 Running comprehensive features migration...');

      // Read SQL file
      const sqlPath = path.join(
        process.cwd(),
        'prisma',
        'migrations',
        'add_comprehensive_features.sql',
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
      this.logger.log(`📊 Split SQL into ${statements.length} statements`);
      if (statements.length <= 5) {
        this.logger.warn(`⚠️ Only ${statements.length} statements found - this seems too few. First statement preview: ${statements[0]?.substring(0, 200)}...`);
      }

      const results: any[] = [];
      let successful = 0;
      let errors = 0;

      // Execute each statement
      for (const statement of statements) {
        if (!statement || statement.trim().length === 0) continue;

        try {
          await this.prisma.$executeRawUnsafe(statement);
          successful++;
          results.push({
            statement: statement.substring(0, 100) + '...',
            status: 'success',
          });
        } catch (error: any) {
          errors++;
          this.logger.error(`❌ SQL statement failed: ${error.message}`);
          results.push({
            statement: statement.substring(0, 100) + '...',
            status: 'error',
            error: error.message,
          });
        }
      }

      // Verify migration
      const verification = await this.verifyMigrationInternal();

      return {
        data: {
          success: errors === 0,
          message: errors === 0
            ? 'Migration completed successfully'
            : `Migration completed with ${errors} errors`,
          summary: {
            totalStatements: statements.length,
            successful,
            errors,
          },
          verification,
          details: results,
        },
        message: errors === 0
          ? 'Migration completed successfully'
          : `Migration completed with ${errors} errors`,
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
  @ApiOperation({ summary: 'Verify features migration', description: 'Verifies that features migration was successful. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Migration verification completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async verifyMigration(): Promise<ApiResponse<any>> {
    const verification = await this.verifyMigrationInternal();
    return {
      data: verification,
      message: 'Migration verification completed',
    };
  }

  private async verifyMigrationInternal() {
    const checks: Record<string, boolean> = {};

    // Check if all new tables exist
    const tables = [
      'SellerInvitation',
      'ActivityLog',
      'Transaction',
      'Discrepancy',
      'SupportTicket',
      'TicketMessage',
      'KnowledgeBaseArticle',
      'WhatsAppConversation',
      'WhatsAppMessage',
      'WhatsAppTemplate',
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
        checks[`${table}TableExists`] = false;
      }
    }

    // Check if Product table has isPlatformOwned column (table name is 'products' in database)
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'products' 
          AND column_name = 'isPlatformOwned'
        );`,
      );
      checks['productIsPlatformOwnedColumnExists'] = (result as any)[0]?.exists || false;
    } catch (error) {
      checks['productIsPlatformOwnedColumnExists'] = false;
    }

    // Check if Product.sellerId is nullable (table name is 'products' in database)
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT is_nullable 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'products' 
         AND column_name = 'sellerId';`,
      );
      checks['productSellerIdNullable'] = (result as any)[0]?.is_nullable === 'YES';
    } catch (error) {
      checks['productSellerIdNullable'] = false;
    }

    return checks;
  }

  private splitSQLStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inDoBlock = false;
    let dollarQuoteTag = '';
    const lines = sql.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      const line = originalLine.trim();
      
      // Skip comment lines
      if (line.startsWith('--')) {
        continue;
      }

      // Check for DO $$ block start (must be at start of line)
      const doMatch = line.match(/^DO\s+(\$\$|\$[^$]+\$)/i);
      if (doMatch) {
        // Save any pending statement before starting DO block
        if (currentStatement.trim() && !inDoBlock) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        inDoBlock = true;
        dollarQuoteTag = doMatch[1];
        currentStatement = originalLine + '\n';
        continue;
      }

      // If in DO block, accumulate all lines
      if (inDoBlock) {
        currentStatement += originalLine + '\n';
        
        // Check for END statement (must match the dollar quote tag)
        // Pattern: END followed by whitespace, then the dollar quote tag, optional semicolon
        const escapedTag = dollarQuoteTag.replace(/\$/g, '\\$');
        const endPattern = new RegExp(`^END\\s+${escapedTag}\\s*;?\\s*$`, 'i');
        
        if (endPattern.test(line)) {
          // Found END, close the DO block
          const trimmed = currentStatement.trim();
          if (trimmed.length > 0) {
            statements.push(trimmed);
          }
          currentStatement = '';
          inDoBlock = false;
          dollarQuoteTag = '';
        }
        continue;
      }

      // Regular statement handling (not in DO block)
      // Add non-empty lines to current statement
      if (line.length > 0) {
        currentStatement += originalLine + '\n';
      }

      // If line ends with semicolon, it's the end of a statement
      if (line.endsWith(';')) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement (shouldn't happen in well-formed SQL, but handle it)
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    // Filter out empty statements and comments
    const filtered = statements
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    return filtered;
  }
}

