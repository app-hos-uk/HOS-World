-- Add CHECK constraint to prevent negative stock (overselling) at database level
-- This is the last line of defense — even under concurrent transactions,
-- PostgreSQL will reject any UPDATE that would make stock negative.

DO $$
BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("stock" >= 0);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint products_stock_non_negative already exists, skipping';
END $$;

DO $$
BEGIN
  ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_stock_non_negative" CHECK ("vendorStock" >= 0);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint vendor_products_stock_non_negative already exists, skipping';
END $$;

DO $$
BEGIN
  ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_quantity_non_negative" CHECK ("quantity" >= 0);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint inventory_locations_quantity_non_negative already exists, skipping';
END $$;
