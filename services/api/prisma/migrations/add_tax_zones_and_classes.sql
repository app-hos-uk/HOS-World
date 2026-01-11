-- Migration: Add Tax Zones, Tax Classes, and Tax Rates
-- Date: 2025-01-XX
-- Description: Adds tax zone system for location-based tax calculation (Phase 3 feature)

-- Create TaxZone table
CREATE TABLE IF NOT EXISTS "tax_zones" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "state" TEXT,
  "city" TEXT,
  "postalCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tax_zones_pkey" PRIMARY KEY ("id")
);

-- Create TaxClass table
CREATE TABLE IF NOT EXISTS "tax_classes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tax_classes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tax_classes_name_key" UNIQUE ("name")
);

-- Create TaxRate table
CREATE TABLE IF NOT EXISTS "tax_rates" (
  "id" TEXT NOT NULL,
  "taxZoneId" TEXT NOT NULL,
  "taxClassId" TEXT,
  "rate" DECIMAL(5, 4) NOT NULL,
  "isInclusive" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tax_rates_taxZoneId_taxClassId_key" UNIQUE ("taxZoneId", "taxClassId")
);

-- Create indexes for TaxZone
CREATE INDEX IF NOT EXISTS "tax_zones_country_idx" ON "tax_zones"("country");
CREATE INDEX IF NOT EXISTS "tax_zones_isActive_idx" ON "tax_zones"("isActive");

-- Create indexes for TaxRate
CREATE INDEX IF NOT EXISTS "tax_rates_taxZoneId_idx" ON "tax_rates"("taxZoneId");
CREATE INDEX IF NOT EXISTS "tax_rates_taxClassId_idx" ON "tax_rates"("taxClassId");
CREATE INDEX IF NOT EXISTS "tax_rates_isActive_idx" ON "tax_rates"("isActive");

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_taxZoneId_fkey" FOREIGN KEY ("taxZoneId") REFERENCES "tax_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "tax_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add taxClassId column to products table if it doesn't exist
DO $$ BEGIN
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "taxClassId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add foreign key from products to tax_classes
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "tax_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create index on products.taxClassId
CREATE INDEX IF NOT EXISTS "products_taxClassId_idx" ON "products"("taxClassId");
