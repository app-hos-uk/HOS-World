import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Password hash for "Test123!"
const PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const teamUsers = [
  {
    email: 'admin@hos.test',
    password: PASSWORD_HASH,
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  },
  {
    email: 'procurement@hos.test',
    password: PASSWORD_HASH,
    firstName: 'Procurement',
    lastName: 'Manager',
    role: UserRole.PROCUREMENT,
  },
  {
    email: 'fulfillment@hos.test',
    password: PASSWORD_HASH,
    firstName: 'Fulfillment',
    lastName: 'Staff',
    role: UserRole.FULFILLMENT,
  },
  {
    email: 'catalog@hos.test',
    password: PASSWORD_HASH,
    firstName: 'Catalog',
    lastName: 'Editor',
    role: UserRole.CATALOG,
  },
  {
    email: 'marketing@hos.test',
    password: PASSWORD_HASH,
    firstName: 'Marketing',
    lastName: 'Manager',
    role: UserRole.MARKETING,
  },
  {
    email: 'finance@hos.test',
    password: PASSWORD_HASH,
    firstName: 'Finance',
    lastName: 'Manager',
    role: UserRole.FINANCE,
  },
  {
    email: 'cms@hos.test',
    password: PASSWORD_HASH,
    firstName: 'CMS',
    lastName: 'Editor',
    role: UserRole.CMS_EDITOR,
  },
];

async function createTeamUsers() {
  console.log('🌱 Creating team role users...\n');

  for (const userData of teamUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        // Update existing user
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: userData.password,
            role: userData.role,
            firstName: userData.firstName,
            lastName: userData.lastName,
          },
        });
        console.log(`✅ Updated user: ${userData.email} (${userData.role})`);
      } else {
        // Create new user
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
          },
        });
        console.log(`✅ Created user: ${userData.email} (${userData.role})`);
      }
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error);
    }
  }

  console.log('\n✅ Team role users created/updated successfully!');
  console.log('\n📋 Test Users List:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const allUsers = await prisma.user.findMany({
    where: {
      email: {
        endsWith: '@hos.test',
      },
    },
    select: {
      email: true,
      role: true,
      firstName: true,
      lastName: true,
    },
    orderBy: {
      role: 'asc',
    },
  });

  allUsers.forEach((user) => {
    console.log(`  Email: ${user.email.padEnd(30)} | Password: Test123! | Role: ${user.role}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

createTeamUsers()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

