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

@Controller('admin/migration-features')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationFeaturesController {
  private readonly logger = new Logger(MigrationFeaturesController.name);

  constructor(private prisma: PrismaService) {}

  @Post('run-sql')
  async runSQLMigration(): Promise<ApiResponse<any>> {
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
      const verification = await this.verifyMigration();

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
  async verifyMigration(): Promise<ApiResponse<any>> {
    const verification = await this.verifyMigration();
    return {
      data: verification,
      message: 'Migration verification completed',
    };
  }

  private async verifyMigration() {
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

    // Check if Product table has isPlatformOwned column
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Product' 
          AND column_name = 'isPlatformOwned'
        );`,
      );
      checks['productIsPlatformOwnedColumnExists'] = (result as any)[0]?.exists || false;
    } catch (error) {
      checks['productIsPlatformOwnedColumnExists'] = false;
    }

    // Check if Product.sellerId is nullable
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT is_nullable 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'Product' 
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
      
      // Skip comments (but keep empty lines for formatting)
      if (line.startsWith('--')) {
        continue;
      }

      // Check for DO $$ block start
      if (line.match(/^DO\s+\$\$/i)) {
        // If we have a pending statement, save it first
        if (currentStatement.trim() && !inDoBlock) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        inDoBlock = true;
        dollarQuoteTag = '$$';
        currentStatement = originalLine + '\n';
        continue;
      }

      // Check for DO $tag$ block start (with custom tag)
      const doMatch = line.match(/^DO\s+\$([^$]+)\$/i);
      if (doMatch) {
        // If we have a pending statement, save it first
        if (currentStatement.trim() && !inDoBlock) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        inDoBlock = true;
        dollarQuoteTag = `$${doMatch[1]}$`;
        currentStatement = originalLine + '\n';
        continue;
      }

      // If in DO block, accumulate lines until we find END
      if (inDoBlock) {
        currentStatement += originalLine + '\n';
        
        // Check for END with matching dollar quote (case insensitive, with optional semicolon)
        const endPattern = new RegExp(`^END\\s+\\${dollarQuoteTag.replace(/\$/g, '\\$')}\\s*;?$`, 'i');
        if (line.match(endPattern)) {
          // Found END, close the block
          statements.push(currentStatement.trim());
          currentStatement = '';
          inDoBlock = false;
          dollarQuoteTag = '';
        }
        continue;
      }

      // Regular statement handling - preserve original line to maintain formatting
      if (line.length > 0) {
        currentStatement += originalLine + '\n';
      }

      // Check if line ends with semicolon (end of statement)
      if (line.endsWith(';')) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    // Filter out empty statements and comments
    return statements
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));
  }
}

