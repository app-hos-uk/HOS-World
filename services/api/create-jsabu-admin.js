const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createJabuAdmin() {
  const email = 'mail@jsabu.com';
  const password = 'Admin123!'; // Change this to your desired password
  
  try {
    console.log(`\n🔄 Creating admin user: ${email}\n`);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      console.log(`✅ User already exists:`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Created: ${existingUser.createdAt.toISOString()}\n`);
      
      // Update to ADMIN if not already
      if (existingUser.role !== UserRole.ADMIN) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: UserRole.ADMIN },
        });
        console.log(`✅ Updated role to ADMIN\n`);
      }
      
      // Update password
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      });
      console.log(`✅ Password updated\n`);
      
      return;
    }
    
    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        country: 'GB',
        preferredCommunicationMethod: 'EMAIL',
        gdprConsent: true,
      },
    });
    
    console.log(`✅ Admin user created successfully!`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}\n`);
    console.log(`⚠️  IMPORTANT: Change password after first login!\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createJabuAdmin()
  .then(() => {
    console.log('✅ Completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
