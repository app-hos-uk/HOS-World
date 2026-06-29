CREATE TABLE IF NOT EXISTS "financial_periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "totalRevenue" DECIMAL(12,2),
    "totalRefunds" DECIMAL(12,2),
    "totalPayouts" DECIMAL(12,2),
    "totalFees" DECIMAL(12,2),
    "netIncome" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "financial_periods_year_month_key" ON "financial_periods"("year", "month");

ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
