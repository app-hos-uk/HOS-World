-- Migration: Add Product Types, Volume Pricing, Bundle Items
-- This migration adds product type support, volume pricing, and bundle products

-- 1. Create ProductType enum
DO $$ BEGIN
    CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIANT', 'BUNDLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add productType and parentProductId to products table
ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "productType" "ProductType" NOT NULL DEFAULT 'SIMPLE',
    ADD COLUMN IF NOT EXISTS "parentProductId" TEXT;

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS "products_productType_idx" ON "products"("productType");
CREATE INDEX IF NOT EXISTS "products_parentProductId_idx" ON "products"("parentProductId");

-- 4. Add foreign key constraint for parentProductId (self-reference)
DO $$ BEGIN
    ALTER TABLE "products"
        ADD CONSTRAINT "products_parentProductId_fkey"
        FOREIGN KEY ("parentProductId")
        REFERENCES "products"("id")
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create product_bundle_items table
CREATE TABLE IF NOT EXISTS "product_bundle_items" (
    "id" TEXT NOT NULL,
    "bundleProductId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceOverride" DECIMAL(10,2),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT "product_bundle_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_bundle_items_bundleProductId_productId_key" UNIQUE ("bundleProductId", "productId")
);

-- 6. Add foreign keys for product_bundle_items
DO $$ BEGIN
    ALTER TABLE "product_bundle_items"
        ADD CONSTRAINT "product_bundle_items_bundleProductId_fkey"
        FOREIGN KEY ("bundleProductId")
        REFERENCES "products"("id")
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "product_bundle_items"
        ADD CONSTRAINT "product_bundle_items_productId_fkey"
        FOREIGN KEY ("productId")
        REFERENCES "products"("id")
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Add indexes for product_bundle_items
CREATE INDEX IF NOT EXISTS "product_bundle_items_bundleProductId_idx" ON "product_bundle_items"("bundleProductId");
CREATE INDEX IF NOT EXISTS "product_bundle_items_productId_idx" ON "product_bundle_items"("productId");

-- 8. Create volume_pricing table
CREATE TABLE IF NOT EXISTS "volume_pricing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "volume_pricing_pkey" PRIMARY KEY ("id")
);

-- 9. Add foreign key for volume_pricing
DO $$ BEGIN
    ALTER TABLE "volume_pricing"
        ADD CONSTRAINT "volume_pricing_productId_fkey"
        FOREIGN KEY ("productId")
        REFERENCES "products"("id")
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 10. Add indexes for volume_pricing
CREATE INDEX IF NOT EXISTS "volume_pricing_productId_idx" ON "volume_pricing"("productId");
CREATE INDEX IF NOT EXISTS "volume_pricing_minQuantity_idx" ON "volume_pricing"("minQuantity");
CREATE INDEX IF NOT EXISTS "volume_pricing_isActive_idx" ON "volume_pricing"("isActive");

-- 11. Update existing products to have SIMPLE type (already set as default)
-- No action needed as default is already SIMPLE

-- 12. Create trigger to update updatedAt for volume_pricing
CREATE OR REPLACE FUNCTION update_volume_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volume_pricing_updated_at
    BEFORE UPDATE ON "volume_pricing"
    FOR EACH ROW
    EXECUTE FUNCTION update_volume_pricing_updated_at();
