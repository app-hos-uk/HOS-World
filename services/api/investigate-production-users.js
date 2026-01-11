const { PrismaClient } = require('@prisma/client');

// This script can work with production database if DATABASE_URL is set to production
const prisma = new PrismaClient();

async function investigateProductionUsers() {
  console.log('\n🔍 PRODUCTION DATABASE INVESTIGATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Check for mail@jsabu.com
    console.log('1️⃣  Checking for mail@jsabu.com...');
    const jsabuUser = await prisma.user.findUnique({
      where: { email: 'mail@jsabu.com' },
      include: {
        sellerProfile: true,
        customerProfile: true,
      },
    });

    if (jsabuUser) {
      console.log('   ✅ FOUND: mail@jsabu.com');
      console.log(`      ID: ${jsabuUser.id}`);
      console.log(`      Role: ${jsabuUser.role}`);
      console.log(`      Name: ${jsabuUser.firstName || ''} ${jsabuUser.lastName || ''}`);
      console.log(`      Created: ${jsabuUser.createdAt.toISOString()}`);
      console.log(`      Updated: ${jsabuUser.updatedAt.toISOString()}`);
      if (jsabuUser.sellerProfile) {
        console.log(`      Store: ${jsabuUser.sellerProfile.storeName || 'N/A'}`);
      }
    } else {
      console.log('   ❌ NOT FOUND: mail@jsabu.com');
    }
    console.log('');

    // 2. Get all users with statistics
    console.log('2️⃣  User Statistics...');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`   Total Users: ${allUsers.length}\n`);

    // 3. Group by role
    console.log('3️⃣  Users by Role:');
    const byRole = allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    Object.entries(byRole)
      .sort((a, b) => b[1] - a[1])
      .forEach(([role, count]) => {
        console.log(`   ${role}: ${count}`);
      });
    console.log('');

    // 4. Check for duplicate emails
    console.log('4️⃣  Checking for duplicate emails...');
    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM users
      GROUP BY email
      HAVING COUNT(*) > 1
    `;

    if (duplicateEmails.length > 0) {
      console.log(`   ❌ FOUND ${duplicateEmails.length} duplicate email(s):`);
      duplicateEmails.forEach(dup => {
        console.log(`      - "${dup.email}" appears ${dup.count} times`);
      });
    } else {
      console.log('   ✅ No duplicate emails found');
    }
    console.log('');

    // 5. Recent users (last 10)
    console.log('5️⃣  Recent Users (Last 10):');
    allUsers.slice(0, 10).forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role}) - ${user.createdAt.toISOString()}`);
    });
    if (allUsers.length > 10) {
      console.log(`   ... and ${allUsers.length - 10} more`);
    }
    console.log('');

    // 6. Check for admin users
    console.log('6️⃣  Admin Users:');
    const adminUsers = allUsers.filter(u => u.role === 'ADMIN');
    if (adminUsers.length > 0) {
      adminUsers.forEach(admin => {
        console.log(`   - ${admin.email} (${admin.firstName || ''} ${admin.lastName || ''})`);
      });
    } else {
      console.log('   ⚠️  No admin users found');
    }
    console.log('');

    // 7. Check for users created in last 7 days
    console.log('7️⃣  Users Created in Last 7 Days:');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = allUsers.filter(u => new Date(u.createdAt) > sevenDaysAgo);
    console.log(`   Count: ${recentUsers.length}`);
    if (recentUsers.length > 0) {
      recentUsers.slice(0, 5).forEach(user => {
        console.log(`   - ${user.email} (${user.role})`);
      });
      if (recentUsers.length > 5) {
        console.log(`   ... and ${recentUsers.length - 5} more`);
      }
    }
    console.log('');

    // 8. Check for potential conflicts
    console.log('8️⃣  Potential Conflicts:');
    
    // Users with same email but different cases
    const emailConflicts = await prisma.$queryRaw`
      SELECT LOWER(email) as email_lower, COUNT(*) as count, array_agg(email) as emails
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `;
    
    if (emailConflicts.length > 0) {
      console.log(`   ⚠️  Found ${emailConflicts.length} email case conflicts:`);
      emailConflicts.forEach(conflict => {
        console.log(`      - ${conflict.email_lower}: ${conflict.emails.join(', ')}`);
      });
    } else {
      console.log('   ✅ No email case conflicts');
    }

    // Orphaned records check
    const orphanedCarts = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM cart_items ci
      LEFT JOIN carts c ON ci."cartId" = c.id
      WHERE c.id IS NULL
    `;
    
    if (orphanedCarts[0].count > 0) {
      console.log(`   ⚠️  Found ${orphanedCarts[0].count} orphaned cart items`);
    }

    const orphanedOrders = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM orders o
      LEFT JOIN users u ON o."userId" = u.id
      WHERE u.id IS NULL
    `;
    
    if (orphanedOrders[0].count > 0) {
      console.log(`   ⚠️  Found ${orphanedOrders[0].count} orphaned orders`);
    }

    console.log('');

    // 9. Summary
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Users: ${allUsers.length}`);
    console.log(`   Admin Users: ${adminUsers.length}`);
    console.log(`   Duplicate Emails: ${duplicateEmails.length}`);
    console.log(`   Email Case Conflicts: ${emailConflicts.length}`);
    console.log(`   Orphaned Cart Items: ${orphanedCarts[0].count}`);
    console.log(`   Orphaned Orders: ${orphanedOrders[0].count}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

investigateProductionUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
