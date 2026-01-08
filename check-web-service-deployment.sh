#!/bin/bash

# Check web service deployment details

echo "=========================================="
echo "Web Service Deployment Check"
echo "=========================================="
echo ""

echo "Latest Web Service Deployment:"
railway deployment list --limit 1

echo ""
echo "Detailed Deployment Info (JSON):"
railway deployment list --json | grep -A 10 "80a2fdd8-7cd8-4872-a539-f01bab619311" | head -15

echo ""
echo "=========================================="
echo "Git Commit for Comparison:"
echo "=========================================="
git log --oneline -1
echo "Full Hash: $(git rev-parse HEAD)"
