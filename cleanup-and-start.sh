#!/bin/bash

# Cleanup and Start Development Server
# This script kills existing processes and starts a fresh dev server

cd "$(dirname "$0")"

echo "🧹 Cleaning up existing processes on port 3000..."

# Kill any processes on port 3000
PIDS=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PIDS" ]; then
    echo "Found processes: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null
    sleep 2
    echo "✅ Cleared port 3000"
else
    echo "✅ Port 3000 is free"
fi

echo ""
echo "🚀 Starting development server..."
echo ""

# Navigate to web app
cd apps/web

# Clear .next cache
if [ -d ".next" ]; then
    echo "🧹 Clearing .next cache..."
    rm -rf .next
fi

# Start the server
echo "🌐 Starting Next.js on http://localhost:3000"
echo "   (Press Ctrl+C to stop)"
echo ""

npm run dev
