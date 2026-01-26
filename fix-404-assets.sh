#!/bin/bash

# Fix 404 Errors for Next.js Static Assets
# This script clears the build cache and restarts the dev server

cd "$(dirname "$0")"

echo "🔧 Fixing 404 Errors for Next.js Static Assets"
echo "=============================================="
echo ""

# Stop any running servers
echo "🛑 Stopping any running servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2

# Clear all Next.js caches
echo "🧹 Clearing Next.js build cache..."
cd apps/web
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next/cache
cd ../..

# Clear root cache
rm -rf node_modules/.cache
rm -rf .turbo

echo "✅ Cache cleared"
echo ""

# Rebuild workspace packages (ensure they're up to date)
echo "🔨 Rebuilding workspace packages..."
cd packages/shared-types && pnpm run build > /dev/null 2>&1 && cd ../..
cd packages/theme-system && pnpm run build > /dev/null 2>&1 && cd ../..
cd packages/utils && pnpm run build > /dev/null 2>&1 && cd ../..
cd packages/api-client && pnpm run build > /dev/null 2>&1 && cd ../..

echo "✅ Packages rebuilt"
echo ""

# Start the dev server
echo "🚀 Starting development server..."
echo "   The server will compile on first request"
echo "   This may take a moment..."
echo ""

cd apps/web
pnpm run dev
