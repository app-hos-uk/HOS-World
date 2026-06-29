-- Add CANCELLATION_REQUESTED to OrderStatus
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLATION_REQUESTED';

-- Create CancellationStatus enum
CREATE TYPE "CancellationStatus" AS ENUM (
  'PENDING_SELLER',
  'SELLER_APPROVED',
  'PENDING_FINANCE',
  'FINANCE_APPROVED',
  'APPROVED',
  'REJECTED',
  'ESCALATED',
  'AUTO_APPROVED'
);

-- Create cancellation_requests table
CREATE TABLE "cancellation_requests" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reason" TEXT,
  "status" "CancellationStatus" NOT NULL DEFAULT 'PENDING_SELLER',
  "previousStatus" "OrderStatus" NOT NULL,
  "sellerReviewedById" TEXT,
  "sellerReviewedAt" TIMESTAMP(3),
  "sellerNotes" TEXT,
  "financeReviewedById" TEXT,
  "financeReviewedAt" TIMESTAMP(3),
  "financeNotes" TEXT,
  "escalatedAt" TIMESTAMP(3),
  "escalationReason" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "adminNotes" TEXT,
  "autoApproved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cancellation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cancellation_requests_orderId_idx" ON "cancellation_requests"("orderId");
CREATE INDEX "cancellation_requests_requestedById_idx" ON "cancellation_requests"("requestedById");
CREATE INDEX "cancellation_requests_status_idx" ON "cancellation_requests"("status");
CREATE INDEX "cancellation_requests_createdAt_idx" ON "cancellation_requests"("createdAt");

ALTER TABLE "cancellation_requests"
  ADD CONSTRAINT "cancellation_requests_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cancellation_requests"
  ADD CONSTRAINT "cancellation_requests_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANCELLATION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANCELLATION_SELLER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANCELLATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANCELLATION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANCELLATION_ESCALATED';
