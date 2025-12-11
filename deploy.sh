#!/bin/bash

# Deployment Script for House of Spells Marketplace
# This script helps deploy to Railway

echo "🚀 House of Spells Marketplace - Deployment Script"
echo "=================================================="
echo ""

cd "/Users/apple/Desktop/Retrieved /HoS Retrieved /HOS-latest-Sabu/HOS-World"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if logged in
echo "📋 Checking Railway login status..."
railway whoami

# Check if project is linked
echo ""
echo "📦 Checking project link..."
if railway status &> /dev/null; then
    echo "✅ Project is linked"
    railway status
else
    echo "⚠️  Project not linked. Linking now..."
    railway link
fi

echo ""
echo "🔍 Available services in project:"
echo "Please check Railway dashboard to find the exact service name"
echo "Common service names: api, backend, hos-marketplaceapi-production"
echo ""

# Try common service names
SERVICES=("api" "backend" "hos-marketplaceapi-production" "hos-marketplace-api" "api-production")

for SERVICE in "${SERVICES[@]}"; do
    echo "🔄 Trying to deploy service: $SERVICE"
    if railway up --service "$SERVICE" 2>&1 | grep -q "Service not found"; then
        echo "   ❌ Service '$SERVICE' not found"
    else
        echo "   ✅ Deploying to service: $SERVICE"
        railway up --service "$SERVICE"
        exit 0
    fi
done

echo ""
echo "❌ Could not find service automatically."
echo ""
echo "📝 Manual Deployment Steps:"
echo "1. Go to Railway Dashboard: https://railway.app/dashboard"
echo "2. Select project: HOS Backend"
echo "3. Find your backend API service"
echo "4. Click 'Deploy' or 'Redeploy'"
echo ""
echo "OR run manually:"
echo "   railway up --service <SERVICE_NAME>"
echo ""

