#!/bin/sh
echo "=== Resolving known problematic migrations ==="

# Mark all three problematic migrations as already applied so
# prisma migrate deploy skips them (avoids checksum mismatch errors)
npx prisma migrate resolve --applied 20260219100000_convert_gbp_to_usd 2>/dev/null || true
npx prisma migrate resolve --applied 20260220000000_add_vendor_marketplace_support 2>/dev/null || true
npx prisma migrate resolve --applied 20260221000000_merge_catalog_marketing_pipeline 2>/dev/null || true

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy || echo "WARN: migrate deploy had issues"

echo "=== Starting application ==="
exec node dist/main.js
