-- Fix Prisma migration history: remove failed or invalid record for add_global_features
-- so that "prisma migrate deploy" can run successfully.
--
-- Run this when:
-- - 20251206133014_add_global_features is stuck in a failed state (finished_at IS NULL), or
-- - You previously baselined with run_and_baseline.sql and get checksum mismatch.
--
-- After running this, run: pnpm prisma migrate deploy
-- The migration SQL uses IF NOT EXISTS / ON CONFLICT DO NOTHING, so re-applying is safe.
--
-- Usage:
--   cd services/api && pnpm prisma db execute --file scripts/fix-migration-history.sql

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20251206133014_add_global_features';
