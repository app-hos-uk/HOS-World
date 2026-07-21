/**
 * Stress Test for HOS Marketplace API
 * Phase 1: Heavy load test on public endpoints (200 concurrent workers)
 * Phase 2: Authenticated endpoint tests
 *
 * Usage: node infrastructure/stress-test.mjs [--duration=30] [--concurrency=200] [--phase=all|heavy|auth]
 */

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

const DURATION_SEC = Number(args.duration) || 30;
const CONCURRENCY = Number(args.concurrency) || 200;
const PHASE = args.phase || 'all';

// ─── Stats helper ────────────────────────────────────────────────────
class Stats {
  constructor(name) {
    this.name = name;
    this.count = 0;
    this.errors = 0;
    this.latencies = [];
    this.statusCodes = {};
  }
  record(latencyMs, statusCode, isError) {
    this.count++;
    this.latencies.push(latencyMs);
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;
    if (isError) this.errors++;
  }
  percentile(p) {
    if (!this.latencies.length) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
  }
  avg() {
    if (!this.latencies.length) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }
  summary() {
    return {
      requests: this.count,
      errors: this.errors,
      errorRate: this.count ? `${((this.errors / this.count) * 100).toFixed(1)}%` : '0%',
      avgMs: Math.round(this.avg()),
      p50Ms: Math.round(this.percentile(50)),
      p95Ms: Math.round(this.percentile(95)),
      p99Ms: Math.round(this.percentile(99)),
      maxMs: Math.round(Math.max(...(this.latencies.length ? this.latencies : [0]))),
      statusCodes: this.statusCodes,
    };
  }
}

function printReport(title, allStats, perEndpoint, endpoints, elapsedSec) {
  const rps = (allStats.count / elapsedSec).toFixed(1);
  console.log('');
  console.log('='.repeat(75));
  console.log(`  ${title}`);
  console.log('='.repeat(75));
  console.log(`  Duration:       ${elapsedSec.toFixed(1)}s`);
  console.log(`  Total Requests: ${allStats.count.toLocaleString()}`);
  console.log(`  Total Errors:   ${allStats.errors.toLocaleString()}`);
  console.log(`  Throughput:     ${rps} req/s`);
  console.log('');
  console.log('  LATENCY (all endpoints)');
  console.log(`    Avg:  ${Math.round(allStats.avg())}ms`);
  console.log(`    p50:  ${Math.round(allStats.percentile(50))}ms`);
  console.log(`    p95:  ${Math.round(allStats.percentile(95))}ms`);
  console.log(`    p99:  ${Math.round(allStats.percentile(99))}ms`);
  console.log(`    Max:  ${Math.round(Math.max(...(allStats.latencies.length ? allStats.latencies : [0])))}ms`);
  console.log('');

  console.log('  PER-ENDPOINT BREAKDOWN');
  console.log('-'.repeat(75));
  console.log(
    '  ' +
      'Endpoint'.padEnd(22) +
      'Reqs'.padStart(8) +
      'Errs'.padStart(7) +
      'Avg'.padStart(8) +
      'p50'.padStart(8) +
      'p95'.padStart(8) +
      'p99'.padStart(8) +
      'Max'.padStart(8),
  );
  console.log('-'.repeat(75));
  for (const ep of endpoints) {
    const s = perEndpoint[ep.name].summary();
    console.log(
      '  ' +
        ep.name.padEnd(22) +
        String(s.requests).padStart(8) +
        String(s.errors).padStart(7) +
        `${s.avgMs}ms`.padStart(8) +
        `${s.p50Ms}ms`.padStart(8) +
        `${s.p95Ms}ms`.padStart(8) +
        `${s.p99Ms}ms`.padStart(8) +
        `${s.maxMs}ms`.padStart(8),
    );
  }
  console.log('-'.repeat(75));
  console.log('');

  console.log('  STATUS CODE DISTRIBUTION');
  const codes = allStats.summary().statusCodes;
  for (const [code, count] of Object.entries(codes).sort()) {
    const pct = ((count / allStats.count) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((count / allStats.count) * 40));
    console.log(`    ${code === '0' ? 'ERR' : code}: ${String(count).padStart(7)} (${pct.padStart(5)}%) ${bar}`);
  }
  console.log('');

  const errorRate = allStats.errors / Math.max(1, allStats.count);
  const p95 = allStats.percentile(95);
  const verdict =
    errorRate < 0.05 && p95 < 2000
      ? '✅ PASS'
      : errorRate >= 0.05
        ? '❌ FAIL (error rate too high)'
        : '⚠️  WARN (p95 latency > 2s)';
  console.log(`  VERDICT: ${verdict}`);
  console.log(`    Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: <5%)`);
  console.log(`    p95 latency: ${Math.round(p95)}ms (threshold: <2000ms)`);
  console.log('='.repeat(75));
}

async function runLoadPhase(endpoints, concurrency, durationSec, title) {
  const totalWeight = endpoints.reduce((s, e) => s + e.weight, 0);
  function pickEndpoint() {
    let r = Math.random() * totalWeight;
    for (const ep of endpoints) {
      r -= ep.weight;
      if (r <= 0) return ep;
    }
    return endpoints[0];
  }

  const allStats = new Stats('TOTAL');
  const perEndpoint = {};
  endpoints.forEach((ep) => (perEndpoint[ep.name] = new Stats(ep.name)));
  let running = true;

  async function makeRequest(ep) {
    const url = `${BASE_URL}${ep.path}`;
    const opts = { method: ep.method, headers: { ...ep.headers, 'Content-Type': 'application/json' } };
    if (ep.body) opts.body = JSON.stringify(ep.body);
    const start = performance.now();
    let statusCode = 0;
    let isError = false;
    try {
      const res = await fetch(url, opts);
      statusCode = res.status;
      await res.text();
      isError = statusCode >= 500;
    } catch {
      statusCode = 0;
      isError = true;
    }
    const latency = performance.now() - start;
    allStats.record(latency, statusCode, isError);
    perEndpoint[ep.name].record(latency, statusCode, isError);
  }

  async function worker() {
    while (running) {
      await makeRequest(pickEndpoint());
    }
  }

  console.log('');
  console.log(`  🚀 ${title}`);
  console.log(`     Concurrency: ${concurrency} | Duration: ${durationSec}s`);
  console.log('');

  const start = performance.now();
  const progressInterval = setInterval(() => {
    const elapsed = ((performance.now() - start) / 1000).toFixed(0);
    const rps = (allStats.count / Math.max(1, elapsed)).toFixed(0);
    process.stdout.write(
      `\r  [${elapsed}s / ${durationSec}s] Requests: ${allStats.count.toLocaleString()} | Errors: ${allStats.errors} | RPS: ${rps} | Avg: ${Math.round(allStats.avg())}ms  `,
    );
  }, 1000);

  const workers = Array.from({ length: concurrency }, () => worker());
  setTimeout(() => { running = false; }, durationSec * 1000);
  await Promise.all(workers);
  clearInterval(progressInterval);

  const elapsed = (performance.now() - start) / 1000;
  printReport(title, allStats, perEndpoint, endpoints, elapsed);
  return allStats;
}

// ─── Authenticated helper ────────────────────────────────────────────
async function getAuthToken() {
  const uid = Math.random().toString(36).slice(2, 10);
  const email = `stresstest-${uid}@hos.test`;
  const password = 'StressTest@1234';

  // Try to register
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      firstName: 'Stress',
      lastName: 'Tester',
      inviteCode: process.env.REGISTRATION_INVITE_CODES?.split(',')[0] || 'hos2024',
    }),
  });
  const regData = await regRes.json();

  if (regData?.data?.accessToken) {
    return { token: regData.data.accessToken, email };
  }

  // If registration failed, try login in case user already existed
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  if (loginData?.data?.accessToken) {
    return { token: loginData.data.accessToken, email };
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────
console.log('');
console.log('╔═════════════════════════════════════════════════════════════════════════╗');
console.log('║           HOS MARKETPLACE API - STRESS TEST SUITE                      ║');
console.log('╚═════════════════════════════════════════════════════════════════════════╝');
console.log(`  Target: ${BASE_URL}`);

// Preflight
try {
  const hc = await fetch(`${BASE_URL}/health`);
  const hcBody = await hc.json();
  console.log(`  Health: ${hcBody.status} (${hc.status})`);
  console.log(`  DB: ${hcBody.checks?.database?.status || '?'} | Redis: ${hcBody.checks?.redis?.status || '?'}`);
} catch (e) {
  console.log(`  ❌ API not reachable: ${e.message}`);
  process.exit(1);
}

// ═══════════════ PHASE 1: HEAVY PUBLIC LOAD ═══════════════
if (PHASE === 'all' || PHASE === 'heavy') {
  const PUBLIC_ENDPOINTS = [
    { name: 'Health', method: 'GET', path: '/health', weight: 5, headers: {} },
    { name: 'Products List', method: 'GET', path: '/products?page=1&limit=20', weight: 25, headers: {} },
    { name: 'Products Page 2', method: 'GET', path: '/products?page=2&limit=20', weight: 10, headers: {} },
    { name: 'Categories', method: 'GET', path: '/categories', weight: 15, headers: {} },
    { name: 'Search "wand"', method: 'GET', path: '/search?q=wand&page=1&limit=10', weight: 15, headers: {} },
    { name: 'Search "potion"', method: 'GET', path: '/search?q=potion&page=1&limit=10', weight: 10, headers: {} },
    { name: 'Product slug 404', method: 'GET', path: '/products/nonexistent-slug', weight: 10, headers: {} },
    { name: 'Departments', method: 'GET', path: '/departments', weight: 10, headers: {} },
  ];

  await runLoadPhase(PUBLIC_ENDPOINTS, CONCURRENCY, DURATION_SEC, `PHASE 1: HEAVY PUBLIC LOAD (${CONCURRENCY} workers)`);
}

// ═══════════════ PHASE 2: AUTHENTICATED ENDPOINTS ═══════════════
if (PHASE === 'all' || PHASE === 'auth') {
  console.log('');
  console.log('  🔑 Obtaining auth token for Phase 2...');

  const auth = await getAuthToken();

  if (!auth) {
    console.log('  ⚠️  Could not obtain auth token. Testing auth endpoints with 401 behavior instead.');

    const UNAUTH_ENDPOINTS = [
      { name: 'Profile (no auth)', method: 'GET', path: '/users/me', weight: 20, headers: {} },
      { name: 'Orders (no auth)', method: 'GET', path: '/orders', weight: 20, headers: {} },
      { name: 'Cart (no auth)', method: 'GET', path: '/cart', weight: 20, headers: {} },
      { name: 'Wishlist (no auth)', method: 'GET', path: '/wishlist', weight: 15, headers: {} },
      { name: 'Addresses (no auth)', method: 'GET', path: '/addresses', weight: 10, headers: {} },
      { name: 'Notifications', method: 'GET', path: '/notifications', weight: 15, headers: {} },
    ];

    await runLoadPhase(UNAUTH_ENDPOINTS, Math.min(CONCURRENCY, 100), Math.min(DURATION_SEC, 15), 'PHASE 2: AUTH ENDPOINT GUARD TEST (no token)');
  } else {
    console.log(`  ✅ Authenticated as ${auth.email}`);
    const authHeader = { Authorization: `Bearer ${auth.token}` };

    const AUTH_ENDPOINTS = [
      { name: 'Profile', method: 'GET', path: '/users/me', weight: 20, headers: authHeader },
      { name: 'Orders', method: 'GET', path: '/orders', weight: 20, headers: authHeader },
      { name: 'Cart', method: 'GET', path: '/cart', weight: 20, headers: authHeader },
      { name: 'Wishlist', method: 'GET', path: '/wishlist', weight: 15, headers: authHeader },
      { name: 'Addresses', method: 'GET', path: '/addresses', weight: 10, headers: authHeader },
      { name: 'Notifications', method: 'GET', path: '/notifications', weight: 15, headers: authHeader },
    ];

    await runLoadPhase(AUTH_ENDPOINTS, Math.min(CONCURRENCY, 100), DURATION_SEC, 'PHASE 2: AUTHENTICATED ENDPOINTS');
  }
}

console.log('');
console.log('  ✨ Stress test suite complete.');
console.log('');
