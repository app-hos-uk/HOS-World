#!/usr/bin/env bash
#
# Staging smoke test script
# Usage: BASE_URL=https://your-staging.railway.app ./scripts/smoke-test-staging.sh
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAILED=0

echo "═══════════════════════════════════════════════════════════"
echo "Smoke test: $BASE_URL"
echo "═══════════════════════════════════════════════════════════"

check() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"
  local code
  code=$(curl -s -o /tmp/smoke_response.json -w "%{http_code}" "$url")
  if [ "$code" = "$expected_code" ]; then
    echo "✅ $name: HTTP $code"
  else
    echo "❌ $name: expected HTTP $expected_code, got $code"
    cat /tmp/smoke_response.json 2>/dev/null | head -5
    FAILED=1
  fi
}

check "Health live"    "$BASE_URL/api/health/live"
check "Health"         "$BASE_URL/api/health"
check "Products"       "$BASE_URL/api/products?limit=1"
check "Swagger docs"   "$BASE_URL/api/docs"  "200"

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ All smoke tests passed"
  exit 0
else
  echo "❌ Some smoke tests failed"
  exit 1
fi
