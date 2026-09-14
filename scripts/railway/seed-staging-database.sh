#!/usr/bin/env bash
# Run Prisma migrations and seed staging with QA test data.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/railway/seed-staging-database.sh
#   ./scripts/railway/seed-staging-database.sh   # uses Railway staging DATABASE_URL via CLI

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/services/api"

cd "$API"

if [ -z "${DATABASE_URL:-}" ]; then
  if command -v railway >/dev/null 2>&1; then
    echo "==> Loading DATABASE_URL from Railway staging (@hos-marketplace/api)"
    export DATABASE_URL
    DATABASE_URL="$(railway variables --environment staging -s Postgres --json \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('DATABASE_PUBLIC_URL',''))" 2>/dev/null || true)"
    if [ -z "$DATABASE_URL" ]; then
      echo "ERROR: DATABASE_URL not set. Export it or run: railway environment link staging" >&2
      exit 1
    fi
  else
    echo "ERROR: Set DATABASE_URL or install Railway CLI." >&2
    exit 1
  fi
fi

echo "==> prisma migrate deploy"
pnpm exec prisma migrate deploy

echo "==> prisma migrate status"
pnpm exec prisma migrate status

echo "==> Seeding admin + test roles + loyalty config"
pnpm db:seed-admin
pnpm db:seed-all-roles
pnpm db:seed-loyalty

echo ""
echo "Staging database ready for QA."
echo "Test users: *@hos.test (password from TEST_SEED_PASSWORD env)"
echo "Super admin: app@houseofspells.co.uk (password from SEED_ADMIN_PASSWORD env)"
