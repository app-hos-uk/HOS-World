-- Enchanted Circle — Phase 1 core loyalty + channels + expanded stores

-- SellerType: PLATFORM_RETAIL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SellerType' AND e.enumlabel = 'PLATFORM_RETAIL'
  ) THEN
    ALTER TYPE "SellerType" ADD VALUE 'PLATFORM_RETAIL';
  END IF;
END $$;

-- NotificationType: loyalty + events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'LOYALTY_POINTS_EARNED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_POINTS_EARNED';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'LOYALTY_TIER_UPGRADE') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_TIER_UPGRADE';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'LOYALTY_TIER_DOWNGRADE') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_TIER_DOWNGRADE';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'LOYALTY_POINTS_EXPIRING') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_POINTS_EXPIRING';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'LOYALTY_REDEMPTION') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_REDEMPTION';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'LOYALTY_WELCOME') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_WELCOME';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'EVENT_INVITATION') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'EVENT_INVITATION';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'EVENT_REMINDER') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';
  END IF;
END $$;

-- Loyalty transaction enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyTxType') THEN
    CREATE TYPE "LoyaltyTxType" AS ENUM ('EARN', 'BURN', 'EXPIRE', 'ADJUST', 'BONUS', 'TRANSFER');
  END IF;
END $$;

-- Sellers: loyalty fields
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "loyaltyEarnRate" DECIMAL(5,4);
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "loyaltyFundingModel" TEXT NOT NULL DEFAULT 'SELLER_FUNDED';

-- Orders: loyalty fields
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "loyaltyDiscountAmount" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "loyaltyRedemptionChannel" TEXT;

-- Carts: pending loyalty redemption
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "pendingLoyaltyPoints" INTEGER;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "pendingLoyaltyOptionId" TEXT;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "loyaltyDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Stores: expand (keeps existing rows; backfills required `code`)
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "sellerId" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "storeType" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'GB';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/London';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GBP';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "managerName" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "operatingHours" JSONB;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);

UPDATE "stores" SET "code" = 'HOS-LEGACY-' || "id" WHERE "code" IS NULL;
ALTER TABLE "stores" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "stores_code_key" ON "stores"("code");

CREATE INDEX IF NOT EXISTS "stores_sellerId_idx" ON "stores"("sellerId");
CREATE INDEX IF NOT EXISTS "stores_country_idx" ON "stores"("country");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_sellerId_fkey'
  ) THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Loyalty core tables
CREATE TABLE IF NOT EXISTS "loyalty_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "pointsThreshold" INTEGER NOT NULL,
    "multiplier" DECIMAL(3,2) NOT NULL,
    "spendWeight" DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    "frequencyWeight" DECIMAL(3,2) NOT NULL DEFAULT 0.25,
    "engagementWeight" DECIMAL(3,2) NOT NULL DEFAULT 0.25,
    "benefits" JSONB NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "inviteOnly" BOOLEAN NOT NULL DEFAULT false,
    "maxMembers" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tiers_name_key" ON "loyalty_tiers"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tiers_slug_key" ON "loyalty_tiers"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tiers_level_key" ON "loyalty_tiers"("level");

CREATE TABLE IF NOT EXISTS "loyalty_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "totalPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "totalPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "compositeScore" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalSpend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "engagementCount" INTEGER NOT NULL DEFAULT 0,
    "tierExpiresAt" TIMESTAMP(3),
    "cardNumber" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrollmentChannel" TEXT NOT NULL DEFAULT 'WEB',
    "preferredCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "regionCode" TEXT NOT NULL DEFAULT 'GB',
    "fandomProfile" JSONB,
    "optInEmail" BOOLEAN NOT NULL DEFAULT true,
    "optInSms" BOOLEAN NOT NULL DEFAULT false,
    "optInWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "optInPush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_memberships_userId_key" ON "loyalty_memberships"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_memberships_cardNumber_key" ON "loyalty_memberships"("cardNumber");
CREATE INDEX IF NOT EXISTS "loyalty_memberships_tierId_idx" ON "loyalty_memberships"("tierId");
CREATE INDEX IF NOT EXISTS "loyalty_memberships_totalPointsEarned_idx" ON "loyalty_memberships"("totalPointsEarned");
CREATE INDEX IF NOT EXISTS "loyalty_memberships_compositeScore_idx" ON "loyalty_memberships"("compositeScore");

CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "type" "LoyaltyTxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "channel" TEXT NOT NULL,
    "storeId" TEXT,
    "sellerId" TEXT,
    "description" TEXT,
    "earnRuleId" TEXT,
    "campaignId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "loyalty_transactions_membershipId_idx" ON "loyalty_transactions"("membershipId");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_type_idx" ON "loyalty_transactions"("type");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_source_idx" ON "loyalty_transactions"("source");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_channel_idx" ON "loyalty_transactions"("channel");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_createdAt_idx" ON "loyalty_transactions"("createdAt");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_expiresAt_idx" ON "loyalty_transactions"("expiresAt");

CREATE TABLE IF NOT EXISTS "loyalty_earn_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "pointsAmount" INTEGER NOT NULL,
    "pointsType" TEXT NOT NULL DEFAULT 'FIXED',
    "multiplierStack" BOOLEAN NOT NULL DEFAULT true,
    "maxPerDay" INTEGER,
    "maxPerMonth" INTEGER,
    "maxPerUser" INTEGER,
    "conditions" JSONB,
    "regionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_earn_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_earn_rules_action_key" ON "loyalty_earn_rules"("action");

CREATE TABLE IF NOT EXISTS "loyalty_redemption_options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "value" DECIMAL(10,2),
    "description" TEXT,
    "image" TEXT,
    "stock" INTEGER,
    "regionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_redemption_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "loyalty_redemptions" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "couponCode" TEXT,
    "channel" TEXT NOT NULL,
    "storeId" TEXT,
    "orderId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "loyalty_redemptions_membershipId_idx" ON "loyalty_redemptions"("membershipId");
CREATE INDEX IF NOT EXISTS "loyalty_redemptions_channel_idx" ON "loyalty_redemptions"("channel");

CREATE TABLE IF NOT EXISTS "loyalty_referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "referrerPoints" INTEGER NOT NULL DEFAULT 500,
    "refereePoints" INTEGER NOT NULL DEFAULT 200,
    "convertedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_referrals_referralCode_key" ON "loyalty_referrals"("referralCode");

CREATE TABLE IF NOT EXISTS "loyalty_bonus_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "multiplier" DECIMAL(3,2),
    "bonusPoints" INTEGER,
    "conditions" JSONB,
    "regionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channelCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_bonus_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "loyalty_bonus_campaigns_isActive_startsAt_endsAt_idx" ON "loyalty_bonus_campaigns"("isActive", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "product_channels" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "storeId" TEXT,
    "currency" TEXT NOT NULL,
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2),
    "compareAtPrice" DECIMAL(10,2),
    "marginPercent" DECIMAL(5,4),
    "batchReference" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "notes" TEXT,
    CONSTRAINT "product_channels_pkey" PRIMARY KEY ("id")
);

-- Note: PostgreSQL treats NULL as distinct in UNIQUE; multiple ONLINE rows with storeId NULL are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "product_channels_productId_channelType_storeId_currency_effectiveFrom_key" ON "product_channels"("productId", "channelType", "storeId", "currency", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "product_channels_productId_idx" ON "product_channels"("productId");
CREATE INDEX IF NOT EXISTS "product_channels_channelType_idx" ON "product_channels"("channelType");
CREATE INDEX IF NOT EXISTS "product_channels_storeId_idx" ON "product_channels"("storeId");
CREATE INDEX IF NOT EXISTS "product_channels_isActive_idx" ON "product_channels"("isActive");

CREATE TABLE IF NOT EXISTS "pos_connections" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "externalOutletId" TEXT,
    "externalRegisterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'NEVER_SYNCED',
    "syncError" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_connections_storeId_key" ON "pos_connections"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "pos_connections_sellerId_storeId_key" ON "pos_connections"("sellerId", "storeId");
CREATE INDEX IF NOT EXISTS "pos_connections_provider_idx" ON "pos_connections"("provider");
CREATE INDEX IF NOT EXISTS "pos_connections_isActive_idx" ON "pos_connections"("isActive");

CREATE TABLE IF NOT EXISTS "external_entity_mappings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "storeId" TEXT,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_entity_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_entity_mappings_provider_entityType_internalId_storeId_key" ON "external_entity_mappings"("provider", "entityType", "internalId", "storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "external_entity_mappings_provider_entityType_externalId_storeId_key" ON "external_entity_mappings"("provider", "entityType", "externalId", "storeId");
CREATE INDEX IF NOT EXISTS "external_entity_mappings_provider_entityType_idx" ON "external_entity_mappings"("provider", "entityType");
CREATE INDEX IF NOT EXISTS "external_entity_mappings_syncStatus_idx" ON "external_entity_mappings"("syncStatus");

-- FKs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_memberships_userId_fkey') THEN
    ALTER TABLE "loyalty_memberships" ADD CONSTRAINT "loyalty_memberships_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_memberships_tierId_fkey') THEN
    ALTER TABLE "loyalty_memberships" ADD CONSTRAINT "loyalty_memberships_tierId_fkey"
      FOREIGN KEY ("tierId") REFERENCES "loyalty_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_membershipId_fkey') THEN
    ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "loyalty_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_redemptions_membershipId_fkey') THEN
    ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "loyalty_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_redemptions_optionId_fkey') THEN
    ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_optionId_fkey"
      FOREIGN KEY ("optionId") REFERENCES "loyalty_redemption_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_referrals_referrerId_fkey') THEN
    ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_referrerId_fkey"
      FOREIGN KEY ("referrerId") REFERENCES "loyalty_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_referrals_refereeId_fkey') THEN
    ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_refereeId_fkey"
      FOREIGN KEY ("refereeId") REFERENCES "loyalty_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_channels_productId_fkey') THEN
    ALTER TABLE "product_channels" ADD CONSTRAINT "product_channels_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_channels_storeId_fkey') THEN
    ALTER TABLE "product_channels" ADD CONSTRAINT "product_channels_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_connections_sellerId_fkey') THEN
    ALTER TABLE "pos_connections" ADD CONSTRAINT "pos_connections_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_connections_storeId_fkey') THEN
    ALTER TABLE "pos_connections" ADD CONSTRAINT "pos_connections_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add channels column to loyalty_redemption_options
ALTER TABLE "loyalty_redemption_options" ADD COLUMN IF NOT EXISTS "channels" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add birthday column to loyalty_memberships
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "birthday" TIMESTAMP(3);
