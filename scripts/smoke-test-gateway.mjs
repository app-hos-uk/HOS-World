#!/usr/bin/env node
/**
 * Smoke test: Gateway API endpoints
 *
 * Usage:
 *   GATEWAY_URL=http://localhost:4000 node scripts/smoke-test-gateway.mjs
 *   GATEWAY_URL=https://your-gateway.railway.app node scripts/smoke-test-gateway.mjs
 *
 * Exits 0 if all gateway-owned endpoints return expected status; else 1.
 */

const BASE = (process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
// Set GATEWAY_FULL=1 to require /api/health/services and /api/health/circuits (gateway-only).
// Omit or set to 0 when target may be monolith (those endpoints 404 there).
const fullGateway = process.env.GATEWAY_FULL !== '0' && process.env.GATEWAY_FULL !== '';

const tests = [
  { name: 'Root /', path: '/', expectStatus: 200, expectBody: 'status' },
  { name: 'Health', path: '/api/health', expectStatus: 200, expectBody: 'service' },
  { name: 'Health live', path: '/api/health/live', expectStatus: 200, expectBody: 'status' },
  { name: 'Health ready', path: '/api/health/ready', expectStatus: 200, expectBody: 'status' },
  { name: 'Health services', path: '/api/health/services', expectStatus: 200, expectBody: 'services', gatewayOnly: true },
  { name: 'Health circuits', path: '/api/health/circuits', expectStatus: 200, expectBody: 'circuits', gatewayOnly: true },
].filter((t) => !t.gatewayOnly || fullGateway);

async function run() {
  console.log(`Smoke testing: ${BASE}${fullGateway ? ' (full gateway)' : ' (core health only)'}\n`);
  let failed = 0;
  for (const t of tests) {
    const url = `${BASE}${t.path}`;
    try {
      const res = await fetch(url, { method: 'GET' });
      const ok = res.ok && res.status === t.expectStatus;
      const body = ok ? await res.json() : null;
      const hasKey = !t.expectBody || (body && typeof body[t.expectBody] !== 'undefined');
      if (ok && hasKey) {
        console.log(`  ✅ ${t.name} (${t.path}) → ${res.status}`);
      } else {
        console.log(`  ❌ ${t.name} (${t.path}) → ${res.status}${!hasKey ? ' (missing expected key)' : ''}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ ${t.name} (${t.path}) → Error: ${e.message}`);
      failed++;
    }
  }
  console.log('');
  if (failed > 0) {
    console.log(`FAIL: ${failed} endpoint(s) failed.`);
    process.exit(1);
  }
  console.log('PASS: All gateway endpoints responded as expected.');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
