-- Track when an order was marked delivered (used for return window eligibility).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- Backfill deliveredAt for existing delivered orders using updatedAt as best-effort.
UPDATE "orders"
SET "deliveredAt" = "updatedAt"
WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;
