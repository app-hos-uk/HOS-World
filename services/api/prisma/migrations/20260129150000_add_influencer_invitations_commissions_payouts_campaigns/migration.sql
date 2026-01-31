-- Influencer invitations, campaigns, commissions, payouts (idempotent)
-- These tables are required by Prisma schema but were missing from earlier migrations.

-- InvitationStatus enum (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND t.typname = 'InvitationStatus') THEN
    CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
  END IF;
END
$$;

-- CampaignStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND t.typname = 'CampaignStatus') THEN
    CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');
  END IF;
END
$$;

-- CommissionStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND t.typname = 'CommissionStatus') THEN
    CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'ADJUSTED');
  END IF;
END
$$;

-- PayoutStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND t.typname = 'PayoutStatus') THEN
    CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
  END IF;
END
$$;

-- influencer_invitations
CREATE TABLE IF NOT EXISTS "influencer_invitations" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "message" TEXT,
  "baseCommissionRate" DECIMAL(5,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencer_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "influencer_invitations_token_key" ON "influencer_invitations"("token");
CREATE INDEX IF NOT EXISTS "influencer_invitations_email_idx" ON "influencer_invitations"("email");
CREATE INDEX IF NOT EXISTS "influencer_invitations_token_idx" ON "influencer_invitations"("token");
CREATE INDEX IF NOT EXISTS "influencer_invitations_status_idx" ON "influencer_invitations"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_invitations_invitedBy_fkey') THEN
    ALTER TABLE "influencer_invitations" ADD CONSTRAINT "influencer_invitations_invitedBy_fkey"
      FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- influencer_campaigns
CREATE TABLE IF NOT EXISTS "influencer_campaigns" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "overrideCommissionRate" DECIMAL(5,4),
  "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalConversions" INTEGER NOT NULL DEFAULT 0,
  "totalSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencer_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "influencer_campaigns_influencerId_idx" ON "influencer_campaigns"("influencerId");
CREATE INDEX IF NOT EXISTS "influencer_campaigns_status_idx" ON "influencer_campaigns"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_campaigns_influencerId_fkey') THEN
    ALTER TABLE "influencer_campaigns" ADD CONSTRAINT "influencer_campaigns_influencerId_fkey"
      FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- influencer_payouts (before commissions because commissions reference payouts)
CREATE TABLE IF NOT EXISTS "influencer_payouts" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "paymentMethod" TEXT,
  "paymentRef" TEXT,
  "paidAt" TIMESTAMP(3),
  "paidBy" TEXT,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencer_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "influencer_payouts_influencerId_idx" ON "influencer_payouts"("influencerId");
CREATE INDEX IF NOT EXISTS "influencer_payouts_status_idx" ON "influencer_payouts"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_payouts_influencerId_fkey') THEN
    ALTER TABLE "influencer_payouts" ADD CONSTRAINT "influencer_payouts_influencerId_fkey"
      FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- influencer_commissions
CREATE TABLE IF NOT EXISTS "influencer_commissions" (
  "id" TEXT NOT NULL,
  "influencerId" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderTotal" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "rateSource" TEXT NOT NULL,
  "rateApplied" DECIMAL(5,4) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
  "payoutId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "influencer_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "influencer_commissions_referralId_key" ON "influencer_commissions"("referralId");
CREATE INDEX IF NOT EXISTS "influencer_commissions_influencerId_idx" ON "influencer_commissions"("influencerId");
CREATE INDEX IF NOT EXISTS "influencer_commissions_status_idx" ON "influencer_commissions"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_commissions_influencerId_fkey') THEN
    ALTER TABLE "influencer_commissions" ADD CONSTRAINT "influencer_commissions_influencerId_fkey"
      FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_commissions_referralId_fkey') THEN
    ALTER TABLE "influencer_commissions" ADD CONSTRAINT "influencer_commissions_referralId_fkey"
      FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influencer_commissions_payoutId_fkey') THEN
    ALTER TABLE "influencer_commissions" ADD CONSTRAINT "influencer_commissions_payoutId_fkey"
      FOREIGN KEY ("payoutId") REFERENCES "influencer_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
