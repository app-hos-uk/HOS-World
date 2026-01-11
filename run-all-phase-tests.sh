#!/bin/bash

# Comprehensive Test Runner for Phase 1 & Phase 2
# This script runs all test suites in sequence

set -e

echo "🧪 Phase 1 & Phase 2 Comprehensive Testing"
echo "============================================"
echo ""
echo "This will test:"
echo "- Phase 1: Promotion Engine, Shipping Rules, API Versioning"
echo "- Phase 2: Customer Groups, Return Policies, Return Requests"
echo ""
echo "Make sure the API server is running on http://localhost:3001"
echo ""

# Check if API is accessible
if ! curl -s -f "${API_URL:-http://localhost:3001/api}/health" > /dev/null 2>&1; then
  echo "⚠️  Warning: API server may not be running"
  echo "   Please start the API server first: cd services/api && pnpm start:dev"
  echo ""
  echo "   Attempting to continue anyway (tests will fail if API is not running)..."
  echo ""
  # In non-interactive mode, continue anyway
  # Uncomment the exit below if you want to stop when API is not available
  # exit 1
fi

# Test counters
PASSED=0
FAILED=0

# Function to run a test script
run_test() {
  local test_name=$1
  local test_script=$2
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Running: $test_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  if bash "$test_script"; then
    echo "✅ $test_name: PASSED"
    ((PASSED++))
  else
    echo "❌ $test_name: FAILED"
    ((FAILED++))
  fi
  echo ""
}

# Phase 1 Tests
echo "📦 PHASE 1 TESTS"
echo "=================="
echo ""

run_test "Promotion Engine" "test-phase1-promotions.sh"
run_test "Shipping Rules" "test-phase1-shipping.sh"

# Phase 2 Tests
echo "📦 PHASE 2 TESTS"
echo "=================="
echo ""

run_test "Customer Groups" "test-phase2-customer-groups.sh"
run_test "Return Policies" "test-phase2-return-policies.sh"
run_test "Return Requests" "test-phase2-return-requests.sh"

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed. Please review the output above."
  exit 1
fi
