-- Campaign Readiness: Add missing indexes and cart checkout lock

-- Product indexes for catalog queries
CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX IF NOT EXISTS "products_fandom_idx" ON "products"("fandom");
CREATE INDEX IF NOT EXISTS "products_status_createdAt_idx" ON "products"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "products_status_categoryId_createdAt_idx" ON "products"("status", "categoryId", "createdAt");
CREATE INDEX IF NOT EXISTS "products_status_fandom_createdAt_idx" ON "products"("status", "fandom", "createdAt");
CREATE INDEX IF NOT EXISTS "products_averageRating_idx" ON "products"("averageRating");

-- ProductReview indexes for rating aggregation
CREATE INDEX IF NOT EXISTS "product_reviews_productId_status_idx" ON "product_reviews"("productId", "status");
CREATE INDEX IF NOT EXISTS "product_reviews_productId_rating_idx" ON "product_reviews"("productId", "rating");

-- OrderItem indexes for order lookups
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_productId_idx" ON "order_items"("productId");

-- Collection index for user lookups
CREATE INDEX IF NOT EXISTS "collections_userId_idx" ON "collections"("userId");

-- Cart checkout lock column
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "checkoutLockedAt" TIMESTAMP(3);
