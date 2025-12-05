#!/bin/bash

# Simple script to create team users via Railway CLI
# This script uses Railway's database connection

echo "🚀 Creating team role users..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

cd services/api

# Try to execute SQL via Railway
echo "Attempting to create users via Railway CLI..."

# Method 1: Try direct SQL execution
if railway run psql --help > /dev/null 2>&1; then
    echo "Using Railway CLI to execute SQL..."
    railway run psql < ../../scripts/create-team-role-users.sql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Users created successfully!${NC}"
        exit 0
    fi
fi

echo -e "${RED}❌ Could not execute SQL directly.${NC}"
echo ""
echo "Please use Prisma Studio instead:"
echo "  1. Run: cd services/api && railway run pnpm db:studio"
echo "  2. Browser will open automatically"
echo "  3. Click 'User' model"
echo "  4. Click 'Add record' 7 times"
echo "  5. Fill in details (see QUICK_PRISMA_STUDIO_GUIDE.md)"
echo ""
echo "Or use the Node.js script:"
echo "  cd services/api && railway run pnpm db:create-team-users"

