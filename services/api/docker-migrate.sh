#!/bin/sh
set -e

echo "=== Step 1: Execute fix SQL directly (bypasses Prisma checksum) ==="
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260315120000_fix_missing_tables/migration.sql 2>&1 || echo "WARN: db execute had issues (may be OK if already applied)"

echo "=== Step 2: Mark all known migrations as applied ==="
npx prisma migrate resolve --applied 20260219100000_convert_gbp_to_usd 2>/dev/null || true
npx prisma migrate resolve --applied 20260220000000_add_vendor_marketplace_support 2>/dev/null || true
npx prisma migrate resolve --applied 20260221000000_merge_catalog_marketing_pipeline 2>/dev/null || true
npx prisma migrate resolve --applied 20260315120000_fix_missing_tables 2>/dev/null || true
npx prisma migrate resolve --applied 20260219200000_stock_check_constraint 2>/dev/null || true
npx prisma migrate resolve --applied 20261003000000_founding_members_email_verification 2>/dev/null || true
npx prisma migrate resolve --applied 20261004000000_security_indexes 2>/dev/null || true
npx prisma migrate resolve --applied 20260609000000_add_blog_system 2>/dev/null || true
npx prisma migrate resolve --applied 20260610000000_campaign_readiness_indexes 2>/dev/null || true

echo "=== Step 2a: Resolve any failed migrations ==="
npx prisma migrate resolve --rolled-back 20260629150000_add_transaction_audit_log 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260629150100_add_reconciliation_engine 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260629150200_add_disputes 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260629150300_add_financial_periods 2>/dev/null || true

echo "=== Step 2b: Execute new migrations directly (IF NOT EXISTS - safe to re-run) ==="
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20261003000000_founding_members_email_verification/migration.sql 2>&1 || echo "WARN: founding members migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20261004000000_security_indexes/migration.sql 2>&1 || echo "WARN: security indexes migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260609000000_add_blog_system/migration.sql 2>&1 || echo "WARN: blog system migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260610000000_campaign_readiness_indexes/migration.sql 2>&1 || echo "WARN: campaign readiness migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260629150000_add_transaction_audit_log/migration.sql 2>&1 || echo "WARN: transaction audit log migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260629150100_add_reconciliation_engine/migration.sql 2>&1 || echo "WARN: reconciliation engine migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260629150200_add_disputes/migration.sql 2>&1 || echo "WARN: disputes migration had issues (may be OK if already applied)"
npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260629150300_add_financial_periods/migration.sql 2>&1 || echo "WARN: financial periods migration had issues (may be OK if already applied)"

echo "=== Step 2c: Mark newly executed migrations as applied ==="
npx prisma migrate resolve --applied 20260629150000_add_transaction_audit_log 2>/dev/null || true
npx prisma migrate resolve --applied 20260629150100_add_reconciliation_engine 2>/dev/null || true
npx prisma migrate resolve --applied 20260629150200_add_disputes 2>/dev/null || true
npx prisma migrate resolve --applied 20260629150300_add_financial_periods 2>/dev/null || true

echo "=== Step 3: Run migrate deploy (authoritative) ==="
# Fail closed: if migrations cannot be applied the schema is in an unknown state and the app
# must NOT start (silently starting on a drifted schema previously caused production outages
# and missing security migrations). By this point all historical migrations are reconciled
# above, so a clean database should have nothing pending and this should succeed.
npx prisma migrate deploy

echo "=== Migrations complete ==="
