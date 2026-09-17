-- Add soft deactivation for loyalty memberships (test cleanup without deleting history).
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "loyalty_memberships" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;
CREATE INDEX IF NOT EXISTS "loyalty_memberships_status_idx" ON "loyalty_memberships"("status");
