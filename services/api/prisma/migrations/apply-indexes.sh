#!/bin/bash
# Apply Phase 4 Performance Indexes

echo "Applying Phase 4 performance indexes to database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it in your .env file or export it"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql is not installed or not in PATH"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Get the database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

if [ -z "$DB_NAME" ]; then
    echo "Error: Could not extract database name from DATABASE_URL"
    exit 1
fi

echo "Database: $DB_NAME"
echo "Applying indexes..."

# Apply the SQL file
psql "$DATABASE_URL" -f prisma/migrations/phase4_performance_indexes.sql

if [ $? -eq 0 ]; then
    echo "✅ Indexes applied successfully!"
    echo ""
    echo "Note: Some indexes may already exist. That's okay - they'll be skipped."
else
    echo "❌ Failed to apply indexes. Check the error above."
    exit 1
fi

echo ""
echo "Next steps:"
echo "1. Verify indexes with: \\di in psql"
echo "2. Monitor query performance"
echo "3. Check slow query logs"

