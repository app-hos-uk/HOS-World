#!/bin/bash

# Script to redeploy all Railway services
# This will trigger fresh deployments for both API and Web services

echo "=========================================="
echo "Redeploying All Railway Services"
echo "=========================================="
echo ""

# Get current Git commit
echo "Current Git Commit:"
git log --oneline -1
echo "Commit Hash: $(git rev-parse HEAD)"
echo ""

# Ensure we're on master branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ]; then
    echo "⚠️  Warning: Not on master branch. Current branch: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "=========================================="
echo "Step 1: Redeploying API Service"
echo "=========================================="
echo "Linking to API service..."
railway link --service @hos-marketplace/api

echo ""
echo "Triggering API service deployment..."
railway up --detach

echo ""
echo "✅ API service deployment triggered!"
echo ""

# Wait a moment before switching services
sleep 2

echo "=========================================="
echo "Step 2: Redeploying Web Service"
echo "=========================================="
echo "Linking to Web service..."
railway link --service @hos-marketplace/web

echo ""
echo "Triggering Web service deployment..."
railway up --detach

echo ""
echo "✅ Web service deployment triggered!"
echo ""

echo "=========================================="
echo "Deployment Status"
echo "=========================================="
echo ""
echo "Checking API service deployments..."
railway link --service @hos-marketplace/api
railway deployment list --limit 2

echo ""
echo "Checking Web service deployments..."
railway link --service @hos-marketplace/web
railway deployment list --limit 2

echo ""
echo "=========================================="
echo "✅ Redeployment Complete!"
echo "=========================================="
echo ""
echo "Monitor deployments in Railway dashboard:"
echo "https://railway.com/project/26dc565d-51d1-4050-8fd1-87c5714eb947"
echo ""
echo "Or check logs with:"
echo "  railway logs --service @hos-marketplace/api"
echo "  railway logs --service @hos-marketplace/web"
