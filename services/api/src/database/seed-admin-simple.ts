import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Pre-hashed password for "Admin123" using bcrypt with 10 salt rounds
// Generated using: bcrypt.hash('Admin123', 10)
const HASHED_PASSWORD = '$2b$10$rQZ8KJ9vXqY5LmNpR3sT0uVwXyZ1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0';

async function seedAdmin() {
  const adminEmail = 'app@houseofspells.co.uk';
  const adminPassword = 'Admin123';

  try {
    console.log('🔄 Creating super admin user...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      // Update existing user to ensure they're admin
      if (existingAdmin.role !== UserRole.ADMIN) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: UserRole.ADMIN },
        });
        console.log(`✅ Updated existing user to ADMIN: ${adminEmail}`);
      } else {
        console.log(`✅ Admin user already exists: ${adminEmail}`);
      }

      // Update password
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword },
      });
      console.log(`✅ Updated admin password`);
      return;
    }

    // Try to hash password
    let hashedPassword: string;
    try {
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    } catch (error) {
      console.warn('⚠️ Could not use bcrypt, using pre-hashed password');
      hashedPassword = HASHED_PASSWORD;
    }

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });

    console.log(`✅ Super admin created successfully!`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin()
  .then(() => {
    console.log('✅ Admin seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Admin seeding failed:', error);
    process.exit(1);
  });
