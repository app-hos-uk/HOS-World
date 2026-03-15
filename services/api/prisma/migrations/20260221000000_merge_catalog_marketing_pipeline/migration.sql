-- Add CONTENT_COMPLETED to ProductSubmissionStatus enum
ALTER TYPE "ProductSubmissionStatus" ADD VALUE IF NOT EXISTS 'CONTENT_COMPLETED';

-- Add CONTENT_COMPLETED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTENT_COMPLETED';

-- Migrate existing MARKETING_COMPLETED submissions to CONTENT_COMPLETED
-- (old pipeline: CATALOG_COMPLETED -> MARKETING_COMPLETED -> FINANCE)
-- (new pipeline: CATALOG_COMPLETED -> CONTENT_COMPLETED -> FINANCE)
-- We keep CATALOG_COMPLETED and MARKETING_COMPLETED values for backward compat
-- but new submissions will use CONTENT_COMPLETED as the combined stage.
UPDATE "product_submissions"
  SET "status" = 'CONTENT_COMPLETED'
  WHERE "status" = 'MARKETING_COMPLETED';
