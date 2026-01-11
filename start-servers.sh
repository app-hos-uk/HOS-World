#!/bin/bash

# Helper script to start both API and Frontend servers
# Usage: ./start-servers.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/services/api"
WEB_DIR="$SCRIPT_DIR/apps/web"

echo "🚀 Starting House of Spells Servers"
echo "===================================="
echo ""

# Check if ports are in use
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "⚠️  Port 3001 is already in use (API server may be running)"
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:3001 | xargs kill -9
        echo "✅ Killed process on port 3001"
    fi
fi

if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use (Frontend may be running)"
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:3000 | xargs kill -9
        echo "✅ Killed process on port 3000"
    fi
fi

echo ""
echo "📦 Starting API Server..."
echo "------------------------"
cd "$API_DIR"
pnpm dev > /tmp/api-server.log 2>&1 &
API_PID=$!
echo "API Server PID: $API_PID"
echo "Logs: /tmp/api-server.log"
echo ""

# Wait a bit for API to start
sleep 3

# Check if API started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo "❌ API server failed to start. Check logs: /tmp/api-server.log"
    exit 1
fi

echo "✅ API Server started (PID: $API_PID)"
echo ""

echo "🌐 Starting Frontend..."
echo "----------------------"
cd "$WEB_DIR"
pnpm dev > /tmp/frontend-server.log 2>&1 &
WEB_PID=$!
echo "Frontend PID: $WEB_PID"
echo "Logs: /tmp/frontend-server.log"
echo ""

# Wait a bit for Frontend to start
sleep 3

# Check if Frontend started successfully
if ! kill -0 $WEB_PID 2>/dev/null; then
    echo "❌ Frontend failed to start. Check logs: /tmp/frontend-server.log"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Frontend started (PID: $WEB_PID)"
echo ""

echo "===================================="
echo "✅ Both servers are running!"
echo ""
echo "📊 Server Status:"
echo "  - API Server: http://localhost:3001 (PID: $API_PID)"
echo "  - Frontend: http://localhost:3000 (PID: $WEB_PID)"
echo "  - Swagger: http://localhost:3001/api/docs"
echo ""
echo "📝 Logs:"
echo "  - API: tail -f /tmp/api-server.log"
echo "  - Frontend: tail -f /tmp/frontend-server.log"
echo ""
echo "🛑 To stop servers:"
echo "  kill $API_PID $WEB_PID"
echo ""
echo "🧪 To run tests:"
echo "  ./test-phase1-e2e.sh"
echo ""

# Save PIDs to file for easy cleanup
echo "$API_PID $WEB_PID" > /tmp/hos-servers.pid
echo "PIDs saved to /tmp/hos-servers.pid"
