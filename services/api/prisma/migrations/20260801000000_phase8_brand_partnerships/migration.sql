-- Phase 8: Brand Partnership Module

CREATE TABLE IF NOT EXISTS "brand_partnerships" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "totalBudget" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "spentBudget" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_partnerships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "brand_partnerships_slug_key" ON "brand_partnerships"("slug");
CREATE INDEX IF NOT EXISTS "brand_partnerships_status_idx" ON "brand_partnerships"("status");
CREATE INDEX IF NOT EXISTS "brand_partnerships_slug_idx" ON "brand_partnerships"("slug");

CREATE TABLE IF NOT EXISTS "brand_campaigns" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MULTIPLIER',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "multiplier" DECIMAL(3, 2),
    "bonusPoints" INTEGER,
    "maxPointsPerUser" INTEGER,
    "totalPointsBudget" INTEGER,
    "targetFandoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "segmentId" TEXT,
    "minTierLevel" INTEGER NOT NULL DEFAULT 0,
    "regionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "featuredProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusiveTierLevel" INTEGER,
    "journeySlug" TEXT,
    "notifyOnStart" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "brand_campaigns_slug_key" ON "brand_campaigns"("slug");
CREATE INDEX IF NOT EXISTS "brand_campaigns_partnershipId_idx" ON "brand_campaigns"("partnershipId");
CREATE INDEX IF NOT EXISTS "brand_campaigns_status_idx" ON "brand_campaigns"("status");
CREATE INDEX IF NOT EXISTS "brand_campaigns_startsAt_endsAt_idx" ON "brand_campaigns"("startsAt", "endsAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_campaigns_partnershipId_fkey'
  ) THEN
    ALTER TABLE "brand_campaigns"
      ADD CONSTRAINT "brand_campaigns_partnershipId_fkey"
      FOREIGN KEY ("partnershipId") REFERENCES "brand_partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "brand_campaign_redemptions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "pointsAwarded" INTEGER NOT NULL,
    "orderTotal" DECIMAL(10, 2),
    "source" TEXT NOT NULL DEFAULT 'PURCHASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_campaign_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "brand_campaign_redemptions_campaignId_idx" ON "brand_campaign_redemptions"("campaignId");
CREATE INDEX IF NOT EXISTS "brand_campaign_redemptions_userId_idx" ON "brand_campaign_redemptions"("userId");
CREATE INDEX IF NOT EXISTS "brand_campaign_redemptions_campaignId_userId_idx" ON "brand_campaign_redemptions"("campaignId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_campaign_redemptions_campaignId_fkey'
  ) THEN
    ALTER TABLE "brand_campaign_redemptions"
      ADD CONSTRAINT "brand_campaign_redemptions_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "brand_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_campaign_redemptions_userId_fkey'
  ) THEN
    ALTER TABLE "brand_campaign_redemptions"
      ADD CONSTRAINT "brand_campaign_redemptions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "loyalty_bonus_campaigns" ADD COLUMN IF NOT EXISTS "brandCampaignId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_bonus_campaigns_brandCampaignId_key" ON "loyalty_bonus_campaigns"("brandCampaignId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_bonus_campaigns_brandCampaignId_fkey'
  ) THEN
    ALTER TABLE "loyalty_bonus_campaigns"
      ADD CONSTRAINT "loyalty_bonus_campaigns_brandCampaignId_fkey"
      FOREIGN KEY ("brandCampaignId") REFERENCES "brand_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
