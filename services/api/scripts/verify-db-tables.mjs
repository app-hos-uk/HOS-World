#!/usr/bin/env node
/**
 * Verify all expected Prisma tables exist in the database.
 * Run: cd services/api && DATABASE_URL="postgresql://..." node scripts/verify-db-tables.mjs
 */

const expectedTables = [
  'users', 'permission_roles', 'tenants', 'tenant_users', 'stores', 'configs',
  'customers', 'sellers', 'themes', 'seller_theme_settings', 'products',
  'product_images', 'product_variations', 'product_bundle_items', 'volume_pricing',
  'carts', 'cart_items', 'addresses', 'orders', 'order_items', 'order_notes',
  'product_reviews', 'wishlist_items', 'return_policies', 'return_requests',
  'return_items', 'payments', 'refresh_tokens', 'oauth_accounts', 'notifications',
  'product_submissions', 'fulfillment_centers', 'shipments', 'catalog_entries',
  'marketing_materials', 'product_pricing', 'duplicate_products', 'logistics_partners',
  'settlements', 'order_settlements', 'fandoms', 'characters', 'ai_chats',
  'badges', 'user_badges', 'quests', 'user_quests', 'collections', 'shared_items',
  'currency_exchange_rates', 'gift_cards', 'gift_card_transactions', 'gdpr_consent_logs',
  'SellerInvitation', 'ActivityLog', 'Transaction', 'Discrepancy',
  'SupportTicket', 'TicketMessage', 'KnowledgeBaseArticle',
  'WhatsAppConversation', 'WhatsAppMessage', 'WhatsAppTemplate',
  'categories', 'attributes', 'attribute_values', 'product_attributes',
  'tags', 'product_tags', 'promotions', 'coupons', 'coupon_usages', 'customer_groups',
  'shipping_methods', 'shipping_rules', 'warehouses', 'inventory_locations',
  'stock_reservations', 'stock_transfers', 'stock_movements', 'tax_zones',
  'tax_classes', 'tax_rates', 'webhooks', 'webhook_deliveries', 'integration_configs',
  'integration_logs', 'influencer_invitations', 'influencers', 'influencer_storefronts',
  'influencer_product_links', 'influencer_campaigns', 'referrals',
  'influencer_commissions', 'influencer_payouts', 'newsletter_subscriptions',
  '_prisma_migrations',
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const result = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const actualTables = new Set(result.map((r) => r.tablename));

    const missing = expectedTables.filter((t) => !actualTables.has(t) && t !== '_prisma_migrations');
    const extra = [...actualTables].filter((t) => !expectedTables.includes(t));

    console.log('\n📋 Database Tables Verification\n');
    console.log(`Expected: ${expectedTables.length} tables (incl. _prisma_migrations)`);
    console.log(`Found: ${actualTables.size} tables in public schema\n`);

    if (missing.length === 0) {
      console.log('✅ All expected tables are present.\n');
    } else {
      console.log('❌ Missing tables:');
      missing.forEach((t) => console.log(`   - ${t}`));
      console.log('');
    }

    if (extra.length > 0) {
      console.log('ℹ️  Extra tables (not in schema):');
      extra.forEach((t) => console.log(`   - ${t}`));
      console.log('');
    }

    const keyTables = ['users', 'products', 'orders', 'categories'];
    console.log('📊 Row counts (key tables):');
    for (const table of keyTables) {
      if (actualTables.has(table)) {
        try {
          const countResult = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*)::int as count FROM "${table}"`,
          );
          const count = countResult[0]?.count ?? 0;
          console.log(`   ${table}: ${count}`);
        } catch (e) {
          console.log(`   ${table}: (error: ${e.message})`);
        }
      }
    }
    console.log('');

    process.exit(missing.length > 0 ? 1 : 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
