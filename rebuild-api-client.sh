#!/bin/bash

# Rebuild API Client with Error Suppression
# This suppresses console errors for missing API endpoints

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
echo "🔄 The dev server should automatically pick up the changes"
echo "   If errors persist, restart the dev server:"
echo "   cd apps/web && pnpm run dev"
echo ""
