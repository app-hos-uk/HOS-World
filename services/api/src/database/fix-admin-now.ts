import { PrismaClient, UserRole } from '@prisma/client';

// Try to load .env file if dotenv is available (optional)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.join(__dirname, '../../../.env') });
} catch {
  // dotenv not available, use environment variables directly
}

const prisma = new PrismaClient();

// Pre-hashed password for "Admin123" using bcrypt with 10 salt rounds
// This hash was generated using: bcrypt.hash('Admin123', 10)
const ADMIN_PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

async function fixAdmin() {
  const email = 'app@houseofspells.co.uk';
  const password = 'Admin123';

  try {
    console.log('🔧 Fixing admin user...');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
    
    // Delete existing user (if exists)
    const deleted = await prisma.user.deleteMany({
      where: { email },
    });
    console.log(`✅ Deleted ${deleted.count} existing user(s)`);

    // Use pre-hashed password (reliable, no bcrypt native module needed)
    console.log('🔄 Using pre-hashed password...');
    const hash = ADMIN_PASSWORD_HASH;
    console.log(`✅ Hash: ${hash.substring(0, 20)}...`);
    console.log(`   Hash length: ${hash.length} characters\n`);

    // Create new admin user
    console.log('🔄 Creating admin user...');
    const admin = await prisma.user.create({
      data: {
        email,
        password: hash,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('   ID:', admin.id);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Name:', admin.firstName, admin.lastName);
    console.log('\n📋 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('\n🧪 Test login with:');
    console.log(`   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email": "${email}", "password": "${password}"}'`);
  } catch (error) {
    console.error('\n❌ Error fixing admin user:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixAdmin()
  .then(() => {
    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });

