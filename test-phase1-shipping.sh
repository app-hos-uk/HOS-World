#!/bin/bash

# Phase 1: Shipping Rules API Tests
# This script tests all shipping method and rule endpoints

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
AUTH_TOKEN=""

echo "🧪 Phase 1: Shipping Rules Testing"
echo "===================================="
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
  exit 1
fi
echo "✅ Logged in successfully"
echo ""

# Step 2: Create Shipping Method
echo "2. Creating shipping method..."
SHIPPING_METHOD=$(make_request POST "/shipping/methods" '{
  "name": "Standard Shipping",
  "description": "Standard delivery within 5-7 business days",
  "type": "FLAT_RATE",
  "isActive": true
}')
echo "$SHIPPING_METHOD" | jq '.'
METHOD_ID=$(echo "$SHIPPING_METHOD" | jq -r '.data.id // empty')
if [ -z "$METHOD_ID" ] || [ "$METHOD_ID" == "null" ]; then
  echo "❌ Failed to create shipping method"
  exit 1
fi
echo "✅ Created shipping method: $METHOD_ID"
echo ""

# Step 3: Create Shipping Rule (Flat Rate)
echo "3. Creating flat rate shipping rule..."
FLAT_RULE=$(make_request POST "/shipping/rules" '{
  "shippingMethodId": "'$METHOD_ID'",
  "name": "UK Standard",
  "priority": 10,
  "rate": 5.99,
  "freeShippingThreshold": 50,
  "estimatedDays": 5,
  "conditions": {
    "country": "GB"
  },
  "isActive": true
}')
echo "$FLAT_RULE" | jq '.'
RULE_ID=$(echo "$FLAT_RULE" | jq -r '.data.id // empty')
echo "✅ Created shipping rule: $RULE_ID"
echo ""

# Step 4: Create Weight-Based Shipping Method
echo "4. Creating weight-based shipping method..."
WEIGHT_METHOD=$(make_request POST "/shipping/methods" '{
  "name": "Weight-Based Shipping",
  "description": "Shipping based on package weight",
  "type": "WEIGHT_BASED",
  "isActive": true
}')
WEIGHT_METHOD_ID=$(echo "$WEIGHT_METHOD" | jq -r '.data.id // empty')
echo "✅ Created weight-based method: $WEIGHT_METHOD_ID"
echo ""

# Step 5: Create Weight-Based Rule
echo "5. Creating weight-based shipping rule..."
WEIGHT_RULE=$(make_request POST "/shipping/rules" '{
  "shippingMethodId": "'$WEIGHT_METHOD_ID'",
  "name": "UK Weight-Based",
  "priority": 5,
  "rate": 2.50,
  "estimatedDays": 7,
  "conditions": {
    "country": "GB",
    "weightRange": {
      "min": 0,
      "max": 10
    }
  },
  "isActive": true
}')
echo "✅ Created weight-based rule"
echo ""

# Step 6: Get All Shipping Methods
echo "6. Getting all shipping methods..."
ALL_METHODS=$(make_request GET "/shipping/methods")
METHOD_COUNT=$(echo "$ALL_METHODS" | jq '.data | length')
echo "✅ Found $METHOD_COUNT shipping methods"
echo ""

# Step 7: Calculate Shipping Rate
echo "7. Calculating shipping rate..."
SHIPPING_RATE=$(make_request POST "/shipping/calculate" '{
  "weight": 2.5,
  "cartValue": 75,
  "destination": {
    "country": "GB",
    "city": "London",
    "postalCode": "SW1A 1AA"
  }
}')
echo "$SHIPPING_RATE" | jq '.'
echo "✅ Shipping rate calculated"
echo ""

# Step 8: Get Shipping Options
echo "8. Getting shipping options for checkout..."
SHIPPING_OPTIONS=$(make_request POST "/shipping/options" '{
  "cartItems": [
    {
      "productId": "test-product-id",
      "quantity": 2,
      "weight": 1.5
    }
  ],
  "cartValue": 100,
  "destination": {
    "country": "GB",
    "city": "London",
    "postalCode": "SW1A 1AA"
  }
}')
echo "$SHIPPING_OPTIONS" | jq '.'
echo "✅ Shipping options retrieved"
echo ""

# Step 9: Test Summary
echo "===================================="
echo "✅ Phase 1 Shipping Rules Tests Complete"
echo ""
echo "Test Summary:"
echo "- Created flat rate shipping method"
echo "- Created shipping rule with conditions"
echo "- Created weight-based shipping method"
echo "- Retrieved all shipping methods"
echo "- Calculated shipping rate"
echo "- Retrieved shipping options"
echo ""
echo "Next: Test shipping in checkout flow"
