-- Phase 7: Ambassador Programme

CREATE TABLE IF NOT EXISTS "ambassador_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tier" TEXT NOT NULL DEFAULT 'ADVOCATE',
    "referralCode" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "profileImage" TEXT,
    "socialLinks" JSONB,
    "totalReferralSignups" INTEGER NOT NULL DEFAULT 0,
    "totalReferralRevenue" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "totalUgcSubmissions" INTEGER NOT NULL DEFAULT 0,
    "totalUgcApproved" INTEGER NOT NULL DEFAULT 0,
    "totalPointsEarnedAsAmb" INTEGER NOT NULL DEFAULT 0,
    "commissionAsPoints" BOOLEAN NOT NULL DEFAULT true,
    "commissionPointsRate" DECIMAL(3, 2) NOT NULL DEFAULT 1.5,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ambassador_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_userId_key" ON "ambassador_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_membershipId_key" ON "ambassador_profiles"("membershipId");
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_referralCode_key" ON "ambassador_profiles"("referralCode");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_status_idx" ON "ambassador_profiles"("status");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_tier_idx" ON "ambassador_profiles"("tier");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_userId_idx" ON "ambassador_profiles"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ambassador_profiles_userId_fkey'
  ) THEN
    ALTER TABLE "ambassador_profiles"
      ADD CONSTRAINT "ambassador_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ambassador_profiles_membershipId_fkey'
  ) THEN
    ALTER TABLE "ambassador_profiles"
      ADD CONSTRAINT "ambassador_profiles_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "loyalty_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ugc_submissions" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialUrl" TEXT,
    "platform" TEXT,
    "productId" TEXT,
    "fandomId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "featuredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ugc_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ugc_submissions_ambassadorId_idx" ON "ugc_submissions"("ambassadorId");
CREATE INDEX IF NOT EXISTS "ugc_submissions_userId_idx" ON "ugc_submissions"("userId");
CREATE INDEX IF NOT EXISTS "ugc_submissions_status_idx" ON "ugc_submissions"("status");
CREATE INDEX IF NOT EXISTS "ugc_submissions_type_idx" ON "ugc_submissions"("type");
CREATE INDEX IF NOT EXISTS "ugc_submissions_productId_idx" ON "ugc_submissions"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ugc_submissions_ambassadorId_fkey'
  ) THEN
    ALTER TABLE "ugc_submissions"
      ADD CONSTRAINT "ugc_submissions_ambassadorId_fkey"
      FOREIGN KEY ("ambassadorId") REFERENCES "ambassador_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ugc_submissions_userId_fkey'
  ) THEN
    ALTER TABLE "ugc_submissions"
      ADD CONSTRAINT "ugc_submissions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ugc_submissions_productId_fkey'
  ) THEN
    ALTER TABLE "ugc_submissions"
      ADD CONSTRAINT "ugc_submissions_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ugc_submissions_fandomId_fkey'
  ) THEN
    ALTER TABLE "ugc_submissions"
      ADD CONSTRAINT "ugc_submissions_fandomId_fkey"
      FOREIGN KEY ("fandomId") REFERENCES "fandoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ambassador_achievements" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "achievementSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ambassador_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_achievements_ambassadorId_achievementSlug_key" ON "ambassador_achievements"("ambassadorId", "achievementSlug");
CREATE INDEX IF NOT EXISTS "ambassador_achievements_ambassadorId_idx" ON "ambassador_achievements"("ambassadorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ambassador_achievements_ambassadorId_fkey'
  ) THEN
    ALTER TABLE "ambassador_achievements"
      ADD CONSTRAINT "ambassador_achievements_ambassadorId_fkey"
      FOREIGN KEY ("ambassadorId") REFERENCES "ambassador_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "influencer_commissions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
