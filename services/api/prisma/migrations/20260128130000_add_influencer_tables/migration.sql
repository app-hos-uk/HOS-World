-- Influencer module: enums and tables (idempotent)

-- InfluencerStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND t.typname = 'InfluencerStatus') THEN
    CREATE TYPE "InfluencerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END
$$;

-- InfluencerTier enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND t.typname = 'InfluencerTier') THEN
    CREATE TYPE "InfluencerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
  END IF;
END
$$;

-- influencers table
CREATE TABLE IF NOT EXISTS "influencers" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "bio" TEXT,
  "profileImage" TEXT,
  "bannerImage" TEXT,
  "socialLinks" JSONB,
  "referralCode" TEXT NOT NULL,
  "cookieDuration" INTEGER NOT NULL DEFAULT 30,
  "baseCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  "categoryCommissions" JSONB,
  "status" "InfluencerStatus" NOT NULL DEFAULT 'ACTIVE',
  "tier" "InfluencerTier" NOT NULL DEFAULT 'BRONZE',
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalConversions" INTEGER NOT NULL DEFAULT 0,
  "totalSalesAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalCommission" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "influencers_userId_key" ON "influencers"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "influencers_slug_key" ON "influencers"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "influencers_referralCode_key" ON "influencers"("referralCode");
CREATE INDEX IF NOT EXISTS "influencers_referralCode_idx" ON "influencers"("referralCode");
CREATE INDEX IF NOT EXISTS "influencers_status_idx" ON "influencers"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencers_userId_fkey') THEN
    ALTER TABLE "influencers" ADD CONSTRAINT "influencers_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- influencer_storefronts table
CREATE TABLE IF NOT EXISTS "influencer_storefronts" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "primaryColor" TEXT NOT NULL DEFAULT '#7C3AED',
  "secondaryColor" TEXT NOT NULL DEFAULT '#F3E8FF',
  "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
  "textColor" TEXT NOT NULL DEFAULT '#1F2937',
  "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
  "layoutType" TEXT NOT NULL DEFAULT 'grid',
  "showBanner" BOOLEAN NOT NULL DEFAULT true,
  "showBio" BOOLEAN NOT NULL DEFAULT true,
  "showSocialLinks" BOOLEAN NOT NULL DEFAULT true,
  "contentBlocks" JSONB,
  "featuredProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "customDomain" TEXT,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencer_storefronts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "influencer_storefronts_influencerId_key" ON "influencer_storefronts"("influencerId");
CREATE UNIQUE INDEX IF NOT EXISTS "influencer_storefronts_customDomain_key" ON "influencer_storefronts"("customDomain");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_storefronts_influencerId_fkey') THEN
    ALTER TABLE "influencer_storefronts" ADD CONSTRAINT "influencer_storefronts_influencerId_fkey"
      FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
