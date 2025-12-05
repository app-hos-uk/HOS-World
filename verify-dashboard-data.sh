#!/bin/bash
echo "Verifying dashboard data structure and completeness..."
echo ""

api_url="https://hos-marketplaceapi-production.up.railway.app/api"
password="Test123!"

get_token() {
  local email=$1
  curl -s -X POST "$api_url/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" | \
    grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4
}

# Test Admin Dashboard Data
echo "1. Admin Dashboard Data Structure..."
token=$(get_token "admin@hos.test")
response=$(curl -s -X GET "$api_url/dashboard/admin" \
  -H "Authorization: Bearer $token")
if echo "$response" | grep -q '"statistics"'; then
  echo "   ✅ Has statistics object"
fi
if echo "$response" | grep -q '"submissionsByStatus"'; then
  echo "   ✅ Has submissionsByStatus"
fi
if echo "$response" | grep -q '"ordersByStatus"'; then
  echo "   ✅ Has ordersByStatus"
fi
if echo "$response" | grep -q '"recentActivity"'; then
  echo "   ✅ Has recentActivity"
fi
echo ""

# Test Procurement Dashboard Data
echo "2. Procurement Dashboard Data Structure..."
token=$(get_token "procurement@hos.test")
response=$(curl -s -X GET "$api_url/dashboard/procurement" \
  -H "Authorization: Bearer $token")
if echo "$response" | grep -q '"pendingSubmissions"'; then
  echo "   ✅ Has pendingSubmissions"
fi
if echo "$response" | grep -q '"duplicateAlerts"'; then
  echo "   ✅ Has duplicateAlerts"
fi
if echo "$response" | grep -q '"statistics"'; then
  echo "   ✅ Has statistics"
fi
echo ""

# Test Fulfillment Dashboard Data
echo "3. Fulfillment Dashboard Data Structure..."
token=$(get_token "fulfillment@hos.test")
response=$(curl -s -X GET "$api_url/dashboard/fulfillment" \
  -H "Authorization: Bearer $token")
if echo "$response" | grep -q '"shipments"'; then
  echo "   ✅ Has shipments"
fi
if echo "$response" | grep -q '"statistics"'; then
  echo "   ✅ Has statistics"
fi
echo ""

# Test Catalog Dashboard Data
echo "4. Catalog Dashboard Data Structure..."
token=$(get_token "catalog@hos.test")
response=$(curl -s -X GET "$api_url/dashboard/catalog" \
  -H "Authorization: Bearer $token")
if echo "$response" | grep -q '"pendingEntries"'; then
  echo "   ✅ Has pendingEntries"
fi
if echo "$response" | grep -q '"inProgress"'; then
  echo "   ✅ Has inProgress"
fi
echo ""

# Test Marketing Dashboard Data
echo "5. Marketing Dashboard Data Structure..."
token=$(get_token "marketing@hos.test")
response=$(curl -s -X GET "$api_url/dashboard/marketing" \
  -H "Authorization: Bearer $token")
if echo "$response" | grep -q '"pendingProducts"'; then
  echo "   ✅ Has pendingProducts"
fi
if echo "$response" | grep -q '"materialsLibrary"'; then
  echo "   ✅ Has materialsLibrary"
fi
echo ""

# Test Finance Dashboard Data
echo "6. Finance Dashboard Data Structure..."
token=$(get_token "finance@hos.test")
response=$(curl -s -X GET "$api_url/dashboard/finance" \
  -H "Authorization: Bearer $token")
if echo "$response" | grep -q '"pendingApprovals"'; then
  echo "   ✅ Has pendingApprovals"
fi
if echo "$response" | grep -q '"pricingHistory"'; then
  echo "   ✅ Has pricingHistory"
fi
echo ""

echo "Dashboard data structure verification complete!"
