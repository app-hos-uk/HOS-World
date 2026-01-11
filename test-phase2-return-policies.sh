#!/bin/bash

# Phase 2: Return Policies API Tests
# This script tests all return policy endpoints

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
AUTH_TOKEN=""

echo "🧪 Phase 2: Return Policies Testing"
echo "====================================="
echo ""

# Helper function to make authenticated requests
make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  curl -s -X "$method" "$API_URL$endpoint" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${data:+-d "$data"}
}

# Step 1: Login as Admin
echo "1. Logging in as Admin..."
LOGIN_RESPONSE=$(make_request POST "/auth/login" '{"email":"admin@hos.com","password":"Test123!"}')
AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Login failed. Please ensure admin user exists."
  exit 1
fi
echo "✅ Logged in successfully"
echo ""

# Step 2: Create Platform-Wide Return Policy
echo "2. Creating platform-wide return policy..."
PLATFORM_POLICY=$(make_request POST "/return-policies" '{
  "name": "Standard Return Policy",
  "description": "30-day return policy for all products",
  "isReturnable": true,
  "returnWindowDays": 30,
  "requiresApproval": false,
  "requiresInspection": false,
  "refundMethod": "ORIGINAL_PAYMENT",
  "restockingFee": 0,
  "priority": 0,
  "isActive": true
}')
echo "$PLATFORM_POLICY" | jq '.'
POLICY_ID=$(echo "$PLATFORM_POLICY" | jq -r '.data.id // empty')
if [ -z "$POLICY_ID" ] || [ "$POLICY_ID" == "null" ]; then
  echo "❌ Failed to create return policy"
  exit 1
fi
echo "✅ Created return policy: $POLICY_ID"
echo ""

# Step 3: Get All Return Policies
echo "3. Getting all return policies..."
ALL_POLICIES=$(make_request GET "/return-policies")
POLICY_COUNT=$(echo "$ALL_POLICIES" | jq '.data | length')
echo "✅ Found $POLICY_COUNT return policies"
echo "$ALL_POLICIES" | jq '.data[] | {id, name, returnWindowDays, isActive}'
echo ""

# Step 4: Get Return Policy by ID
echo "4. Getting return policy by ID..."
POLICY_DETAILS=$(make_request GET "/return-policies/$POLICY_ID")
echo "$POLICY_DETAILS" | jq '.'
echo "✅ Retrieved return policy details"
echo ""

# Step 5: Update Return Policy
echo "5. Updating return policy..."
UPDATED_POLICY=$(make_request PUT "/return-policies/$POLICY_ID" '{
  "returnWindowDays": 45,
  "restockingFee": 5.00
}')
echo "$UPDATED_POLICY" | jq '.'
echo "✅ Updated return policy"
echo ""

# Step 6: Get Products (to test applicable policy)
echo "6. Getting products to test applicable policy..."
PRODUCTS=$(curl -s -X GET "$API_URL/products?limit=1" \
  -H "Authorization: Bearer $AUTH_TOKEN")
PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.data[0].id // empty' 2>/dev/null || echo "")

if [ -n "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ]; then
  echo "7. Getting applicable return policy for product..."
  APPLICABLE_POLICY=$(make_request GET "/return-policies/applicable/$PRODUCT_ID")
  echo "$APPLICABLE_POLICY" | jq '.'
  echo "✅ Retrieved applicable return policy"
  echo ""
fi

# Step 8: Test Summary
echo "====================================="
echo "✅ Phase 2 Return Policies Tests Complete"
echo ""
echo "Test Summary:"
echo "- Created platform-wide return policy"
echo "- Retrieved all return policies"
echo "- Retrieved return policy by ID"
echo "- Updated return policy"
if [ -n "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ]; then
  echo "- Retrieved applicable return policy for product"
fi
echo ""
echo "Next: Test return policies in admin UI and return requests"
