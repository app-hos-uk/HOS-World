#!/bin/bash

# E2E Test Runner Script
# This script runs Playwright E2E tests with proper server checks

set -e

echo "🧪 Starting E2E Tests with Browser Automation"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API server is running
echo "📡 Checking API server status..."
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001/api}"
if curl -s -f "${API_URL}/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ API server is running${NC}"
else
  echo -e "${YELLOW}⚠️  API server may not be running at ${API_URL}${NC}"
  echo "   Please start the API server: cd services/api && pnpm dev"
  echo "   Continuing anyway (Playwright will start web server)..."
fi

echo ""
echo "🌐 Starting E2E tests..."
echo "   - Web server will start automatically"
echo "   - Tests will run in Chromium browser"
echo "   - Results will be saved to test-results/"
echo ""

# Run Playwright tests
cd "$(dirname "$0")/.."
pnpm test:e2e

echo ""
echo -e "${GREEN}✅ E2E tests completed!${NC}"
echo ""
echo "📊 View test report:"
echo "   pnpm test:e2e:ui"
echo ""
