#!/bin/bash

# Comprehensive Test Script for Product Visibility and Category/Fandom Issues
# This script tests:
# 1. Product creation with PUBLISHED status (should become ACTIVE)
# 2. Product visibility to customers
# 3. Category/fandom optional fields in product submission
# 4. No products available scenario

set -e

API_URL="${API_URL:-https://hos-marketplaceapi-production.up.railway.app/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@houseofspells.co.uk}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

echo "🧪 Starting Comprehensive Product Visibility Tests"
echo "=================================================="
echo "API URL: $API_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_test() {
    local test_name=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "   $message"
        fi
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "   $message"
        fi
        ((TESTS_FAILED++))
    fi
}

# Step 1: Admin Login
echo "📝 Step 1: Admin Login"
echo "----------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if [ -z "$LOGIN_RESPONSE" ]; then
    echo -e "${RED}❌ Failed to get login response${NC}"
    exit 1
fi

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to extract token from login response${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}"
echo ""

# Step 2: Test Product Creation with PUBLISHED Status
echo "📝 Step 2: Create Product with PUBLISHED Status"
echo "-----------------------------------------------"
PRODUCT_NAME="Test Product $(date +%s)"
PRODUCT_DATA=$(cat <<EOF
{
  "name": "$PRODUCT_NAME",
  "description": "Test product for visibility verification",
  "price": 29.99,
  "currency": "GBP",
  "stock": 10,
  "status": "PUBLISHED",
  "sku": "TEST-$(date +%s)",
  "fandom": "Harry Potter",
  "category": "Collectibles"
}
EOF
)

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/admin/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$PRODUCT_DATA")

PRODUCT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
PRODUCT_STATUS=$(echo "$CREATE_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

if [ -z "$PRODUCT_ID" ]; then
    print_test "Product Creation" "FAIL" "Failed to create product. Response: $CREATE_RESPONSE"
else
    if [ "$PRODUCT_STATUS" = "ACTIVE" ]; then
        print_test "Product Creation with PUBLISHED Status" "PASS" "Product created with ID: $PRODUCT_ID, Status: $PRODUCT_STATUS (correctly mapped from PUBLISHED)"
    else
        print_test "Product Creation with PUBLISHED Status" "FAIL" "Product created but status is '$PRODUCT_STATUS' instead of 'ACTIVE'"
    fi
fi

echo ""

# Step 3: Test Product Visibility to Customers
echo "📝 Step 3: Test Product Visibility to Customers"
echo "------------------------------------------------"
CUSTOMER_PRODUCTS_RESPONSE=$(curl -s -X GET "$API_URL/products?page=1&limit=20")

if echo "$CUSTOMER_PRODUCTS_RESPONSE" | grep -q "$PRODUCT_NAME"; then
    print_test "Product Visibility to Customers" "PASS" "Product '$PRODUCT_NAME' is visible to customers"
else
    print_test "Product Visibility to Customers" "FAIL" "Product '$PRODUCT_NAME' is NOT visible to customers"
    echo "   Response: $CUSTOMER_PRODUCTS_RESPONSE"
fi

echo ""

# Step 4: Test Product Count
echo "📝 Step 4: Check Total Active Products"
echo "---------------------------------------"
TOTAL_PRODUCTS=$(echo "$CUSTOMER_PRODUCTS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")

if [ -n "$TOTAL_PRODUCTS" ] && [ "$TOTAL_PRODUCTS" -gt 0 ]; then
    print_test "Active Products Count" "PASS" "Found $TOTAL_PRODUCTS active product(s) visible to customers"
else
    print_test "Active Products Count" "FAIL" "No active products found. This indicates the issue exists."
fi

echo ""

# Step 5: Test Product Update Status
echo "📝 Step 5: Test Product Status Update"
echo "-------------------------------------"
if [ -n "$PRODUCT_ID" ]; then
    UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/admin/products/$PRODUCT_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"status": "PUBLISHED"}')
    
    UPDATED_STATUS=$(echo "$UPDATE_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    
    if [ "$UPDATED_STATUS" = "ACTIVE" ]; then
        print_test "Product Status Update" "PASS" "Status update from PUBLISHED correctly mapped to ACTIVE"
    else
        print_test "Product Status Update" "FAIL" "Status update failed. Status is '$UPDATED_STATUS' instead of 'ACTIVE'"
    fi
else
    print_test "Product Status Update" "SKIP" "Skipped - No product ID available"
fi

echo ""

# Step 6: Test Fandoms API
echo "📝 Step 6: Test Fandoms API (for Category/Fandom Issue)"
echo "------------------------------------------------------"
FANDOMS_RESPONSE=$(curl -s -X GET "$API_URL/fandoms")

if echo "$FANDOMS_RESPONSE" | grep -q '"data"'; then
    FANDOMS_COUNT=$(echo "$FANDOMS_RESPONSE" | grep -o '"data":\[.*\]' | grep -o '{"id"' | wc -l | tr -d ' ')
    print_test "Fandoms API" "PASS" "Fandoms API working. Found $FANDOMS_COUNT fandom(s)"
else
    print_test "Fandoms API" "FAIL" "Fandoms API returned error or empty response"
    echo "   Response: $FANDOMS_RESPONSE"
fi

echo ""

# Step 7: Test Product Submission (Seller Flow)
echo "📝 Step 7: Test Product Submission with Optional Fandom/Category"
echo "------------------------------------------------------------------"
# This would require a seller account - skipping for now but documenting the test
print_test "Product Submission Flow" "SKIP" "Requires seller account setup. Manual testing recommended."

echo ""

# Step 8: Summary
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi

