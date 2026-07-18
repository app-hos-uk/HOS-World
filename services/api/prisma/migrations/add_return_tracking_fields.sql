-- Add return tracking fields to return_requests table
-- Migration: add_return_tracking_fields
-- Date: 2026-07-18
-- Note: Column names use camelCase to match Prisma schema conventions

-- Add tracking number for return shipment
ALTER TABLE "return_requests" 
ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;

-- Add carrier (UPS, FedEx, USPS, etc.)
ALTER TABLE "return_requests" 
ADD COLUMN IF NOT EXISTS "carrier" TEXT;

-- Add shippedAt timestamp (when customer shipped the return)
ALTER TABLE "return_requests" 
ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3);

-- Add receivedAt timestamp (when return was received at warehouse)
ALTER TABLE "return_requests" 
ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);

-- Add inspectedAt timestamp (when return was inspected)
ALTER TABLE "return_requests" 
ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3);

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS "return_requests_status_idx" ON "return_requests"("status");

-- Add index on createdAt for sorting
CREATE INDEX IF NOT EXISTS "return_requests_createdAt_idx" ON "return_requests"("createdAt");
