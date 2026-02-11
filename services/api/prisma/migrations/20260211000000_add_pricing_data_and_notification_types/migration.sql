-- Add pricingData JSON column to product_submissions
ALTER TABLE "product_submissions" ADD COLUMN IF NOT EXISTS "pricingData" JSONB;

-- Add new NotificationType enum values for submission workflow
-- Prisma enums are stored as PostgreSQL enums; we need to add new values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBMISSION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBMISSION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBMISSION_RESUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CATALOG_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKETING_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINANCE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINANCE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PRODUCT_PUBLISHED';

-- Update Settlement currency default from USD to GBP
ALTER TABLE "settlements" ALTER COLUMN "currency" SET DEFAULT 'GBP';
