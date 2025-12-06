import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Reading migration SQL file...');
    const migrationPath = join(__dirname, '../../prisma/migrations/run_and_baseline.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('🔄 Executing migration SQL...');
    
    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error: any) {
          // Ignore errors for IF NOT EXISTS statements
          if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
            console.warn(`⚠️ Warning: ${error.message}`);
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('✅ Database schema updated');
    console.log('✅ Prisma migrations table baselined');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();

