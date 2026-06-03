#!/bin/sh
set -e

echo "=== Step 1: Execute fix SQL directly (bypasses Prisma checksum) ==="
npx prisma db execute --file ./prisma/migrations/20260315120000_fix_missing_tables/migration.sql 2>&1 || echo "WARN: db execute had issues (may be OK if already applied)"

echo "=== Step 2: Mark all known migrations as applied ==="
npx prisma migrate resolve --applied 20260219100000_convert_gbp_to_usd 2>/dev/null || true
npx prisma migrate resolve --applied 20260220000000_add_vendor_marketplace_support 2>/dev/null || true
npx prisma migrate resolve --applied 20260221000000_merge_catalog_marketing_pipeline 2>/dev/null || true
npx prisma migrate resolve --applied 20260315120000_fix_missing_tables 2>/dev/null || true
npx prisma migrate resolve --applied 20260219200000_stock_check_constraint 2>/dev/null || true
npx prisma migrate resolve --applied 20261003000000_founding_members_email_verification 2>/dev/null || true
npx prisma migrate resolve --applied 20261004000000_security_indexes 2>/dev/null || true

echo "=== Step 2b: Execute new migrations directly (IF NOT EXISTS - safe to re-run) ==="
npx prisma db execute --file ./prisma/migrations/20261003000000_founding_members_email_verification/migration.sql 2>&1 || echo "WARN: founding members migration had issues (may be OK if already applied)"
npx prisma db execute --file ./prisma/migrations/20261004000000_security_indexes/migration.sql 2>&1 || echo "WARN: security indexes migration had issues (may be OK if already applied)"

echo "=== Step 3: Run migrate deploy for any future migrations ==="
npx prisma migrate deploy || echo "WARN: migrate deploy had issues - continuing with startup"

echo "=== Starting application ==="
exec node dist/main.js
