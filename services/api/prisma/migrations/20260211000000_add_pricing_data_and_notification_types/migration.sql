-- Add pricingData JSON column to product_submissions
ALTER TABLE "product_submissions" ADD COLUMN IF NOT EXISTS "pricingData" JSONB;

-- Add new NotificationType enum values for submission workflow (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'SUBMISSION_APPROVED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SUBMISSION_APPROVED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'SUBMISSION_REJECTED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SUBMISSION_REJECTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'SUBMISSION_RESUBMITTED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SUBMISSION_RESUBMITTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'CATALOG_COMPLETED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'CATALOG_COMPLETED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'MARKETING_COMPLETED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'MARKETING_COMPLETED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'FINANCE_APPROVED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'FINANCE_APPROVED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'FINANCE_REJECTED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'FINANCE_REJECTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'NotificationType' AND e.enumlabel = 'PRODUCT_PUBLISHED') THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_PUBLISHED';
  END IF;
END $$;

-- Update Settlement currency default from USD to GBP
ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'GBP';
