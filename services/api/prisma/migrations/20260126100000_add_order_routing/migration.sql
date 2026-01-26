-- Add latitude and longitude to Address for geo-based routing
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Add indexes on addresses for performance
CREATE INDEX IF NOT EXISTS "addresses_userId_idx" ON "addresses"("userId");
CREATE INDEX IF NOT EXISTS "addresses_country_idx" ON "addresses"("country");
CREATE INDEX IF NOT EXISTS "addresses_city_idx" ON "addresses"("city");

-- Add new fields to fulfillment_centers
ALTER TABLE "fulfillment_centers" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "fulfillment_centers" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "fulfillment_centers" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "fulfillment_centers" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "fulfillment_centers" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "fulfillment_centers" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

-- Add indexes on fulfillment_centers for performance
CREATE INDEX IF NOT EXISTS "fulfillment_centers_isActive_idx" ON "fulfillment_centers"("isActive");
CREATE INDEX IF NOT EXISTS "fulfillment_centers_city_idx" ON "fulfillment_centers"("city");
CREATE INDEX IF NOT EXISTS "fulfillment_centers_country_idx" ON "fulfillment_centers"("country");

-- Add new fields to warehouses
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "managerName" TEXT;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "warehouseType" TEXT DEFAULT 'DISTRIBUTION';

-- Add indexes on warehouses for performance
CREATE INDEX IF NOT EXISTS "warehouses_city_idx" ON "warehouses"("city");
CREATE INDEX IF NOT EXISTS "warehouses_country_idx" ON "warehouses"("country");

-- Add fulfillment routing fields to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillingWarehouseId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillmentCenterId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimatedDistance" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "routingMethod" TEXT;

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillingWarehouseId_fkey') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillingWarehouseId_fkey" 
        FOREIGN KEY ("fulfillingWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillmentCenterId_fkey') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillmentCenterId_fkey" 
        FOREIGN KEY ("fulfillmentCenterId") REFERENCES "fulfillment_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add indexes on orders for performance
CREATE INDEX IF NOT EXISTS "orders_fulfillingWarehouseId_idx" ON "orders"("fulfillingWarehouseId");
CREATE INDEX IF NOT EXISTS "orders_fulfillmentCenterId_idx" ON "orders"("fulfillmentCenterId");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON "orders"("userId");
CREATE INDEX IF NOT EXISTS "orders_sellerId_idx" ON "orders"("sellerId");
