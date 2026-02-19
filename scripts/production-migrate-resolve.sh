#!/usr/bin/env bash
#
# Production migration resolve – mark init migration as applied
# Run this ONLY if production DB was created before the 20251201000000_init migration.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db" ./scripts/production-migrate-resolve.sh
#   Or: ./scripts/production-migrate-resolve.sh  # uses DATABASE_URL from env
#

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is required"
  echo "Usage: DATABASE_URL=\"postgresql://...\" $0"
  exit 1
fi

cd "$(dirname "$0")/../services/api"

# If migration failed (e.g. "UserRole already exists"), first clear the failed state
echo "Resolving failed migration state (if any)..."
pnpm exec prisma migrate resolve --rolled-back 20251201000000_init 2>/dev/null || true

echo "Marking 20251201000000_init as applied..."
pnpm exec prisma migrate resolve --applied 20251201000000_init
echo "✅ Done. Now run: pnpm exec prisma migrate deploy"
