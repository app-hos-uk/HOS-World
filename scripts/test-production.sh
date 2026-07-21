#!/usr/bin/env bash
# Smoke test + API endpoints test against production (monolith).
# Use after deploy to verify APIs respond.
#
# Usage: ./scripts/test-production.sh
# Override: API_BASE_URL=https://custom.railway.app ./scripts/test-production.sh

set -e
API_BASE_URL="${API_BASE_URL:?Set API_BASE_URL env var before running}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "Production tests → $API_BASE_URL"
echo "=============================================="

echo ""
echo "1. Smoke test (health endpoints)..."
GATEWAY_URL="$API_BASE_URL" GATEWAY_FULL=0 node scripts/smoke-test-gateway.mjs
echo ""

echo "2. API endpoints (public)..."
API_URL="$API_BASE_URL/api" node test-api-endpoints.js
echo ""

echo "=============================================="
echo "Production tests completed."
echo "=============================================="
