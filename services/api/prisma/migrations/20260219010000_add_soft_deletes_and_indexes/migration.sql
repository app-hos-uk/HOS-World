-- Add soft delete fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "product_submissions" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Soft delete indexes
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX IF NOT EXISTS "products_deletedAt_idx" ON "products"("deletedAt");
CREATE INDEX IF NOT EXISTS "orders_deletedAt_idx" ON "orders"("deletedAt");
CREATE INDEX IF NOT EXISTS "sellers_deletedAt_idx" ON "sellers"("deletedAt");
CREATE INDEX IF NOT EXISTS "product_submissions_deletedAt_idx" ON "product_submissions"("deletedAt");

-- Product lookup indexes
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products"("barcode");
CREATE INDEX IF NOT EXISTS "products_ean_idx" ON "products"("ean");
