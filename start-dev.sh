#!/bin/bash

# Start Development Server Script
# This script helps start the Next.js development server

cd "$(dirname "$0")"

echo "🚀 Starting House of Spells Marketplace Development Server"
echo "============================================================"
echo ""

# Check if pnpm is available
if command -v pnpm &> /dev/null; then
    echo "✅ Using pnpm"
    PACKAGE_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
    echo "⚠️  pnpm not found, using npm instead"
    echo "   Note: This project uses pnpm. Install it with: npm install -g pnpm"
    PACKAGE_MANAGER="npm"
else
    echo "❌ Neither pnpm nor npm found. Please install Node.js first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    $PACKAGE_MANAGER install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Check if workspace packages are built
if [ ! -d "packages/api-client/dist" ]; then
    echo "🔨 Building workspace packages..."
    cd packages/shared-types && $PACKAGE_MANAGER run build && cd ../..
    cd packages/theme-system && $PACKAGE_MANAGER run build && cd ../..
    cd packages/utils && $PACKAGE_MANAGER run build && cd ../..
    cd packages/api-client && $PACKAGE_MANAGER run build && cd ../..
fi

# Navigate to web app
cd apps/web

# Clear .next directory for fresh start
if [ -d ".next" ]; then
    echo "🧹 Clearing .next cache..."
    rm -rf .next
fi

echo ""
echo "🌐 Starting Next.js development server on http://localhost:3000"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start the dev server
$PACKAGE_MANAGER run dev
