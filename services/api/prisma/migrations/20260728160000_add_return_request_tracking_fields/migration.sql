-- Add return shipment tracking fields expected by Prisma ReturnRequest model.
-- Previously lived in a standalone SQL file that was never applied by `prisma migrate deploy`.

ALTER TABLE "return_requests"
ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;

ALTER TABLE "return_requests"
ADD COLUMN IF NOT EXISTS "carrier" TEXT;

ALTER TABLE "return_requests"
ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3);

ALTER TABLE "return_requests"
ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);

ALTER TABLE "return_requests"
ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "return_requests_status_idx" ON "return_requests"("status");
CREATE INDEX IF NOT EXISTS "return_requests_createdAt_idx" ON "return_requests"("createdAt");
