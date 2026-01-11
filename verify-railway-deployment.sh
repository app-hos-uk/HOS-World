#!/bin/bash

# Railway Deployment Verification Script
# This script helps verify that the Railway deployment is working correctly

echo "🚂 Railway Deployment Verification"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI is not installed${NC}"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

echo -e "${GREEN}✅ Railway CLI is installed${NC}"
echo ""

# Check if logged in
echo "Checking Railway login status..."
if railway whoami &> /dev/null; then
    echo -e "${GREEN}✅ Logged in to Railway${NC}"
    railway whoami
else
    echo -e "${YELLOW}⚠️  Not logged in to Railway${NC}"
    echo "Please run: railway login"
    exit 1
fi

echo ""
echo "=================================="
echo "Verification Steps:"
echo "=================================="
echo ""
echo "1. Check project status..."
railway status 2>&1 || echo "Could not get project status"

echo ""
echo "2. Check service deployments..."
railway service list 2>&1 || echo "Could not list services"

echo ""
echo "3. Check environment variables..."
echo "   (This will show which variables are set)"
railway variables 2>&1 | head -20 || echo "Could not get variables"

echo ""
echo "=================================="
echo "Manual Verification Steps:"
echo "=================================="
echo ""
echo "Please verify the following in Railway Dashboard:"
echo ""
echo "1. Go to Railway Dashboard → @hos-marketplace/api service"
echo "2. Check 'Deployments' tab for latest deployment status"
echo "3. Check 'Logs' tab for any errors"
echo "4. Check 'Variables' tab for required environment variables"
echo "5. Test health endpoint: curl https://your-api-url.railway.app/api/health"
echo ""
echo "=================================="
