#!/bin/bash

# Switch Railway Account Script
# Deployments should use the Railway account for app@houseofspells.co.uk.
# This script helps you log out and log in with the correct account.

echo "🔄 Switching Railway Account"
echo "================================"
echo "Deployments must use: app@houseofspells.co.uk (Railway account)"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Check current login status
echo "📋 Current Account Status:"
if railway whoami &> /dev/null; then
    echo "Currently logged in as:"
    railway whoami
    echo ""
    echo "To switch accounts:"
    echo "  1. Log out: railway logout"
    echo "  2. Log in: railway login"
    echo ""
    read -p "Do you want to log out now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Logging out..."
        railway logout
        echo "✅ Logged out"
        echo ""
        echo "Now log in with your other account:"
        echo "  railway login"
        echo ""
        read -p "Do you want to log in now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            railway login
        fi
    fi
else
    echo "Not currently logged in"
    echo ""
    echo "Log in with:"
    echo "  railway login"
    echo ""
    read -p "Do you want to log in now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        railway login
    fi
fi

echo ""
echo "================================"
echo "✅ Account switch complete"
echo ""
echo "Next steps:"
echo "  1. Ensure you're logged in as app@houseofspells.co.uk (railway whoami)"
echo "  2. Link your project: cd services/api && railway link"
echo "  3. Trigger deploy: see docs/RAILWAY_ACCOUNT_AND_DEPLOY.md"
echo ""
