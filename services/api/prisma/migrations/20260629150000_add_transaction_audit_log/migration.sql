CREATE TABLE IF NOT EXISTS "transaction_audit_logs" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transaction_audit_logs_transactionId_idx" ON "transaction_audit_logs"("transactionId");
CREATE INDEX IF NOT EXISTS "transaction_audit_logs_createdAt_idx" ON "transaction_audit_logs"("createdAt");

ALTER TABLE "transaction_audit_logs"
  ADD CONSTRAINT "transaction_audit_logs_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_audit_logs"
  ADD CONSTRAINT "transaction_audit_logs_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
