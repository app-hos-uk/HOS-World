#!/bin/bash

# Test script for admin seller creation
# Usage: ./test-seller-creation.sh [admin-email] [admin-password]

API_URL="${NEXT_PUBLIC_API_URL:-https://hos-marketplaceapi-production.up.railway.app/api}"
ADMIN_EMAIL="${1:-app@houseofspells.co.uk}"
ADMIN_PASSWORD="${2}"

echo "🧪 Testing Admin Seller Creation"
echo "=================================="
echo "API URL: $API_URL"
echo ""

# Step 1: Check API health
echo "Step 1: Checking API health..."
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q "status"; then
  echo "✅ API is healthy"
else
  echo "❌ API health check failed"
  echo "Response: $HEALTH_RESPONSE"
  exit 1
fi
echo ""

# Step 2: Admin login
echo "Step 2: Logging in as admin..."
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "⚠️  Admin password not provided. Please provide it as second argument."
  echo "Usage: ./test-seller-creation.sh [admin-email] [admin-password]"
  exit 1
fi

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Admin login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Admin login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 3: Create seller
echo "Step 3: Creating test seller..."
TIMESTAMP=$(date +%s)
SELLER_EMAIL="test-seller-$TIMESTAMP@example.com"

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/admin/sellers/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"email\": \"$SELLER_EMAIL\",
    \"password\": \"TestPassword123\",
    \"storeName\": \"Test Store $TIMESTAMP\",
    \"country\": \"United Kingdom\"
  }")

if echo "$CREATE_RESPONSE" | grep -q "Seller created successfully"; then
  echo "✅ Seller created successfully!"
  echo ""
  echo "Seller Details:"
  echo "$CREATE_RESPONSE" | grep -o '"email":"[^"]*' | cut -d'"' -f4
  echo "$CREATE_RESPONSE" | grep -o '"storeName":"[^"]*' | cut -d'"' -f4
  echo ""
  
  # Extract seller email for login test
  SELLER_EMAIL_CREATED=$(echo "$CREATE_RESPONSE" | grep -o '"email":"[^"]*' | cut -d'"' -f4)
  
  # Step 4: Test seller login
  echo "Step 4: Testing seller login..."
  SELLER_LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SELLER_EMAIL_CREATED\",\"password\":\"TestPassword123\"}")
  
  SELLER_TOKEN=$(echo "$SELLER_LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$SELLER_TOKEN" ]; then
    echo "❌ Seller login failed"
    echo "Response: $SELLER_LOGIN_RESPONSE"
  else
    echo "✅ Seller login successful!"
    echo "Seller Token: ${SELLER_TOKEN:0:20}..."
    echo ""
    
    # Step 5: Check seller profile
    echo "Step 5: Checking seller profile..."
    SELLER_PROFILE=$(curl -s -X GET "$API_URL/sellers/me" \
      -H "Authorization: Bearer $SELLER_TOKEN")
    
    if echo "$SELLER_PROFILE" | grep -q "storeName"; then
      echo "✅ Seller profile retrieved"
      echo "Store Name: $(echo "$SELLER_PROFILE" | grep -o '"storeName":"[^"]*' | cut -d'"' -f4)"
      VERIFIED=$(echo "$SELLER_PROFILE" | grep -o '"verified":[^,}]*' | cut -d':' -f2)
      echo "Verified: $VERIFIED (should be false to trigger onboarding)"
    else
      echo "⚠️  Could not retrieve seller profile"
      echo "Response: $SELLER_PROFILE"
    fi
  fi
  
  echo ""
  echo "=================================="
  echo "✅ Test completed successfully!"
  echo ""
  echo "Seller Credentials:"
  echo "  Email: $SELLER_EMAIL_CREATED"
  echo "  Password: TestPassword123"
  echo ""
  echo "Next Steps:"
  echo "  1. Seller can login at: https://hos-marketplaceweb-production.up.railway.app/login"
  echo "  2. Seller will be redirected to onboarding flow"
  echo "  3. Seller completes profile setup"
  
else
  echo "❌ Seller creation failed"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

