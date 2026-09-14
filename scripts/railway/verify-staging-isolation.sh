#!/usr/bin/env bash
# Compare staging vs production DATABASE_URL / REDIS_URL to confirm isolation.
# Requires Railway CLI authenticated and project linked.

set -euo pipefail

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI not found." >&2
  exit 1
fi

fetch() {
  local env="$1"
  local key="$2"
  railway variables --environment "$env" -s '@hos-marketplace/api' --json 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('${key}',''))" 2>/dev/null || true
}

PROD_DB="$(fetch production DATABASE_URL)"
STAG_DB="$(fetch staging DATABASE_URL)"
PROD_REDIS="$(fetch production REDIS_URL)"
STAG_REDIS="$(fetch staging REDIS_URL)"

show_status() {
  local label="$1"
  local val="$2"
  if [ -n "$val" ]; then
    echo "${label}: set (${#val} chars)"
  else
    echo "${label}: <not set>"
  fi
}

echo "==> DATABASE_URL"
show_status "production" "$PROD_DB"
show_status "staging" "$STAG_DB"
echo ""
echo "==> REDIS_URL"
show_status "production" "$PROD_REDIS"
show_status "staging" "$STAG_REDIS"

if [ -n "$PROD_DB" ] && [ -n "$STAG_DB" ] && [ "$PROD_DB" = "$STAG_DB" ]; then
  echo ""
  echo "ERROR: Staging and production DATABASE_URL are identical. Fix Railway references." >&2
  exit 1
fi

if [ -n "$PROD_REDIS" ] && [ -n "$STAG_REDIS" ] && [ "$PROD_REDIS" = "$STAG_REDIS" ]; then
  echo ""
  echo "ERROR: Staging and production REDIS_URL are identical." >&2
  exit 1
fi

echo ""
echo "OK: Staging connection strings differ from production (or staging not configured yet)."
