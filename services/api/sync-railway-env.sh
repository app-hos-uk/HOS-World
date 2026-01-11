#!/bin/bash

# Script to sync Railway environment variables to local .env file
# Usage: ./sync-railway-env.sh

set -e

echo "🔄 Syncing Railway environment variables to local .env file..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if we're in the API directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the services/api directory"
    exit 1
fi

# Get variables from Railway
echo "📥 Fetching variables from Railway..."
RAILWAY_VARS=$(railway variables --json 2>/dev/null || railway variables 2>/dev/null)

if [ -z "$RAILWAY_VARS" ]; then
    echo "⚠️  Could not fetch variables from Railway. Make sure you're logged in:"
    echo "   railway login"
    exit 1
fi

# Extract specific variables
DATABASE_URL=$(railway variables --json 2>/dev/null | grep -o '"DATABASE_URL":"[^"]*' | cut -d'"' -f4 || echo "")
JWT_SECRET=$(railway variables --json 2>/dev/null | grep -o '"JWT_SECRET":"[^"]*' | cut -d'"' -f4 || echo "")
JWT_REFRESH_SECRET=$(railway variables --json 2>/dev/null | grep -o '"JWT_REFRESH_SECRET":"[^"]*' | cut -d'"' -f4 || echo "")

# If JSON parsing failed, try alternative method
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  JSON parsing failed, trying alternative method..."
    DATABASE_URL=$(railway variables 2>/dev/null | grep "DATABASE_URL" | awk -F'=' '{print $2}' | tr -d ' ' || echo "")
    JWT_SECRET=$(railway variables 2>/dev/null | grep "JWT_SECRET" | awk -F'=' '{print $2}' | tr -d ' ' || echo "")
    JWT_REFRESH_SECRET=$(railway variables 2>/dev/null | grep "JWT_REFRESH_SECRET" | awk -F'=' '{print $2}' | tr -d ' ' || echo "")
fi

# Check if variables were found
if [ -z "$DATABASE_URL" ] || [ -z "$JWT_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "⚠️  Some variables are missing. Please set them in Railway first:"
    echo "   railway variables --set \"DATABASE_URL=...\""
    echo "   railway variables --set \"JWT_SECRET=...\""
    echo "   railway variables --set \"JWT_REFRESH_SECRET=...\""
    exit 1
fi

# Backup existing .env file if it exists
if [ -f ".env" ]; then
    echo "💾 Backing up existing .env file to .env.backup..."
    cp .env .env.backup
fi

# Create or update .env file
echo "✏️  Writing variables to .env file..."
cat > .env << EOF
# Environment variables synced from Railway
# Last updated: $(date)

# Database Connection
DATABASE_URL=$DATABASE_URL

# JWT Secrets
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
EOF

echo ""
echo "✅ Successfully synced Railway variables to .env file!"
echo ""
echo "📋 Variables set:"
echo "   - DATABASE_URL: ${DATABASE_URL:0:50}..."
echo "   - JWT_SECRET: ${JWT_SECRET:0:20}..."
echo "   - JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:0:20}..."
echo ""
echo "💡 To verify, run: node -e \"require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');\""
