#!/usr/bin/env node
/**
 * Smoke test key API endpoints.
 * Run: API_BASE_URL="https://hos-marketplaceapi-production.up.railway.app/api" node scripts/verify-api-endpoints.mjs
 * Or: API_BASE_URL="http://localhost:3001/api" node scripts/verify-api-endpoints.mjs
 */

const baseUrl = process.env.API_BASE_URL || 'https://hos-marketplaceapi-production.up.railway.app/api';

const endpoints = [
  { path: '/', method: 'GET', public: true, desc: 'Root/health' },
  { path: '/health', method: 'GET', public: true, desc: 'Health check' },
  { path: '/health/live', method: 'GET', public: true, desc: 'Liveness' },
  { path: '/health/ready', method: 'GET', public: true, desc: 'Readiness (DB+Redis)' },
  { path: '/products', method: 'GET', public: true, desc: 'Products list' },
  { path: '/taxonomy/categories', method: 'GET', public: true, desc: 'Categories' },
  { path: '/themes', method: 'GET', public: true, desc: 'Themes' },
  { path: '/fandoms', method: 'GET', public: true, desc: 'Fandoms' },
  { path: '/auth/me', method: 'GET', public: false, desc: 'Current user (requires auth)' },
];

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('\n🔍 API Endpoints Smoke Test\n');
  console.log(`Base URL: ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    const url = `${baseUrl}${ep.path}`.replace(/([^:]\/)\/+/g, '$1');
    try {
      const { status, ok, data } = await fetchJson(url, { method: ep.method });
      const expectOk = ep.public;
      const success = expectOk ? ok : status === 401 || status === 403 || ok;

      if (success) {
        console.log(`✅ ${ep.method} ${ep.path} → ${status} (${ep.desc})`);
        passed++;
      } else {
        console.log(`❌ ${ep.method} ${ep.path} → ${status} (${ep.desc})`);
        if (data?.message) console.log(`   ${data.message}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${ep.method} ${ep.path} → ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Result: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Smoke test failed:', err.message);
  process.exit(1);
});
