/**
 * SELLER Role to B2C_SELLER Migration Script
 * 
 * This script migrates users with the legacy SELLER role to B2C_SELLER.
 * The SELLER role was marked for deprecation in favor of B2C_SELLER which
 * better distinguishes from WHOLESALER sellers.
 * 
 * IMPORTANT: Run this script BEFORE removing SELLER from the UserRole enum.
 * 
 * Usage:
 * 1. Take a database backup before running
 * 2. Run: npx ts-node src/database/migrate-seller-role.ts
 * 3. Verify the migration was successful
 * 4. Update code to remove SELLER checks (replace with B2C_SELLER only)
 * 5. Remove SELLER from UserRole enum in schema.prisma
 * 6. Run prisma migrate to update the database enum
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('SELLER to B2C_SELLER Migration Script');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Count current SELLER users
  console.log('Step 1: Analyzing current SELLER users...');
  const sellerCount = await prisma.user.count({
    where: { role: 'SELLER' },
  });

  console.log(`Found ${sellerCount} users with SELLER role`);

  if (sellerCount === 0) {
    console.log('No users to migrate. Migration complete!');
    return;
  }

  // Step 2: Get details of SELLER users
  console.log('\nStep 2: Getting SELLER user details...');
  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      sellerProfile: {
        select: {
          id: true,
          storeName: true,
          sellerType: true,
        },
      },
    },
  });

  console.log('\nUsers to migrate:');
  console.log('-'.repeat(60));
  for (const seller of sellers) {
    console.log(`- ${seller.email} (${seller.firstName} ${seller.lastName})`);
    if (seller.sellerProfile) {
      console.log(`  Store: ${seller.sellerProfile.storeName}`);
      console.log(`  Seller Type: ${seller.sellerProfile.sellerType}`);
    }
  }
  console.log('-'.repeat(60));

  // Step 3: Migrate users
  console.log('\nStep 3: Migrating users...');
  
  const dryRun = process.argv.includes('--dry-run');
  
  if (dryRun) {
    console.log('\n[DRY RUN MODE] No changes will be made.');
    console.log(`Would update ${sellerCount} users from SELLER to B2C_SELLER`);
  } else {
    // Perform the migration
    const result = await prisma.user.updateMany({
      where: { role: 'SELLER' },
      data: { role: 'B2C_SELLER' },
    });

    console.log(`\n✅ Successfully migrated ${result.count} users to B2C_SELLER`);

    // Also update seller profiles if sellerType is not set
    const profileResult = await prisma.seller.updateMany({
      where: {
        user: { role: 'B2C_SELLER' },
        sellerType: null,
      },
      data: { sellerType: 'B2C_SELLER' },
    });

    console.log(`✅ Updated ${profileResult.count} seller profiles with sellerType`);
  }

  // Step 4: Verification
  console.log('\nStep 4: Verification...');
  const remainingSellers = await prisma.user.count({
    where: { role: 'SELLER' },
  });

  const b2cSellers = await prisma.user.count({
    where: { role: 'B2C_SELLER' },
  });

  console.log(`Remaining SELLER users: ${remainingSellers}`);
  console.log(`Total B2C_SELLER users: ${b2cSellers}`);

  if (remainingSellers === 0 && !dryRun) {
    console.log('\n✅ Migration complete! All SELLER users have been migrated to B2C_SELLER.');
    console.log('\nNext steps:');
    console.log('1. Update code to remove SELLER role checks (search for "SELLER")');
    console.log('2. Remove SELLER from UserRole enum in schema.prisma');
    console.log('3. Run: npx prisma migrate dev --name remove_seller_role');
  }

  console.log('\n' + '='.repeat(60));
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
