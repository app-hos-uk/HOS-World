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

async function fixAdmin() {
  const email = 'app@houseofspells.co.uk';
  const password = getSeedAdminPassword();

  try {
    console.log('🔧 Fixing admin user...');
    console.log(`   Email: ${email}`);

    await prisma.user.deleteMany({ where: { email } });

    const hash = await bcrypt.hash(password, BCRYPT_PASSWORD_ROUNDS);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hash,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });

    console.log(`✅ Admin recreated: ${admin.email} (${admin.id})`);
    const apiUrl = process.env.API_URL || process.env.API_PUBLIC_URL || 'http://localhost:3001';
    console.log(`   Login: POST ${apiUrl.replace(/\/+$/, '')}/api/auth/login`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
