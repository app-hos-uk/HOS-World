-- Admin-managed carriers for seller manual tracking entry
CREATE TABLE IF NOT EXISTS "shipping_carriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "trackingUrlTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowCustomName" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_carriers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shipping_carriers_name_key" ON "shipping_carriers"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_carriers_code_key" ON "shipping_carriers"("code");
CREATE INDEX IF NOT EXISTS "shipping_carriers_isActive_sortOrder_idx" ON "shipping_carriers"("isActive", "sortOrder");
