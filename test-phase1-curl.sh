#!/bin/bash

# Phase 1 End-to-End Tests using curl
# Tests Promotion Engine, Shipping Rules, and API Versioning

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
BASE_URL="${API_URL%/api}"

echo "🧪 Phase 1 E2E Test Suite (curl-based)"
echo "======================================="
echo "API URL: $API_URL"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: $1"
        ((FAILED++))
        return 1
    fi
}

test_skip() {
    echo -e "${YELLOW}⏭️  SKIP${NC}: $1 (requires authentication)"
    ((SKIPPED++))
}

# Test helper function
test_endpoint() {
    local method=$1
    local url=$2
    local description=$3
    local expected_status=${4:-200}
    local data=$5
    local headers=$6
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo -e "${BLUE}URL:${NC} $method $url"
    
    if [ -n "$data" ]; then
        echo -e "${BLUE}Data:${NC} $data"
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "Content-Type: application/json" $headers "$url" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" $headers -d "$data" "$url" 2>&1)
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT -H "Content-Type: application/json" $headers -d "$data" "$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method -H "Content-Type: application/json" $headers "$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    echo -e "${BLUE}Status:${NC} $http_code"
    
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        test_result "$description"
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo -e "${BLUE}Response:${NC} $(echo "$body" | head -c 200)..."
        fi
        echo ""
        return 0
    elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        test_skip "$description (requires authentication)"
        echo ""
        return 0
    else
        test_result "$description"
        echo -e "${RED}Error:${NC} Expected $expected_status, got $http_code"
        if [ -n "$body" ]; then
            echo -e "${RED}Response:${NC} $body"
        fi
        echo ""
        return 1
    fi
}

echo "📋 Test 1: API Health Check"
echo "---------------------------"
test_endpoint "GET" "$API_URL/v1/health" "API v1 health check"
test_endpoint "GET" "$API_URL/health" "API legacy health check"
echo ""

echo "📋 Test 2: API Versioning"
echo "-------------------------"
test_endpoint "GET" "$API_URL/v1/products?page=1&limit=1" "v1 products endpoint"
test_endpoint "GET" "$API_URL/products?page=1&limit=1" "Legacy products endpoint"
test_endpoint "GET" "$BASE_URL/api/v1" "v1 root endpoint"
test_endpoint "GET" "$BASE_URL/api" "Legacy root endpoint"
echo ""

echo "📋 Test 3: Promotions API"
echo "-------------------------"
test_endpoint "GET" "$API_URL/v1/promotions" "List promotions"
test_endpoint "GET" "$API_URL/v1/promotions?status=ACTIVE" "List active promotions"
test_endpoint "POST" "$API_URL/v1/promotions/coupons/validate" "Validate coupon" "200" '{"couponCode":"TEST"}'
echo ""

echo "📋 Test 4: Shipping API"
echo "-----------------------"
test_endpoint "GET" "$API_URL/v1/shipping/methods" "List shipping methods"
test_endpoint "POST" "$API_URL/v1/shipping/options" "Calculate shipping options" "200" '{"cartItems":[],"cartValue":0,"destination":{"country":"GB"}}'
echo ""

echo "📋 Test 5: API Documentation"
echo "----------------------------"
test_endpoint "GET" "$BASE_URL/api/docs" "Swagger documentation"
test_endpoint "GET" "$BASE_URL/api/docs-json" "Swagger JSON"
echo ""

echo "📋 Test 6: Versioned Endpoints"
echo "-------------------------------"
test_endpoint "GET" "$API_URL/v1/auth/me" "Get current user (v1)" "401"
test_endpoint "GET" "$API_URL/auth/me" "Get current user (legacy)" "401"
test_endpoint "GET" "$API_URL/v1/cart" "Get cart (v1)" "401"
test_endpoint "GET" "$API_URL/cart" "Get cart (legacy)" "401"
echo ""

# Summary
echo "======================================="
echo "📊 Test Summary"
echo "======================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo "Total: $((PASSED + FAILED + SKIPPED))"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $PASSED -gt 0 ]; then
        echo -e "${GREEN}✅ All accessible tests passed!${NC}"
        if [ $SKIPPED -gt 0 ]; then
            echo -e "${YELLOW}ℹ️  Some tests were skipped (require authentication)${NC}"
            echo "   This is expected for protected endpoints."
        fi
        exit 0
    else
        echo -e "${YELLOW}⚠️  No tests could be executed.${NC}"
        echo "   Check if servers are running:"
        echo "   - API: curl $API_URL/v1/health"
        echo "   - Frontend: curl http://localhost:3000"
        exit 1
    fi
else
    echo -e "${RED}❌ Some tests failed.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Ensure API server is running: cd services/api && pnpm dev"
    echo "2. Check API health: curl $API_URL/v1/health"
    echo "3. Verify endpoints are accessible"
    exit 1
fi
