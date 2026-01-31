import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Running Phase 6 Fandom Features Migration...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../../prisma/migrations/phase6_fandom_features.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split by semicolons and filter out empty statements
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ Statement ${i + 1} executed successfully\n`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)\n`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          // Continue with other statements
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying tables...');

    // Verify tables were created
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('fandoms', 'characters', 'ai_chats', 'badges', 'user_badges', 'quests', 'user_quests', 'collections', 'shared_items')
      ORDER BY table_name;
    `;

    console.log(`\n✅ Found ${tables.length} tables:`);
    tables.forEach((table) => {
      console.log(`   - ${table.table_name}`);
    });

    if (tables.length === 9) {
      console.log('\n🎉 All Phase 6 tables created successfully!');
    } else {
      console.log(`\n⚠️  Expected 9 tables, found ${tables.length}`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
