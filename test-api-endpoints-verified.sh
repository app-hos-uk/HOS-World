#!/bin/bash

# Verified API Endpoints Test
# Based on actual routes registered in the API

API_URL="${API_URL:-https://hos-marketplaceapi-production.up.railway.app}"

echo "🧪 Testing Verified API Endpoints"
echo "===================================="
echo "API Base URL: $API_URL"
echo ""
echo "Based on Railway logs, these routes ARE registered:"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local endpoint=$2
    
    local url="${API_URL}${endpoint}"
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
        echo -e "${GREEN}✓${NC} $name - $status_code"
        ((PASSED++))
    elif [ "$status_code" = "404" ]; then
        echo -e "${RED}✗${NC} $name - 404 (Not Found)"
        ((FAILED++))
    elif [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
        echo -e "${YELLOW}⊘${NC} $name - $status_code (Auth Required - Expected)"
        ((PASSED++))
    else
        echo -e "${YELLOW}?${NC} $name - $status_code"
        ((FAILED++))
    fi
}

echo "Testing endpoints that ARE registered according to logs:"
echo ""

# Test endpoints we know are registered
test_endpoint "Root" "/"
test_endpoint "Health Check" "/api/health"
test_endpoint "Products" "/api/products"
test_endpoint "Fandoms" "/api/fandoms"
test_endpoint "Characters" "/api/characters"
test_endpoint "Currency" "/api/currency"
test_endpoint "Sellers" "/api/sellers"
test_endpoint "Auth (should require POST)" "/api/auth/login"
test_endpoint "GDPR" "/api/gdpr/consent"
test_endpoint "Themes" "/api/themes"
test_endpoint "Dashboard" "/api/dashboard/stats"

echo ""
echo "===================================="
echo "Results:"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo "===================================="
echo ""

# If health check fails, show detailed error
if [ "$FAILED" -gt 0 ]; then
    echo "⚠️  Some endpoints returned 404. Checking health endpoint details:"
    echo ""
    curl -v "${API_URL}/api/health" 2>&1 | head -30
    echo ""
    echo ""
    echo "💡 Possible issues:"
    echo "   1. Railway routing/proxy configuration"
    echo "   2. API might be behind a reverse proxy"
    echo "   3. Routes might need different path structure"
    echo ""
fi
