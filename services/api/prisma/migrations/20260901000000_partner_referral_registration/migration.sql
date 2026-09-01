-- Partner Referral Registration

CREATE TABLE IF NOT EXISTS "referral_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "brandPartnershipId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_partners_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referral_partners_slug_key" ON "referral_partners"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_partners_brandPartnershipId_key" ON "referral_partners"("brandPartnershipId");
CREATE INDEX IF NOT EXISTS "referral_partners_status_idx" ON "referral_partners"("status");

CREATE TABLE IF NOT EXISTS "referral_partner_links" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL DEFAULT '/register',
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL DEFAULT 'referral',
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "signupBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "pointsMultiplier" DECIMAL(3, 2),
    "multiplierDays" INTEGER,
    "couponCode" TEXT,
    "discountPercent" DECIMAL(5, 2),
    "discountFixedAmount" DECIMAL(10, 2),
    "maxRedemptions" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalRegistrations" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_partner_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referral_partner_links_code_key" ON "referral_partner_links"("code");
CREATE INDEX IF NOT EXISTS "referral_partner_links_partnerId_idx" ON "referral_partner_links"("partnerId");
CREATE INDEX IF NOT EXISTS "referral_partner_links_code_idx" ON "referral_partner_links"("code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_partner_links_partnerId_fkey'
  ) THEN
    ALTER TABLE "referral_partner_links"
      ADD CONSTRAINT "referral_partner_links_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "referral_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "partner_referral_conversions" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "signupBonusAwarded" INTEGER NOT NULL DEFAULT 0,
    "multiplierApplied" BOOLEAN NOT NULL DEFAULT false,
    "multiplierExpiresAt" TIMESTAMP(3),
    "couponApplied" TEXT,
    "firstOrderId" TEXT,
    "firstOrderTotal" DECIMAL(10, 2),
    "convertedAt" TIMESTAMP(3),
    "landingPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_referral_conversions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_referral_conversions_partnerId_idx" ON "partner_referral_conversions"("partnerId");
CREATE INDEX IF NOT EXISTS "partner_referral_conversions_linkId_idx" ON "partner_referral_conversions"("linkId");
CREATE UNIQUE INDEX IF NOT EXISTS "partner_referral_conversions_userId_key" ON "partner_referral_conversions"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_referral_conversions_partnerId_fkey'
  ) THEN
    ALTER TABLE "partner_referral_conversions"
      ADD CONSTRAINT "partner_referral_conversions_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "referral_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_referral_conversions_linkId_fkey'
  ) THEN
    ALTER TABLE "partner_referral_conversions"
      ADD CONSTRAINT "partner_referral_conversions_linkId_fkey"
      FOREIGN KEY ("linkId") REFERENCES "referral_partner_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_referral_conversions_userId_fkey'
  ) THEN
    ALTER TABLE "partner_referral_conversions"
      ADD CONSTRAINT "partner_referral_conversions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Add partnerReferralLinkId to loyalty_memberships
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "partnerReferralLinkId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_memberships_partnerReferralLinkId_fkey'
  ) THEN
    ALTER TABLE "loyalty_memberships"
      ADD CONSTRAINT "loyalty_memberships_partnerReferralLinkId_fkey"
      FOREIGN KEY ("partnerReferralLinkId") REFERENCES "referral_partner_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
