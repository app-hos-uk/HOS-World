-- AlterTable: add idempotencyKey to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateIndex: unique constraint on (userId, idempotencyKey) to prevent duplicate orders
CREATE UNIQUE INDEX IF NOT EXISTS "orders_userId_idempotencyKey_key"
  ON "orders" ("userId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
