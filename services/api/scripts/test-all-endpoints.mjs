#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Smoke Test
 * Tests every public and authenticated endpoint against the live API.
 */

const API_BASE = process.env.API_URL || 'https://hos-marketplaceapi-production.up.railway.app';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hos.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Test123!';

let TOKEN = '';
let RESULTS = { pass: 0, fail: 0, skip: 0, errors: [] };

async function req(method, path, { body, auth = false, expectStatus, label } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (auth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const tag = label || `${method} ${path}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const opts = { method, headers, signal: controller.signal };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    clearTimeout(timeout);

    const status = res.status;
    const ok = expectStatus
      ? Array.isArray(expectStatus)
        ? expectStatus.includes(status)
        : status === expectStatus
      : status >= 200 && status < 500;

    if (ok) {
      RESULTS.pass++;
      console.log(`  ✅ ${tag} → ${status}`);
    } else {
      RESULTS.fail++;
      RESULTS.errors.push({ tag, status, expected: expectStatus || '2xx-4xx' });
      console.log(`  ❌ ${tag} → ${status} (expected ${expectStatus || '2xx-4xx'})`);
    }
    return { status, data: status < 300 ? await res.json().catch(() => null) : null };
  } catch (err) {
    RESULTS.fail++;
    const msg = err.name === 'AbortError' ? 'TIMEOUT' : err.message;
    RESULTS.errors.push({ tag, error: msg });
    console.log(`  ❌ ${tag} → ERROR: ${msg}`);
    return { status: 0, data: null };
  }
}

async function login() {
  console.log('\n🔑 Authenticating...');
  const r = await req('POST', '/api/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    label: 'Login (admin)',
  });
  const token = r.data?.data?.token || r.data?.token;
  if (token) {
    TOKEN = token;
    console.log('  ✅ Got auth token');
    return true;
  }
  console.log('  ⚠️  Could not authenticate — auth-protected tests will fail');
  return false;
}

async function testPublicEndpoints() {
  console.log('\n━━━ PUBLIC ENDPOINTS ━━━');

  console.log('\n📋 Health');
  await req('GET', '/api/', { expectStatus: [200, 301] });
  await req('GET', '/api/health', { expectStatus: 200 });
  await req('GET', '/api/health/live', { expectStatus: 200 });
  await req('GET', '/api/health/ready', { expectStatus: [200, 503] });

  console.log('\n📋 Products (public)');
  await req('GET', '/api/products', { expectStatus: 200 });
  await req('GET', '/api/products?page=1&limit=5', { expectStatus: 200 });
  await req('GET', '/api/products/non-existent-id', { expectStatus: [404, 400, 200] });

  console.log('\n📋 Taxonomy (public)');
  await req('GET', '/api/taxonomy/categories', { expectStatus: 200 });
  await req('GET', '/api/taxonomy/categories/tree', { expectStatus: 200 });
  await req('GET', '/api/taxonomy/tags', { expectStatus: 200 });
  await req('GET', '/api/taxonomy/tags/search?q=harry', { expectStatus: [200, 400] });
  await req('GET', '/api/taxonomy/attributes', { expectStatus: 200 });
  await req('GET', '/api/taxonomy/attributes/global', { expectStatus: 200 });

  console.log('\n📋 Sellers (public)');
  await req('GET', '/api/sellers/directory', { expectStatus: 200 });

  console.log('\n📋 Characters & Fandoms');
  await req('GET', '/api/characters', { expectStatus: 200 });
  await req('GET', '/api/fandoms', { expectStatus: 200 });

  console.log('\n📋 Reviews (public)');
  await req('GET', '/api/reviews/products/non-existent', { expectStatus: [200, 400, 404] });

  console.log('\n📋 Promotions (public read)');
  await req('GET', '/api/promotions', { expectStatus: 200 });

  console.log('\n📋 Compliance');
  await req('GET', '/api/compliance/requirements/US', { expectStatus: 200 });
  await req('GET', '/api/compliance/tax-rates/US', { expectStatus: 200 });

  console.log('\n📋 Currency');
  await req('GET', '/api/currency/rates', { expectStatus: 200 });
  await req('GET', '/api/currency/convert?from=USD&to=GBP&amount=100', { expectStatus: [200, 400] });

  console.log('\n📋 Shipping (public)');
  await req('GET', '/api/shipping/methods', { expectStatus: 200 });

  console.log('\n📋 Themes (public)');
  await req('GET', '/api/themes', { expectStatus: 200 });

  console.log('\n📋 Search (Meilisearch)');
  await req('GET', '/api/meilisearch/search?q=wand', { expectStatus: [200, 503] });
  await req('GET', '/api/meilisearch/suggestions?q=har', { expectStatus: [200, 503] });
  await req('GET', '/api/meilisearch/stats', { expectStatus: [200, 503] });

  console.log('\n📋 Support KB (public)');
  await req('GET', '/api/support/kb/articles', { expectStatus: 200 });
  await req('GET', '/api/support/kb/search?q=return', { expectStatus: [200, 400] });

  console.log('\n📋 Newsletter (public)');
  await req('GET', '/api/newsletter/status?email=test@test.com', { expectStatus: [200, 400] });

  console.log('\n📋 Geolocation');
  await req('GET', '/api/geolocation/detect', { expectStatus: [200, 400] });

  console.log('\n📋 Metrics');
  await req('GET', '/api/metrics/prometheus', { expectStatus: 200 });
  await req('GET', '/api/metrics/json', { expectStatus: 200 });
  await req('GET', '/api/metrics/health', { expectStatus: 200 });

  console.log('\n📋 Gift Cards (public validate)');
  await req('GET', '/api/gift-cards/validate/NON-EXISTENT', { expectStatus: [200, 404, 400] });

  console.log('\n📋 Gamification (public)');
  await req('GET', '/api/gamification/leaderboard', { expectStatus: 200 });

  console.log('\n📋 Badges (public)');
  await req('GET', '/api/badges', { expectStatus: 200 });

  console.log('\n📋 Quests (public)');
  await req('GET', '/api/quests', { expectStatus: 200 });

  console.log('\n📋 Social Sharing (public)');
  await req('GET', '/api/social-sharing/shared', { expectStatus: [200, 400] });

  console.log('\n📋 Chatbot (public)');
  await req('POST', '/api/support/chatbot/message', {
    body: { message: 'Hello', conversationId: null },
    expectStatus: [200, 201, 400],
  });
}

async function testAuthEndpoints() {
  if (!TOKEN) {
    console.log('\n⚠️  Skipping auth endpoints — no token');
    return;
  }

  console.log('\n━━━ AUTHENTICATED ENDPOINTS ━━━');

  console.log('\n📋 Auth');
  await req('GET', '/api/auth/me', { auth: true, expectStatus: 200 });

  console.log('\n📋 Users');
  await req('GET', '/api/users/profile', { auth: true, expectStatus: 200 });
  await req('GET', '/api/users/profile/gamification', { auth: true, expectStatus: [200, 404] });
  await req('GET', '/api/users/profile/badges', { auth: true, expectStatus: [200, 404] });
  await req('GET', '/api/users/profile/collections', { auth: true, expectStatus: [200, 404] });

  console.log('\n📋 Cart');
  await req('GET', '/api/cart', { auth: true, expectStatus: [200, 404] });

  console.log('\n📋 Orders');
  await req('GET', '/api/orders', { auth: true, expectStatus: 200 });

  console.log('\n📋 Addresses');
  await req('GET', '/api/addresses', { auth: true, expectStatus: 200 });

  console.log('\n📋 Wishlist');
  await req('GET', '/api/wishlist', { auth: true, expectStatus: 200 });

  console.log('\n📋 Collections');
  await req('GET', '/api/collections', { auth: true, expectStatus: 200 });

  console.log('\n📋 Notifications');
  await req('GET', '/api/notifications', { auth: true, expectStatus: 200 });

  console.log('\n📋 Returns');
  await req('GET', '/api/returns', { auth: true, expectStatus: 200 });

  console.log('\n📋 GDPR');
  await req('GET', '/api/gdpr/consent', { auth: true, expectStatus: 200 });
  await req('GET', '/api/gdpr/consent-history', { auth: true, expectStatus: 200 });
  await req('GET', '/api/gdpr/policy-version', { auth: true, expectStatus: [200, 404] });

  console.log('\n📋 Digital Products');
  await req('GET', '/api/digital-products/my-purchases', { auth: true, expectStatus: [200, 404] });

  console.log('\n📋 Payments');
  await req('GET', '/api/payments/providers', { auth: true, expectStatus: 200 });

  console.log('\n📋 Currency (auth)');
  await req('GET', '/api/currency/user-currency', { auth: true, expectStatus: 200 });
}

async function testAdminEndpoints() {
  if (!TOKEN) {
    console.log('\n⚠️  Skipping admin endpoints — no token');
    return;
  }

  console.log('\n━━━ ADMIN ENDPOINTS ━━━');

  console.log('\n📋 Dashboard');
  await req('GET', '/api/dashboard/stats', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/dashboard/admin', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/dashboard/procurement', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/dashboard/fulfillment', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/dashboard/catalog', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/dashboard/marketing', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Admin Users');
  await req('GET', '/api/admin/dashboard', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/users', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/settings', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/sellers', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Catalog');
  await req('GET', '/api/catalog/pending', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/catalog/entries', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/catalog/dashboard/stats', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Submissions');
  await req('GET', '/api/submissions', { auth: true, expectStatus: [200, 403, 404] });

  console.log('\n📋 Procurement');
  await req('GET', '/api/procurement/submissions', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/procurement/dashboard/stats', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Finance');
  await req('GET', '/api/finance/pending', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/finance/dashboard/stats', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Finance - Payouts');
  await req('GET', '/api/finance/payouts', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Finance - Refunds');
  await req('GET', '/api/finance/refunds', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Finance - Reports');
  await req('GET', '/api/finance/reports/revenue', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/finance/reports/seller-performance', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/finance/reports/platform-fees', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Finance - Transactions');
  await req('GET', '/api/finance/transactions', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Publishing');
  await req('GET', '/api/publishing/ready', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/publishing/published', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Duplicates');
  await req('GET', '/api/duplicates/alerts', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/duplicates/cross-seller-groups', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Inventory');
  await req('GET', '/api/inventory/warehouses', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/inventory/alerts/low-stock', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/inventory/metrics', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/inventory/locations', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Fulfillment');
  await req('GET', '/api/fulfillment/centers', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/fulfillment/shipments', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/fulfillment/dashboard/stats', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Settlements');
  await req('GET', '/api/settlements', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Tax');
  await req('GET', '/api/tax/zones', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/tax/classes', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/tax/rates', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Integrations');
  await req('GET', '/api/integrations', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/integrations/providers', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Webhooks');
  await req('GET', '/api/webhooks', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Logistics');
  await req('GET', '/api/logistics/partners', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Support Tickets');
  await req('GET', '/api/support/tickets', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Marketing');
  await req('GET', '/api/marketing/pending', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/marketing/materials', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/marketing/dashboard/stats', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Analytics');
  await req('GET', '/api/analytics/sales/trends', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/analytics/customers/metrics', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Activity');
  await req('GET', '/api/activity/logs', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 CMS');
  await req('GET', '/api/cms/pages', { auth: true, expectStatus: [200, 403, 503] });
  await req('GET', '/api/cms/banners', { auth: true, expectStatus: [200, 403, 503] });
  await req('GET', '/api/cms/blog', { auth: true, expectStatus: [200, 403, 503] });

  console.log('\n📋 Customer Groups');
  await req('GET', '/api/customer-groups', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Tenants');
  await req('GET', '/api/tenants', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Newsletter (admin)');
  await req('GET', '/api/newsletter/subscriptions', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Sellers Admin');
  await req('GET', '/api/sellers/admin/vendors', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/sellers/invitations', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Return Policies');
  await req('GET', '/api/return-policies', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Discrepancies');
  await req('GET', '/api/discrepancies', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Vendor Products');
  await req('GET', '/api/vendor-products', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Admin Products');
  await req('GET', '/api/admin/products', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Templates');
  await req('GET', '/api/templates', { auth: true, expectStatus: [200, 403, 404] });

  console.log('\n📋 WhatsApp');
  await req('GET', '/api/whatsapp/conversations', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/whatsapp/templates', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Influencer Admin');
  await req('GET', '/api/admin/influencers', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/influencer-campaigns', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/influencer-invitations', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/influencer-commissions', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/influencer-payouts', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Notifications Admin');
  await req('GET', '/api/notifications/admin/failed-jobs', { auth: true, expectStatus: [200, 403, 404] });

  console.log('\n📋 Domains');
  await req('GET', '/api/domains/packages', { auth: true, expectStatus: [200, 403] });

  console.log('\n📋 Stripe Connect');
  await req('GET', '/api/stripe-connect/status', { auth: true, expectStatus: [200, 400, 403, 404] });

  console.log('\n📋 Permissions');
  await req('GET', '/api/admin/permissions/catalog', { auth: true, expectStatus: [200, 403] });
  await req('GET', '/api/admin/roles', { auth: true, expectStatus: [200, 403] });
}

async function testAuthGuards() {
  console.log('\n━━━ AUTH GUARD TESTS (no token → should 401/403) ━━━');
  await req('GET', '/api/auth/me', { expectStatus: 401 });
  await req('GET', '/api/cart', { expectStatus: 401 });
  await req('GET', '/api/orders', { expectStatus: 401 });
  await req('GET', '/api/admin/dashboard', { expectStatus: 401 });
  await req('GET', '/api/notifications', { expectStatus: 401 });
  await req('GET', '/api/gdpr/consent', { expectStatus: 401 });
}

async function main() {
  console.log(`\n🧪 HOS Marketplace — Comprehensive API Endpoint Test`);
  console.log(`   Target: ${API_BASE}`);
  console.log(`   Time:   ${new Date().toISOString()}\n`);

  // Phase 1: Auth guard tests (without token)
  await testAuthGuards();

  // Phase 2: Public endpoints
  await testPublicEndpoints();

  // Phase 3: Login
  const authed = await login();

  // Phase 4: Auth endpoints
  await testAuthEndpoints();

  // Phase 5: Admin endpoints
  await testAdminEndpoints();

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ Passed:  ${RESULTS.pass}`);
  console.log(`  ❌ Failed:  ${RESULTS.fail}`);
  console.log(`  Total:     ${RESULTS.pass + RESULTS.fail}`);
  console.log(`  Rate:      ${((RESULTS.pass / (RESULTS.pass + RESULTS.fail)) * 100).toFixed(1)}%`);

  if (RESULTS.errors.length > 0) {
    console.log('\n  Failed endpoints:');
    for (const err of RESULTS.errors) {
      if (err.error) {
        console.log(`    ❌ ${err.tag}: ${err.error}`);
      } else {
        console.log(`    ❌ ${err.tag}: got ${err.status}, expected ${err.expected}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════\n');
  process.exit(RESULTS.fail > 0 ? 1 : 0);
}

main();
