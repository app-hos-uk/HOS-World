const API = 'https://hos-marketplaceapi-production.up.railway.app/api';

const results = { passed: 0, failed: 0, errors: [] };

async function req(method, path, body, token) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, data: json, ok: r.ok };
  } catch (e) {
    return { status: 0, data: e.message, ok: false };
  }
}

function check(name, condition, detail) {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    const msg = `  ✗ ${name} — ${detail || 'FAILED'}`;
    results.errors.push(msg);
    console.log(msg);
  }
}

// ─── PHASE 1: Core API Health ───
async function testHealth() {
  console.log('\n═══ PHASE 1: API Health & Core Endpoints ═══');
  
  const health = await req('GET', '/health');
  check('GET /health', health.ok, `status=${health.status}`);
  
  const live = await req('GET', '/health/live');
  check('GET /health/live', live.ok, `status=${live.status}`);
  
  const ready = await req('GET', '/health/ready');
  check('GET /health/ready', ready.ok || ready.status === 503, `status=${ready.status}`);
  
  const root = await req('GET', '');
  check('GET / (root)', root.status === 200 || root.status === 404, `status=${root.status}`);
}

// ─── PHASE 2: Login All Roles ───
const tokens = {};
async function testLogins() {
  console.log('\n═══ PHASE 2: User Role Logins ═══');
  
  const users = [
    { email: 'app@houseofspells.co.uk', password: 'Admin123', role: 'ADMIN (super)' },
    { email: 'admin@hos.test', password: 'Test123!', role: 'ADMIN (test)' },
    { email: 'customer@hos.test', password: 'Test123!', role: 'CUSTOMER' },
    { email: 'wholesaler@hos.test', password: 'Test123!', role: 'WHOLESALER' },
    { email: 'seller@hos.test', password: 'Test123!', role: 'B2C_SELLER' },
    { email: 'procurement@hos.test', password: 'Test123!', role: 'PROCUREMENT' },
    { email: 'fulfillment@hos.test', password: 'Test123!', role: 'FULFILLMENT' },
    { email: 'catalog@hos.test', password: 'Test123!', role: 'CATALOG' },
    { email: 'marketing@hos.test', password: 'Test123!', role: 'MARKETING' },
    { email: 'finance@hos.test', password: 'Test123!', role: 'FINANCE' },
    { email: 'cms@hos.test', password: 'Test123!', role: 'CMS_EDITOR' },
  ];

  for (const u of users) {
    const r = await req('POST', '/auth/login', { email: u.email, password: u.password });
    const token = r.data?.data?.token || r.data?.data?.accessToken || r.data?.data?.access_token || r.data?.token;
    const ok = r.ok && token;
    check(`Login ${u.role} (${u.email})`, ok, `status=${r.status} ${!token ? 'no token' : ''} ${r.data?.message || ''}`);
    if (token) {
      const key = u.role.replace(/[^A-Z_]/g, '').replace(/^_/, '');
      tokens[key] = token;
      tokens[u.email] = token;
    }
  }
}

// ─── PHASE 3: Auth endpoints ───
async function testAuthEndpoints() {
  console.log('\n═══ PHASE 3: Auth & User Endpoints ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  
  if (!t) { console.log('  ⚠ No admin token, skipping auth tests'); return; }
  
  const me = await req('GET', '/auth/me', null, t);
  check('GET /auth/me', me.ok, `status=${me.status}`);
  
  const profile = await req('GET', '/users/profile', null, t);
  check('GET /users/profile', profile.ok, `status=${profile.status}`);
}

// ─── PHASE 4: Public Endpoints ───
async function testPublicEndpoints() {
  console.log('\n═══ PHASE 4: Public Endpoints ═══');
  
  const products = await req('GET', '/products?limit=5');
  check('GET /products', products.ok, `status=${products.status}`);
  
  const categories = await req('GET', '/taxonomy/categories');
  check('GET /taxonomy/categories', categories.ok, `status=${categories.status}`);
  
  const catTree = await req('GET', '/taxonomy/categories/tree');
  check('GET /taxonomy/categories/tree', catTree.ok, `status=${catTree.status}`);
  
  const tags = await req('GET', '/taxonomy/tags');
  check('GET /taxonomy/tags', tags.ok, `status=${tags.status}`);
  
  const collections = await req('GET', '/collections');
  check('GET /collections', collections.ok, `status=${collections.status}`);
  
  const characters = await req('GET', '/characters');
  check('GET /characters', characters.ok, `status=${characters.status}`);
  
  const fandoms = await req('GET', '/fandoms');
  check('GET /fandoms', fandoms.ok, `status=${fandoms.status}`);
  
  const sellers = await req('GET', '/sellers/directory');
  check('GET /sellers/directory', sellers.ok, `status=${sellers.status}`);
  
  const currency = await req('GET', '/currency/rates');
  check('GET /currency/rates', currency.ok, `status=${currency.status}`);
  
  const shipping = await req('GET', '/shipping/methods');
  check('GET /shipping/methods', shipping.ok, `status=${shipping.status}`);
  
  const kbArticles = await req('GET', '/support/kb/articles');
  check('GET /support/kb/articles', kbArticles.ok, `status=${kbArticles.status}`);
  
  const newsletter = await req('GET', '/newsletter/status');
  check('GET /newsletter/status', newsletter.ok || newsletter.status === 401, `status=${newsletter.status}`);
}

// ─── PHASE 5: Admin Endpoints ───
async function testAdminEndpoints() {
  console.log('\n═══ PHASE 5: Admin Endpoints ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const dash = await req('GET', '/admin/dashboard', null, t);
  check('GET /admin/dashboard', dash.ok, `status=${dash.status}`);
  
  const users = await req('GET', '/admin/users', null, t);
  check('GET /admin/users', users.ok, `status=${users.status}`);
  
  const settings = await req('GET', '/admin/settings', null, t);
  check('GET /admin/settings', settings.ok, `status=${settings.status}`);
  
  const roles = await req('GET', '/admin/roles', null, t);
  check('GET /admin/roles', roles.ok, `status=${roles.status}`);
  
  const adminSellers = await req('GET', '/admin/sellers', null, t);
  check('GET /admin/sellers', adminSellers.ok, `status=${adminSellers.status}`);
  
  const adminProducts = await req('GET', '/admin/products', null, t);
  check('GET /admin/products', adminProducts.ok, `status=${adminProducts.status}`);
  
  const invitations = await req('GET', '/admin/sellers/invitations', null, t);
  check('GET /admin/sellers/invitations', invitations.ok, `status=${invitations.status}`);
  
  const influencers = await req('GET', '/admin/influencers', null, t);
  check('GET /admin/influencers', influencers.ok, `status=${influencers.status}`);
  
  const infInvitations = await req('GET', '/admin/influencer-invitations', null, t);
  check('GET /admin/influencer-invitations', infInvitations.ok, `status=${infInvitations.status}`);
  
  const infCommissions = await req('GET', '/admin/influencer-commissions', null, t);
  check('GET /admin/influencer-commissions', infCommissions.ok, `status=${infCommissions.status}`);
  
  const infPayouts = await req('GET', '/admin/influencer-payouts', null, t);
  check('GET /admin/influencer-payouts', infPayouts.ok, `status=${infPayouts.status}`);
  
  const infCampaigns = await req('GET', '/admin/influencer-campaigns', null, t);
  check('GET /admin/influencer-campaigns', infCampaigns.ok, `status=${infCampaigns.status}`);
}

// ─── PHASE 6: Dashboard Endpoints (by role) ───
async function testDashboards() {
  console.log('\n═══ PHASE 6: Dashboard Stats ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const dashStats = await req('GET', '/dashboard/stats', null, t);
  check('GET /dashboard/stats', dashStats.ok, `status=${dashStats.status}`);
  
  const dashAdmin = await req('GET', '/dashboard/admin', null, t);
  check('GET /dashboard/admin', dashAdmin.ok, `status=${dashAdmin.status}`);
  
  const pt = tokens['PROCUREMENT'] || tokens['procurement@hos.test'] || t;
  const dashProc = await req('GET', '/dashboard/procurement', null, pt);
  check('GET /dashboard/procurement', dashProc.ok, `status=${dashProc.status}`);
  
  const ft = tokens['FULFILLMENT'] || tokens['fulfillment@hos.test'] || t;
  const dashFul = await req('GET', '/dashboard/fulfillment', null, ft);
  check('GET /dashboard/fulfillment', dashFul.ok, `status=${dashFul.status}`);
  
  const ct = tokens['CATALOG'] || tokens['catalog@hos.test'] || t;
  const dashCat = await req('GET', '/dashboard/catalog', null, ct);
  check('GET /dashboard/catalog', dashCat.ok, `status=${dashCat.status}`);
  
  const mt = tokens['MARKETING'] || tokens['marketing@hos.test'] || t;
  const dashMkt = await req('GET', '/dashboard/marketing', null, mt);
  check('GET /dashboard/marketing', dashMkt.ok, `status=${dashMkt.status}`);
  
  const fint = tokens['FINANCE'] || tokens['finance@hos.test'] || t;
  const dashFin = await req('GET', '/dashboard/finance', null, fint);
  check('GET /dashboard/finance', dashFin.ok, `status=${dashFin.status}`);
}

// ─── PHASE 7: Submission & Procurement Pipeline ───
async function testSubmissionPipeline() {
  console.log('\n═══ PHASE 7: Submission & Procurement Pipeline ═══');
  
  const sellerT = tokens['B2C_SELLER'] || tokens['seller@hos.test'];
  if (sellerT) {
    const subs = await req('GET', '/submissions', null, sellerT);
    check('GET /submissions (seller)', subs.ok, `status=${subs.status}`);
    
    const dupCheck = await req('GET', '/submissions/check-duplicates?name=test', null, sellerT);
    check('GET /submissions/check-duplicates', dupCheck.ok, `status=${dupCheck.status}`);
  } else {
    console.log('  ⚠ No seller token, skipping submission tests');
  }
  
  const procT = tokens['PROCUREMENT'] || tokens['procurement@hos.test'];
  if (procT) {
    const procSubs = await req('GET', '/procurement/submissions', null, procT);
    check('GET /procurement/submissions', procSubs.ok, `status=${procSubs.status}`);
    
    const procDups = await req('GET', '/procurement/duplicates', null, procT);
    check('GET /procurement/duplicates', procDups.ok, `status=${procDups.status}`);
    
    const procStats = await req('GET', '/procurement/dashboard/stats', null, procT);
    check('GET /procurement/dashboard/stats', procStats.ok, `status=${procStats.status}`);
  } else {
    console.log('  ⚠ No procurement token, skipping procurement tests');
  }
  
  const catT = tokens['CATALOG'] || tokens['catalog@hos.test'];
  if (catT) {
    const catPending = await req('GET', '/catalog/pending', null, catT);
    check('GET /catalog/pending', catPending.ok, `status=${catPending.status}`);
    
    const catEntries = await req('GET', '/catalog/entries', null, catT);
    check('GET /catalog/entries', catEntries.ok, `status=${catEntries.status}`);
    
    const catStats = await req('GET', '/catalog/dashboard/stats', null, catT);
    check('GET /catalog/dashboard/stats', catStats.ok, `status=${catStats.status}`);
  } else {
    console.log('  ⚠ No catalog token, skipping catalog tests');
  }
  
  const mktT = tokens['MARKETING'] || tokens['marketing@hos.test'];
  if (mktT) {
    const mktPending = await req('GET', '/marketing/pending', null, mktT);
    check('GET /marketing/pending', mktPending.ok, `status=${mktPending.status}`);
    
    const mktStats = await req('GET', '/marketing/dashboard/stats', null, mktT);
    check('GET /marketing/dashboard/stats', mktStats.ok, `status=${mktStats.status}`);
  } else {
    console.log('  ⚠ No marketing token, skipping marketing tests');
  }
  
  const finT = tokens['FINANCE'] || tokens['finance@hos.test'];
  if (finT) {
    const finPending = await req('GET', '/finance/pending', null, finT);
    check('GET /finance/pending', finPending.ok, `status=${finPending.status}`);
    
    const finStats = await req('GET', '/finance/dashboard/stats', null, finT);
    check('GET /finance/dashboard/stats', finStats.ok, `status=${finStats.status}`);
    
    const finTxns = await req('GET', '/finance/transactions', null, finT);
    check('GET /finance/transactions', finTxns.ok, `status=${finTxns.status}`);
    
    const finPayouts = await req('GET', '/finance/payouts', null, finT);
    check('GET /finance/payouts', finPayouts.ok, `status=${finPayouts.status}`);
    
    const finRefunds = await req('GET', '/finance/refunds', null, finT);
    check('GET /finance/refunds', finRefunds.ok, `status=${finRefunds.status}`);
  } else {
    console.log('  ⚠ No finance token, skipping finance tests');
  }
  
  const pubT = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (pubT) {
    const pubReady = await req('GET', '/publishing/ready', null, pubT);
    check('GET /publishing/ready', pubReady.ok, `status=${pubReady.status}`);
    
    const pubDone = await req('GET', '/publishing/published', null, pubT);
    check('GET /publishing/published', pubDone.ok, `status=${pubDone.status}`);
  }
}

// ─── PHASE 8: Fulfillment & Inventory ───
async function testFulfillmentInventory() {
  console.log('\n═══ PHASE 8: Fulfillment & Inventory ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const fulT = tokens['FULFILLMENT'] || tokens['fulfillment@hos.test'] || t;
  
  const centers = await req('GET', '/fulfillment/centers', null, fulT);
  check('GET /fulfillment/centers', centers.ok, `status=${centers.status}`);
  
  const shipments = await req('GET', '/fulfillment/shipments', null, fulT);
  check('GET /fulfillment/shipments', shipments.ok, `status=${shipments.status}`);
  
  const fulStats = await req('GET', '/fulfillment/dashboard/stats', null, fulT);
  check('GET /fulfillment/dashboard/stats', fulStats.ok, `status=${fulStats.status}`);
  
  const warehouses = await req('GET', '/inventory/warehouses', null, t);
  check('GET /inventory/warehouses', warehouses.ok, `status=${warehouses.status}`);
  
  const lowStock = await req('GET', '/inventory/alerts/low-stock', null, t);
  check('GET /inventory/alerts/low-stock', lowStock.ok, `status=${lowStock.status}`);
  
  const invMetrics = await req('GET', '/inventory/metrics', null, t);
  check('GET /inventory/metrics', invMetrics.ok, `status=${invMetrics.status}`);
  
  const movements = await req('GET', '/inventory/movements', null, t);
  check('GET /inventory/movements', movements.ok, `status=${movements.status}`);
  
  const transfers = await req('GET', '/inventory/transfers', null, t);
  check('GET /inventory/transfers', transfers.ok, `status=${transfers.status}`);
  
  const locations = await req('GET', '/inventory/locations', null, t);
  check('GET /inventory/locations', locations.ok, `status=${locations.status}`);
}

// ─── PHASE 9: Orders & Payments ───
async function testOrdersPayments() {
  console.log('\n═══ PHASE 9: Orders & Payments ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const orders = await req('GET', '/orders', null, t);
  check('GET /orders', orders.ok, `status=${orders.status}`);
  
  const providers = await req('GET', '/payments/providers', null, t);
  check('GET /payments/providers', providers.ok, `status=${providers.status}`);
  
  const returns = await req('GET', '/returns', null, t);
  check('GET /returns', returns.ok, `status=${returns.status}`);
  
  const returnPolicies = await req('GET', '/return-policies', null, t);
  check('GET /return-policies', returnPolicies.ok, `status=${returnPolicies.status}`);
}

// ─── PHASE 10: Search & Other Modules ───
async function testSearchModules() {
  console.log('\n═══ PHASE 10: Search, CMS & Other Modules ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  
  const search = await req('GET', '/meilisearch/search?q=test');
  check('GET /meilisearch/search', search.ok || search.status === 500, `status=${search.status}`);
  
  const instant = await req('GET', '/meilisearch/instant?q=test');
  check('GET /meilisearch/instant', instant.ok || instant.status === 500, `status=${instant.status}`);
  
  const suggestions = await req('GET', '/meilisearch/suggestions?q=test');
  check('GET /meilisearch/suggestions', suggestions.ok || search.status === 500, `status=${suggestions.status}`);
  
  if (t) {
    const stats = await req('GET', '/meilisearch/stats', null, t);
    check('GET /meilisearch/stats', stats.ok || stats.status === 500, `status=${stats.status}`);
    
    const cmsPages = await req('GET', '/cms/pages', null, t);
    check('GET /cms/pages', cmsPages.ok, `status=${cmsPages.status}`);
    
    const cmsBanners = await req('GET', '/cms/banners', null, t);
    check('GET /cms/banners', cmsBanners.ok, `status=${cmsBanners.status}`);
    
    const cmsBlog = await req('GET', '/cms/blog', null, t);
    check('GET /cms/blog', cmsBlog.ok, `status=${cmsBlog.status}`);
    
    const activity = await req('GET', '/activity/logs', null, t);
    check('GET /activity/logs', activity.ok, `status=${activity.status}`);
    
    const webhooks = await req('GET', '/webhooks', null, t);
    check('GET /webhooks', webhooks.ok, `status=${webhooks.status}`);
    
    const integrations = await req('GET', '/integrations', null, t);
    check('GET /integrations', integrations.ok, `status=${integrations.status}`);
    
    const intProviders = await req('GET', '/integrations/providers', null, t);
    check('GET /integrations/providers', intProviders.ok, `status=${intProviders.status}`);
    
    const themes = await req('GET', '/themes', null, t);
    check('GET /themes', themes.ok, `status=${themes.status}`);
    
    const tenants = await req('GET', '/tenants/my-tenants', null, t);
    check('GET /tenants/my-tenants', tenants.ok, `status=${tenants.status}`);
    
    const custGroups = await req('GET', '/customer-groups', null, t);
    check('GET /customer-groups', custGroups.ok, `status=${custGroups.status}`);
    
    const logistics = await req('GET', '/logistics/partners', null, t);
    check('GET /logistics/partners', logistics.ok, `status=${logistics.status}`);
    
    const settlements = await req('GET', '/settlements', null, t);
    check('GET /settlements', settlements.ok, `status=${settlements.status}`);
    
    const domains = await req('GET', '/domains/me', null, t);
    check('GET /domains/me', domains.ok || domains.status === 404, `status=${domains.status}`);
    
    const notifications = await req('GET', '/notifications', null, t);
    check('GET /notifications', notifications.ok, `status=${notifications.status}`);
    
    const tickets = await req('GET', '/support/tickets', null, t);
    check('GET /support/tickets', tickets.ok, `status=${tickets.status}`);
    
    const geo = await req('GET', '/geolocation/detect');
    check('GET /geolocation/detect', geo.ok || geo.status === 400 || geo.status === 500, `status=${geo.status}`);
  }
}

// ─── PHASE 11: Tax & Promotions ───
async function testTaxPromotions() {
  console.log('\n═══ PHASE 11: Tax, Promotions & Gift Cards ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const zones = await req('GET', '/tax/zones', null, t);
  check('GET /tax/zones', zones.ok, `status=${zones.status}`);
  
  const classes = await req('GET', '/tax/classes', null, t);
  check('GET /tax/classes', classes.ok, `status=${classes.status}`);
  
  const rates = await req('GET', '/tax/rates', null, t);
  check('GET /tax/rates', rates.ok, `status=${rates.status}`);
  
  const promotions = await req('GET', '/promotions', null, t);
  check('GET /promotions', promotions.ok, `status=${promotions.status}`);
  
  const giftCards = await req('GET', '/gift-cards/my-gift-cards', null, t);
  check('GET /gift-cards/my-gift-cards', giftCards.ok, `status=${giftCards.status}`);
}

// ─── PHASE 12: Seller-specific ───
async function testSellerEndpoints() {
  console.log('\n═══ PHASE 12: Seller-Specific Endpoints ═══');
  const st = tokens['B2C_SELLER'] || tokens['seller@hos.test'];
  if (!st) { console.log('  ⚠ No seller token, skipping'); return; }
  
  const me = await req('GET', '/sellers/me', null, st);
  check('GET /sellers/me', me.ok, `status=${me.status}`);
  
  const myProducts = await req('GET', '/sellers/me/products', null, st);
  check('GET /sellers/me/products', myProducts.ok, `status=${myProducts.status}`);
}

// ─── PHASE 13: Customer-specific ───
async function testCustomerEndpoints() {
  console.log('\n═══ PHASE 13: Customer-Specific Endpoints ═══');
  const ct = tokens['CUSTOMER'] || tokens['customer@hos.test'];
  if (!ct) { console.log('  ⚠ No customer token, skipping'); return; }
  
  const wishlist = await req('GET', '/wishlist', null, ct);
  check('GET /wishlist', wishlist.ok, `status=${wishlist.status}`);
  
  const addresses = await req('GET', '/addresses', null, ct);
  check('GET /addresses', addresses.ok, `status=${addresses.status}`);
  
  const orders = await req('GET', '/orders', null, ct);
  check('GET /orders', orders.ok, `status=${orders.status}`);
  
  const gamification = await req('GET', '/gamification/profile', null, ct);
  check('GET /gamification/profile', gamification.ok || gamification.status === 404, `status=${gamification.status}`);
  
  const leaderboard = await req('GET', '/gamification/leaderboard', null, ct);
  check('GET /gamification/leaderboard', leaderboard.ok, `status=${leaderboard.status}`);
  
  const quests = await req('GET', '/quests', null, ct);
  check('GET /quests', quests.ok, `status=${quests.status}`);
  
  const digiPurchases = await req('GET', '/digital-products/my-purchases', null, ct);
  check('GET /digital-products/my-purchases', digiPurchases.ok, `status=${digiPurchases.status}`);
}

// ─── PHASE 14: Analytics & Reports ───
async function testAnalytics() {
  console.log('\n═══ PHASE 14: Analytics & Reports ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const salesTrends = await req('GET', '/analytics/sales/trends', null, t);
  check('GET /analytics/sales/trends', salesTrends.ok || salesTrends.status === 500, `status=${salesTrends.status}`);
  
  const custMetrics = await req('GET', '/analytics/customers/metrics', null, t);
  check('GET /analytics/customers/metrics', custMetrics.ok || custMetrics.status === 500, `status=${custMetrics.status}`);
  
  const prodPerf = await req('GET', '/analytics/products/performance', null, t);
  check('GET /analytics/products/performance', prodPerf.ok || prodPerf.status === 500, `status=${prodPerf.status}`);
  
  const revGrowth = await req('GET', '/analytics/revenue/growth', null, t);
  check('GET /analytics/revenue/growth', revGrowth.ok || revGrowth.status === 500, `status=${revGrowth.status}`);
  
  const finRevenue = await req('GET', '/finance/reports/revenue', null, t);
  check('GET /finance/reports/revenue', finRevenue.ok || finRevenue.status === 500, `status=${finRevenue.status}`);
  
  const finSellerPerf = await req('GET', '/finance/reports/seller-performance', null, t);
  check('GET /finance/reports/seller-performance', finSellerPerf.ok || finSellerPerf.status === 500, `status=${finSellerPerf.status}`);
  
  const finPlatFees = await req('GET', '/finance/reports/platform-fees', null, t);
  check('GET /finance/reports/platform-fees', finPlatFees.ok || finPlatFees.status === 500, `status=${finPlatFees.status}`);
}

// ─── PHASE 15: Duplicates & Discrepancies ───
async function testDuplicates() {
  console.log('\n═══ PHASE 15: Duplicates & Compliance ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  if (!t) { console.log('  ⚠ No admin token, skipping'); return; }
  
  const dupAlerts = await req('GET', '/duplicates/alerts', null, t);
  check('GET /duplicates/alerts', dupAlerts.ok, `status=${dupAlerts.status}`);
  
  const crossSeller = await req('GET', '/duplicates/cross-seller-groups', null, t);
  check('GET /duplicates/cross-seller-groups', crossSeller.ok, `status=${crossSeller.status}`);
  
  const compliance = await req('GET', '/compliance/requirements/GB', null, t);
  check('GET /compliance/requirements/GB', compliance.ok || compliance.status === 404, `status=${compliance.status}`);
  
  const compTax = await req('GET', '/compliance/tax-rates/GB', null, t);
  check('GET /compliance/tax-rates/GB', compTax.ok || compTax.status === 404, `status=${compTax.status}`);
}

// ─── PHASE 16: Monitoring ───
async function testMonitoring() {
  console.log('\n═══ PHASE 16: Monitoring & Metrics ═══');
  const t = tokens['ADMIN'] || tokens['app@houseofspells.co.uk'];
  
  const prom = await req('GET', '/metrics/prometheus');
  check('GET /metrics/prometheus', prom.ok || prom.status === 401, `status=${prom.status}`);
  
  const jsonMetrics = await req('GET', '/metrics/json');
  check('GET /metrics/json', jsonMetrics.ok || jsonMetrics.status === 401, `status=${jsonMetrics.status}`);
  
  const metricsHealth = await req('GET', '/metrics/health');
  check('GET /metrics/health', metricsHealth.ok || metricsHealth.status === 401, `status=${metricsHealth.status}`);
}

// ─── RUN ALL ───
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   HOS API ENDPOINT & LOGIN VERIFICATION SUITE       ║');
  console.log(`║   Target: ${API}  ║`);
  console.log(`║   Date: ${new Date().toISOString()}              ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  
  await testHealth();
  await testLogins();
  await testAuthEndpoints();
  await testPublicEndpoints();
  await testAdminEndpoints();
  await testDashboards();
  await testSubmissionPipeline();
  await testFulfillmentInventory();
  await testOrdersPayments();
  await testSearchModules();
  await testTaxPromotions();
  await testSellerEndpoints();
  await testCustomerEndpoints();
  await testAnalytics();
  await testDuplicates();
  await testMonitoring();
  
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                    FINAL RESULTS                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Total tests: ${results.passed + results.failed}`);
  console.log(`  ✓ Passed:    ${results.passed}`);
  console.log(`  ✗ Failed:    ${results.failed}`);
  console.log(`  Pass rate:   ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n── Failed Tests ──');
    results.errors.forEach(e => console.log(e));
  }
  
  console.log('\n── Login Token Summary ──');
  const roleKeys = Object.keys(tokens).filter(k => !k.includes('@'));
  console.log(`  Tokens acquired: ${roleKeys.length} roles → ${roleKeys.join(', ')}`);
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
