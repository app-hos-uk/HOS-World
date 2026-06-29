CREATE TABLE IF NOT EXISTS "disputes" (
    "id" TEXT NOT NULL,
    "stripeDisputeId" TEXT,
    "orderId" TEXT,
    "transactionId" TEXT,
    "sellerId" TEXT,
    "customerId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceDeadline" TIMESTAMP(3),
    "evidenceSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "disputes_stripeDisputeId_key" ON "disputes"("stripeDisputeId");
CREATE INDEX IF NOT EXISTS "disputes_status_idx" ON "disputes"("status");
CREATE INDEX IF NOT EXISTS "disputes_sellerId_idx" ON "disputes"("sellerId");
CREATE INDEX IF NOT EXISTS "disputes_orderId_idx" ON "disputes"("orderId");
CREATE INDEX IF NOT EXISTS "disputes_createdAt_idx" ON "disputes"("createdAt");

ALTER TABLE "disputes" ADD CONSTRAINT "disputes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
