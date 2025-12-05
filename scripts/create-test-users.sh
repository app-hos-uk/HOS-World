#!/bin/bash

# Create Test Users for RBAC Testing
# This script creates mock users via API registration

API_URL="${API_URL:-https://hos-marketplaceapi-production.up.railway.app/api}"

echo "🌱 Creating test users for RBAC testing..."
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to create user
create_user() {
    local email=$1
    local password=$2
    local first_name=$3
    local last_name=$4
    local role=$5
    local store_name=$6
    
    echo -n "Creating $email ($role)... "
    
    # Build JSON payload
    if [ -n "$store_name" ]; then
        payload=$(cat <<EOF
{
  "email": "$email",
  "password": "$password",
  "firstName": "$first_name",
  "lastName": "$last_name",
  "role": "$role",
  "storeName": "$store_name"
}
EOF
)
    else
        payload=$(cat <<EOF
{
  "email": "$email",
  "password": "$password",
  "firstName": "$first_name",
  "lastName": "$last_name",
  "role": "$role"
}
EOF
)
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq 201 ] || [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        return 0
    elif echo "$body" | grep -q "already exists"; then
        echo -e "${YELLOW}⚠️  Already exists${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed (HTTP $http_code)${NC}"
        echo "Response: $body"
        return 1
    fi
}

# Default password for all users
PASSWORD="Test123!"

echo "Creating users..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create CUSTOMER
create_user "customer@hos.test" "$PASSWORD" "John" "Customer" "customer"

# Create WHOLESALER
create_user "wholesaler@hos.test" "$PASSWORD" "Sarah" "Wholesaler" "wholesaler" "Wholesale Magic Supplies"

# Create B2C_SELLER
create_user "seller@hos.test" "$PASSWORD" "Mike" "Seller" "b2c_seller" "B2C Magic Store"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}⚠️  Note: Team roles (ADMIN, PROCUREMENT, FULFILLMENT, CATALOG, MARKETING, FINANCE, CMS_EDITOR)"
echo "     cannot be created via registration API. They need to be created manually via:"
echo "     - Prisma Studio (recommended)"
echo "     - Direct SQL insert"
echo "     - Database admin tools${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Test Users Created:"
echo ""
echo "  Email: customer@hos.test    | Password: $PASSWORD | Role: CUSTOMER"
echo "  Email: wholesaler@hos.test  | Password: $PASSWORD | Role: WHOLESALER"
echo "  Email: seller@hos.test      | Password: $PASSWORD | Role: B2C_SELLER"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Registration-compatible users created!"
echo ""
echo "To create team roles, use one of these methods:"
echo "  1. Prisma Studio: cd services/api && railway run pnpm db:studio"
echo "  2. See MOCK_USERS_CREATION_GUIDE.md for SQL inserts"
echo ""

