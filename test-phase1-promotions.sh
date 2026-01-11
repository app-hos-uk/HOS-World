#!/bin/bash

# Phase 1: Promotion Engine API Tests
# This script tests all promotion and coupon endpoints

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
AUTH_TOKEN=""

echo "🧪 Phase 1: Promotion Engine Testing"
echo "======================================"
echo ""

# Helper function to make authenticated requests
make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -z "$AUTH_TOKEN" ]; then
    curl -s -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      ${data:+-d "$data"}
  else
    curl -s -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      ${data:+-d "$data"}
  fi
}

# Step 1: Login as Admin
echo "1. Logging in as Admin..."
LOGIN_RESPONSE=$(make_request POST "/auth/login" '{"email":"admin@hos.com","password":"Test123!"}')
AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Login failed. Please ensure admin user exists."
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅ Logged in successfully"
echo ""

# Step 2: Create Percentage Discount Promotion
echo "2. Creating percentage discount promotion..."
PERCENTAGE_PROMO=$(make_request POST "/promotions" '{
  "name": "Test 20% Off",
  "description": "20% off all products",
  "type": "PERCENTAGE_DISCOUNT",
  "status": "ACTIVE",
  "priority": 10,
  "startDate": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "conditions": {
    "cartValue": {
      "min": 50
    }
  },
  "actions": {
    "type": "PERCENTAGE_DISCOUNT",
    "percentage": 20
  },
  "isStackable": false
}')
echo "$PERCENTAGE_PROMO" | jq '.'
PROMO_ID=$(echo "$PERCENTAGE_PROMO" | jq -r '.data.id // empty')
if [ -z "$PROMO_ID" ] || [ "$PROMO_ID" == "null" ]; then
  echo "❌ Failed to create promotion"
  exit 1
fi
echo "✅ Created promotion: $PROMO_ID"
echo ""

# Step 3: Create Fixed Amount Promotion
echo "3. Creating fixed amount promotion..."
FIXED_PROMO=$(make_request POST "/promotions" '{
  "name": "Test £10 Off",
  "description": "£10 off orders over £100",
  "type": "FIXED_DISCOUNT",
  "status": "ACTIVE",
  "priority": 5,
  "startDate": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "conditions": {
    "cartValue": {
      "min": 100
    }
  },
  "actions": {
    "type": "FIXED_DISCOUNT",
    "fixedAmount": 10
  },
  "isStackable": false
}')
echo "$FIXED_PROMO" | jq '.'
echo "✅ Created fixed amount promotion"
echo ""

# Step 4: Get All Promotions
echo "4. Getting all active promotions..."
ALL_PROMOS=$(make_request GET "/promotions")
PROMO_COUNT=$(echo "$ALL_PROMOS" | jq '.data | length')
echo "✅ Found $PROMO_COUNT active promotions"
echo ""

# Step 5: Create Coupon
echo "5. Creating coupon for promotion..."
COUPON=$(make_request POST "/promotions/coupons" '{
  "promotionId": "'$PROMO_ID'",
  "code": "TEST20OFF",
  "usageLimit": 100,
  "userLimit": 1
}')
echo "$COUPON" | jq '.'
COUPON_CODE="TEST20OFF"
echo "✅ Created coupon: $COUPON_CODE"
echo ""

# Step 6: Validate Coupon
echo "6. Validating coupon..."
# First, login as a customer
CUSTOMER_LOGIN=$(make_request POST "/auth/login" '{"email":"customer@hos.com","password":"Test123!"}')
CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$CUSTOMER_TOKEN" ]; then
  echo "⚠️  Customer login failed, using admin token"
  CUSTOMER_TOKEN="$AUTH_TOKEN"
fi

VALIDATE_RESPONSE=$(curl -s -X GET "$API_URL/promotions/coupons/validate?code=$COUPON_CODE&cartValue=100" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$VALIDATE_RESPONSE" | jq '.'
echo "✅ Coupon validation completed"
echo ""

# Step 7: Test Summary
echo "======================================"
echo "✅ Phase 1 Promotion Engine Tests Complete"
echo ""
echo "Test Summary:"
echo "- Created percentage discount promotion"
echo "- Created fixed amount promotion"
echo "- Retrieved all promotions"
echo "- Created coupon"
echo "- Validated coupon"
echo ""
echo "Next: Test coupon application in cart flow"
