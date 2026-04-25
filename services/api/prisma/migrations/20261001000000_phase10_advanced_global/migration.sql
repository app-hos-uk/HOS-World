-- Phase 10: Advanced Features & Global Readiness

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "defaultRegionCode" TEXT NOT NULL DEFAULT 'GB';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "loyaltyRedeemValue" DECIMAL(8, 6) NOT NULL DEFAULT 0.01;

CREATE TABLE IF NOT EXISTS "click_collect_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedReady" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "collectedBy" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "reminderNotifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "click_collect_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "click_collect_orders_orderId_key" ON "click_collect_orders"("orderId");
CREATE INDEX IF NOT EXISTS "click_collect_orders_storeId_idx" ON "click_collect_orders"("storeId");
CREATE INDEX IF NOT EXISTS "click_collect_orders_status_idx" ON "click_collect_orders"("status");
CREATE INDEX IF NOT EXISTS "click_collect_orders_orderId_idx" ON "click_collect_orders"("orderId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'click_collect_orders_orderId_fkey'
    ) THEN
        ALTER TABLE "click_collect_orders"
        ADD CONSTRAINT "click_collect_orders_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'click_collect_orders_storeId_fkey'
    ) THEN
        ALTER TABLE "click_collect_orders"
        ADD CONSTRAINT "click_collect_orders_storeId_fkey"
        FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "product_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BONUS_POINTS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fandomFilter" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bonusPoints" INTEGER,
    "minTierLevel" INTEGER NOT NULL DEFAULT 0,
    "regionCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "maxRedemptions" INTEGER,
    "totalRedemptions" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_campaigns_slug_key" ON "product_campaigns"("slug");
CREATE INDEX IF NOT EXISTS "product_campaigns_status_idx" ON "product_campaigns"("status");
CREATE INDEX IF NOT EXISTS "product_campaigns_startsAt_endsAt_idx" ON "product_campaigns"("startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "store_onboarding_checklists" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_onboarding_checklists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_onboarding_checklists_storeId_key" ON "store_onboarding_checklists"("storeId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'store_onboarding_checklists_storeId_fkey'
    ) THEN
        ALTER TABLE "store_onboarding_checklists"
        ADD CONSTRAINT "store_onboarding_checklists_storeId_fkey"
        FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
