-- Phase 9: Analytics, CLV & Attribution

CREATE TABLE IF NOT EXISTS "loyalty_analytics_snapshots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "activeMembers30d" INTEGER NOT NULL DEFAULT 0,
    "newEnrollments" INTEGER NOT NULL DEFAULT 0,
    "pointsIssued" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "pointsExpired" INTEGER NOT NULL DEFAULT 0,
    "pointsLiability" INTEGER NOT NULL DEFAULT 0,
    "totalRevenueLoyalty" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "totalOrdersLoyalty" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValueLoyalty" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "brandFundedPoints" INTEGER NOT NULL DEFAULT 0,
    "campaignPointsIssued" INTEGER NOT NULL DEFAULT 0,
    "webOrders" INTEGER NOT NULL DEFAULT 0,
    "posOrders" INTEGER NOT NULL DEFAULT 0,
    "webRevenue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "posRevenue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "tierDistribution" JSONB,
    "topFandoms" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_analytics_snapshots_date_key" ON "loyalty_analytics_snapshots"("date");
CREATE INDEX IF NOT EXISTS "loyalty_analytics_snapshots_date_idx" ON "loyalty_analytics_snapshots"("date");

CREATE TABLE IF NOT EXISTS "campaign_attributions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignType" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ordersInfluenced" INTEGER NOT NULL DEFAULT 0,
    "revenueInfluenced" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "pointsCost" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "roi" DECIMAL(8, 4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_attributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_attributions_campaignId_date_key" ON "campaign_attributions"("campaignId", "date");
CREATE INDEX IF NOT EXISTS "campaign_attributions_campaignId_idx" ON "campaign_attributions"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_attributions_date_idx" ON "campaign_attributions"("date");
CREATE INDEX IF NOT EXISTS "campaign_attributions_campaignType_idx" ON "campaign_attributions"("campaignType");

ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "clvScore" DECIMAL(10, 2);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "clvUpdatedAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "predictedChurnRisk" DECIMAL(5, 4);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "firstPurchaseAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "lastPurchaseAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "avgOrderValue" DECIMAL(10, 2);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "purchaseFrequency" DECIMAL(6, 4);
