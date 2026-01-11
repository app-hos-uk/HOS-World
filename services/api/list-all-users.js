const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllUsers() {
  try {
    console.log('\n📋 ALL USERS IN DATABASE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    if (users.length === 0) {
      console.log('⚠️  No users found in the database!\n');
      console.log('   This could mean:');
      console.log('   1. The database was reset/cleared');
      console.log('   2. Migrations were not applied correctly');
      console.log('   3. You are connected to a different database\n');
    } else {
      console.log(`Found ${users.length} user(s):\n`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${user.createdAt.toISOString()}`);
        console.log(`   Updated: ${user.updatedAt.toISOString()}`);
        console.log('');
      });
      
      // Group by role
      const byRole = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📊 Summary by Role:');
      Object.entries(byRole).forEach(([role, count]) => {
        console.log(`   ${role}: ${count}`);
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

listAllUsers();
