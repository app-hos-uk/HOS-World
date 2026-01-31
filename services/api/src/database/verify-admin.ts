import { PrismaClient, UserRole } from '@prisma/client';

// Try to load .env file if dotenv is available (optional)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.join(__dirname, '../../../.env') });
} catch {
  // dotenv not available, use environment variables directly
  // DATABASE_URL should be set in environment
}

const prisma = new PrismaClient();

async function verifyAdmin() {
  const adminEmail = 'app@houseofspells.co.uk';

  try {
    console.log('🔍 Checking super admin user status...');
    console.log(`   Email: ${adminEmail}\n`);

    // Check if admin exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existingAdmin) {
      console.log('✅ Admin user EXISTS in database');
      console.log('\n📋 Admin Details:');
      console.log(`   ID: ${existingAdmin.id}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`);
      console.log(`   Created: ${existingAdmin.createdAt}`);
      console.log(`   Updated: ${existingAdmin.updatedAt}`);

      if (existingAdmin.role === UserRole.ADMIN) {
        console.log('\n✅ Status: User has ADMIN role - Ready to use!');
      } else {
        console.log(`\n⚠️  Status: User exists but role is "${existingAdmin.role}" (not ADMIN)`);
        console.log('   Run: pnpm db:seed-admin to update role to ADMIN');
      }
    } else {
      console.log('❌ Admin user DOES NOT EXIST in database');
      console.log('\n📝 To create the admin user, run:');
      console.log('   pnpm db:seed-admin');
      console.log('\n   Or for Railway:');
      console.log('   railway run pnpm db:seed-admin');
    }
  } catch (error) {
    console.error('❌ Error checking admin user:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.message.includes('connect') || error.message.includes('DATABASE_URL')) {
        console.error('\n⚠️  Database connection issue:');
        console.error('   - Check DATABASE_URL is set correctly');
        console.error('   - Verify database is running');
        console.error('   - Check network connectivity');
      }
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdmin()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
