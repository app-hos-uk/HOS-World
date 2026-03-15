-- Add CONTENT_COMPLETED to ProductSubmissionStatus enum
ALTER TYPE "ProductSubmissionStatus" ADD VALUE IF NOT EXISTS 'CONTENT_COMPLETED';

-- Add CONTENT_COMPLETED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTENT_COMPLETED';

-- Migrate existing MARKETING_COMPLETED submissions to CONTENT_COMPLETED
DO $$ BEGIN
  UPDATE "product_submissions"
    SET "status" = 'CONTENT_COMPLETED'
    WHERE "status" = 'MARKETING_COMPLETED';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
