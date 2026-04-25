import { PrismaClient, UserRole, SellerType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_PASSWORD_ROUNDS } from '../config/bcrypt-cost';
import { slugify } from '@hos-marketplace/utils';

const prisma = new PrismaClient();

// Mock users for all roles
const mockUsers = [
  {
    email: 'customer@hos.test',
    password: 'Test123!',
    firstName: 'John',
    lastName: 'Customer',
    role: UserRole.CUSTOMER,
    needsProfile: true,
  },
  {
    email: 'wholesaler@hos.test',
    password: 'Test123!',
    firstName: 'Sarah',
    lastName: 'Wholesaler',
    role: UserRole.WHOLESALER,
    storeName: 'Wholesale Magic Supplies',
    needsSellerProfile: true,
    sellerType: SellerType.WHOLESALER,
  },
  {
    email: 'seller@hos.test',
    password: 'Test123!',
    firstName: 'Mike',
    lastName: 'Seller',
    role: UserRole.B2C_SELLER,
    storeName: 'B2C Magic Store',
    needsSellerProfile: true,
    sellerType: SellerType.B2C_SELLER,
  },
  {
    email: 'admin@hos.test',
    password: 'Test123!',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  },
  {
    email: 'procurement@hos.test',
    password: 'Test123!',
    firstName: 'Procurement',
    lastName: 'Manager',
    role: UserRole.PROCUREMENT,
  },
  {
    email: 'fulfillment@hos.test',
    password: 'Test123!',
    firstName: 'Fulfillment',
    lastName: 'Staff',
    role: UserRole.FULFILLMENT,
  },
  {
    email: 'catalog@hos.test',
    password: 'Test123!',
    firstName: 'Catalog',
    lastName: 'Editor',
    role: UserRole.CATALOG,
  },
  {
    email: 'marketing@hos.test',
    password: 'Test123!',
    firstName: 'Marketing',
    lastName: 'Manager',
    role: UserRole.MARKETING,
  },
  {
    email: 'finance@hos.test',
    password: 'Test123!',
    firstName: 'Finance',
    lastName: 'Manager',
    role: UserRole.FINANCE,
  },
  {
    email: 'cms@hos.test',
    password: 'Test123!',
    firstName: 'CMS',
    lastName: 'Editor',
    role: UserRole.CMS_EDITOR,
  },
];

async function seedAllRoles() {
  const defaultPassword = 'Test123!';
  const hashedPassword = await bcrypt.hash(defaultPassword, BCRYPT_PASSWORD_ROUNDS);

  console.log('🌱 Starting to seed mock users for all roles...\n');

  for (const userData of mockUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
        include: {
          customerProfile: true,
          sellerProfile: true,
        },
      });

      if (existingUser) {
        // Update existing user
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            role: userData.role,
            firstName: userData.firstName,
            lastName: userData.lastName,
          },
        });

        // Handle profiles
        if (userData.needsProfile && !existingUser.customerProfile) {
          await prisma.customer.create({
            data: { userId: existingUser.id },
          });
        }

        if (userData.needsSellerProfile && !existingUser.sellerProfile) {
          const storeName = userData.storeName!;
          const baseSlug = slugify(storeName);
          let slug = baseSlug;
          let counter = 1;

          while (await prisma.seller.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }

          await prisma.seller.create({
            data: {
              userId: existingUser.id,
              storeName,
              slug,
              country: 'US',
              timezone: 'UTC',
              sellerType: userData.sellerType || SellerType.B2C_SELLER,
              logisticsOption: 'HOS_LOGISTICS',
            },
          });
        }

        console.log(`✅ Updated user: ${userData.email} (${userData.role})`);
      } else {
        // Create new user
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
          },
        });

        // Create customer profile if needed
        if (userData.needsProfile) {
          await prisma.customer.create({
            data: { userId: user.id },
          });
        }

        // Create seller profile if needed
        if (userData.needsSellerProfile && userData.storeName) {
          const baseSlug = slugify(userData.storeName);
          let slug = baseSlug;
          let counter = 1;

          while (await prisma.seller.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }

          await prisma.seller.create({
            data: {
              userId: user.id,
              storeName: userData.storeName,
              slug,
              country: 'US',
              timezone: 'UTC',
              sellerType: userData.sellerType || SellerType.B2C_SELLER,
              logisticsOption: 'HOS_LOGISTICS',
            },
          });
        }

        console.log(`✅ Created user: ${userData.email} (${userData.role})`);
      }
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error);
    }
  }

  console.log('\n✅ All mock users seeded successfully!');
  console.log('\n📋 Test Users Created:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  mockUsers.forEach((user) => {
    console.log(
      `  Email: ${user.email.padEnd(30)} | Password: ${defaultPassword} | Role: ${user.role}`,
    );
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seedAllRoles()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Seeding failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
