#!/bin/bash

# Railway API Status Check Script
# This script checks the Railway API deployment status

echo "🔍 Checking Railway API Status"
echo "================================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Navigate to API directory
cd "$(dirname "$0")/services/api" || exit 1

echo "📋 Checking Railway Status..."
echo ""

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "⚠️  Not logged in to Railway"
    echo "Run: railway login"
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Check if project is linked
if ! railway status &> /dev/null; then
    echo "⚠️  No Railway project linked"
    echo ""
    echo "To link this project:"
    echo "  1. Run: railway link"
    echo "  2. Select your project from the list"
    echo "  3. Or run: railway link <project-id>"
    echo ""
    echo "Alternatively, you can check the Railway dashboard:"
    echo "  https://railway.app/dashboard"
    echo ""
    exit 1
fi

echo "✅ Project linked"
echo ""

# Get service status
echo "📊 Service Status:"
railway status
echo ""

# List variables
echo "🔑 Environment Variables:"
railway variables
echo ""

# Get recent logs
echo "📝 Recent Logs (last 50 lines):"
railway logs --tail 50
echo ""

# Check deployments (newer Railway CLI uses 'deployment' not 'deployments')
echo "🚀 Recent Deployments:"
railway deployment list 2>/dev/null || railway deployment 2>/dev/null || echo "  (Use Railway dashboard to view deployments)"
echo ""

echo "================================"
echo "✅ Check complete"
echo ""
echo "💡 To see live logs:"
echo "   railway logs --tail"
echo ""
echo "💡 To check specific service:"
echo "   railway service"
echo ""
