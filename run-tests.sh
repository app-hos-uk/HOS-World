#!/bin/bash

# Simple script to check server status and run tests

API_URL="http://localhost:3001/api"
FRONTEND_URL="http://localhost:3000"

echo "🔍 Checking Server Status..."
echo "============================"
echo ""

# Check API server
echo "Checking API server (port 3001)..."
if curl -s --connect-timeout 2 "$API_URL/v1/health" > /dev/null 2>&1; then
    echo "✅ API server is running"
    API_RUNNING=true
else
    echo "❌ API server is NOT running"
    API_RUNNING=false
fi

# Check Frontend
echo "Checking Frontend (port 3000)..."
if curl -s --connect-timeout 2 "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "✅ Frontend is running"
    FRONTEND_RUNNING=true
else
    echo "❌ Frontend is NOT running"
    FRONTEND_RUNNING=false
fi

echo ""

if [ "$API_RUNNING" = false ]; then
    echo "⚠️  API server is not running!"
    echo ""
    echo "To start the API server:"
    echo "  1. Open a NEW terminal"
    echo "  2. Run: cd services/api && pnpm dev"
    echo "  3. Wait for: 'Application is running on: http://localhost:3001'"
    echo "  4. Then run this script again: ./run-tests.sh"
    echo ""
    exit 1
fi

echo "✅ Servers are running! Running tests..."
echo ""
echo "======================================="
echo ""

# Run the curl test script
./test-phase1-curl.sh
