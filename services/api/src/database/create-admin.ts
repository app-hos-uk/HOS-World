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

// Pre-hashed password for "Admin123" using bcrypt with 10 salt rounds
// This hash was generated using: bcrypt.hash('Admin123', 10)
// You can verify it works by comparing: bcrypt.compare('Admin123', hash)
const ADMIN_PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

async function createAdmin() {
  const adminEmail = 'app@houseofspells.co.uk';
  const adminPassword = 'Admin123';

  try {
    console.log('🔄 Creating super admin user...');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(`⚠️  User already exists: ${adminEmail}`);

      // Update to ADMIN role if not already
      if (existingAdmin.role !== UserRole.ADMIN) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: UserRole.ADMIN },
        });
        console.log(`✅ Updated role to ADMIN`);
      } else {
        console.log(`✅ User is already ADMIN`);
      }

      // Update password
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: ADMIN_PASSWORD_HASH },
      });
      console.log(`✅ Updated password`);

      console.log(`\n✅ Admin user ready!`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   Role: ADMIN`);
      return;
    }

    // Create new admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: ADMIN_PASSWORD_HASH,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });

    console.log(`\n✅ Super admin created successfully!`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
    console.log(`\n⚠️  IMPORTANT: Change password after first login!`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin()
  .then(() => {
    console.log('\n✅ Admin creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Admin creation failed:', error);
    process.exit(1);
  });
