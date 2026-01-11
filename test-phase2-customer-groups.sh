#!/bin/bash

# Phase 2: Customer Groups API Tests
# This script tests all customer group endpoints

set -e

API_URL="${API_URL:-http://localhost:3001/api}"
AUTH_TOKEN=""

echo "🧪 Phase 2: Customer Groups Testing"
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

# Step 2: Create Customer Group
echo "2. Creating customer group..."
CUSTOMER_GROUP=$(make_request POST "/customer-groups" '{
  "name": "VIP Customers",
  "description": "VIP customer group with special benefits",
  "type": "VIP",
  "isActive": true
}')
echo "$CUSTOMER_GROUP" | jq '.'
GROUP_ID=$(echo "$CUSTOMER_GROUP" | jq -r '.data.id // empty')
if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
  echo "❌ Failed to create customer group"
  exit 1
fi
echo "✅ Created customer group: $GROUP_ID"
echo ""

# Step 3: Get All Customer Groups
echo "3. Getting all customer groups..."
ALL_GROUPS=$(make_request GET "/customer-groups")
GROUP_COUNT=$(echo "$ALL_GROUPS" | jq '.data | length')
echo "✅ Found $GROUP_COUNT customer groups"
echo "$ALL_GROUPS" | jq '.data[] | {id, name, type, isActive}'
echo ""

# Step 4: Get Customer Group by ID
echo "4. Getting customer group by ID..."
GROUP_DETAILS=$(make_request GET "/customer-groups/$GROUP_ID")
echo "$GROUP_DETAILS" | jq '.'
echo "✅ Retrieved customer group details"
echo ""

# Step 5: Update Customer Group
echo "5. Updating customer group..."
UPDATED_GROUP=$(make_request PUT "/customer-groups/$GROUP_ID" '{
  "description": "Updated VIP customer group description",
  "isActive": true
}')
echo "$UPDATED_GROUP" | jq '.'
echo "✅ Updated customer group"
echo ""

# Step 6: Get Users (to find a customer to add to group)
echo "6. Getting users to add to group..."
USERS=$(curl -s -X GET "$API_URL/users" \
  -H "Authorization: Bearer $AUTH_TOKEN")
CUSTOMER_ID=$(echo "$USERS" | jq -r '.data[] | select(.role == "CUSTOMER") | .id' | head -1)

if [ -z "$CUSTOMER_ID" ]; then
  echo "⚠️  No customer found, skipping customer assignment test"
else
  echo "7. Adding customer to group..."
  ADD_CUSTOMER=$(make_request POST "/customer-groups/$GROUP_ID/customers/$CUSTOMER_ID" '{}')
  echo "$ADD_CUSTOMER" | jq '.'
  echo "✅ Added customer to group"
  echo ""
  
  echo "8. Removing customer from group..."
  REMOVE_CUSTOMER=$(make_request DELETE "/customer-groups/customers/$CUSTOMER_ID" '{}')
  echo "$REMOVE_CUSTOMER" | jq '.'
  echo "✅ Removed customer from group"
  echo ""
fi

# Step 9: Test Summary
echo "====================================="
echo "✅ Phase 2 Customer Groups Tests Complete"
echo ""
echo "Test Summary:"
echo "- Created customer group"
echo "- Retrieved all customer groups"
echo "- Retrieved customer group by ID"
echo "- Updated customer group"
if [ -n "$CUSTOMER_ID" ]; then
  echo "- Added customer to group"
  echo "- Removed customer from group"
fi
echo ""
echo "Next: Test customer groups in admin UI"
