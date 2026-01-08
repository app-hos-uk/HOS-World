#!/usr/bin/env ts-node
/**
 * Script to verify OAuthAccount table exists in production database
 * Usage: pnpm ts-node scripts/verify-oauth-table.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyOAuthTable() {
  try {
    console.log('🔍 Verifying OAuthAccount table...\n');

    // Check if table exists by trying to query it
    const count = await prisma.oAuthAccount.count();
    console.log(`✅ OAuthAccount table exists`);
    console.log(`   Total OAuth accounts: ${count}\n`);

    // Check table structure by querying a sample
    const sample = await prisma.oAuthAccount.findFirst({
      select: {
        id: true,
        userId: true,
        provider: true,
        providerId: true,
        createdAt: true,
      },
    });

    if (sample) {
      console.log('✅ Table structure verified');
      console.log('   Sample record:', JSON.stringify(sample, null, 2));
    } else {
      console.log('ℹ️  Table exists but is empty (no OAuth accounts yet)');
    }

    // Check indexes
    console.log('\n📊 Checking indexes...');
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE tablename = 'oauth_accounts' 
       AND schemaname = 'public'`
    );

    console.log(`   Found ${indexes.length} indexes:`);
    indexes.forEach((idx) => console.log(`   - ${idx.indexname}`));

    // Verify required indexes exist
    const requiredIndexes = ['oauth_accounts_provider_providerId_key', 'oauth_accounts_userId_idx', 'oauth_accounts_provider_idx'];
    const existingIndexNames = indexes.map((idx) => idx.indexname);
    const missingIndexes = requiredIndexes.filter((idx) => !existingIndexNames.includes(idx));

    if (missingIndexes.length === 0) {
      console.log('✅ All required indexes exist');
    } else {
      console.log(`⚠️  Missing indexes: ${missingIndexes.join(', ')}`);
    }

    console.log('\n✅ OAuthAccount table verification complete!');
    return true;
  } catch (error: any) {
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('❌ OAuthAccount table does not exist in the database!');
      console.error('   Run migration: pnpm db:migrate');
      return false;
    }
    console.error('❌ Error verifying OAuthAccount table:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifyOAuthTable()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
