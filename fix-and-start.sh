#!/bin/bash

# Fix Dependencies and Start Server
# This script installs pnpm via npx and reinstalls dependencies

cd "$(dirname "$0")"

echo "🔧 Fixing Dependencies Issue"
echo "============================"
echo ""
echo "The project uses pnpm, but dependencies were installed with pnpm"
echo "and npm can't find them. We'll use npx to run pnpm commands."
echo ""

# Check if we need to reinstall
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.pnpm/registry.npmjs.org/react" ]; then
    echo "📦 Installing dependencies with pnpm (via npx)..."
    echo "   This may take a few minutes..."
    echo ""
    
    # Use npx to run pnpm
    npx pnpm install
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Failed to install dependencies"
        echo ""
        echo "Alternative: Install pnpm globally first:"
        echo "  npm install -g pnpm"
        echo "Then run: pnpm install"
        exit 1
    fi
else
    echo "✅ Dependencies already installed"
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
echo ""

cd apps/web

# Clear .next cache
if [ -d ".next" ]; then
    rm -rf .next
fi

# Start the server
echo "🌐 Starting Next.js on http://localhost:3000"
echo "   (Press Ctrl+C to stop)"
echo ""

npx pnpm run dev
