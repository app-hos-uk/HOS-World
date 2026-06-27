import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_PASSWORD_ROUNDS } from '../config/bcrypt-cost';
import { getSeedAdminPassword } from '../config/seed-password';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.join(__dirname, '../../.env') });
} catch {
  // dotenv optional
}

const prisma = new PrismaClient();

async function createAdmin() {
  const adminEmail = 'app@houseofspells.co.uk';
  const adminPassword = getSeedAdminPassword();

  try {
    console.log('🔄 Creating super admin user...');
    console.log(`   Email: ${adminEmail}`);
    console.log('   Password: [set via SEED_ADMIN_PASSWORD — not logged]');

    const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_PASSWORD_ROUNDS);

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      if (existingAdmin.role !== UserRole.ADMIN) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: UserRole.ADMIN },
        });
      }
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword },
      });
      console.log(`✅ Admin user updated: ${adminEmail}`);
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
    console.log('⚠️  Change password after first login.');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
