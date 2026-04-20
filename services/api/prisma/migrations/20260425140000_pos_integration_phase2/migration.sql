-- Phase 2: POS integration — idempotent additions

ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "autoSyncProducts" BOOLEAN DEFAULT true;
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "autoSyncInventory" BOOLEAN DEFAULT true;
ALTER TABLE "pos_connections" ADD COLUMN IF NOT EXISTS "syncIntervalMinutes" INTEGER DEFAULT 60;

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "externalStoreId" TEXT;

CREATE TABLE IF NOT EXISTS "pos_sales" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "externalSaleId" TEXT NOT NULL,
  "externalInvoice" TEXT,
  "provider" TEXT NOT NULL,
  "saleDate" TIMESTAMP(3) NOT NULL,
  "customerId" TEXT,
  "customerEmail" TEXT,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
  "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'IMPORTED',
  "rawPayload" JSONB,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_sale_items" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "productId" TEXT,
  "externalProductId" TEXT,
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "totalPrice" DECIMAL(10,2) NOT NULL,
  "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT "pos_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_sales_provider_externalSaleId_key" ON "pos_sales"("provider", "externalSaleId");
CREATE INDEX IF NOT EXISTS "pos_sales_storeId_idx" ON "pos_sales"("storeId");
CREATE INDEX IF NOT EXISTS "pos_sales_customerId_idx" ON "pos_sales"("customerId");
CREATE INDEX IF NOT EXISTS "pos_sales_saleDate_idx" ON "pos_sales"("saleDate");

CREATE INDEX IF NOT EXISTS "pos_sale_items_saleId_idx" ON "pos_sale_items"("saleId");
CREATE INDEX IF NOT EXISTS "pos_sale_items_productId_idx" ON "pos_sale_items"("productId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_sales_storeId_fkey') THEN
    ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_sale_items_saleId_fkey') THEN
    ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_sale_items_productId_fkey') THEN
    ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
