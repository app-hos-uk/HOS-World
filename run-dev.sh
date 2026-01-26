#!/bin/bash

# Start Development Server with pnpm
# Run this script from the project root

cd "$(dirname "$0")"

echo "🔧 Installing dependencies..."
pnpm install

echo ""
echo "🔨 Building workspace packages..."
cd packages/shared-types && pnpm run build && cd ../..
cd packages/theme-system && pnpm run build && cd ../..
cd packages/utils && pnpm run build && cd ../..
cd packages/api-client && pnpm run build && cd ../..

echo ""
echo "🧹 Cleaning up port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 2

echo ""
echo "🚀 Starting development server..."
cd apps/web

# Clear .next cache
if [ -d ".next" ]; then
    rm -rf .next
fi

echo ""
echo "🌐 Starting Next.js on http://localhost:3000"
echo "   Press Ctrl+C to stop the server"
echo ""

pnpm run dev
