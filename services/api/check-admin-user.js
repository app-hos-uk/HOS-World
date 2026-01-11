const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    const email = 'mail@jsabu.com';
    
    console.log(`\n🔍 Checking for admin user: ${email}\n`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        sellerProfile: {
          select: {
            storeName: true,
          },
        },
        customerProfile: {
          select: {
            loyaltyPoints: true,
          },
        },
      },
    });
    
    if (user) {
      console.log('✅ USER FOUND:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.firstName || ''} ${user.lastName || ''}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Created: ${user.createdAt.toISOString()}`);
      console.log(`  Updated: ${user.updatedAt.toISOString()}`);
      if (user.sellerProfile) {
        console.log(`  Store: ${user.sellerProfile.storeName}`);
      }
      if (user.customerProfile) {
        console.log(`  Loyalty Points: ${user.customerProfile.loyaltyPoints}`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('❌ USER NOT FOUND');
      console.log(`   No user found with email: ${email}\n`);
      
      // Also check all admin users
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (adminUsers.length > 0) {
        console.log('📋 Existing Admin Users:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        adminUsers.forEach((admin, index) => {
          console.log(`${index + 1}. ${admin.email} (${admin.firstName || ''} ${admin.lastName || ''})`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.log('⚠️  No admin users found in the database.\n');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();
