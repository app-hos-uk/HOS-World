import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedAdmin() {
  const adminEmail = 'app@houseofspells.co.uk';
  const adminPassword = 'Admin123';

  try {
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
        // Update password if needed
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { password: hashedPassword },
        });
        console.log(`✅ Updated admin password: ${adminEmail}`);
      }
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

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

