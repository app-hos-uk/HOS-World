CREATE TABLE IF NOT EXISTS "product_views" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "product_views_productId_idx" ON "product_views"("productId");
CREATE INDEX IF NOT EXISTS "product_views_createdAt_idx" ON "product_views"("createdAt");
CREATE INDEX IF NOT EXISTS "product_views_productId_createdAt_idx" ON "product_views"("productId", "createdAt");
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
