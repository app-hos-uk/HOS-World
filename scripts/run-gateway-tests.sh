#!/usr/bin/env bash
# Run gateway smoke test + load test.
#
# Usage:
#   ./scripts/run-gateway-tests.sh
#     Uses GATEWAY_URL or defaults to http://localhost:4000 (gateway must be running).
#   GATEWAY_URL=https://your-gateway.railway.app ./scripts/run-gateway-tests.sh
#     Tests the deployed gateway.
#
# Exit 0 if all pass; 1 otherwise.

set -e
GATEWAY_URL="${GATEWAY_URL:-http://localhost:4000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "Gateway tests → $GATEWAY_URL"
echo "=============================================="

echo ""
echo "1. Smoke test (gateway endpoints)..."
node scripts/smoke-test-gateway.mjs
echo ""

echo "2. Load test (short: 5s, 5 workers)..."
node scripts/load-test-gateway.mjs 5 5
echo ""

echo "=============================================="
echo "All gateway tests passed."
echo "=============================================="
