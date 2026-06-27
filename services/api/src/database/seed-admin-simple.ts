import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_PASSWORD_ROUNDS } from '../config/bcrypt-cost';
import { getSeedAdminPassword } from '../config/seed-password';

const prisma = new PrismaClient();

async function seedAdmin() {
  const adminEmail = 'app@houseofspells.co.uk';
  const adminPassword = getSeedAdminPassword();

  try {
    console.log('🔄 Creating super admin user...');

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_PASSWORD_ROUNDS);

    if (existingAdmin) {
      if (existingAdmin.role !== UserRole.ADMIN) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: UserRole.ADMIN },
        });
        console.log(`✅ Updated existing user to ADMIN: ${adminEmail}`);
      } else {
        console.log(`✅ Admin user already exists: ${adminEmail}`);
      }

      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword },
      });
      console.log('✅ Updated admin password');
      return;
    }

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });

    console.log(`✅ Super admin created: ${admin.email} (${admin.id})`);
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
  .catch(() => {
    process.exit(1);
  });
