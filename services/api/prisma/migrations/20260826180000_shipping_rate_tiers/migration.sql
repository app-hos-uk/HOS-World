CREATE TABLE IF NOT EXISTS "shipping_rate_tiers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "countryCodes" JSONB NOT NULL,
  "isCatchAll" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_rate_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shipping_rate_tiers_code_key" ON "shipping_rate_tiers"("code");
CREATE INDEX IF NOT EXISTS "shipping_rate_tiers_isActive_idx" ON "shipping_rate_tiers"("isActive");
CREATE INDEX IF NOT EXISTS "shipping_rate_tiers_sortOrder_idx" ON "shipping_rate_tiers"("sortOrder");

CREATE TABLE IF NOT EXISTS "box_size_rates" (
  "id" TEXT NOT NULL,
  "boxSizeId" TEXT NOT NULL,
  "tierId" TEXT NOT NULL,
  "customerPrice" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "box_size_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "box_size_rates_boxSizeId_tierId_key" ON "box_size_rates"("boxSizeId", "tierId");
CREATE INDEX IF NOT EXISTS "box_size_rates_tierId_idx" ON "box_size_rates"("tierId");

ALTER TABLE "box_size_rates" ADD CONSTRAINT "box_size_rates_boxSizeId_fkey"
  FOREIGN KEY ("boxSizeId") REFERENCES "box_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "box_size_rates" ADD CONSTRAINT "box_size_rates_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "shipping_rate_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
