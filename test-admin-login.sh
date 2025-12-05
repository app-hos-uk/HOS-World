#!/bin/bash

# Quick Admin Login Test Script
# This script tests the admin login functionality

echo "🔐 Testing Super Admin Login"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ADMIN_EMAIL="app@houseofspells.co.uk"
ADMIN_PASSWORD="Admin123"

# Detect environment
if [ -z "$API_URL" ]; then
    # Try to detect if we're in Railway or local
    if [ -n "$RAILWAY_ENVIRONMENT" ]; then
        API_URL="https://hos-marketplaceapi-production.up.railway.app/api"
        echo "📍 Detected Railway environment"
    else
        API_URL="http://localhost:3001/api"
        echo "📍 Using local development environment"
    fi
else
    echo "📍 Using custom API URL: $API_URL"
fi

echo ""
echo "Testing login endpoint: $API_URL/auth/login"
echo "Email: $ADMIN_EMAIL"
echo ""

# Test login
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

# Extract status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract body (all but last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status Code: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Extract token if possible
    TOKEN=$(echo "$BODY" | jq -r '.data.token' 2>/dev/null)
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo -e "${GREEN}✅ JWT Token received${NC}"
        echo "Token (first 50 chars): ${TOKEN:0:50}..."
    fi
    
    # Extract user role
    ROLE=$(echo "$BODY" | jq -r '.data.user.role' 2>/dev/null)
    if [ "$ROLE" = "ADMIN" ]; then
        echo -e "${GREEN}✅ User has ADMIN role${NC}"
    else
        echo -e "${YELLOW}⚠️  User role is: $ROLE (expected ADMIN)${NC}"
    fi
else
    echo -e "${RED}❌ Login failed!${NC}"
    echo ""
    echo "Error Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    case $HTTP_CODE in
        401)
            echo -e "${RED}Error: Invalid credentials${NC}"
            echo "Possible causes:"
            echo "  - Wrong email or password"
            echo "  - Password hash mismatch"
            echo "  - User doesn't exist"
            echo ""
            echo "Solution: Run 'pnpm db:seed-admin' to create/update admin user"
            ;;
        404)
            echo -e "${RED}Error: Endpoint not found${NC}"
            echo "Check if API is running and URL is correct"
            ;;
        500)
            echo -e "${RED}Error: Internal server error${NC}"
            echo "Check API logs for details"
            ;;
        *)
            echo -e "${RED}Error: HTTP $HTTP_CODE${NC}"
            ;;
    esac
fi

echo ""
echo "============================"
echo "Test completed"

