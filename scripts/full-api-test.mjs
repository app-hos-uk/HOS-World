// Full API Endpoint Test Script
const API = 'https://hos-marketplaceapi-production.up.railway.app/api';

let pass = 0, fail = 0, warn = 0;

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function getToken(email, password) {
  const { data } = await post(`${API}/auth/login`, { email, password });
  return data?.data?.token || null;
}

async function t(method, path, label, token) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { method, headers, signal: AbortSignal.timeout(10000) });
    const code = res.status;
    if (code === 200 || code === 201) {
      console.log(`✅ ${code} | ${method} ${path} | ${label}`);
      pass++;
    } else if (code === 503) {
      console.log(`⚡ ${code} | ${method} ${path} | ${label} (external dep)`);
      warn++;
    } else if (code === 501) {
      console.log(`⚡ ${code} | ${method} ${path} | ${label} (not implemented)`);
      warn++;
    } else {
      console.log(`❌ ${code} | ${method} ${path} | ${label}`);
      fail++;
    }
  } catch (e) {
    console.log(`❌ ERR | ${method} ${path} | ${label} (${e.message})`);
    fail++;
  }
}

async function main() {
  console.log('============================================');
  console.log('  OBTAINING TOKENS');
  console.log('============================================\n');

  const users = [
    ['ADMIN', 'admin@hos.test', 'Test123!'],
    ['CUSTOMER', 'customer@hos.test', 'Test123!'],
    ['SELLER', 'seller@hos.test', 'Test123!'],
    ['WHOLESALER', 'wholesaler@hos.test', 'Test123!'],
    ['PROCUREMENT', 'procurement@hos.test', 'Test123!'],
    ['FULFILLMENT', 'fulfillment@hos.test', 'Test123!'],
    ['CATALOG', 'catalog@hos.test', 'Test123!'],
    ['MARKETING', 'marketing@hos.test', 'Test123!'],
    ['FINANCE', 'finance@hos.test', 'Test123!'],
    ['CMS_EDITOR', 'cms@hos.test', 'Test123!'],
    ['INFLUENCER', 'influencer@hos.test', 'Test!123'],
  ];

  const tokens = {};
  let loginPass = 0;
  for (const [role, email, pwd] of users) {
    const tok = await getToken(email, pwd);
    if (tok && tok.length > 20) {
      console.log(`✅ ${role} login OK`);
      tokens[role] = tok;
      loginPass++;
    } else {
      console.log(`❌ ${role} login FAILED`);
    }
  }
  console.log(`\nLogins: ${loginPass} / ${users.length}\n`);

  const A = tokens.ADMIN;
  const C = tokens.CUSTOMER;
  const S = tokens.SELLER;
  const W = tokens.WHOLESALER;
  const P = tokens.PROCUREMENT;
  const FF = tokens.FULFILLMENT;
  const CA = tokens.CATALOG;
  const MK = tokens.MARKETING;
  const FI = tokens.FINANCE;
  const CM = tokens.CMS_EDITOR;
  const IN = tokens.INFLUENCER;

  // ==========================================
  console.log('============================================');
  console.log('  1. PUBLIC ENDPOINTS (No Auth)');
  console.log('============================================\n');

  await t('GET', '/health', 'Health check');
  await t('GET', '/', 'API root');
  await t('GET', '/products', 'Products');
  await t('GET', '/products?limit=5', 'Products (limit)');
  await t('GET', '/fandoms', 'Fandoms');
  await t('GET', '/characters', 'Characters');
  await t('GET', '/themes', 'Themes');
  await t('GET', '/taxonomy/categories', 'Categories');
  await t('GET', '/taxonomy/tags', 'Tags');
  await t('GET', '/taxonomy/attributes', 'Attributes');
  await t('GET', '/catalog/entries', 'Catalog entries');
  await t('GET', '/catalog/pending', 'Catalog pending');
  await t('GET', '/promotions', 'Promotions');
  await t('GET', '/shipping/methods', 'Shipping methods');
  await t('GET', '/badges', 'Badges');
  await t('GET', '/quests', 'Quests');
  await t('GET', '/currency/rates', 'Currency rates');
  await t('GET', '/geolocation/detect', 'Geolocation');
  await t('GET', '/gamification/leaderboard', 'Leaderboard');
  await t('GET', '/meilisearch/search?q=test', 'Meilisearch');

  // ==========================================
  console.log('\n============================================');
  console.log('  2. AUTH - /auth/me FOR ALL ROLES');
  console.log('============================================\n');

  await t('GET', '/auth/me', 'ADMIN', A);
  await t('GET', '/auth/me', 'CUSTOMER', C);
  await t('GET', '/auth/me', 'SELLER', S);
  await t('GET', '/auth/me', 'WHOLESALER', W);
  await t('GET', '/auth/me', 'PROCUREMENT', P);
  await t('GET', '/auth/me', 'FULFILLMENT', FF);
  await t('GET', '/auth/me', 'CATALOG', CA);
  await t('GET', '/auth/me', 'MARKETING', MK);
  await t('GET', '/auth/me', 'FINANCE', FI);
  await t('GET', '/auth/me', 'CMS_EDITOR', CM);
  await t('GET', '/auth/me', 'INFLUENCER', IN);

  // ==========================================
  console.log('\n============================================');
  console.log('  3. CUSTOMER ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/orders', 'My orders', C);
  await t('GET', '/cart', 'My cart', C);
  await t('GET', '/wishlist', 'My wishlist', C);
  await t('GET', '/addresses', 'My addresses', C);
  await t('GET', '/returns', 'My returns', C);
  await t('GET', '/notifications', 'Notifications', C);

  // ==========================================
  console.log('\n============================================');
  console.log('  4. SELLER ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/sellers/me', 'Seller profile', S);
  await t('GET', '/submissions', 'My submissions', S);

  // ==========================================
  console.log('\n============================================');
  console.log('  5. PROCUREMENT ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/procurement/submissions', 'Procurement submissions', P);

  // ==========================================
  console.log('\n============================================');
  console.log('  6. FULFILLMENT ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/fulfillment/shipments', 'Fulfillment shipments', FF);

  // ==========================================
  console.log('\n============================================');
  console.log('  7. CATALOG ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/catalog/entries', 'Catalog entries', CA);
  await t('GET', '/catalog/pending', 'Catalog pending', CA);
  await t('GET', '/catalog/dashboard/stats', 'Catalog stats', CA);

  // ==========================================
  console.log('\n============================================');
  console.log('  8. FINANCE ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/finance/pending', 'Finance pending (FINANCE)', FI);
  await t('GET', '/finance/dashboard/stats', 'Finance stats (FINANCE)', FI);
  await t('GET', '/finance/transactions', 'Transactions (FINANCE)', FI);
  await t('GET', '/finance/transactions', 'Transactions (ADMIN)', A);

  // ==========================================
  console.log('\n============================================');
  console.log('  9. CMS ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/cms/pages', 'CMS pages', CM);

  // ==========================================
  console.log('\n============================================');
  console.log('  10. ADMIN MANAGEMENT ENDPOINTS');
  console.log('============================================\n');

  await t('GET', '/admin/dashboard', 'Admin dashboard', A);
  await t('GET', '/admin/users', 'Admin users', A);
  await t('GET', '/orders', 'All orders', A);
  await t('GET', '/notifications', 'Notifications', A);
  await t('GET', '/support/tickets', 'Support tickets', A);
  await t('GET', '/customer-groups', 'Customer groups', A);
  await t('GET', '/return-policies', 'Return policies', A);
  await t('GET', '/tenants', 'Tenants', A);
  await t('GET', '/integrations', 'Integrations', A);
  await t('GET', '/webhooks', 'Webhooks', A);
  await t('GET', '/discrepancies', 'Discrepancies', A);
  await t('GET', '/collections', 'Collections', A);
  await t('GET', '/tax/rates', 'Tax rates', A);
  await t('GET', '/dashboard/stats', 'Dashboard stats', A);
  await t('GET', '/settlements', 'Settlements', A);
  await t('GET', '/activity/logs', 'Activity logs', A);
  await t('GET', '/whatsapp/conversations', 'WhatsApp', A);
  await t('GET', '/gdpr/consent', 'GDPR consent', A);
  await t('GET', '/newsletter/subscriptions', 'Newsletter', A);

  // ==========================================
  console.log('\n============================================');
  console.log('  11. INFLUENCER ENDPOINTS (as INFLUENCER)');
  console.log('============================================\n');

  await t('GET', '/influencers/me', 'My profile', IN);
  await t('GET', '/influencers/me/analytics', 'My analytics', IN);
  await t('GET', '/influencers/me/product-links', 'My product links', IN);
  await t('GET', '/influencers/me/campaigns', 'My campaigns', IN);
  await t('GET', '/influencers/me/commissions', 'My commissions', IN);
  await t('GET', '/influencers/me/earnings', 'My earnings', IN);
  await t('GET', '/influencers/me/payouts', 'My payouts', IN);
  await t('GET', '/influencers/me/storefront', 'My storefront', IN);
  await t('GET', '/referrals/me', 'My referrals', IN);

  // ==========================================
  console.log('\n============================================');
  console.log('  12. INFLUENCER ADMIN (as ADMIN)');
  console.log('============================================\n');

  await t('GET', '/admin/influencers', 'All influencers', A);
  await t('GET', '/admin/influencer-invitations', 'All invitations', A);
  await t('GET', '/admin/influencer-campaigns', 'All campaigns', A);
  await t('GET', '/admin/influencer-commissions', 'All commissions', A);
  await t('GET', '/admin/influencer-payouts', 'All payouts', A);

  // ==========================================
  console.log('\n============================================');
  console.log('  FINAL RESULTS');
  console.log('============================================\n');

  const total = pass + fail + warn;
  console.log(`✅ Passed:  ${pass} / ${total}`);
  console.log(`❌ Failed:  ${fail} / ${total}`);
  console.log(`⚡ Warning: ${warn} / ${total} (external deps / not implemented)`);
  console.log('');

  if (fail === 0) {
    console.log('🎉 ALL ENDPOINTS PASSING (no errors)');
  } else {
    console.log(`⚠️  ${fail} endpoint(s) need attention`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
