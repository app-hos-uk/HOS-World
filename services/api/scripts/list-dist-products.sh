#!/usr/bin/env sh
# List contents of dist/products for CI/Railway build logs.
# Run from services/api (e.g. after nest build).
# Usage: sh scripts/list-dist-products.sh [base_dir]
#   base_dir defaults to current directory (.). Use . when running from services/api.

set -e

BASE="${1:-.}"
DIST_PRODUCTS="${BASE}/dist/products"

echo "═══════════════════════════════════════════════════════════"
echo "  dist/products contents (API build output)"
echo "═══════════════════════════════════════════════════════════"

if [ ! -d "$DIST_PRODUCTS" ]; then
  echo "  ⚠️  dist/products not found at: $DIST_PRODUCTS"
  exit 1
fi

ls -la "$DIST_PRODUCTS"
echo "  ---"
echo "  Files:"
ls -1 "$DIST_PRODUCTS" 2>/dev/null || true
echo "═══════════════════════════════════════════════════════════"
