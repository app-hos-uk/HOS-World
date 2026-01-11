#!/bin/bash

# Helper script to stop both API and Frontend servers
# Usage: ./stop-servers.sh

echo "🛑 Stopping House of Spells Servers"
echo "===================================="
echo ""

# Try to read PIDs from file
if [ -f /tmp/hos-servers.pid ]; then
    PIDS=$(cat /tmp/hos-servers.pid)
    echo "Found saved PIDs: $PIDS"
    kill $PIDS 2>/dev/null && echo "✅ Stopped servers" || echo "⚠️  Servers may have already stopped"
    rm /tmp/hos-servers.pid
else
    echo "No saved PIDs found. Checking ports..."
fi

# Kill processes on ports
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "Stopping API server on port 3001..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ API server stopped" || echo "⚠️  Could not stop API server"
else
    echo "✅ No process on port 3001"
fi

if lsof -ti:3000 > /dev/null 2>&1; then
    echo "Stopping Frontend on port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Frontend stopped" || echo "⚠️  Could not stop Frontend"
else
    echo "✅ No process on port 3000"
fi

echo ""
echo "✅ All servers stopped"
echo ""
