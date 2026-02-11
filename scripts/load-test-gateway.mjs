#!/usr/bin/env node
/**
 * Load test: Gateway → microservices pipeline
 *
 * Usage:
 *   GATEWAY_URL=http://localhost:4000 node scripts/load-test-gateway.mjs
 *   GATEWAY_URL=https://gateway.example.com node scripts/load-test-gateway.mjs [concurrency] [durationSec]
 *
 * Default: 10 concurrent workers, 30 seconds. Optional args: concurrency durationSec
 *
 * Targets:
 *   GET /api/health/live (gateway health)
 *   GET /api/health/services (service registry)
 *   GET /api/health/circuits (circuit breaker state)
 *
 * Exits 0 if success rate >= 95% and no unexpected 5xx; else 1.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const concurrency = parseInt(process.argv[2] || '10', 10);
const durationSec = parseInt(process.argv[3] || '30', 10);

const endpoints = [
  { method: 'GET', path: '/api/health/live' },
  { method: 'GET', path: '/api/health/services' },
  { method: 'GET', path: '/api/health/circuits' },
];

const results = { ok: 0, err: 0, statuses: {} };

function pickEndpoint() {
  return endpoints[Math.floor(Math.random() * endpoints.length)];
}

async function runOne() {
  const { method, path } = pickEndpoint();
  const url = `${GATEWAY_URL.replace(/\/$/, '')}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { method });
    const ms = Date.now() - start;
    results.statuses[res.status] = (results.statuses[res.status] || 0) + 1;
    if (res.ok) {
      results.ok++;
      return { ok: true, status: res.status, ms };
    }
    results.err++;
    return { ok: false, status: res.status, ms };
  } catch (e) {
    results.err++;
    results.statuses['0'] = (results.statuses['0'] || 0) + 1;
    return { ok: false, error: e.message };
  }
}

function worker(id) {
  return new Promise((resolve) => {
    const endAt = Date.now() + durationSec * 1000;
    function tick() {
      if (Date.now() >= endAt) {
        resolve();
        return;
      }
      runOne().finally(() => setImmediate(tick));
    }
    setImmediate(tick);
  });
}

async function main() {
  console.log(`Load test: ${GATEWAY_URL} concurrency=${concurrency} duration=${durationSec}s`);
  const start = Date.now();
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const total = results.ok + results.err;
  const successRate = total ? ((results.ok / total) * 100).toFixed(2) : 0;

  console.log(`Done in ${elapsed}s. Total requests: ${total}`);
  console.log(`Success: ${results.ok}, Errors: ${results.err}, Success rate: ${successRate}%`);
  console.log('Status codes:', results.statuses);

  const failed = (results.statuses['502'] || 0) + (results.statuses['503'] || 0) + (results.statuses['0'] || 0);
  if (Number(successRate) >= 95 && failed === 0) {
    console.log('PASS: success rate >= 95% and no 502/503/connection errors');
    process.exit(0);
  }
  console.log('FAIL: success rate < 95% or presence of 502/503/connection errors');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
