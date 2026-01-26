#!/bin/bash

# Start Development Server using npx pnpm (no global install needed)

cd "$(dirname "$0")"

echo "🔧 Installing dependencies with npx pnpm..."
npx pnpm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🔨 Building workspace packages..."
cd packages/shared-types && npx pnpm run build && cd ../..
cd packages/theme-system && npx pnpm run build && cd ../..
cd packages/utils && npx pnpm run build && cd ../..
cd packages/api-client && npx pnpm run build && cd ../..

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

npx pnpm run dev
