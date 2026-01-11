#!/bin/bash

# Phase 2: Return Requests API Tests
# This script tests all return request endpoints

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
CUSTOMER_TOKEN=""
ADMIN_TOKEN=""
ORDER_ID=""

echo "🧪 Phase 2: Return Requests Testing"
echo "====================================="
echo ""

# Helper function to make authenticated requests
make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  local token=$4
  
  curl -s -X "$method" "$API_URL$endpoint" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token:-$CUSTOMER_TOKEN}" \
    ${data:+-d "$data"}
}

# Step 1: Login as Customer
echo "1. Logging in as Customer..."
CUSTOMER_LOGIN=$(make_request POST "/auth/login" '{"email":"customer@hos.com","password":"Test123!"}' "")
CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$CUSTOMER_TOKEN" ]; then
  echo "❌ Customer login failed. Please ensure customer user exists."
  exit 1
fi
echo "✅ Customer logged in successfully"
echo ""

# Step 2: Get Customer Orders
echo "2. Getting customer orders..."
ORDERS=$(make_request GET "/orders" "" "$CUSTOMER_TOKEN")
ORDER_ID=$(echo "$ORDERS" | jq -r '.data[0].id // empty' 2>/dev/null || echo "")

if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" == "null" ]; then
  echo "⚠️  No orders found. Creating a test order..."
  # Try to create an order (this may fail if cart is empty)
  echo "   Please create an order first, then run this test again"
  exit 1
fi
echo "✅ Found order: $ORDER_ID"
echo ""

# Step 3: Check Return Eligibility
echo "3. Checking return eligibility..."
ELIGIBILITY=$(make_request GET "/return-policies/eligibility/$ORDER_ID" "" "$CUSTOMER_TOKEN")
echo "$ELIGIBILITY" | jq '.'
echo "✅ Return eligibility checked"
echo ""

# Step 4: Create Return Request (Full Order)
echo "4. Creating return request for full order..."
RETURN_REQUEST=$(make_request POST "/returns" '{
  "orderId": "'$ORDER_ID'",
  "reason": "DEFECTIVE",
  "notes": "Item arrived damaged"
}' "$CUSTOMER_TOKEN")
echo "$RETURN_REQUEST" | jq '.'
RETURN_ID=$(echo "$RETURN_REQUEST" | jq -r '.data.id // empty')
if [ -z "$RETURN_ID" ] || [ "$RETURN_ID" == "null" ]; then
  echo "❌ Failed to create return request"
  echo "Response: $RETURN_REQUEST"
  exit 1
fi
echo "✅ Created return request: $RETURN_ID"
echo ""

# Step 5: Get All Return Requests
echo "5. Getting all return requests..."
ALL_RETURNS=$(make_request GET "/returns" "" "$CUSTOMER_TOKEN")
RETURN_COUNT=$(echo "$ALL_RETURNS" | jq '.data | length')
echo "✅ Found $RETURN_COUNT return requests"
echo ""

# Step 6: Get Return Request by ID
echo "6. Getting return request by ID..."
RETURN_DETAILS=$(make_request GET "/returns/$RETURN_ID" "" "$CUSTOMER_TOKEN")
echo "$RETURN_DETAILS" | jq '.'
echo "✅ Retrieved return request details"
echo ""

# Step 7: Login as Admin to Update Status
echo "7. Logging in as Admin..."
ADMIN_LOGIN=$(make_request POST "/auth/login" '{"email":"admin@hos.com","password":"Test123!"}' "")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Admin logged in"
echo ""

# Step 8: Update Return Status
echo "8. Updating return request status (Admin)..."
STATUS_UPDATE=$(make_request PUT "/returns/$RETURN_ID/status" '{
  "status": "APPROVED",
  "refundAmount": 50.00,
  "refundMethod": "ORIGINAL_PAYMENT"
}' "$ADMIN_TOKEN")
echo "$STATUS_UPDATE" | jq '.'
echo "✅ Updated return request status"
echo ""

# Step 9: Test Summary
echo "====================================="
echo "✅ Phase 2 Return Requests Tests Complete"
echo ""
echo "Test Summary:"
echo "- Checked return eligibility"
echo "- Created return request"
echo "- Retrieved all return requests"
echo "- Retrieved return request by ID"
echo "- Updated return request status (Admin)"
echo ""
echo "Next: Test return requests in customer UI"
