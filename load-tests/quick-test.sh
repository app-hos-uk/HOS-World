#!/bin/bash

# Quick Load Test Script
# Usage: ./load-tests/quick-test.sh [artillery|k6] [api-url]

TOOL=${1:-artillery}
API_URL=${2:-http://localhost:3001/api}

echo "🚀 Starting load test with $TOOL"
echo "📍 Target API: $API_URL"
echo ""

if [ "$TOOL" = "artillery" ]; then
    if ! command -v artillery &> /dev/null; then
        echo "❌ Artillery not found. Installing..."
        npm install -g artillery
    fi
    
    echo "Running Artillery test..."
    API_URL=$API_URL artillery run load-tests/concurrent-users-test.yml
    
elif [ "$TOOL" = "k6" ]; then
    if ! command -v k6 &> /dev/null; then
        echo "❌ k6 not found. Please install k6 first:"
        echo "   macOS: brew install k6"
        echo "   Linux: See https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    echo "Running k6 test..."
    k6 run -e API_URL=$API_URL load-tests/k6-concurrent-users.js
    
else
    echo "❌ Unknown tool: $TOOL"
    echo "Usage: ./load-tests/quick-test.sh [artillery|k6] [api-url]"
    exit 1
fi

echo ""
echo "✅ Load test completed!"


