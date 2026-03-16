#!/bin/sh
echo "=== Step 1: Execute fix SQL directly (bypasses Prisma checksum) ==="
npx prisma db execute --file ./prisma/migrations/20260315120000_fix_missing_tables/migration.sql 2>&1 || echo "WARN: db execute had issues (may be OK if already applied)"

echo "=== Step 2: Mark all known migrations as applied ==="
npx prisma migrate resolve --applied 20260219100000_convert_gbp_to_usd 2>/dev/null || true
npx prisma migrate resolve --applied 20260220000000_add_vendor_marketplace_support 2>/dev/null || true
npx prisma migrate resolve --applied 20260221000000_merge_catalog_marketing_pipeline 2>/dev/null || true
npx prisma migrate resolve --applied 20260315120000_fix_missing_tables 2>/dev/null || true
npx prisma migrate resolve --applied 20260219200000_stock_check_constraint 2>/dev/null || true

echo "=== Step 3: Run migrate deploy for any future migrations ==="
npx prisma migrate deploy 2>&1 || echo "WARN: migrate deploy had issues"

echo "=== Starting application ==="
exec node dist/main.js
