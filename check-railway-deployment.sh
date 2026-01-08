#!/bin/bash

# Script to check Railway deployment status and compare with Git

echo "=========================================="
echo "Git Repository Status"
echo "=========================================="
echo "Current Branch:"
git branch --show-current
echo ""
echo "Latest Commit:"
git log --oneline -1
echo ""
echo "Full Commit Hash:"
git rev-parse HEAD
echo ""
echo "Remote Status:"
git remote -v
echo ""

echo "=========================================="
echo "Railway Deployment Status"
echo "=========================================="
echo "Project Status:"
railway status
echo ""

echo "Latest Deployments:"
railway deployment list --limit 5
echo ""

echo "Service List:"
railway service list
echo ""

echo "=========================================="
echo "Comparison"
echo "=========================================="
GIT_COMMIT=$(git rev-parse HEAD)
echo "Git Commit: $GIT_COMMIT"
echo ""
echo "Railway Deployments (check if commit matches above):"
railway deployment list --json | grep -i "commit\|hash" || railway deployment list
echo ""

echo "=========================================="
echo "Service Details"
echo "=========================================="
echo "Backend API Service:"
railway service --service @hos-marketplace/api status 2>/dev/null || echo "Service status unavailable"
echo ""

echo "Frontend Web Service:"
railway service --service @hos-marketplace/web status 2>/dev/null || echo "Service status unavailable"
echo ""
