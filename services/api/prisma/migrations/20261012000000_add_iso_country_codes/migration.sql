-- Add countryCode fields to all models collecting country data
-- Preserves existing data in 'country' field for audit trail

-- User profile
ALTER TABLE "users" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "users_countryCode_idx" ON "users"("countryCode");

-- Store locations
ALTER TABLE "stores" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "stores_countryCode_idx" ON "stores"("countryCode");

-- Customer profiles  
ALTER TABLE "customers" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "customers_countryCode_idx" ON "customers"("countryCode");

-- Seller/merchant profiles
ALTER TABLE "sellers" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "sellers_countryCode_idx" ON "sellers"("countryCode");

-- Shipping/billing addresses
ALTER TABLE "addresses" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "addresses_countryCode_idx" ON "addresses"("countryCode");

-- Fulfillment centers
ALTER TABLE "fulfillment_centers" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "fulfillment_centers_countryCode_idx" ON "fulfillment_centers"("countryCode");

-- Logistics partners
ALTER TABLE "logistics_partners" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "logistics_partners_countryCode_idx" ON "logistics_partners"("countryCode");

-- Warehouses
ALTER TABLE "warehouses" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "warehouses_countryCode_idx" ON "warehouses"("countryCode");

-- Tax zones
ALTER TABLE "tax_zones" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "tax_zones_countryCode_idx" ON "tax_zones"("countryCode");

-- Founding members
ALTER TABLE "founding_members" ADD COLUMN "countryCode" VARCHAR(2);
CREATE INDEX "founding_members_countryCode_idx" ON "founding_members"("countryCode");
