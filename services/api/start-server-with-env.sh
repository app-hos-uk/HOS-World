#!/bin/bash

# Start API server with environment variables from ENV_VALUES.txt
# Usage: ./start-server-with-env.sh

cd "$(dirname "$0")"

# Load environment variables from ENV_VALUES.txt
if [ -f "ENV_VALUES.txt" ]; then
    echo "📋 Loading environment variables from ENV_VALUES.txt..."
    export DATABASE_URL="postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway"
    export JWT_SECRET="EDLd7c1od2DTOXo8LQDxzNa0OM+drNeozaPMlggG2kQ="
    export JWT_REFRESH_SECRET="9KFJvUbcTrgjW8Ui6gOa0De/GE/XF4wfksEcCgBp2fo="
    echo "✅ Environment variables loaded"
else
    echo "❌ ENV_VALUES.txt not found"
    exit 1
fi

# Start the server
echo "🚀 Starting API server..."
pnpm dev
