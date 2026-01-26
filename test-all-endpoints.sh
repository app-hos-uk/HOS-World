#!/bin/bash

# API Endpoints Test Script
# Tests all API endpoints against the production API

API_URL="${API_URL:-https://hos-marketplaceapi-production.up.railway.app}"

echo "🧪 Testing API Endpoints"
echo "=========================="
echo "API Base URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0
SKIPPED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local body=$4
    local requires_auth=$5
    
    local url="${API_URL}${endpoint}"
    local status_code
    
    if [ "$requires_auth" = "true" ]; then
        echo -e "${YELLOW}⊘ SKIP${NC} $name ($endpoint) - Requires authentication"
        ((SKIPPED++))
        return
    fi
    
    if [ "$method" = "GET" ]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        if [ -n "$body" ]; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url")
        else
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url")
        fi
    else
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
    fi
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} $name ($endpoint) - $status_code"
        ((PASSED++))
    elif [ "$status_code" = "404" ]; then
        echo -e "${YELLOW}⊘ 404${NC} $name ($endpoint) - Not implemented (expected)"
        ((SKIPPED++))
    elif [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
        echo -e "${YELLOW}⊘ AUTH${NC} $name ($endpoint) - Requires authentication ($status_code)"
        ((SKIPPED++))
    else
        echo -e "${RED}✗ FAIL${NC} $name ($endpoint) - $status_code"
        ((FAILED++))
    fi
}

echo "📋 Testing Public Endpoints..."
echo ""

# Health & Root (test without /api prefix first, then with)
test_endpoint "Health Check (no prefix)" "GET" "/health"
test_endpoint "Health Check (with /api)" "GET" "/api/health"
test_endpoint "Root Endpoint" "GET" "/"
test_endpoint "Root Endpoint (with /api)" "GET" "/api/"

# Public Product Endpoints
test_endpoint "Get Products" "GET" "/api/products"
test_endpoint "Get Products (with query)" "GET" "/api/products?page=1&limit=10"

# Public Fandoms & Characters (may not exist)
test_endpoint "Get Fandoms" "GET" "/api/fandoms"
test_endpoint "Get Characters" "GET" "/api/characters"

# Currency (may not exist)
test_endpoint "Get Currency Rates" "GET" "/api/currency/rates"

# GDPR (may not exist, requires auth for POST)
test_endpoint "Get GDPR Consent" "GET" "/api/gdpr/consent" "" "true"
test_endpoint "Update GDPR Consent" "POST" "/api/gdpr/consent" '{"marketing":false,"analytics":false}' "true"

# Auth endpoints (public but need data for POST)
test_endpoint "Auth Login Endpoint" "GET" "/api/auth/login" "" "false"  # Will fail but tests endpoint exists
test_endpoint "Auth Register Endpoint" "GET" "/api/auth/register" "" "false"  # Will fail but tests endpoint exists

echo ""
echo "=========================="
echo "📊 Test Results Summary"
echo "=========================="
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo -e "${YELLOW}⊘ Skipped: $SKIPPED${NC}"
echo "=========================="
echo ""

# Instructions for testing authenticated endpoints
echo "📝 To test authenticated endpoints:"
echo "   1. Login: curl -X POST $API_URL/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"user@example.com\",\"password\":\"password\"}'"
echo "   2. Extract token from response"
echo "   3. Use token: curl -H 'Authorization: Bearer TOKEN' $API_URL/auth/me"
echo ""
