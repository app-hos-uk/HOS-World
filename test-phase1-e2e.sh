#!/bin/bash

# Phase 1 End-to-End Test Script
# Tests Promotion Engine, Shipping Rules, and API Versioning

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo "🧪 Phase 1 E2E Test Suite"
echo "========================="
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $1"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $1"
        ((FAILED++))
    fi
}

# Test 1: API Health Check
echo "📋 Test 1: API Health Check"
echo "---------------------------"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/v1/health" || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    test_result "API health check"
else
    echo -e "${RED}❌ FAIL${NC}: API health check (HTTP $HTTP_CODE)"
    ((FAILED++))
fi
echo ""

# Test 2: API Versioning - v1 endpoints
echo "📋 Test 2: API Versioning"
echo "-------------------------"
V1_PRODUCTS=$(curl -s -w "\n%{http_code}" "$API_URL/v1/products?page=1&limit=1" || echo "000")
V1_CODE=$(echo "$V1_PRODUCTS" | tail -n1)
if [ "$V1_CODE" = "200" ] || [ "$V1_CODE" = "401" ]; then
    test_result "v1 products endpoint accessible"
else
    echo -e "${RED}❌ FAIL${NC}: v1 products endpoint (HTTP $V1_CODE)"
    ((FAILED++))
fi

LEGACY_PRODUCTS=$(curl -s -w "\n%{http_code}" "$API_URL/products?page=1&limit=1" || echo "000")
LEGACY_CODE=$(echo "$LEGACY_PRODUCTS" | tail -n1)
if [ "$LEGACY_CODE" = "200" ] || [ "$LEGACY_CODE" = "401" ]; then
    test_result "Legacy products endpoint still works"
else
    echo -e "${RED}❌ FAIL${NC}: Legacy products endpoint (HTTP $LEGACY_CODE)"
    ((FAILED++))
fi
echo ""

# Test 3: Promotions Endpoints
echo "📋 Test 3: Promotions API"
echo "-------------------------"
PROMOTIONS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/v1/promotions" \
    -H "Authorization: Bearer ${ADMIN_TOKEN:-test}" || echo "000")
PROMOTIONS_CODE=$(echo "$PROMOTIONS_RESPONSE" | tail -n1)
if [ "$PROMOTIONS_CODE" = "200" ] || [ "$PROMOTIONS_CODE" = "401" ]; then
    test_result "Promotions endpoint accessible"
else
    echo -e "${RED}❌ FAIL${NC}: Promotions endpoint (HTTP $PROMOTIONS_CODE)"
    ((FAILED++))
fi

COUPON_VALIDATE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/promotions/coupons/validate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN:-test}" \
    -d '{"couponCode":"TEST"}' || echo "000")
COUPON_CODE=$(echo "$COUPON_VALIDATE" | tail -n1)
if [ "$COUPON_CODE" = "200" ] || [ "$COUPON_CODE" = "400" ] || [ "$COUPON_CODE" = "401" ]; then
    test_result "Coupon validation endpoint accessible"
else
    echo -e "${RED}❌ FAIL${NC}: Coupon validation endpoint (HTTP $COUPON_CODE)"
    ((FAILED++))
fi
echo ""

# Test 4: Shipping Endpoints
echo "📋 Test 4: Shipping API"
echo "-----------------------"
SHIPPING_METHODS=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/v1/shipping/methods" \
    -H "Authorization: Bearer ${ADMIN_TOKEN:-test}" || echo "000")
SHIPPING_CODE=$(echo "$SHIPPING_METHODS" | tail -n1)
if [ "$SHIPPING_CODE" = "200" ] || [ "$SHIPPING_CODE" = "401" ]; then
    test_result "Shipping methods endpoint accessible"
else
    echo -e "${RED}❌ FAIL${NC}: Shipping methods endpoint (HTTP $SHIPPING_CODE)"
    ((FAILED++))
fi

SHIPPING_OPTIONS=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/shipping/options" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN:-test}" \
    -d '{"cartItems":[],"cartValue":0,"destination":{"country":"GB"}}' || echo "000")
OPTIONS_CODE=$(echo "$SHIPPING_OPTIONS" | tail -n1)
if [ "$OPTIONS_CODE" = "200" ] || [ "$OPTIONS_CODE" = "400" ] || [ "$OPTIONS_CODE" = "401" ]; then
    test_result "Shipping options calculation endpoint accessible"
else
    echo -e "${RED}❌ FAIL${NC}: Shipping options endpoint (HTTP $OPTIONS_CODE)"
    ((FAILED++))
fi
echo ""

# Test 5: Swagger Documentation
echo "📋 Test 5: API Documentation"
echo "----------------------------"
SWAGGER_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/docs" || echo "000")
SWAGGER_CODE=$(echo "$SWAGGER_RESPONSE" | tail -n1)
if [ "$SWAGGER_CODE" = "200" ]; then
    test_result "Swagger documentation accessible"
else
    echo -e "${RED}❌ FAIL${NC}: Swagger documentation (HTTP $SWAGGER_CODE)"
    ((FAILED++))
fi
echo ""

# Summary
echo "========================="
echo "📊 Test Summary"
echo "========================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    echo ""
    echo "Note: Some tests may fail if authentication is required."
    echo "Set ADMIN_TOKEN environment variable for authenticated tests."
    exit 1
fi
