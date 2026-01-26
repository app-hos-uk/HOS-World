#!/bin/bash

# Fix Webpack Error - Complete Clean and Rebuild
# This script fixes the "Cannot read properties of undefined" webpack error

cd "$(dirname "$0")"

echo "🔧 Fixing Webpack Error"
echo "======================="
echo ""

# Stop any running dev servers
echo "🛑 Stopping any running servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2

# Clear all caches
echo "🧹 Clearing all caches..."
rm -rf apps/web/.next
rm -rf apps/web/node_modules/.cache
rm -rf node_modules/.cache
rm -rf .turbo

# Rebuild workspace packages
echo ""
echo "🔨 Rebuilding workspace packages..."
cd packages/shared-types
pnpm run build
cd ../theme-system
pnpm run build
cd ../utils
pnpm run build
cd ../api-client
pnpm run build
cd ../..

# Verify packages are built
echo ""
echo "✅ Verifying packages..."
if [ -d "packages/shared-types/dist" ] && [ -d "packages/theme-system/dist" ] && [ -d "packages/utils/dist" ] && [ -d "packages/api-client/dist" ]; then
    echo "✅ All packages built successfully"
else
    echo "❌ Some packages failed to build"
    exit 1
fi

# Start the dev server
echo ""
echo "🚀 Starting development server..."
echo "   The server will start on http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""

cd apps/web
pnpm run dev
