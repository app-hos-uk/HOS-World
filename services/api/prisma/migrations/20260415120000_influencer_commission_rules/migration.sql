-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "influencer_commission_rules" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "brandName" TEXT,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "influencer_commission_rules_influencerId_idx" ON "influencer_commission_rules"("influencerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "influencer_commission_rules_influencerId_isActive_idx" ON "influencer_commission_rules"("influencerId", "isActive");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'influencer_commission_rules_influencerId_fkey'
  ) THEN
    ALTER TABLE "influencer_commission_rules" ADD CONSTRAINT "influencer_commission_rules_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
