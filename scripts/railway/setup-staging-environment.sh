#!/usr/bin/env bash
# Create and verify an isolated Railway staging environment for HOS.
# Requires: Railway CLI logged in (railway login) and project linked (railway link).
#
# Usage:
#   ./scripts/railway/setup-staging-environment.sh
#   ./scripts/railway/setup-staging-environment.sh --skip-create   # env already exists

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKIP_CREATE=false

for arg in "$@"; do
  case "$arg" in
    --skip-create) SKIP_CREATE=true ;;
    -h|--help)
      echo "Usage: $0 [--skip-create]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI not found. Install: npm install -g @railway/cli@4.42.1" >&2
  exit 1
fi

cd "$ROOT"

echo "==> Railway project status"
railway status --json 2>/dev/null || railway status

if [ "$SKIP_CREATE" = false ]; then
  echo ""
  echo "==> Creating staging environment (duplicate of production)..."
  echo "    This creates isolated Postgres + Redis for staging."
  railway environment create staging --duplicate production --json || {
    echo "Note: If staging already exists, re-run with --skip-create"
    exit 1
  }
fi

echo ""
echo "==> Linking CLI to staging environment"
railway environment link staging

echo ""
echo "==> Staging services"
railway status --json 2>/dev/null || railway status

echo ""
echo "==> Verifying DATABASE_URL and REDIS_URL are set on staging API service"
railway variables --environment staging -s '@hos-marketplace/api' 2>/dev/null | grep -E 'DATABASE_URL|REDIS_URL' || true

echo ""
echo "==> Next steps"
echo "1. Run isolation check:"
echo "     ./scripts/railway/verify-staging-isolation.sh"
echo "2. Apply staging env overrides (see scripts/railway/staging-env-overrides.env.example)"
echo "3. Migrate and seed:"
echo "     ./scripts/railway/seed-staging-database.sh"
echo "4. Add GitHub secrets STAGING_API_URL and STAGING_WEB_URL (Railway public URLs)"
echo "5. Push to develop branch to trigger deploy-staging.yml"
