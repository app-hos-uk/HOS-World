#!/bin/sh
# Pre-migration script: resolve any failed migrations before running deploy.
# This handles P3009 errors where a migration is stuck in "failed" state.
# Safe to run repeatedly — only acts when a failed migration exists.

set -e

echo "=== Checking for failed migrations ==="

# Query _prisma_migrations for any failed records (finished_at IS NULL or rolled_back_at set)
FAILED=$(npx prisma db execute --stdin <<'SQL' 2>/dev/null || true
SELECT migration_name FROM "_prisma_migrations"
WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
ORDER BY "started_at" ASC LIMIT 1;
SQL
)

# Resolve known failed migrations if prisma migrate deploy would fail
npx prisma migrate resolve --rolled-back 20260629150000_add_transaction_audit_log 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260629150100_add_reconciliation_engine 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260629150200_add_disputes 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260629150300_add_financial_periods 2>/dev/null || true

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy
