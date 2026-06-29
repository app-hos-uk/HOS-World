CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalMatched" INTEGER NOT NULL DEFAULT 0,
    "totalMismatched" INTEGER NOT NULL DEFAULT 0,
    "totalMissing" INTEGER NOT NULL DEFAULT 0,
    "totalExtra" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "startedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reconciliation_items" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "transactionId" TEXT,
    "stripeChargeId" TEXT,
    "internalAmount" DECIMAL(10,2),
    "stripeAmount" DECIMAL(10,2),
    "currency" TEXT,
    "discrepancyAmount" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reconciliation_runs_status_idx" ON "reconciliation_runs"("status");
CREATE INDEX IF NOT EXISTS "reconciliation_runs_createdAt_idx" ON "reconciliation_runs"("createdAt");
CREATE INDEX IF NOT EXISTS "reconciliation_items_runId_idx" ON "reconciliation_items"("runId");
CREATE INDEX IF NOT EXISTS "reconciliation_items_status_idx" ON "reconciliation_items"("status");

ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_runId_fkey" FOREIGN KEY ("runId") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
