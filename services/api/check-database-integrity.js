const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseIntegrity() {
  console.log('\n🔍 DATABASE INTEGRITY CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const issues = [];
  const warnings = [];

  try {
    // 1. Check for duplicate emails
    console.log('1️⃣  Checking for duplicate emails...');
    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM users
      GROUP BY email
      HAVING COUNT(*) > 1
    `;
    
    if (duplicateEmails.length > 0) {
      issues.push(`❌ Found ${duplicateEmails.length} duplicate email(s):`);
      duplicateEmails.forEach(dup => {
        console.log(`   ❌ Email "${dup.email}" appears ${dup.count} times`);
        issues.push(`   - Email "${dup.email}" appears ${dup.count} times`);
      });
    } else {
      console.log('   ✅ No duplicate emails found\n');
    }

    // 2. Check for users without required fields
    console.log('2️⃣  Checking for users with missing required fields...');
    // Email is required, so we'll use raw SQL to check for null/empty
    const usersWithoutEmail = await prisma.$queryRaw`
      SELECT id, email
      FROM users
      WHERE email IS NULL OR email = ''
    `;
    
    if (usersWithoutEmail.length > 0) {
      issues.push(`❌ Found ${usersWithoutEmail.length} user(s) without email`);
      usersWithoutEmail.forEach(user => {
        console.log(`   ❌ User ${user.id} has no email`);
        issues.push(`   - User ${user.id} has no email`);
      });
    } else {
      console.log('   ✅ All users have emails\n');
    }

    // 3. Check for orphaned cart items (cart doesn't exist)
    console.log('3️⃣  Checking for orphaned cart items...');
    const orphanedCartItems = await prisma.$queryRaw`
      SELECT ci.id, ci."cartId"
      FROM cart_items ci
      LEFT JOIN carts c ON ci."cartId" = c.id
      WHERE c.id IS NULL
    `;
    
    if (orphanedCartItems.length > 0) {
      warnings.push(`⚠️  Found ${orphanedCartItems.length} orphaned cart item(s)`);
      console.log(`   ⚠️  Found ${orphanedCartItems.length} orphaned cart item(s)`);
      orphanedCartItems.slice(0, 5).forEach(item => {
        console.log(`      - Cart item ${item.id} references non-existent cart ${item.cartId}`);
      });
      if (orphanedCartItems.length > 5) {
        console.log(`      ... and ${orphanedCartItems.length - 5} more`);
      }
    } else {
      console.log('   ✅ No orphaned cart items found\n');
    }

    // 4. Check for orphaned order items (order doesn't exist)
    console.log('4️⃣  Checking for orphaned order items...');
    const orphanedOrderItems = await prisma.$queryRaw`
      SELECT oi.id, oi."orderId"
      FROM order_items oi
      LEFT JOIN orders o ON oi."orderId" = o.id
      WHERE o.id IS NULL
    `;
    
    if (orphanedOrderItems.length > 0) {
      warnings.push(`⚠️  Found ${orphanedOrderItems.length} orphaned order item(s)`);
      console.log(`   ⚠️  Found ${orphanedOrderItems.length} orphaned order item(s)`);
      orphanedOrderItems.slice(0, 5).forEach(item => {
        console.log(`      - Order item ${item.id} references non-existent order ${item.orderId}`);
      });
      if (orphanedOrderItems.length > 5) {
        console.log(`      ... and ${orphanedOrderItems.length - 5} more`);
      }
    } else {
      console.log('   ✅ No orphaned order items found\n');
    }

    // 5. Check for users with invalid roles
    console.log('5️⃣  Checking for users with invalid roles...');
    const validRoles = ['CUSTOMER', 'SELLER', 'WHOLESALER', 'B2C_SELLER', 'ADMIN', 'PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR'];
    const usersWithInvalidRoles = await prisma.user.findMany({
      where: {
        role: {
          notIn: validRoles,
        },
      },
      select: { id: true, email: true, role: true },
    });
    
    if (usersWithInvalidRoles.length > 0) {
      issues.push(`❌ Found ${usersWithInvalidRoles.length} user(s) with invalid roles`);
      usersWithInvalidRoles.forEach(user => {
        console.log(`   ❌ User ${user.email} has invalid role: ${user.role}`);
        issues.push(`   - User ${user.email} has invalid role: ${user.role}`);
      });
    } else {
      console.log('   ✅ All users have valid roles\n');
    }

    // 6. Check for sellers without seller profiles
    console.log('6️⃣  Checking for sellers without seller profiles...');
    const sellersWithoutProfiles = await prisma.user.findMany({
      where: {
        role: {
          in: ['SELLER', 'WHOLESALER', 'B2C_SELLER'],
        },
        sellerProfile: null,
      },
      select: { id: true, email: true, role: true },
    });
    
    if (sellersWithoutProfiles.length > 0) {
      warnings.push(`⚠️  Found ${sellersWithoutProfiles.length} seller(s) without seller profiles`);
      console.log(`   ⚠️  Found ${sellersWithoutProfiles.length} seller(s) without seller profiles:`);
      sellersWithoutProfiles.forEach(seller => {
        console.log(`      - ${seller.email} (${seller.role})`);
      });
    } else {
      console.log('   ✅ All sellers have profiles\n');
    }

    // 7. Check for customers without customer profiles
    console.log('7️⃣  Checking for customers without customer profiles...');
    const customersWithoutProfiles = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        customerProfile: null,
      },
      select: { id: true, email: true },
    });
    
    if (customersWithoutProfiles.length > 0) {
      warnings.push(`⚠️  Found ${customersWithoutProfiles.length} customer(s) without customer profiles`);
      console.log(`   ⚠️  Found ${customersWithoutProfiles.length} customer(s) without customer profiles`);
    } else {
      console.log('   ✅ All customers have profiles\n');
    }

    // 8. Check for products without images
    console.log('8️⃣  Checking for products without images...');
    const productsWithoutImages = await prisma.product.findMany({
      where: {
        images: {
          none: {},
        },
      },
      select: { id: true, name: true },
    });
    
    if (productsWithoutImages.length > 0) {
      warnings.push(`⚠️  Found ${productsWithoutImages.length} product(s) without images`);
      console.log(`   ⚠️  Found ${productsWithoutImages.length} product(s) without images`);
    } else {
      console.log('   ✅ All products have images\n');
    }

    // 9. Check for refresh tokens without users
    console.log('9️⃣  Checking for orphaned refresh tokens...');
    const orphanedRefreshTokens = await prisma.$queryRaw`
      SELECT rt.id, rt."userId"
      FROM refresh_tokens rt
      LEFT JOIN users u ON rt."userId" = u.id
      WHERE u.id IS NULL
    `;
    
    if (orphanedRefreshTokens.length > 0) {
      warnings.push(`⚠️  Found ${orphanedRefreshTokens.length} orphaned refresh token(s)`);
      console.log(`   ⚠️  Found ${orphanedRefreshTokens.length} orphaned refresh token(s)`);
    } else {
      console.log('   ✅ No orphaned refresh tokens found\n');
    }

    // 10. Check for addresses without users
    console.log('🔟 Checking for orphaned addresses...');
    const orphanedAddresses = await prisma.$queryRaw`
      SELECT a.id, a."userId"
      FROM addresses a
      LEFT JOIN users u ON a."userId" = u.id
      WHERE u.id IS NULL
    `;
    
    if (orphanedAddresses.length > 0) {
      warnings.push(`⚠️  Found ${orphanedAddresses.length} orphaned address(es)`);
      console.log(`   ⚠️  Found ${orphanedAddresses.length} orphaned address(es)`);
    } else {
      console.log('   ✅ No orphaned addresses found\n');
    }

    // 11. Check for orders without users
    console.log('1️⃣1️⃣  Checking for orphaned orders...');
    const orphanedOrders = await prisma.$queryRaw`
      SELECT o.id, o."userId"
      FROM orders o
      LEFT JOIN users u ON o."userId" = u.id
      WHERE u.id IS NULL
    `;
    
    if (orphanedOrders.length > 0) {
      warnings.push(`⚠️  Found ${orphanedOrders.length} orphaned order(s)`);
      console.log(`   ⚠️  Found ${orphanedOrders.length} orphaned order(s)`);
    } else {
      console.log('   ✅ No orphaned orders found\n');
    }

    // 12. Database statistics
    console.log('📊 Database Statistics:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.cart.count(),
      prisma.address.count(),
      prisma.refreshToken.count(),
    ]);
    
    console.log(`   Users: ${stats[0]}`);
    console.log(`   Products: ${stats[1]}`);
    console.log(`   Orders: ${stats[2]}`);
    console.log(`   Carts: ${stats[3]}`);
    console.log(`   Addresses: ${stats[4]}`);
    console.log(`   Refresh Tokens: ${stats[5]}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    console.log('📋 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ No issues found! Database integrity is good.\n');
    } else {
      if (issues.length > 0) {
        console.log(`\n❌ CRITICAL ISSUES (${issues.length}):`);
        issues.forEach(issue => console.log(`   ${issue}`));
      }
      
      if (warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
        warnings.forEach(warning => console.log(`   ${warning}`));
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error during integrity check:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseIntegrity()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
