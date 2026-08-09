-- Creates the indexes that schema.prisma declares but that were never actually built in the
-- database. Verified against production with `prisma migrate diff` and pg_indexes.
--
-- IF NOT EXISTS keeps this file safe to re-run, matching the convention used by the other
-- migrations in this repo.
--
-- Deliberately NOT created here, even though `prisma migrate diff` lists them as missing:
--
--   orders (userId, idempotencyKey)  Already enforced by orders_userId_idempotencyKey_key from
--                                    20260418120000, which is a partial unique index carrying
--                                    WHERE "idempotencyKey" IS NOT NULL. Prisma cannot express a
--                                    partial index, so diff reports it as absent. It is not.
--   products (status)                Served by the leading column of products_status_createdAt_idx.
--   product_submissions (status)     Served by the (status, createdAt) index created below.
--   sellers (stripeConnectAccountId) Duplicates the existing unique index on the same column.
--   stores (code)                    Duplicates the existing unique index on the same column.
--   loyalty_memberships (cardNumber) Duplicates the existing unique index on the same column.
--   loyalty_referrals (referralCode) Duplicates the existing unique index on the same column.
--
-- Those seven stay as known, explained drift rather than redundant indexes that only cost writes.

-- notifications carried no index at all beyond its primary key, so the unread-badge lookup and the
-- newest-first listing were both sequential scans.
CREATE INDEX IF NOT EXISTS "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");

CREATE INDEX IF NOT EXISTS "orders_paymentStatus_idx" ON "orders"("paymentStatus");
CREATE INDEX IF NOT EXISTS "orders_createdAt_idx" ON "orders"("createdAt");

CREATE INDEX IF NOT EXISTS "products_sellerId_status_idx" ON "products"("sellerId", "status");

CREATE INDEX IF NOT EXISTS "product_submissions_sellerId_status_idx" ON "product_submissions"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "product_submissions_status_createdAt_idx" ON "product_submissions"("status", "createdAt");
