-- PromotionUsage: track automatic promotion consumption per user/order (enforces userUsageLimit + usageCount)

CREATE TABLE IF NOT EXISTS "promotion_usages" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_usages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promotion_usages_promotionId_userId_idx" ON "promotion_usages"("promotionId", "userId");
CREATE INDEX IF NOT EXISTS "promotion_usages_orderId_idx" ON "promotion_usages"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotion_usages_promotionId_fkey'
  ) THEN
    ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_promotionId_fkey"
      FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotion_usages_userId_fkey'
  ) THEN
    ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotion_usages_orderId_fkey'
  ) THEN
    ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
