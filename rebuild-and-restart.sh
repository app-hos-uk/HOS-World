#!/bin/bash

# Rebuild API Client and Restart Dev Server
# This fixes the console error suppression for 404s

cd "$(dirname "$0")"

echo "🔨 Rebuilding api-client package..."
cd packages/api-client
pnpm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build api-client"
    exit 1
fi

echo ""
echo "✅ api-client rebuilt successfully"
echo ""
echo "🔄 Restarting dev server..."
echo "   (Stop the current server with Ctrl+C if it's running)"
echo ""

cd ../../apps/web
rm -rf .next
pnpm run dev
