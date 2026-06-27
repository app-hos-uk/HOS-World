import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_PASSWORD_ROUNDS } from '../config/bcrypt-cost';
import { getSeedTestPassword } from '../config/seed-password';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.join(__dirname, '../../.env') });
} catch {
  // dotenv optional
}

const prisma = new PrismaClient();

const teamUsers = [
  { email: 'admin@hos.test', firstName: 'Admin', lastName: 'User', role: UserRole.ADMIN },
  { email: 'procurement@hos.test', firstName: 'Procurement', lastName: 'Manager', role: UserRole.PROCUREMENT },
  { email: 'fulfillment@hos.test', firstName: 'Fulfillment', lastName: 'Staff', role: UserRole.FULFILLMENT },
  { email: 'catalog@hos.test', firstName: 'Catalog', lastName: 'Editor', role: UserRole.CATALOG },
  { email: 'marketing@hos.test', firstName: 'Marketing', lastName: 'Manager', role: UserRole.MARKETING },
  { email: 'finance@hos.test', firstName: 'Finance', lastName: 'Manager', role: UserRole.FINANCE },
  { email: 'cms@hos.test', firstName: 'CMS', lastName: 'Editor', role: UserRole.CMS_EDITOR },
];

async function createTeamUsers() {
  const passwordHash = await bcrypt.hash(getSeedTestPassword(), BCRYPT_PASSWORD_ROUNDS);

  console.log('🌱 Creating/updating team users...\n');

  for (const userData of teamUsers) {
    const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: passwordHash,
          role: userData.role,
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
      });
      console.log(`✅ Updated: ${userData.email}`);
    } else {
      await prisma.user.create({
        data: {
          email: userData.email,
          password: passwordHash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        },
      });
      console.log(`✅ Created: ${userData.email}`);
    }
  }

  console.log('\n✅ Team role users created/updated successfully!');
  console.log('   Password: set via TEST_SEED_PASSWORD env (random in dev if unset)\n');

  const allUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@hos.test' } },
    select: { email: true, role: true },
    orderBy: { role: 'asc' },
  });

  allUsers.forEach((user) => {
    console.log(`  ${user.email.padEnd(30)} | ${user.role}`);
  });
}

createTeamUsers()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
